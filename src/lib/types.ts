export type Likelihood = "low" | "moderate" | "high";

export type HealthCondition = {
  name: string;
  description: string;
  likelihood: Likelihood;
  reasoning: string;
  suggestedNextStep: string;
};

export type Urgency = "routine" | "soon" | "urgent" | "emergency";

export type AnalysisResult = {
  summary: string;
  conditions: HealthCondition[];
  urgency: Urgency;
  disclaimer: string;
  cleanedSymptoms: string[];
  originalInput: string;
  latencyMs: number;
  emergencyFlags?: string[];
};

export type PreprocessResult = {
  original: string;
  cleanedText: string;
  symptoms: string[];
  corrections: Array<{ from: string; to: string }>;
  truncated: boolean;
};

export type PatientContext = {
  age?: number;
  sex?: "female" | "male" | "other" | "prefer_not_to_say";
};

export type LogEntry = {
  id: string;
  timestamp: string;
  originalInput: string;
  cleanedSymptoms: string[];
  corrections: Array<{ from: string; to: string }>;
  patientContext?: PatientContext;
  modelResponse: {
    summary: string;
    urgency: Urgency;
    conditions: HealthCondition[];
  } | null;
  error: string | null;
  latencyMs: number;
  emergencyFlags?: string[];
};
