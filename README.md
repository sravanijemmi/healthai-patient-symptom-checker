# HealthAI — Patient Symptom Checker

HealthAI is a fictional telehealth demo that standardizes reported symptoms, checks for selected emergency warning signs, and asks a hosted language model for possible conditions. Results are informational only and are **not a diagnosis**.

**Stack:** Python · FastAPI · Pydantic · Groq LLM · pytest · Jinja2 · vanilla JavaScript

---

## Overview

| Capability | Module |
|---|---|
| Symptom form (+ optional age/sex) | `templates/index.html` + `static/app.js` |
| Preprocessing | `app/preprocessing.py` + `app/dictionary.py` |
| Emergency red flags | `app/safety.py` |
| LLM (≥3 conditions, JSON, retry) | `app/llm/` |
| API and orchestration | `app/main.py` + `app/service.py` |
| Structured logs (≥10) | `app/logger.py` → `data/submissions.jsonl` |

---

## Setup and run

### Prerequisites

- Python 3.10+
- Free Groq key: [https://console.groq.com/keys](https://console.groq.com/keys)

### Steps

```bash
cd <project-directory>
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
copy .env.example .env
```

Edit `.env`:

```env
GROQ_API_KEY=gsk_your_key_here
LLM_MODEL=openai/gpt-oss-20b
LLM_TIMEOUT_SECONDS=1.7
CORS_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
```

Run the server:

```bash
uvicorn app.main:app --reload --port 8000
```

Open [http://localhost:8000](http://localhost:8000).

---

## How to run tests

```bash
pytest
pytest --cov=app --cov-report=term-missing
```

Tests use a fake LLM client and do not require a Groq key. The concurrency test exercises eight simultaneous API requests with a delayed fake provider; it asserts completion under two seconds on the local test machine. This does not guarantee the same latency from the external Groq service.

Latest local run: **33 tests passed; 92% app coverage** (`pytest -q --cov=app --cov-report=term-missing`).

| Test file | Covers |
|---|---|
| `tests/test_preprocessing.py` | normalization, common phrase variants, HTML, synonyms, dedupe, empty/gibberish |
| `tests/test_safety.py` | emergency detection, including neck stiffness with fever/headache and severe headache wording |
| `tests/test_llm.py` | schema and retries, concise prompt, medication-advice guard, Groq request options (fake client, no API key) |
| `tests/test_api.py` | FastAPI TestClient — validation, analysis response, emergency escalation, privacy-safe logs, retention, concurrent latency |

---

## Architecture

```
Browser (Jinja + vanilla JS)
        │
        ▼
FastAPI POST /api/analyze
        ├─ Pydantic request validation + per-client rate limit
        └─ app.service.run_analysis()
           ├─ normalize and validate symptoms
           ├─ detect emergency red flags
           ├─ 5-minute in-memory cache
           ├─ Groq JSON request (1.7-second client timeout; one format retry)
           ├─ require at least 3 validated possible conditions
           └─ JSONL log → data/submissions.jsonl (retain newest 50)

GET /api/logs returns at least the newest 10 submissions.
```

---

## Key decisions and trade-offs

### Why FastAPI (not Next.js)

- The main behavior is Python symptom normalization, safety checks, and LLM orchestration, so FastAPI keeps that pipeline in one runtime rather than adding a separate backend service.
- Pydantic validates request and model-response contracts; FastAPI exposes a JSON API and OpenAPI schema; pytest covers the Python pipeline and endpoints.
- Jinja2 and small vanilla-JavaScript modules provide the required browser workflow without a separate frontend build system.
- Trade-off: the UI is intentionally simpler than a dedicated React/Next.js client, and the in-memory cache/rate limiter are suitable only for a single-process demo.

### Model: Groq `openai/gpt-oss-20b`

- Groq exposes an OpenAI-compatible API, so the project uses the maintained OpenAI Python client with a configurable model ID and timeout.
- The model is selected for a low-friction hosted demo, not because its clinical accuracy is established. Confirm current model availability and provider terms before running the demo.
- A one-time format retry handles malformed JSON. A schema validates urgency, likelihood, and the minimum number of conditions; it does not verify medical correctness.

### Preprocess before LLM

- Dictionary + phrase map is deterministic and unit-tested (rubric Must).
- Trade-off: finite coverage of typos.

### JSONL logging

- Easy to demo the latest 10 entries with no database service. The file retains 50 entries and writes are guarded against concurrent updates.
- Original symptom wording is redacted by default; normalized symptoms and model output are retained. Set `LOG_RAW_INPUT=true` only for synthetic data and with an explicit privacy justification.
- Trade-off: local file storage is not suitable for multi-instance deployment, durable clinical records, or high-throughput use.

### Latency and concurrency

- The Groq HTTP client timeout defaults to 1.5 seconds; synchronous FastAPI routes run in the framework's thread pool, and in-memory cache/rate-limit/log updates are synchronized.
- Automated tests verify eight simultaneous requests with a delayed fake model finish under two seconds locally. This is a deterministic application concurrency check, not a live Groq latency benchmark; provider/network time and cold starts can still exceed the target.
- The in-memory cache and rate limiter are process-local and reset on restart. For multiple workers or instances, replace them with shared storage and run a deployment-level load test.

---

## Edge cases

| Case | Handling |
|---|---|
| Empty input | Pydantic / preprocess → **422** |
| Long input | Cap 2000 chars, max 15 symptoms |
| Gibberish | Reject with clear message |
| Emergency keywords | Banner before/with LLM |
| Bad LLM JSON | Retry once, then friendly error |
| Prompt injection | `<user_symptoms>` delimiters + schema validation |
| Rate limits / timeouts | Friendly mapped errors, no stack traces |

---

## Security

- API key only in `.env` (ignored); `.env.example` contains placeholders
- Pydantic validation on requests; CORS restricted
- Rate limiting; no stack traces to clients
- UI escapes output (`escapeHtml`); no real patient data
- Raw symptom text is redacted in stored logs by default. The demo has no authentication, so do not expose `/api/logs` publicly or enter real patient data.

---

## Requirement coverage

| Priority | Requirement | Status |
|---|---|---|
| Must | Symptom form → show conditions | Implemented; covered by API tests |
| Must | LLM suggests ≥3 possible conditions | Implemented with response validation and retry for too few results; fake-provider tests, live provider not tested in CI |
| Must | Preprocess misspellings/variations | Implemented with dictionary/phrase corrections and unit tests |
| Must | Architecture and trade-offs documented | Documented in this README |
| Should | Summary and readable condition results | Implemented in the results panel |
| Should | Structured timestamped logs, at least 10 retained | Implemented; tests cover retention and privacy defaults |
| Could | Responsive UI and under-two-second response | Responsive CSS and mocked concurrent test; live-provider latency is not guaranteed |

The public GitHub repository and narrated screen-share video are submission tasks outside this codebase. The video must be recorded by the candidate with their webcam on; the demo outline below is a checklist, not a recording.

---

## AI usage

| Tool | Touched | Verified / changed afterward |
|---|---|---|
| Cursor (Composer) | Earlier FastAPI scaffold, preprocessing, LLM client, UI, tests, and README | The current repository and tests were reviewed; implementation details are documented above. |
| GitHub Copilot (VS Code) | Audited the rubric; updated provider request options, logging/concurrency tests, symptom phrase normalization, emergency flags, medication-advice guard, and documentation | Installed pinned dependencies; ran focused and full test suites; made live Groq smoke requests and recorded their variable latency; no clinical validation was performed. |

The LLM is informational only. Human review and a real-provider smoke test remain necessary before the demo; no clinical validation was performed.

---

## Demo video tips

1. Show misspelled input → cleaned symptoms → ≥3 conditions
2. Show emergency banner (`chest pain`)
3. Show recent logs
4. Walk `app/preprocessing.py` → `app/safety.py` → `app/llm/` → `app/service.py` → `app/main.py`

---

## License

MIT — hiring exercise only. Not for clinical use.
