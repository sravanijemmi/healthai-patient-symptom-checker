import { NextResponse } from "next/server";
import { readLogs, MIN_REQUIRED } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const logs = await readLogs(Math.max(MIN_REQUIRED, 10));
    return NextResponse.json({
      count: logs.length,
      logs,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read logs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
