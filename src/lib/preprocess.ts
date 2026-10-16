import { PHRASE_CORRECTIONS, SYMPTOM_CORRECTIONS } from "./symptom-dictionary";
import type { PreprocessResult } from "./types";

export const MAX_INPUT_LENGTH = 2000;
export const MAX_SYMPTOMS = 15;
const MIN_MEANINGFUL_LENGTH = 3;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Collapse spaces/tabs but keep newlines for symptom splitting. */
function collapseSpacesKeepNewlines(text: string): string {
  return text
    .replace(/[^\S\n\r]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Strip HTML tags and decode a few common entities. */
function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function stripControlChars(text: string): string {
  // Keep newlines (\n \r) so we can split on them; strip other controls.
  return text.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F]/g, " ");
}

function applyPhraseCorrections(text: string): {
  text: string;
  corrections: Array<{ from: string; to: string }>;
} {
  const corrections: Array<{ from: string; to: string }> = [];
  let result = text;

  for (const [pattern, replacement] of PHRASE_CORRECTIONS) {
    const matches = result.match(pattern);
    if (matches) {
      for (const match of matches) {
        const normalizedFrom = match.toLowerCase();
        if (normalizedFrom !== replacement) {
          corrections.push({ from: normalizedFrom, to: replacement });
        }
      }
      result = result.replace(pattern, replacement);
    }
  }

  return { text: result, corrections };
}

/**
 * Split on commas, semicolons, newlines, pipes, and conjunctions.
 */
function tokenizeSymptoms(text: string): string[] {
  return text
    .split(/[\n\r]+|[,;/|]+|\band\b|\bwith\b|\balso\b/i)
    .map((part) => part.replace(/[^\w\s'-]/g, " "))
    .map(collapseWhitespace)
    .filter((part) => part.length >= 2);
}

function correctToken(token: string): {
  value: string;
  correction?: { from: string; to: string };
} {
  const lower = token.toLowerCase();
  const compact = lower.replace(/\s+/g, "");

  if (SYMPTOM_CORRECTIONS[lower]) {
    return {
      value: SYMPTOM_CORRECTIONS[lower],
      correction: { from: lower, to: SYMPTOM_CORRECTIONS[lower] },
    };
  }

  if (SYMPTOM_CORRECTIONS[compact]) {
    return {
      value: SYMPTOM_CORRECTIONS[compact],
      correction: { from: lower, to: SYMPTOM_CORRECTIONS[compact] },
    };
  }

  const words = lower.split(/\s+/);
  let changed = false;
  const correctedWords = words.map((word) => {
    if (SYMPTOM_CORRECTIONS[word]) {
      changed = true;
      return SYMPTOM_CORRECTIONS[word];
    }
    return word;
  });

  if (changed) {
    const value = correctedWords.join(" ");
    return { value, correction: { from: lower, to: value } };
  }

  return { value: lower };
}

function looksLikeGibberish(symptoms: string[], original: string): boolean {
  const letters = original.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 3) return true;

  const vowelRatio =
    (letters.match(/[aeiouAEIOU]/g)?.length ?? 0) / Math.max(letters.length, 1);
  if (vowelRatio < 0.12 && letters.length > 8) return true;

  // Mostly keyboard-smash tokens
  const smash = symptoms.filter((s) => !/[aeiou]/i.test(s) && s.length > 4);
  if (symptoms.length > 0 && smash.length === symptoms.length) return true;

  return false;
}

/**
 * Clean and standardize free-text symptom input before LLM analysis.
 * Pipeline: Unicode NFKC → strip HTML/control → lowercase/trim/collapse →
 * phrase+dictionary map → split → dedupe → cap(15).
 */
export function preprocessSymptoms(rawInput: string): PreprocessResult {
  const original = rawInput ?? "";
  let truncated = false;
  let text = original.normalize("NFKC");
  text = stripHtml(text);
  text = stripControlChars(text);
  text = collapseSpacesKeepNewlines(text);

  if (text.length > MAX_INPUT_LENGTH) {
    text = text.slice(0, MAX_INPUT_LENGTH);
    truncated = true;
  }

  const phrasePass = applyPhraseCorrections(text);
  text = phrasePass.text.toLowerCase();

  const tokens = tokenizeSymptoms(text);
  const corrections = [...phrasePass.corrections];
  const symptoms: string[] = [];

  for (const token of tokens) {
    const { value, correction } = correctToken(token);
    if (correction) corrections.push(correction);
    if (value.length >= MIN_MEANINGFUL_LENGTH) symptoms.push(value);
  }

  const seen = new Set<string>();
  let uniqueSymptoms = symptoms.filter((symptom) => {
    if (seen.has(symptom)) return false;
    seen.add(symptom);
    return true;
  });

  if (uniqueSymptoms.length > MAX_SYMPTOMS) {
    uniqueSymptoms = uniqueSymptoms.slice(0, MAX_SYMPTOMS);
    truncated = true;
  }

  const seenCorrections = new Set<string>();
  const uniqueCorrections = corrections.filter((item) => {
    const key = `${item.from}->${item.to}`;
    if (seenCorrections.has(key)) return false;
    seenCorrections.add(key);
    return true;
  });

  return {
    original: original.trim(),
    cleanedText: uniqueSymptoms.join(", "),
    symptoms: uniqueSymptoms,
    corrections: uniqueCorrections,
    truncated,
  };
}

export function validateSymptoms(preprocessed: PreprocessResult): string | null {
  if (!preprocessed.original || preprocessed.original.trim().length === 0) {
    return "Please enter at least one symptom before submitting.";
  }

  if (
    preprocessed.symptoms.length === 0 ||
    looksLikeGibberish(preprocessed.symptoms, preprocessed.original)
  ) {
    return "Please describe symptoms in plain words (for example: fever, cough, headache). We could not identify meaningful medical symptoms.";
  }

  if (preprocessed.cleanedText.length < MIN_MEANINGFUL_LENGTH) {
    return "Symptom description is too short. Please provide a bit more detail.";
  }

  // Very light non-English heuristic: almost no Latin letters
  const latin = (preprocessed.original.match(/[a-zA-Z]/g) || []).length;
  if (latin < 3 && preprocessed.original.length > 5) {
    return "This demo currently supports English symptom descriptions only.";
  }

  return null;
}
