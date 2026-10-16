from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from app.config import get_settings
from app.dictionary import PHRASE_CORRECTIONS, SYMPTOM_CORRECTIONS

MIN_MEANINGFUL_LENGTH = 3


@dataclass
class PreprocessResult:
    original: str
    cleaned_text: str
    symptoms: list[str]
    corrections: list[dict[str, str]] = field(default_factory=list)
    truncated: bool = False


def _collapse_spaces_keep_newlines(text: str) -> str:
    text = re.sub(r"[^\S\n\r]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return text.strip()


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]*>", " ", text)
    return (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )


def _strip_control_chars(text: str) -> str:
    # Keep newlines for splitting; drop other controls.
    return re.sub(r"[\x00-\x09\x0b\x0c\x0e-\x1f\x7f-\x9f]", " ", text)


def _apply_phrase_corrections(text: str) -> tuple[str, list[dict[str, str]]]:
    corrections: list[dict[str, str]] = []
    result = text
    for pattern, replacement in PHRASE_CORRECTIONS:
        matches = pattern.findall(result)
        for match in matches:
            from_val = match.lower() if isinstance(match, str) else str(match).lower()
            if from_val != replacement:
                corrections.append({"from": from_val, "to": replacement})
        result = pattern.sub(replacement, result)
    return result, corrections


def _tokenize(text: str) -> list[str]:
    parts = re.split(r"[\n\r]+|[,;/|]+|\band\b|\bwith\b|\balso\b", text, flags=re.I)
    tokens: list[str] = []
    for part in parts:
        cleaned = re.sub(r"[^\w\s'-]", " ", part)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if len(cleaned) >= 2:
            tokens.append(cleaned)
    return tokens


def _correct_token(token: str) -> tuple[str, dict[str, str] | None]:
    lower = token.lower()
    compact = re.sub(r"\s+", "", lower)

    if lower in SYMPTOM_CORRECTIONS:
        value = SYMPTOM_CORRECTIONS[lower]
        return value, {"from": lower, "to": value}
    if compact in SYMPTOM_CORRECTIONS:
        value = SYMPTOM_CORRECTIONS[compact]
        return value, {"from": lower, "to": value}

    words = lower.split()
    changed = False
    corrected: list[str] = []
    for word in words:
        if word in SYMPTOM_CORRECTIONS:
            changed = True
            corrected.append(SYMPTOM_CORRECTIONS[word])
        else:
            corrected.append(word)
    if changed:
        value = " ".join(corrected)
        return value, {"from": lower, "to": value}
    return lower, None


def _looks_like_gibberish(symptoms: list[str], original: str) -> bool:
    letters = re.sub(r"[^a-zA-Z]", "", original)
    if len(letters) < 3:
        return True
    vowels = len(re.findall(r"[aeiouAEIOU]", letters))
    if vowels / max(len(letters), 1) < 0.12 and len(letters) > 8:
        return True
    smash = [s for s in symptoms if not re.search(r"[aeiou]", s, re.I) and len(s) > 4]
    return bool(symptoms) and len(smash) == len(symptoms)


def preprocess_symptoms(raw_input: str) -> PreprocessResult:
    settings = get_settings()
    original = raw_input or ""
    truncated = False

    text = unicodedata.normalize("NFKC", original)
    text = _strip_html(text)
    text = _strip_control_chars(text)
    text = _collapse_spaces_keep_newlines(text)

    if len(text) > settings.max_input_length:
        text = text[: settings.max_input_length]
        truncated = True

    text, phrase_corrections = _apply_phrase_corrections(text)
    text = text.lower()

    corrections = list(phrase_corrections)
    symptoms: list[str] = []
    for token in _tokenize(text):
        value, correction = _correct_token(token)
        if correction:
            corrections.append(correction)
        if len(value) >= MIN_MEANINGFUL_LENGTH:
            symptoms.append(value)

    seen: set[str] = set()
    unique: list[str] = []
    for symptom in symptoms:
        if symptom not in seen:
            seen.add(symptom)
            unique.append(symptom)

    if len(unique) > settings.max_symptoms:
        unique = unique[: settings.max_symptoms]
        truncated = True

    seen_corr: set[str] = set()
    unique_corr: list[dict[str, str]] = []
    for item in corrections:
        key = f"{item['from']}->{item['to']}"
        if key not in seen_corr:
            seen_corr.add(key)
            unique_corr.append(item)

    return PreprocessResult(
        original=original.strip(),
        cleaned_text=", ".join(unique),
        symptoms=unique,
        corrections=unique_corr,
        truncated=truncated,
    )


def validate_symptoms(preprocessed: PreprocessResult) -> str | None:
    if not preprocessed.original.strip():
        return "Please enter at least one symptom before submitting."
    if not preprocessed.symptoms or _looks_like_gibberish(
        preprocessed.symptoms, preprocessed.original
    ):
        return (
            "Please describe symptoms in plain words "
            "(for example: fever, cough, headache). "
            "We could not identify meaningful medical symptoms."
        )
    if len(preprocessed.cleaned_text) < MIN_MEANINGFUL_LENGTH:
        return "Symptom description is too short. Please provide a bit more detail."
    latin = len(re.findall(r"[a-zA-Z]", preprocessed.original))
    if latin < 3 and len(preprocessed.original) > 5:
        return "This demo currently supports English symptom descriptions only."
    return None
