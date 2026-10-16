import { describe, expect, it, vi } from "vitest";
import { analyzeSymptoms } from "./llm";
import type { LlmClient } from "./llm";
import type { PreprocessResult } from "./types";

const preprocessed: PreprocessResult = {
  original: "fever and cough",
  cleanedText: "fever, cough",
  symptoms: ["fever", "cough"],
  corrections: [],
  truncated: false,
};

function fakeClient(responses: string[]): LlmClient {
  let i = 0;
  return {
    chat: {
      completions: {
        create: vi.fn(async () => {
          const content = responses[Math.min(i, responses.length - 1)];
          i += 1;
          return { choices: [{ message: { content } }] };
        }),
      },
    },
  };
}

const validJson = JSON.stringify({
  summary:
    "Possible viral illness based on fever and cough; this is not a diagnosis.",
  urgency: "soon",
  conditions: [
    {
      name: "Viral upper respiratory infection",
      likelihood: "high",
      reasoning: "Fever plus cough is commonly viral.",
      suggestedNextStep: "Rest and see a clinician if worsening.",
      description: "Common viral illness affecting the upper airways.",
    },
    {
      name: "Seasonal influenza",
      likelihood: "moderate",
      reasoning: "Systemic symptoms can fit flu.",
      suggestedNextStep: "Discuss testing with a clinician.",
      description: "Influenza can cause fever and respiratory symptoms.",
    },
    {
      name: "Acute bronchitis",
      likelihood: "low",
      reasoning: "Cough can persist with airway irritation.",
      suggestedNextStep: "Seek care if breathlessness develops.",
      description: "Inflammation of the bronchial tubes.",
    },
  ],
});

describe("analyzeSymptoms", () => {
  it("returns validated conditions on the happy path", async () => {
    const result = await analyzeSymptoms(preprocessed, undefined, fakeClient([validJson]));
    expect(result.conditions.length).toBeGreaterThanOrEqual(3);
    expect(result.summary.length).toBeGreaterThan(10);
    expect(result.urgency).toBe("soon");
  });

  it("retries once when the first JSON is malformed", async () => {
    const client = fakeClient(["not-json", validJson]);
    const result = await analyzeSymptoms(preprocessed, undefined, client);
    expect(result.conditions.length).toBeGreaterThanOrEqual(3);
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("fails friendly after two malformed responses", async () => {
    await expect(
      analyzeSymptoms(preprocessed, undefined, fakeClient(["bad", "still-bad"])),
    ).rejects.toThrow(/unexpected format|try again/i);
  });
});
