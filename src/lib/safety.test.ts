import { describe, expect, it } from "vitest";
import { detectEmergency } from "./safety";

describe("detectEmergency", () => {
  it("flags chest pain", () => {
    const result = detectEmergency("I have chest pain and feel dizzy");
    expect(result.isEmergency).toBe(true);
    expect(result.flags.join(" ")).toMatch(/chest/i);
  });

  it("flags breathing difficulty", () => {
    const result = detectEmergency("I can't breathe well");
    expect(result.isEmergency).toBe(true);
  });

  it("flags suicidal language", () => {
    const result = detectEmergency("I want to kill myself");
    expect(result.isEmergency).toBe(true);
  });

  it("does not flag ordinary cold symptoms", () => {
    const result = detectEmergency("mild cough and runny nose");
    expect(result.isEmergency).toBe(false);
    expect(result.flags).toHaveLength(0);
  });
});
