from __future__ import annotations

import time
from collections import OrderedDict
from threading import Lock
from typing import Any

_TTL_MS = 5 * 60_000
_MAX_ITEMS = 128
_store: OrderedDict[str, dict[str, Any]] = OrderedDict()
_lock = Lock()


def get_cached(key: str) -> dict[str, Any] | None:
    with _lock:
        hit = _store.get(key)
        if not hit:
            return None
        if float(hit["expires_at"]) < time.time() * 1000:
            _store.pop(key, None)
            return None
        _store.move_to_end(key)
        return hit["value"]


def set_cached(key: str, value: dict[str, Any]) -> None:
    with _lock:
        _store[key] = {"value": value, "expires_at": time.time() * 1000 + _TTL_MS}
        _store.move_to_end(key)
        while len(_store) > _MAX_ITEMS:
            _store.popitem(last=False)
