import { describe, expect, it } from "vitest";
import { preprocessSymptoms, validateSymptoms, MAX_SYMPTOMS } from "./preprocess";

describe("preprocessSymptoms", () => {
  it("normalizes unicode, lowercases, and collapses whitespace", () => {
    const result = preprocessSymptoms("  Fever\u00a0\u00a0AND   Cough  ");
    expect(result.cleanedText).toContain("fever");
    expect(result.cleanedText).toContain("cough");
  });

  it("strips HTML and control characters", () => {
    const result = preprocessSymptoms("<b>fever</b>\n\tcough");
    expect(result.cleanedText).not.toContain("<b>");
    expect(result.symptoms).toEqual(expect.arrayContaining(["fever", "cough"]));
  });

  it("splits on commas, and, newlines, and semicolons", () => {
    const result = preprocessSymptoms("fever\ncough; headache and nausea");
    expect(result.symptoms.length).toBeGreaterThanOrEqual(3);
  });

  it("maps synonyms and slang", () => {
    const result = preprocessSymptoms("tummy ache and throwing up");
    expect(result.symptoms).toEqual(
      expect.arrayContaining(["abdominal pain", "vomiting"]),
    );
  });

  it("corrects common misspellings", () => {
    const result = preprocessSymptoms("feaver, migrane, and sorethrot");
    expect(result.symptoms).toEqual(
      expect.arrayContaining(["fever", "migraine", "sore throat"]),
    );
  });

  it("deduplicates and caps symptom count", () => {
    const many = Array.from({ length: 20 }, (_, i) => `symptom${i}`).join(", ");
    const result = preprocessSymptoms(many);
    expect(result.symptoms.length).toBeLessThanOrEqual(MAX_SYMPTOMS);
    expect(result.truncated).toBe(true);
  });

  it("fixes misspellings inside free-form sentences", () => {
    const result = preprocessSymptoms(
      "from morning on wards something happening in stamoach where i could not eat",
    );
    expect(result.cleanedText).toContain("stomach");
    expect(result.cleanedText).not.toContain("stamoach");
  });
});

describe("validateSymptoms", () => {
  it("rejects empty input", () => {
    expect(validateSymptoms(preprocessSymptoms("   "))).toMatch(/at least one symptom/i);
  });

  it("rejects gibberish", () => {
    expect(validateSymptoms(preprocessSymptoms("asdf qwrty zxcvb"))).toBeTruthy();
  });

  it("accepts valid symptom text", () => {
    expect(validateSymptoms(preprocessSymptoms("fever and cough"))).toBeNull();
  });
});
