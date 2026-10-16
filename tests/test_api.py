import asyncio
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from time import perf_counter, sleep

import pytest
from fastapi.testclient import TestClient
from fastapi.responses import JSONResponse
from starlette.requests import Request

from app import logger, main, rate_limit, service
from app.config import Settings
from app.main import app

client = TestClient(app)


def _analysis(urgency="routine"):
    return {
        "summary": "The reported symptoms can have several causes.",
        "urgency": urgency,
        "conditions": [
            {
                "name": name,
                "description": "A possible explanation for these symptoms.",
                "likelihood": "moderate",
                "reasoning": "Symptoms can overlap.",
                "suggestedNextStep": "Discuss persistent symptoms with a clinician.",
            }
            for name in ("Viral infection", "Influenza", "Bronchitis")
        ],
        "disclaimer": "Informational only, not a diagnosis.",
    }


@pytest.fixture(autouse=True)
def reset_rate_limit():
    rate_limit._buckets.clear()
    yield
    rate_limit._buckets.clear()


@pytest.fixture
def isolated_logs(tmp_path, monkeypatch):
    monkeypatch.setattr(logger, "LOG_DIR", tmp_path)
    monkeypatch.setattr(logger, "LOG_FILE", tmp_path / "submissions.jsonl")


def test_home_page():
    res = client.get("/")
    assert res.status_code == 200
    assert "HealthAI" in res.text


def test_analyze_empty_symptoms():
    res = client.post("/api/analyze", json={"symptoms": "   "})
    assert res.status_code == 422


def test_analyze_gibberish():
    res = client.post("/api/analyze", json={"symptoms": "asdf qwrty zxcvb"})
    assert res.status_code == 422
    assert "symptoms" in res.json()["error"].lower() or "describe" in res.json()["error"].lower()


def test_logs_endpoint():
    def make_request(host):
        return Request(
            {
                "type": "http",
                "method": "GET",
                "scheme": "http",
                "path": "/api/logs",
                "headers": [],
                "client": (host, 50000),
                "server": ("127.0.0.1", 8000),
            }
        )

    local_result = asyncio.run(main.get_logs(make_request("127.0.0.1")))
    remote_result = asyncio.run(main.get_logs(make_request("198.51.100.10")))

    assert "logs" in local_result
    assert isinstance(remote_result, JSONResponse)
    assert remote_result.status_code == 403


def test_client_key_ignores_untrusted_forwarded_ip():
    from starlette.requests import Request

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "scheme": "http",
            "path": "/api/analyze",
            "headers": [(b"x-forwarded-for", b"203.0.113.99")],
            "client": ("127.0.0.1", 50000),
            "server": ("127.0.0.1", 8000),
        }
    )

    assert main._client_key(request) == "127.0.0.1"


def test_analyze_success_returns_three_conditions_and_redacts_raw_log(
    monkeypatch, isolated_logs
):
    monkeypatch.setattr(service, "get_settings", lambda: Settings(log_raw_input=False))
    monkeypatch.setattr(service, "analyze_symptoms", lambda *args, **kwargs: _analysis())

    res = client.post("/api/analyze", json={"symptoms": "feaver and cough"})

    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["conditions"]) >= 3
    assert body["cleaned_symptoms"] == ["fever", "cough"]
    assert body["corrections"]
    entries = logger.read_logs()
    assert entries[0]["timestamp"]
    assert entries[0]["originalInput"] == "[redacted]"
    assert len(entries[0]["modelResponse"]["conditions"]) >= 3


def test_emergency_flag_overrides_model_urgency(monkeypatch, isolated_logs):
    monkeypatch.setattr(service, "analyze_symptoms", lambda *args, **kwargs: _analysis())

    res = client.post("/api/analyze", json={"symptoms": "chest pain and cough"})

    assert res.status_code == 200
    assert res.json()["emergency"] is True
    assert res.json()["urgency"] == "emergency"


def test_rate_limit_returns_retry_after(monkeypatch, isolated_logs):
    settings = Settings(rate_limit_per_minute=1)
    monkeypatch.setattr(rate_limit, "get_settings", lambda: settings)
    monkeypatch.setattr(service, "get_cached", lambda key: None)
    monkeypatch.setattr(service, "set_cached", lambda key, value: None)
    monkeypatch.setattr(service, "analyze_symptoms", lambda *args, **kwargs: _analysis())

    first = client.post("/api/analyze", json={"symptoms": "fever and cough"})
    second = client.post("/api/analyze", json={"symptoms": "headache and fatigue"})

    assert first.status_code == 200
    assert second.status_code == 429
    assert int(second.headers["retry-after"]) > 0


def test_cached_analysis_bypasses_provider_rate_limit(monkeypatch, isolated_logs):
    settings = Settings(rate_limit_per_minute=1)
    monkeypatch.setattr(rate_limit, "get_settings", lambda: settings)
    monkeypatch.setattr(service, "analyze_symptoms", lambda *args, **kwargs: _analysis())

    first = client.post("/api/analyze", json={"symptoms": "nausea and bloating"})
    second = client.post("/api/analyze", json={"symptoms": "nausea and bloating"})

    assert first.status_code == 200
    assert first.json()["cached"] is False
    assert second.status_code == 200
    assert second.json()["cached"] is True


def test_provider_timeout_is_mapped_to_gateway_timeout(monkeypatch, isolated_logs):
    monkeypatch.setattr(service, "get_cached", lambda key: None)
    def timed_out(*args, **kwargs):
        raise RuntimeError("The language model timed out. Please try again.")

    monkeypatch.setattr(service, "analyze_symptoms", timed_out)

    res = client.post("/api/analyze", json={"symptoms": "fever and cough"})

    assert res.status_code == 504
    assert "Traceback" not in res.text


def test_logs_keep_latest_ten_of_last_fifty(isolated_logs):
    for index in range(60):
        logger.append_log({"id": str(index), "timestamp": str(index)})

    recent = logger.read_logs()

    assert len(recent) == 10
    assert [entry["id"] for entry in recent] == [str(index) for index in range(59, 49, -1)]
    assert len(logger.read_all_entries()) == 50


def test_concurrent_mocked_analysis_completes_within_two_seconds(monkeypatch, isolated_logs):
    settings = Settings(rate_limit_per_minute=10)
    monkeypatch.setattr(rate_limit, "get_settings", lambda: settings)
    monkeypatch.setattr(service, "get_cached", lambda key: None)
    monkeypatch.setattr(service, "set_cached", lambda key, value: None)

    request_barrier = Barrier(8, timeout=1.0)

    def delayed_analysis(*args, **kwargs):
        request_barrier.wait()
        sleep(0.35)
        return _analysis()

    monkeypatch.setattr(service, "analyze_symptoms", delayed_analysis)

    def submit(index):
        with TestClient(app) as test_client:
            return test_client.post(
                "/api/analyze",
                json={"symptoms": f"fever and cough {index}"},
            ).status_code

    started = perf_counter()
    with ThreadPoolExecutor(max_workers=8) as executor:
        statuses = list(executor.map(submit, range(8)))
    elapsed = perf_counter() - started

    assert statuses == [200] * 8
    assert elapsed < 2.0
