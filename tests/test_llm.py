import json
from types import SimpleNamespace

from app.llm import analyze_symptoms
from app.llm.base import LlmResult
from app.llm.prompts import build_user_prompt
from app.llm.provider import GroqClient
from app.preprocessing import PreprocessResult
from app.config import Settings


class FakeClient:
    def __init__(self, responses: list[str]):
        self.responses = responses
        self.calls = 0

    def complete(self, messages, model, temperature):
        content = self.responses[min(self.calls, len(self.responses) - 1)]
        self.calls += 1
        return LlmResult(content=content)


VALID = {
    "summary": "Possible viral illness based on fever and cough; not a diagnosis.",
    "urgency": "soon",
    "conditions": [
        {
            "name": "Viral URI",
            "likelihood": "high",
            "reasoning": "Fever plus cough is commonly viral.",
            "suggestedNextStep": "Rest and monitor.",
            "description": "Common viral airway illness.",
        },
        {
            "name": "Influenza",
            "likelihood": "moderate",
            "reasoning": "Systemic symptoms can fit flu.",
            "suggestedNextStep": "Discuss testing.",
            "description": "Influenza can cause fever.",
        },
        {
            "name": "Bronchitis",
            "likelihood": "low",
            "reasoning": "Cough can persist with irritation.",
            "suggestedNextStep": "Seek care if breathless.",
            "description": "Airway inflammation.",
        },
    ],
}


def _pre() -> PreprocessResult:
    return PreprocessResult(
        original="fever and cough",
        cleaned_text="fever, cough",
        symptoms=["fever", "cough"],
        corrections=[],
        truncated=False,
    )


def test_default_llm_timeout_is_bounded_for_two_second_target():
    assert Settings(_env_file=None).llm_timeout_seconds == 1.7


def test_happy_path():
    client = FakeClient([json.dumps(VALID)])
    result = analyze_symptoms(_pre(), client=client)
    assert len(result["conditions"]) >= 3
    assert result["urgency"] == "soon"


def test_prompt_uses_schema_likelihood_values():
    prompt = build_user_prompt(_pre())
    assert '"low"|"moderate"|"high"' in prompt
    assert "summary under 30 words" in prompt
    assert "one short sentence (15 words max)" in prompt


def test_retry_on_malformed_json():
    client = FakeClient(["not-json", json.dumps(VALID)])
    result = analyze_symptoms(_pre(), client=client)
    assert len(result["conditions"]) >= 3
    assert client.calls == 2


def test_retry_when_model_returns_fewer_than_three_conditions():
    too_few = {**VALID, "conditions": VALID["conditions"][:2]}
    client = FakeClient([json.dumps(too_few), json.dumps(VALID)])

    result = analyze_symptoms(_pre(), client=client)

    assert len(result["conditions"]) == 3
    assert client.calls == 2


def test_medication_recommendations_are_replaced_with_clinician_guidance():
    response = json.loads(json.dumps(VALID))
    response["conditions"][0]["suggestedNextStep"] = "Use OTC cold remedies."
    response["conditions"][1]["suggestedNextStep"] = "Consider an antiviral."
    client = FakeClient([json.dumps(response)])

    result = analyze_symptoms(_pre(), client=client)

    assert result["conditions"][0]["suggestedNextStep"] == (
        "Discuss treatment options with a qualified clinician."
    )
    assert result["conditions"][1]["suggestedNextStep"] == (
        "Discuss treatment options with a qualified clinician."
    )


def test_groq_client_uses_low_effort_without_reasoning_for_gpt_oss(monkeypatch):
    captured = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(create=self.create_completion)
            )

        def create_completion(self, **kwargs):
            captured.update(kwargs)
            message = SimpleNamespace(content=json.dumps(VALID))
            choice = SimpleNamespace(message=message)
            return SimpleNamespace(choices=[choice], usage=None)

    monkeypatch.setattr("app.llm.provider.OpenAI", FakeOpenAI)
    client = GroqClient(api_key="test", base_url="https://example.test", timeout=1)

    client.complete([], model="openai/gpt-oss-20b", temperature=0.2)

    assert captured["extra_body"] == {
        "reasoning_effort": "low",
        "include_reasoning": False,
    }
    assert captured["max_completion_tokens"] == 768
