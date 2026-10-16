from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from threading import Lock
from typing import Any

LOG_DIR = Path(__file__).resolve().parent.parent / "data"
LOG_FILE = LOG_DIR / "submissions.jsonl"
MAX_STORED = 50
MIN_REQUIRED = 10
_write_lock = Lock()


def _ensure_log_file() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    if not LOG_FILE.exists():
        LOG_FILE.write_text("", encoding="utf-8")


def create_log_id() -> str:
    return f"log_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"


def read_all_entries() -> list[dict[str, Any]]:
    _ensure_log_file()
    raw = LOG_FILE.read_text(encoding="utf-8")
    if not raw.strip():
        return []
    entries: list[dict[str, Any]] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return entries


def read_logs(limit: int = MIN_REQUIRED) -> list[dict[str, Any]]:
    entries = read_all_entries()
    take = max(limit, MIN_REQUIRED)
    return list(reversed(entries[-take:]))


def append_log(entry: dict[str, Any]) -> None:
    with _write_lock:
        entries = read_all_entries()
        entries.append(entry)
        trimmed = entries[-MAX_STORED:]
        payload = "\n".join(json.dumps(item, ensure_ascii=False) for item in trimmed) + "\n"
        LOG_FILE.write_text(payload, encoding="utf-8")
