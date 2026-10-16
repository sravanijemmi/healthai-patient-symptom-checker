from __future__ import annotations

import re
from dataclasses import dataclass


EMERGENCY_PATTERNS: list[tuple[str, str, re.Pattern[str]]] = [
    (
        "chest_pain",
        "Chest pain",
        re.compile(r"\b(chest\s*pain|chestpain|heart\s*attack|crushing\s*chest)\b", re.I),
    ),
    (
        "breathing",
        "Severe breathing difficulty",
        re.compile(
            r"\b(can'?t\s*breathe|cannot\s*breathe|hard\s*to\s*breathe|"
            r"short(ness)?\s*of\s*breath|choking|gasping)\b",
            re.I,
        ),
    ),
    (
        "stroke",
        "Possible stroke signs",
        re.compile(
            r"\b(stroke|face\s*droop|arm\s*weakness|slurred\s*speech|"
            r"sudden\s*numbness|one[- ]sided\s*weakness)\b",
            re.I,
        ),
    ),
    (
        "suicide",
        "Suicidal thoughts / self-harm",
        re.compile(
            r"\b(suicid(e|al)|kill\s*myself|end\s*my\s*life|self[- ]?harm|want\s*to\s*die)\b",
            re.I,
        ),
    ),
    (
        "severe_bleeding",
        "Severe bleeding / trauma",
        re.compile(
            r"\b(uncontrollable\s*bleeding|severe\s*bleeding|passed\s*out|unconscious|seizure)\b",
            re.I,
        ),
    ),
    (
        "anaphylaxis",
        "Possible severe allergic reaction",
        re.compile(r"\b(anaphylaxis|throat\s*swelling|tongue\s*swelling|epipen)\b", re.I),
    ),
    (
        "neck_stiffness_with_fever_or_headache",
        "Neck stiffness with fever or headache",
        re.compile(
            r"(?=.*\b(?:neck\s*stiffness|stiff\s*neck)\b)"
            r"(?=.*\b(?:fever|headache)\b)",
            re.I | re.S,
        ),
    ),
    (
        "severe_headache",
        "Severe or sudden headache",
        re.compile(
            r"(?=.*\b(?:headache|head\s+pain|head.{0,30}pain|pain.{0,30}head)\b)"
            r"(?=.*\b(?:sudden|severe|worst|extreme|unbearable|too\s*much)\b)",
            re.I | re.S,
        ),
    ),
]


@dataclass
class EmergencyCheck:
    is_emergency: bool
    flags: list[str]
    message: str | None


def detect_emergency(text: str) -> EmergencyCheck:
    flags: list[str] = []
    for _, label, pattern in EMERGENCY_PATTERNS:
        if pattern.search(text or ""):
            flags.append(label)

    if not flags:
        return EmergencyCheck(False, [], None)

    return EmergencyCheck(
        True,
        flags,
        "Emergency warning: Your description may include urgent symptoms ("
        + "; ".join(flags)
        + "). If you or someone else is in immediate danger, call local emergency "
        "services now. Do not wait for this app's analysis.",
    )
