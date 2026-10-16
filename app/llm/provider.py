from __future__ import annotations

from openai import OpenAI

from app.llm.base import LlmResult

_GPT_OSS_MODELS = {"openai/gpt-oss-20b", "openai/gpt-oss-120b"}
_MAX_COMPLETION_TOKENS = 768


class GroqClient:
    """Real Groq implementation (OpenAI-compatible API)."""

    def __init__(self, api_key: str, base_url: str, timeout: float) -> None:
        self._client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=0,
        )

    def complete(
        self,
        messages: list[dict[str, str]],
        model: str,
        temperature: float,
    ) -> LlmResult:
        request = {
            "model": model,
            "temperature": temperature,
            "max_completion_tokens": _MAX_COMPLETION_TOKENS,
            "response_format": {"type": "json_object"},
            "messages": messages,
        }
        if model in _GPT_OSS_MODELS:
            request["extra_body"] = {
                "reasoning_effort": "low",
                "include_reasoning": False,
            }

        completion = self._client.chat.completions.create(**request)
        content = completion.choices[0].message.content
        if not content:
            raise RuntimeError(
                "The language model returned an empty response. Please try again."
            )
        usage = completion.usage
        return LlmResult(
            content=content,
            prompt_tokens=getattr(usage, "prompt_tokens", None) if usage else None,
            completion_tokens=getattr(usage, "completion_tokens", None) if usage else None,
            total_tokens=getattr(usage, "total_tokens", None) if usage else None,
        )
