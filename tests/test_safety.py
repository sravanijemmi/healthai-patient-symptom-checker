from app.safety import detect_emergency


def test_chest_pain():
    result = detect_emergency("I have chest pain")
    assert result.is_emergency
    assert any("Chest" in f for f in result.flags)


def test_breathing():
    assert detect_emergency("I can't breathe").is_emergency


def test_ordinary_cold():
    result = detect_emergency("mild cough and runny nose")
    assert not result.is_emergency


def test_neck_stiffness_with_fever_or_headache_is_flagged():
    result = detect_emergency("neck stiffness, mild fever, and headache")
    assert result.is_emergency
    assert "Neck stiffness with fever or headache" in result.flags


def test_neck_stiffness_alone_is_not_flagged():
    assert not detect_emergency("neck stiffness after exercise").is_emergency


def test_severe_headache_is_flagged():
    result = detect_emergency("one side head is toomuch pain")
    assert result.is_emergency
    assert "Severe or sudden headache" in result.flags


def test_ordinary_headache_is_not_flagged():
    assert not detect_emergency("mild headache after a long day").is_emergency
