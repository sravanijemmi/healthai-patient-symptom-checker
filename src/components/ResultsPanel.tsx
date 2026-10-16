"use client";

import type { AnalyzeResponse } from "./SymptomForm";

type Props = {
  result: AnalyzeResponse | null;
  loading: boolean;
};

const likelihoodLabel: Record<string, string> = {
  low: "Lower likelihood",
  moderate: "Moderate likelihood",
  high: "Higher likelihood",
};

export function ResultsPanel({ result, loading }: Props) {
  if (loading) {
    return (
      <section className="results-panel" aria-live="polite">
        <div className="loading-block">
          <div className="pulse-bar" />
          <p>Reviewing your symptoms and preparing possible conditions…</p>
        </div>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="results-panel empty">
        <h2>Your assessment will appear here</h2>
        <p>
          Submit symptoms to see a short summary and at least three possible
          health conditions with plain-language reasoning.
        </p>
      </section>
    );
  }

  return (
    <section className="results-panel" aria-live="polite">
      <header className="results-header">
        <p className="eyebrow">Analysis summary</p>
        <h2>Preliminary assessment</h2>
        <p className="summary">{result.summary}</p>
        <div className="meta-row">
          <span>Cleaned symptoms: {result.cleanedSymptoms.join(", ")}</span>
          <span>
            Urgency: {result.urgency}
            {result.cached ? " · cached" : ""} · {result.latencyMs} ms
          </span>
        </div>
        {result.corrections?.length > 0 && (
          <p className="corrections">
            Standardized:{" "}
            {result.corrections
              .map((item) => `${item.from} → ${item.to}`)
              .join(" · ")}
          </p>
        )}
      </header>

      <ol className="condition-list">
        {result.conditions.map((condition, index) => (
          <li key={`${condition.name}-${index}`}>
            <div className="condition-top">
              <span className="condition-index">{index + 1}</span>
              <h3>{condition.name}</h3>
              <span className={`likelihood likelihood-${condition.likelihood}`}>
                {likelihoodLabel[condition.likelihood]}
              </span>
            </div>
            <p>{condition.description}</p>
            {condition.reasoning && (
              <p className="muted">
                <strong>Why listed:</strong> {condition.reasoning}
              </p>
            )}
            {condition.suggestedNextStep && (
              <p className="muted">
                <strong>Suggested next step:</strong> {condition.suggestedNextStep}
              </p>
            )}
          </li>
        ))}
      </ol>

      <aside className="disclaimer">{result.disclaimer}</aside>
    </section>
  );
}
