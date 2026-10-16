from app.preprocessing import preprocess_symptoms, validate_symptoms


def test_normalization_and_synonyms():
    result = preprocess_symptoms("  feaver, migrane, and sorethrot  ")
    assert "fever" in result.symptoms
    assert "migraine" in result.symptoms
    assert "sore throat" in result.symptoms


def test_slang_mapping():
    result = preprocess_symptoms("tummy ache and throwing up")
    assert "abdominal pain" in result.symptoms
    assert "vomiting" in result.symptoms


def test_running_nose_variation_is_standardized():
    result = preprocess_symptoms("cough and running nose")
    assert result.symptoms == ["cough", "runny nose"]


def test_severe_one_sided_head_pain_is_standardized():
    result = preprocess_symptoms("one side head is toomuch pain")
    assert result.symptoms == ["one-sided headache"]


def test_weakness_and_travel_narrative_extracts_symptom_phrases():
    result = preprocess_symptoms(
        "sometimes i feel like weak and i cant stand, "
        "like something is happening in the stomach like i am weak i need to sit, "
        "need drink kike feeling even though i had enough breakfast "
        "when i am travelling in metro especially"
    )

    assert "weakness" in result.cleaned_text
    assert "difficulty standing" in result.cleaned_text
    assert "stomach discomfort" in result.cleaned_text
    assert "thirst" in result.cleaned_text
    assert result.corrections


def test_html_and_newlines():
    result = preprocess_symptoms("<b>fever</b>\ncough")
    assert "<b>" not in result.cleaned_text
    assert "fever" in result.symptoms
    assert "cough" in result.symptoms


def test_dedupe_and_cap():
    many = ", ".join(f"symptom{i}" for i in range(20))
    result = preprocess_symptoms(many)
    assert len(result.symptoms) <= 15
    assert result.truncated is True


def test_empty_and_gibberish():
    assert validate_symptoms(preprocess_symptoms("   "))
    assert validate_symptoms(preprocess_symptoms("asdf qwrty zxcvb"))


def test_valid_input():
    assert validate_symptoms(preprocess_symptoms("fever and cough")) is None
