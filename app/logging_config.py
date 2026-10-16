from __future__ import annotations

import json
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from app.config import get_settings

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_FILE = LOG_DIR / "app.log"

_configured = False


def setup_logging() -> logging.Logger:
    global _configured
    logger = logging.getLogger("healthai")
    if _configured:
        return logger

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=1_000_000,
        backupCount=3,
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    logger.propagate = False
    _configured = True
    return logger


def log_event(event: str, **fields: Any) -> None:
    """Write one JSON line to the rotating app log (no IPs / names)."""
    settings = get_settings()
    payload = {"event": event, **fields}
    if not settings.log_raw_input:
        payload.pop("raw_input", None)
        payload.pop("originalInput", None)
    setup_logging().info(json.dumps(payload, ensure_ascii=False, default=str))
