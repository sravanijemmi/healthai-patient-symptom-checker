"use client";

import { useCallback, useEffect, useState } from "react";
import type { LogEntry } from "@/lib/types";

type Props = {
  refreshKey: number;
};

export function RecentLogs({ refreshKey }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/logs");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load logs.");
      }
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="logs-panel">
      <div className="logs-header">
        <div>
          <p className="eyebrow">Structured logging</p>
          <h2>Recent submissions</h2>
          <p className="section-copy">
            The last submissions are stored as JSON lines with timestamps, cleaned
            input, and model responses for later review.
          </p>
        </div>
        <button type="button" className="secondary-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {loading && <p className="muted">Loading logs…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && logs.length === 0 && (
        <p className="muted">No submissions yet. Analyze symptoms to create the first log.</p>
      )}

      <ul className="log-list">
        {logs.map((entry) => (
          <li key={entry.id}>
            <time dateTime={entry.timestamp}>
              {new Date(entry.timestamp).toLocaleString()}
            </time>
            <p>
              <strong>Input:</strong> {entry.originalInput || "(empty)"}
            </p>
            <p>
              <strong>Cleaned:</strong>{" "}
              {entry.cleanedSymptoms.join(", ") || "(none)"}
            </p>
            {entry.modelResponse ? (
              <p>
                <strong>Conditions:</strong>{" "}
                {entry.modelResponse.conditions.map((c) => c.name).join(", ")}
              </p>
            ) : (
              <p>
                <strong>Error:</strong> {entry.error}
              </p>
            )}
            <p className="muted">{entry.latencyMs} ms</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
