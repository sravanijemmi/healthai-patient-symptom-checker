from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from app.cache import get_cached, set_cached
from app.config import get_settings
from app.llm import LlmClient, analyze_symptoms
from app.logging_config import log_event
from app.logger import append_log, create_log_id
from app.preprocessing import preprocess_symptoms, validate_symptoms
from app.rate_limit import check_rate_limit
from app.safety import EmergencyCheck, detect_emergency


@dataclass
class ServiceResult:
    ok: bool
    status_code: int
    payload: dict[str, Any]


def run_analysis(
    symptoms: str,
    age: int | None = None,
    sex: str | None = None,
    client: Optional[LlmClient] = None,
    rate_limit_key: str | None = None,
) -> ServiceResult:
    """
    Orchestrates: preprocess → safety → cache/LLM → validate → log.
    Routes stay thin; this is the main application logic.
    """
    started = time.time()
    request_id = create_log_id()
    settings = get_settings()
    emergency: EmergencyCheck = detect_emergency(symptoms)
    preprocessed = preprocess_symptoms(symptoms)
    validation_error = validate_symptoms(preprocessed)

    def latency_ms() -> int:
        return int((time.time() - started) * 1000)

    def base_log(**extra: Any) -> dict[str, Any]:
        entry = {
            "id": request_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cleanedSymptoms": preprocessed.symptoms,
            "corrections": preprocessed.corrections,
            "patientContext": {"age": age, "sex": sex},
            "latencyMs": latency_ms(),
            "emergencyFlags": emergency.flags,
            "model": settings.llm_model,
        }
        if settings.log_raw_input:
            entry["originalInput"] = preprocessed.original
        else:
            entry["originalInput"] = "[redacted]"
        entry.update(extra)
        return entry

    if validation_error:
        append_log(base_log(modelResponse=None, error=validation_error))
        log_event(
            "analyze_rejected",
            request_id=request_id,
            reason=validation_error,
            cleaned_symptoms=preprocessed.symptoms,
            latency_ms=latency_ms(),
            model=settings.llm_model,
        )
        return ServiceResult(
            False,
            422,
            {
                "error": validation_error,
                "emergency": emergency.is_emergency,
                "emergency_message": emergency.message,
                "emergency_flags": emergency.flags,
            },
        )

    cache_key = f"{preprocessed.cleaned_text}|{age}|{sex}"
    cached = get_cached(cache_key)
    if cached:
        result = {
            **cached,
            "latency_ms": latency_ms(),
            "original_input": preprocessed.original,
            "cleaned_symptoms": preprocessed.symptoms,
            "corrections": preprocessed.corrections,
            "truncated": preprocessed.truncated,
            "cached": True,
            "emergency": emergency.is_emergency,
            "emergency_message": emergency.message,
            "emergency_flags": emergency.flags,
        }
        append_log(
            base_log(
                modelResponse={
                    "summary": result["summary"],
                    "urgency": result["urgency"],
                    "conditions": result["conditions"],
                },
                error=None,
            )
        )
        log_event(
            "analyze_cache_hit",
            request_id=request_id,
            cleaned_symptoms=preprocessed.symptoms,
            latency_ms=result["latency_ms"],
            model=settings.llm_model,
        )
        return ServiceResult(True, 200, result)

    if rate_limit_key is not None:
        rate = check_rate_limit(rate_limit_key)
        if not rate.allowed:
            return ServiceResult(
                False,
                429,
                {
                    "error": f"Too many requests. Please wait {rate.retry_after_sec}s and try again.",
                    "retry_after_sec": rate.retry_after_sec,
                },
            )

    try:
        analysis = analyze_symptoms(preprocessed, age=age, sex=sex, client=client)
        urgency = "emergency" if emergency.is_emergency else analysis["urgency"]
        result = {
            "summary": analysis["summary"],
            "urgency": urgency,
            "conditions": analysis["conditions"],
            "disclaimer": analysis["disclaimer"],
            "original_input": preprocessed.original,
            "cleaned_symptoms": preprocessed.symptoms,
            "corrections": preprocessed.corrections,
            "latency_ms": latency_ms(),
            "cached": False,
            "truncated": preprocessed.truncated,
            "emergency": emergency.is_emergency,
            "emergency_message": emergency.message,
            "emergency_flags": emergency.flags,
        }
        set_cached(cache_key, result)
        append_log(
            base_log(
                modelResponse={
                    "summary": result["summary"],
                    "urgency": result["urgency"],
                    "conditions": result["conditions"],
                },
                error=None,
                prompt_tokens=analysis.get("prompt_tokens"),
                completion_tokens=analysis.get("completion_tokens"),
                total_tokens=analysis.get("total_tokens"),
            )
        )
        log_event(
            "analyze_ok",
            request_id=request_id,
            cleaned_symptoms=preprocessed.symptoms,
            latency_ms=result["latency_ms"],
            model=settings.llm_model,
            prompt_tokens=analysis.get("prompt_tokens"),
            completion_tokens=analysis.get("completion_tokens"),
            total_tokens=analysis.get("total_tokens"),
            attempts=analysis.get("attempts"),
        )
        return ServiceResult(True, 200, result)
    except Exception as exc:  # noqa: BLE001
        message = str(exc)
        if not message or "Traceback" in message:
            message = "We could not complete the analysis right now. Please try again."
        append_log(base_log(modelResponse=None, error=message))
        log_event(
            "analyze_error",
            request_id=request_id,
            cleaned_symptoms=preprocessed.symptoms,
            latency_ms=latency_ms(),
            model=settings.llm_model,
            error=message,
        )
        status = 503 if "GROQ_API_KEY" in message else 502
        if "timed out" in message.lower():
            status = 504
        if "rate-limit" in message.lower():
            status = 429
        return ServiceResult(
            False,
            status,
            {
                "error": message,
                "emergency": emergency.is_emergency,
                "emergency_message": emergency.message,
                "emergency_flags": emergency.flags,
            },
        )
