# HealthAI — Patient Symptom Checker

Fictional telehealth web app for the **AidenAI / LaunchBae AI Engineer build round**. Patients enter symptoms and get **possible** health-condition suggestions from an LLM (educational triage only — **not a diagnosis**, **not real patient care**).

**Stack:** Next.js 15 (TypeScript) · App Router API · Groq (`openai/gpt-oss-20b`) · Zod · Vitest  

> We do **not** use Flask/FastAPI. The brief asks for a web app + LLM, not a specific Python framework. Zod ≈ Pydantic; Vitest ≈ pytest; `/api/*` route handlers ≈ Flask blueprints.

---

## Overview

| Capability | Implementation |
|---|---|
| Symptom form (+ optional age/sex) | `src/components/SymptomForm.tsx` |
| Preprocessing (visible + tested) | `src/lib/preprocess.ts` |
| Emergency red-flag banner | `src/lib/safety.ts` |
| LLM (≥3 conditions, JSON, retry) | `src/lib/llm.ts` |
| Results + summary UI | `src/components/ResultsPanel.tsx` |
| Structured logs (last ≥10) | `src/lib/logger.ts` + Recent submissions panel |

**Screenshot tip for submission:** run the app, submit `feaver, migrane, and sorethrot`, capture the results panel (summary + ≥3 conditions + corrections).

---

## Setup and run

### Prerequisites

- Node.js 20+
- Free Groq key: [https://console.groq.com/keys](https://console.groq.com/keys)

### Steps

```bash
git clone https://github.com/sravanijemmi/healthai.git
cd healthai
npm install
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # macOS/Linux
```

Edit `.env.local`:

```env
GROQ_API_KEY=gsk_your_key_here
LLM_MODEL=openai/gpt-oss-20b
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production:

```bash
npm run build
npm start
```

---

## How to run the tests

```bash
npm test
```

Coverage (optional):

```bash
npx vitest run --coverage
```

| Suite | What it covers |
|---|---|
| `preprocess.test.ts` | normalize, HTML strip, split, synonyms, dedupe, cap, empty/gibberish |
| `safety.test.ts` | emergency keyword detection |
| `llm.test.ts` | happy path, malformed JSON → retry, double failure |
| `logger.test.ts` | structured log shape / last-10 behavior |

Tests use a **fake LLM client** — no API key required for `npm test`.

---

## Architecture

```
Browser (React UI)
  │  optional age/sex + live emergency check
  ▼
POST /api/analyze
  │
  ├─ Zod request validation (422 on bad input)
  ├─ Rate limit (per IP)
  ├─ detectEmergency()     ← rule-based, independent of LLM
  ├─ preprocessSymptoms()  ← clean list passed to LLM
  ├─ cache (5 min, cleaned key)
  ├─ analyzeSymptoms()     ← Groq JSON, temp 0.2, timeout, retry×1
  └─ appendLog() → data/submissions.jsonl

GET /api/logs → newest submissions (≥10 kept; file stores up to 50)
```

### Module map

| Path | Role |
|---|---|
| `src/lib/preprocess.ts` | Unicode, HTML/control strip, split, synonym map, dedupe, cap 15 |
| `src/lib/symptom-dictionary.ts` | Misspellings / slang |
| `src/lib/safety.ts` | Emergency red flags |
| `src/lib/llm.ts` | Prompt, timeout, retry, Zod parse |
| `src/lib/schemas.ts` | Request + model response schemas |
| `src/lib/logger.ts` | JSONL logging |
| `src/lib/rate-limit.ts` | Simple in-memory limiter |
| `src/middleware.ts` | Restricted CORS on `/api/*` |
| `src/app/api/analyze/route.ts` | Orchestration |
| `src/components/*` | Form, results, logs UI |

---

## Key decisions and trade-offs

### Model: Groq `openai/gpt-oss-20b` (free)

- **Why:** Brief needs an LLM, not paid OpenAI. Free tier + low latency (~1s demos).
- **Trade-off:** Rate limits; Llama IDs removed from Groq free tier (Aug 2026), so we migrated.

### Preprocess before the LLM

- **Why:** Rubric grades cleaning/standardization; dictionary is deterministic and unit-tested.
- **Trade-off:** Finite dictionary; unknown typos may pass through (LLM can still infer).

### Zod instead of Pydantic / Vitest instead of pytest

- **Why:** Native TypeScript stack; same validation/testing job as Python tools.
- **Trade-off:** Recruiters scanning for “pytest” won’t see that name — documented here explicitly.

### JSONL logs on disk

- **Why:** Zero infra; easy to show last ≥10 in the UI.
- **Trade-off:** Not multi-instance safe; production would use a DB.

### Cache + low temperature (0.2)

- **Why:** Helps the “~2s under normal load” Could; stable JSON.
- **Trade-off:** Cache is process-local.

---

## Edge cases handled

| Case | Handling |
|---|---|
| Empty / whitespace | Client check + Zod → **422** |
| Very long input | Cap **2000** chars; symptom list cap **15** |
| Gibberish / non-medical | Reject with “please describe symptoms…” |
| Emergency keywords | Banner **before and with** LLM (`safety.ts`) |
| LLM timeout / rate limit / bad JSON | Timeout, friendly errors, **retry once** on malformed JSON |
| Prompt injection | User text wrapped in `<user_symptoms>`; output schema validated |
| Non-English (heuristic) | Polite “English only” message |
| Stack traces | Never returned to the client |

---

## Security and correctness

| Control | Status |
|---|---|
| API key only in `.env.local` | Yes (`.env*` gitignored; `.env.example` committed) |
| Input validation (Zod ≈ Pydantic) | Yes — request + LLM response |
| CORS restricted on `/api` | Yes — `src/middleware.ts` (localhost demo origins) |
| Rate limiting | Yes — `rate-limit.ts` |
| No stack traces to users | Yes — `friendlyError()` |
| Output escaping | Yes — React text nodes (no `dangerouslySetInnerHTML`) |
| No real patient data | Demo only; logs are local JSONL, gitignored |

---

## Limitations / with more time

- Richer medical synonym graph / spell-check service  
- Persistent DB + auth for multi-user logs  
- Streaming LLM responses  
- Full i18n  
- Load testing + stricter CORS for a deployed domain  

---

## Requirement checklist (brief)

| Priority | Item | Status |
|---|---|---|
| Must | Symptom form → conditions | Done |
| Must | LLM ≥3 conditions | Done |
| Must | Preprocessing | Done |
| Must | Architecture / trade-offs docs | Done |
| Should | Friendly results + summary | Done |
| Should | Structured logs ≥10 | Done |
| Could | Responsive + ~2s | Done |
| Not needed | Auth, external health DBs, advanced analytics | Skipped on purpose |

---

## AI usage

| Tool | Parts touched | What I verified / changed afterward |
|---|---|---|
| **Cursor (Composer / Auto)** | Scaffold, preprocess dictionary, Groq client, UI/CSS, API routes, tests, README drafts | Re-checked Must/Should/Could; switched to Groq free model after Llama 404; added emergency keywords myself in review; confirmed Zod validation, retry, and secrets stay out of git; ran `npm test` |
| **Groq LLM (product runtime)** | Symptom → possible conditions | Prompt forbids diagnosis; schema enforced; UI shows disclaimer |

Honest note: AI helped with boilerplate and structure; **safety keyword list**, **preprocess dictionary curation**, **prompt rules**, and **manual end-to-end browser checks** were reviewed/owned by me.

---

## Demo video script (≤8 min, webcam on)

1. Form + misspellings → ≥3 conditions + summary  
2. Show preprocessing corrections  
3. Trigger emergency banner (`chest pain` / `can't breathe`)  
4. Show recent logs  
5. Code walk: `preprocess.ts` → `safety.ts` → `llm.ts` → `api/analyze`  
6. Trade-offs (Groq free, Zod, JSONL)

---

## License

MIT — synthetic hiring exercise only. Not for clinical use.
