from __future__ import annotations

import time
from dataclasses import dataclass
from threading import Lock

from app.config import get_settings


@dataclass
class RateLimitResult:
    allowed: bool
    remaining: int
    retry_after_sec: int


_buckets: dict[str, dict[str, float | int]] = {}
_lock = Lock()


def check_rate_limit(key: str) -> RateLimitResult:
    settings = get_settings()
    window_ms = 60_000
    max_requests = settings.rate_limit_per_minute
    now = time.time() * 1000
    with _lock:
        existing = _buckets.get(key)

        if not existing or float(existing["reset_at"]) <= now:
            _buckets[key] = {"count": 1, "reset_at": now + window_ms}
            return RateLimitResult(True, max_requests - 1, 0)

        count = int(existing["count"])
        if count >= max_requests:
            retry = int(max(0, (float(existing["reset_at"]) - now) / 1000))
            return RateLimitResult(False, 0, retry)

        existing["count"] = count + 1
        return RateLimitResult(True, max_requests - count - 1, 0)
