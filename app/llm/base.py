from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol


@dataclass
class LlmResult:
    content: str
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


class LlmClient(Protocol):
    """Swap real providers or inject a fake client in tests."""

    def complete(
        self,
        messages: list[dict[str, str]],
        model: str,
        temperature: float,
    ) -> LlmResult:
        ...
