"use client";

import { FormEvent, useMemo, useState } from "react";
import { detectEmergency } from "@/lib/safety";
import type { AnalysisResult } from "@/lib/types";

type Correction = { from: string; to: string };

export type AnalyzeResponse = AnalysisResult & {
  corrections: Correction[];
  cached?: boolean;
  truncated?: boolean;
  emergency?: boolean;
  emergencyMessage?: string | null;
  emergencyFlags?: string[];
};

type Props = {
  onResult: (result: AnalyzeResponse) => void;
  onError: (message: string) => void;
  onLoadingChange: (loading: boolean) => void;
  onEmergencyPreview: (message: string | null) => void;
};

const EXAMPLES = [
  "feaver, migrane, and sorethrot",
  "nausia, vomitting, and diarrea for two days",
  "chestpain, short of breath, and dizzyness",
  "fatige, backpain, and can't sleep",
];

const MAX_LEN = 2000;

export function SymptomForm({
  onResult,
  onError,
  onLoadingChange,
  onEmergencyPreview,
}: Props) {
  const [symptoms, setSymptoms] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientError, setClientError] = useState("");

  const liveEmergency = useMemo(() => detectEmergency(symptoms), [symptoms]);

  function updateSymptoms(value: string) {
    setSymptoms(value);
    const check = detectEmergency(value);
    onEmergencyPreview(check.message);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onError("");
    setClientError("");

    const trimmed = symptoms.trim();
    if (!trimmed) {
      setClientError("Please enter at least one symptom before submitting.");
      return;
    }
    if (trimmed.length > MAX_LEN) {
      setClientError(`Please keep symptoms under ${MAX_LEN} characters.`);
      return;
    }

    setLoading(true);
    onLoadingChange(true);

    try {
      const payload: Record<string, unknown> = { symptoms: trimmed };
      if (age.trim()) {
        const ageNum = Number(age);
        if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120) {
          throw new Error("Age must be a whole number between 0 and 120.");
        }
        payload.age = ageNum;
      }
      if (sex) payload.sex = sex;

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.emergencyMessage) {
        onEmergencyPreview(data.emergencyMessage);
      }

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed. Please try again.");
      }

      onResult(data as AnalyzeResponse);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setLoading(false);
      onLoadingChange(false);
    }
  }

  return (
    <form className="symptom-form" onSubmit={handleSubmit}>
      <label htmlFor="symptoms" className="field-label">
        Describe your symptoms
      </label>
      <p className="field-hint">
        Separate symptoms with commas, semicolons, or new lines. Misspellings and
        slang (e.g. tummy ache → abdominal pain) are cleaned before the LLM.
      </p>
      <textarea
        id="symptoms"
        name="symptoms"
        rows={5}
        maxLength={MAX_LEN}
        value={symptoms}
        onChange={(event) => updateSymptoms(event.target.value)}
        placeholder="Example: fever, cough, and a sore throat for 3 days"
        required
        disabled={loading}
      />

      <div className="optional-fields">
        <div>
          <label htmlFor="age">Age (optional)</label>
          <input
            id="age"
            type="number"
            min={0}
            max={120}
            inputMode="numeric"
            value={age}
            disabled={loading}
            onChange={(event) => setAge(event.target.value)}
            placeholder="e.g. 28"
          />
        </div>
        <div>
          <label htmlFor="sex">Sex (optional)</label>
          <select
            id="sex"
            value={sex}
            disabled={loading}
            onChange={(event) => setSex(event.target.value)}
          >
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
      </div>

      <div className="form-meta">
        <span>
          {symptoms.length}/{MAX_LEN}
          {liveEmergency.isEmergency ? " · emergency keywords detected" : ""}
        </span>
        <div className="example-row">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="example-chip"
              disabled={loading}
              onClick={() => updateSymptoms(example)}
            >
              Try: {example}
            </button>
          ))}
        </div>
      </div>

      {clientError && (
        <p className="error-banner" role="alert">
          {clientError}
        </p>
      )}

      <button type="submit" className="primary-btn" disabled={loading || !symptoms.trim()}>
        {loading ? "Analyzing…" : "Analyze symptoms"}
      </button>
    </form>
  );
}
