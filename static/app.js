const form = document.getElementById("symptomForm");
const symptomsEl = document.getElementById("symptoms");
const ageEl = document.getElementById("age");
const sexEl = document.getElementById("sex");
const charCount = document.getElementById("charCount");
const formError = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");
const resultsPanel = document.getElementById("resultsPanel");
const emergencyBanner = document.getElementById("emergencyBanner");
const logList = document.getElementById("logList");
const refreshLogs = document.getElementById("refreshLogs");

const EMERGENCY_RE =
  /\b(chest\s*pain|can't\s*breathe|cannot\s*breathe|suicid|stroke|kill\s*myself)\b/i;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setEmergency(message) {
  if (!message) {
    emergencyBanner.classList.add("hidden");
    emergencyBanner.textContent = "";
    return;
  }
  emergencyBanner.textContent = message;
  emergencyBanner.classList.remove("hidden");
}

function updateCharCount() {
  charCount.textContent = `${symptomsEl.value.length}/2000`;
  if (EMERGENCY_RE.test(symptomsEl.value)) {
    setEmergency(
      "Emergency warning: your text may include urgent symptoms. If you are in immediate danger, call local emergency services now."
    );
  } else if (!emergencyBanner.dataset.locked) {
    setEmergency(null);
  }
}

symptomsEl.addEventListener("input", updateCharCount);
updateCharCount();

document.querySelectorAll(".example-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    symptomsEl.value = btn.dataset.example || "";
    updateCharCount();
  });
});

function renderLoading() {
  resultsPanel.innerHTML = `<div class="loading-block"><p>Reviewing your symptoms and preparing possible conditions…</p></div>`;
}

function renderResults(data) {
  const conditions = (data.conditions || [])
    .map(
      (c, i) => `
      <li>
        <div class="condition-top">
          <h3>${i + 1}. ${escapeHtml(c.name)}</h3>
          <span class="likelihood">${escapeHtml(c.likelihood)} likelihood</span>
        </div>
        <p>${escapeHtml(c.description || "")}</p>
        ${c.reasoning ? `<p class="muted"><strong>Why listed:</strong> ${escapeHtml(c.reasoning)}</p>` : ""}
        ${
          c.suggestedNextStep || c.suggested_next_step
            ? `<p class="muted"><strong>Suggested next step:</strong> ${escapeHtml(
                c.suggestedNextStep || c.suggested_next_step
              )}</p>`
            : ""
        }
      </li>`
    )
    .join("");

  const corrections = (data.corrections || [])
    .map((item) => `${escapeHtml(item.from)} → ${escapeHtml(item.to)}`)
    .join(" · ");

  resultsPanel.innerHTML = `
    <p class="eyebrow">Analysis summary</p>
    <h2>Preliminary assessment</h2>
    <p>${escapeHtml(data.summary || "")}</p>
    <div class="meta-row">
      <span>Cleaned: ${escapeHtml((data.cleaned_symptoms || []).join(", "))}</span>
      <span>Urgency: ${escapeHtml(data.urgency || "soon")} · ${escapeHtml(String(data.latency_ms || 0))} ms${
        data.cached ? " · cached" : ""
      }</span>
    </div>
    ${corrections ? `<p class="corrections">Standardized: ${corrections}</p>` : ""}
    <ol class="condition-list">${conditions}</ol>
    <aside class="disclaimer">${escapeHtml(data.disclaimer || "")}</aside>
  `;
}

async function loadLogs() {
  try {
    const res = await fetch("/api/logs");
    const data = await res.json();
    const logs = data.logs || [];
    if (!logs.length) {
      logList.innerHTML = `<li class="muted">No submissions yet.</li>`;
      return;
    }
    logList.innerHTML = logs
      .map((entry) => {
        const conditions = entry.modelResponse?.conditions?.map((c) => c.name).join(", ");
        const input = entry.originalInput === "[redacted]"
          ? "Redacted; normalized symptoms retained"
          : entry.originalInput || "(empty)";
        return `<li>
          <time>${escapeHtml(entry.timestamp || "")}</time>
          <p><strong>Input:</strong> ${escapeHtml(input)}</p>
          <p><strong>Cleaned:</strong> ${escapeHtml((entry.cleanedSymptoms || []).join(", ") || "(none)")}</p>
          <p>${
            entry.modelResponse
              ? `<strong>Conditions:</strong> ${escapeHtml(conditions || "")}`
              : `<strong>Error:</strong> ${escapeHtml(entry.error || "")}`
          }</p>
          <p class="muted">${escapeHtml(String(entry.latencyMs || 0))} ms</p>
        </li>`;
      })
      .join("");
  } catch {
    logList.innerHTML = `<li class="error-banner">Could not load logs.</li>`;
  }
}

refreshLogs.addEventListener("click", loadLogs);
loadLogs();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.classList.add("hidden");
  formError.textContent = "";
  emergencyBanner.dataset.locked = "";

  const symptoms = symptomsEl.value.trim();
  if (!symptoms) {
    formError.textContent = "Please enter at least one symptom before submitting.";
    formError.classList.remove("hidden");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Analyzing…";
  renderLoading();

  const body = { symptoms };
  if (ageEl.value.trim()) body.age = Number(ageEl.value);
  if (sexEl.value) body.sex = sexEl.value;

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.emergency_message) {
      emergencyBanner.dataset.locked = "1";
      setEmergency(data.emergency_message);
    }
    if (!res.ok) {
      throw new Error(data.error || "Analysis failed. Please try again.");
    }
    renderResults(data);
    loadLogs();
  } catch (error) {
    formError.textContent = error.message || "Unexpected error.";
    formError.classList.remove("hidden");
    resultsPanel.innerHTML = `<h2>Analysis unavailable</h2><p class="muted">${escapeHtml(
      error.message || "Please try again."
    )}</p>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Analyze symptoms";
  }
});
