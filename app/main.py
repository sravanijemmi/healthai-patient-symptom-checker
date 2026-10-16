from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import ValidationError

from app.config import get_settings
from app.logger import read_logs
from app.rate_limit import check_rate_limit
from app.schemas import AnalyzeRequest, AnalyzeResponse, ErrorResponse
from app.service import run_analysis

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

app = FastAPI(
    title="HealthAI",
    description="Symptom checker powered by preprocessing + LLM (educational demo).",
    version="1.0.0",
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "local"


@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(request, "index.html")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/logs")
async def get_logs() -> dict:
    logs = read_logs(10)
    return {"count": len(logs), "logs": logs}


@app.post(
    "/api/analyze",
    response_model=AnalyzeResponse,
    responses={422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
def analyze(request: Request, payload: AnalyzeRequest) -> AnalyzeResponse | JSONResponse:
    rate = check_rate_limit(_client_key(request))
    if not rate.allowed:
        return JSONResponse(
            status_code=429,
            content={
                "error": f"Too many requests. Please wait {rate.retry_after_sec}s and try again."
            },
            headers={"Retry-After": str(rate.retry_after_sec)},
        )

    result = run_analysis(payload.symptoms, age=payload.age, sex=payload.sex)
    if not result.ok:
        return JSONResponse(status_code=result.status_code, content=result.payload)
    return AnalyzeResponse(**result.payload)


@app.exception_handler(ValidationError)
async def validation_exception_handler(_: Request, exc: ValidationError) -> JSONResponse:
    msg = exc.errors()[0].get("msg", "Invalid request") if exc.errors() else "Invalid request"
    return JSONResponse(status_code=422, content={"error": msg})


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(status_code=exc.status_code, content={"error": detail})
