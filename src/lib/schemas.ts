import { z } from "zod";

/** Zod = TypeScript equivalent of Pydantic for request/response validation. */
export const analyzeRequestSchema = z.object({
  symptoms: z
    .string()
    .trim()
    .min(1, "Please enter at least one symptom before submitting.")
    .max(2000, "Symptom text is too long. Please keep it under 2000 characters."),
  age: z.number().int().min(0).max(120).optional(),
  sex: z.enum(["female", "male", "other", "prefer_not_to_say"]).optional(),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

const likelihoodSchema = z
  .enum(["low", "moderate", "high", "medium"])
  .transform((value): "low" | "moderate" | "high" =>
    value === "medium" ? "moderate" : value,
  );

export const conditionSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(8).optional(),
  reasoning: z.string().min(8).optional(),
  suggestedNextStep: z.string().min(5).optional(),
  suggested_next_step: z.string().min(5).optional(),
  likelihood: likelihoodSchema,
});

export const modelResponseSchema = z.object({
  summary: z.string().min(20),
  urgency: z.enum(["routine", "soon", "urgent", "emergency"]).default("soon"),
  disclaimer: z.string().optional(),
  conditions: z.array(conditionSchema).min(3),
});
