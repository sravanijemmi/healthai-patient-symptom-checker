from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class AnalyzeRequest(BaseModel):
    symptoms: str = Field(..., min_length=1, max_length=2000)
    age: Optional[int] = Field(default=None, ge=0, le=120)
    sex: Optional[Literal["female", "male", "other", "prefer_not_to_say"]] = None

    @field_validator("symptoms")
    @classmethod
    def strip_symptoms(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Please enter at least one symptom before submitting.")
        return cleaned


class HealthCondition(BaseModel):
    name: str
    description: str
    likelihood: Literal["low", "moderate", "high"]
    reasoning: str = ""
    suggested_next_step: str = Field(
        default="Discuss these symptoms with a clinician if they persist or worsen.",
        alias="suggestedNextStep",
    )

    model_config = {"populate_by_name": True}


class ModelResponse(BaseModel):
    summary: str
    urgency: Literal["routine", "soon", "urgent", "emergency"] = "soon"
    conditions: list[HealthCondition] = Field(..., min_length=3)
    disclaimer: Optional[str] = None


class Correction(BaseModel):
    from_: str = Field(..., alias="from")
    to: str

    model_config = {"populate_by_name": True}


class AnalyzeResponse(BaseModel):
    summary: str
    urgency: str
    conditions: list[HealthCondition]
    disclaimer: str
    original_input: str
    cleaned_symptoms: list[str]
    corrections: list[dict]
    latency_ms: int
    cached: bool = False
    truncated: bool = False
    emergency: bool = False
    emergency_message: Optional[str] = None
    emergency_flags: list[str] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: str
    emergency: bool = False
    emergency_message: Optional[str] = None
    emergency_flags: list[str] = Field(default_factory=list)
