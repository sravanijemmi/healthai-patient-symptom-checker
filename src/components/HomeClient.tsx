"use client";

import { useState } from "react";
import { RecentLogs } from "./RecentLogs";
import { ResultsPanel } from "./ResultsPanel";
import { AnalyzeResponse, SymptomForm } from "./SymptomForm";

export function HomeClient() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  const [emergencyMessage, setEmergencyMessage] = useState<string | null>(null);

  return (
    <>
      {emergencyMessage && (
        <aside className="emergency-banner" role="alert">
          {emergencyMessage}
        </aside>
      )}

      <section className="workspace">
        <div className="form-column">
          <SymptomForm
            onResult={(next) => {
              setResult(next);
              setLogRefreshKey((value) => value + 1);
              if (next.emergencyMessage) setEmergencyMessage(next.emergencyMessage);
            }}
            onError={setError}
            onLoadingChange={setLoading}
            onEmergencyPreview={setEmergencyMessage}
          />
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
        </div>
        <ResultsPanel result={result} loading={loading} />
      </section>

      <RecentLogs refreshKey={logRefreshKey} />
    </>
  );
}
