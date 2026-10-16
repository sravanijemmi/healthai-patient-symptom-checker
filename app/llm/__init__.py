from __future__ import annotations

import json
import re
from typing import Any, Optional

from pydantic import ValidationError

from app.config import get_settings
from app.llm.base import LlmClient, LlmResult
from app.llm.prompts import DISCLAIMER, SYSTEM_PROMPT, build_user_prompt
from app.llm.provider import GroqClient
from app.preprocessing import PreprocessResult
from app.schemas import HealthCondition, ModelResponse

__all__ = [
    "DISCLAIMER",
    "LlmClient",
    "LlmResult",
    "GroqClient",
    "analyze_symptoms",
]

_MEDICATION_ADVICE_RE = re.compile(
    r"\b(?:otc|over[ -]?the[ -]?counter|medications?|medicines?|drugs?|"
    r"antibiotics?|antivirals?|prescriptions?|prescribe|pain relief)\b",
    re.IGNORECASE,
)
_SAFE_NEXT_STEP = "Discuss treatment options with a qualified clinician."


def _normalize_condition(raw: HealthCondition) -> HealthCondition:
    reasoning = raw.reasoning or raw.description or "Possible match based on reported symptoms."
    description = raw.description or reasoning
    step = raw.suggested_next_step or (
        "Discuss these symptoms with a clinician if they persist or worsen."
    )
    if _MEDICATION_ADVICE_RE.search(step):
        step = _SAFE_NEXT_STEP
    return HealthCondition(
        name=raw.name,
        description=description,
        likelihood=raw.likelihood,
        reasoning=reasoning,
        suggestedNextStep=step,
    )


def _parse_model_json(content: str) -> ModelResponse:
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError("MALFORMED_JSON") from exc
    try:
        return ModelResponse.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError("MALFORMED_JSON") from exc


def _map_api_error(error: Exception) -> RuntimeError:
    msg = str(error).lower()
    if "429" in msg or "rate limit" in msg:
        return RuntimeError(
            "The AI service is rate-limiting requests right now. Please wait a moment and try again."
        )
    if "timeout" in msg or "timed out" in msg:
        return RuntimeError("The language model timed out. Please try again.")
    if "groq_api_key" in msg or "api key" in msg:
        return RuntimeError(str(error))
    return RuntimeError(
        "We could not complete the analysis right now. Please try again in a moment."
    )


def analyze_symptoms(
    preprocessed: PreprocessResult,
    age: int | None = None,
    sex: str | None = None,
    client: Optional[LlmClient] = None,
) -> dict[str, Any]:
    settings = get_settings()
    if client is None:
        if not settings.groq_api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Add it to your .env file "
                "(free key: https://console.groq.com/keys)."
            )
        client = GroqClient(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
            timeout=settings.llm_timeout_seconds,
        )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_prompt(preprocessed, age, sex)},
    ]

    last_error: Exception | None = None
    last_usage: LlmResult | None = None
    for attempt in range(1, 3):
        try:
            result = client.complete(
                messages=messages,
                model=settings.llm_model,
                temperature=settings.llm_temperature,
            )
            last_usage = result
            data = _parse_model_json(result.content)
            conditions = [_normalize_condition(c) for c in data.conditions[:6]]
            return {
                "summary": data.summary,
                "urgency": data.urgency,
                "conditions": [c.model_dump(by_alias=True) for c in conditions],
                "disclaimer": data.disclaimer or DISCLAIMER,
                "model": settings.llm_model,
                "prompt_tokens": result.prompt_tokens,
                "completion_tokens": result.completion_tokens,
                "total_tokens": result.total_tokens,
                "attempts": attempt,
            }
        except ValueError as exc:
            last_error = exc
            if str(exc) != "MALFORMED_JSON" or attempt == 2:
                break
        except Exception as exc:  # noqa: BLE001
            raise _map_api_error(exc) from exc

    if last_error and str(last_error) == "MALFORMED_JSON":
        raise RuntimeError(
            "The AI returned an unexpected format after a retry. Please try again."
        )
    raise _map_api_error(last_error or RuntimeError("Unknown LLM failure"))
