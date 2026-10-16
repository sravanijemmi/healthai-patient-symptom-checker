import { NextRequest, NextResponse } from "next/server";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/cache";
import { analyzeSymptoms } from "@/lib/llm";
import { appendLog, createLogId } from "@/lib/logger";
import { preprocessSymptoms, validateSymptoms } from "@/lib/preprocess";
import { checkRateLimit } from "@/lib/rate-limit";
import { detectEmergency } from "@/lib/safety";
import { analyzeRequestSchema } from "@/lib/schemas";
import type { AnalysisResult, PatientContext } from "@/lib/types";

export const runtime = "nodejs";

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "local";
}

function friendlyError(error: unknown): { message: string; status: number } {
  const message =
    error instanceof Error
      ? error.message
      : "We could not complete the analysis right now. Please try again.";

  if (message.includes("GROQ_API_KEY")) {
    return { message, status: 503 };
  }
  if (message.toLowerCase().includes("rate-limit") || message.includes("429")) {
    return { message, status: 429 };
  }
  if (message.toLowerCase().includes("timed out")) {
    return { message, status: 504 };
  }
  // Never leak stack traces / raw internals
  return {
    message: message.startsWith("The ") || message.startsWith("We ") || message.startsWith("Please ")
      ? message
      : "We could not complete the analysis right now. Please try again.",
    status: 502,
  };
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const rate = checkRateLimit(clientKey(req));

  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Too many requests. Please wait ${rate.retryAfterSec}s and try again.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = analyzeRequestSchema.safeParse(json);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message || "Invalid request. Check your symptoms input.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { symptoms, age, sex } = parsed.data;
  const patientContext: PatientContext = {};
  if (typeof age === "number") patientContext.age = age;
  if (sex) patientContext.sex = sex;

  const emergency = detectEmergency(symptoms);
  const preprocessed = preprocessSymptoms(symptoms);
  const validationError = validateSymptoms(preprocessed);

  if (validationError) {
    await appendLog({
      id: createLogId(),
      timestamp: new Date().toISOString(),
      originalInput: preprocessed.original,
      cleanedSymptoms: preprocessed.symptoms,
      corrections: preprocessed.corrections,
      patientContext,
      modelResponse: null,
      error: validationError,
      latencyMs: Date.now() - started,
      emergencyFlags: emergency.flags,
    });

    return NextResponse.json(
      {
        error: validationError,
        emergency: emergency.isEmergency,
        emergencyMessage: emergency.message,
        emergencyFlags: emergency.flags,
      },
      { status: 422 },
    );
  }

  const cacheKey = `${preprocessed.cleanedText}|${age ?? ""}|${sex ?? ""}`;
  const cached = getCachedAnalysis(cacheKey);
  if (cached) {
    const result: AnalysisResult = {
      ...cached,
      latencyMs: Date.now() - started,
      originalInput: preprocessed.original,
      cleanedSymptoms: preprocessed.symptoms,
      emergencyFlags: emergency.flags,
    };

    await appendLog({
      id: createLogId(),
      timestamp: new Date().toISOString(),
      originalInput: preprocessed.original,
      cleanedSymptoms: preprocessed.symptoms,
      corrections: preprocessed.corrections,
      patientContext,
      modelResponse: {
        summary: result.summary,
        urgency: result.urgency,
        conditions: result.conditions,
      },
      error: null,
      latencyMs: result.latencyMs,
      emergencyFlags: emergency.flags,
    });

    return NextResponse.json({
      ...result,
      corrections: preprocessed.corrections,
      truncated: preprocessed.truncated,
      cached: true,
      emergency: emergency.isEmergency,
      emergencyMessage: emergency.message,
      emergencyFlags: emergency.flags,
    });
  }

  try {
    const analysis = await analyzeSymptoms(preprocessed, patientContext);
    const latencyMs = Date.now() - started;

    const result: AnalysisResult = {
      ...analysis,
      latencyMs,
      originalInput: preprocessed.original,
      cleanedSymptoms: preprocessed.symptoms,
      emergencyFlags: emergency.flags,
      urgency: emergency.isEmergency ? "emergency" : analysis.urgency,
    };

    setCachedAnalysis(cacheKey, result);

    await appendLog({
      id: createLogId(),
      timestamp: new Date().toISOString(),
      originalInput: preprocessed.original,
      cleanedSymptoms: preprocessed.symptoms,
      corrections: preprocessed.corrections,
      patientContext,
      modelResponse: {
        summary: result.summary,
        urgency: result.urgency,
        conditions: result.conditions,
      },
      error: null,
      latencyMs,
      emergencyFlags: emergency.flags,
    });

    return NextResponse.json({
      ...result,
      corrections: preprocessed.corrections,
      truncated: preprocessed.truncated,
      cached: false,
      emergency: emergency.isEmergency,
      emergencyMessage: emergency.message,
      emergencyFlags: emergency.flags,
    });
  } catch (error) {
    const { message, status } = friendlyError(error);

    await appendLog({
      id: createLogId(),
      timestamp: new Date().toISOString(),
      originalInput: preprocessed.original,
      cleanedSymptoms: preprocessed.symptoms,
      corrections: preprocessed.corrections,
      patientContext,
      modelResponse: null,
      error: message,
      latencyMs: Date.now() - started,
      emergencyFlags: emergency.flags,
    });

    return NextResponse.json(
      {
        error: message,
        emergency: emergency.isEmergency,
        emergencyMessage: emergency.message,
        emergencyFlags: emergency.flags,
      },
      { status },
    );
  }
}
