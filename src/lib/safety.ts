/**
 * Rule-based emergency detection — runs before and independent of the LLM.
 * Strong differentiator for a health triage demo.
 */

const EMERGENCY_PATTERNS: Array<{ id: string; label: string; pattern: RegExp }> = [
  {
    id: "chest_pain",
    label: "Chest pain",
    pattern: /\b(chest\s*pain|chestpain|heart\s*attack|crushing\s*chest)\b/i,
  },
  {
    id: "breathing",
    label: "Severe breathing difficulty",
    pattern:
      /\b(can'?t\s*breathe|cannot\s*breathe|hard\s*to\s*breathe|short(ness)?\s*of\s*breath|choking|gasping)\b/i,
  },
  {
    id: "stroke",
    label: "Possible stroke signs",
    pattern:
      /\b(stroke|face\s*droop|arm\s*weakness|slurred\s*speech|sudden\s*numbness|one[- ]sided\s*weakness)\b/i,
  },
  {
    id: "suicide",
    label: "Suicidal thoughts / self-harm",
    pattern:
      /\b(suicid(e|al)|kill\s*myself|end\s*my\s*life|self[- ]?harm|want\s*to\s*die)\b/i,
  },
  {
    id: "severe_bleeding",
    label: "Severe bleeding / trauma",
    pattern: /\b(uncontrollable\s*bleeding|severe\s*bleeding|passed\s*out|unconscious|seizure)\b/i,
  },
  {
    id: "anaphylaxis",
    label: "Possible severe allergic reaction",
    pattern: /\b(anaphylaxis|throat\s*swelling|tongue\s*swelling|epipen)\b/i,
  },
];

export type EmergencyCheck = {
  isEmergency: boolean;
  flags: string[];
  message: string | null;
};

export function detectEmergency(text: string): EmergencyCheck {
  const flags: string[] = [];
  for (const rule of EMERGENCY_PATTERNS) {
    if (rule.pattern.test(text)) {
      flags.push(rule.label);
    }
  }

  if (flags.length === 0) {
    return { isEmergency: false, flags: [], message: null };
  }

  return {
    isEmergency: true,
    flags,
    message:
      "Emergency warning: Your description may include urgent symptoms (" +
      flags.join("; ") +
      "). If you or someone else is in immediate danger, call local emergency services now. Do not wait for this app’s analysis.",
  };
}
