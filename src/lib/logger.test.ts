import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LogEntry } from "./types";

describe("structured submission logs", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "healthai-logs-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("keeps timestamps, input, and at least the last 10 entries", async () => {
    const file = path.join(tempDir, "submissions.jsonl");
    const entries: LogEntry[] = Array.from({ length: 12 }, (_, index) => ({
      id: `log_${index}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      originalInput: `symptom ${index}`,
      cleanedSymptoms: [`symptom ${index}`],
      corrections: [],
      modelResponse: {
        summary: "summary of analysis for testing",
        conditions: [
          {
            name: "Condition A",
            description: "Description long enough for schema",
            likelihood: "low",
          },
          {
            name: "Condition B",
            description: "Description long enough for schema",
            likelihood: "moderate",
          },
          {
            name: "Condition C",
            description: "Description long enough for schema",
            likelihood: "high",
          },
        ],
      },
      error: null,
      latencyMs: 100 + index,
    }));

    await fs.writeFile(
      file,
      `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      "utf8",
    );

    const parsed = (await fs.readFile(file, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as LogEntry);
    const newestFirst = parsed.slice(-10).reverse();

    expect(parsed).toHaveLength(12);
    expect(newestFirst).toHaveLength(10);
    expect(newestFirst[0]?.originalInput).toBe("symptom 11");
    expect(newestFirst[0]?.timestamp).toMatch(/2026-01-01/);
    expect(newestFirst[0]?.modelResponse?.conditions.length).toBeGreaterThanOrEqual(3);
  });
});
