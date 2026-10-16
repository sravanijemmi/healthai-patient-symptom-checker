import { promises as fs } from "fs";
import path from "path";
import type { LogEntry } from "./types";

const LOG_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(LOG_DIR, "submissions.jsonl");
const MAX_STORED = 50;
const MIN_REQUIRED = 10;

async function ensureLogFile() {
  await fs.mkdir(LOG_DIR, { recursive: true });
  try {
    await fs.access(LOG_FILE);
  } catch {
    await fs.writeFile(LOG_FILE, "", "utf8");
  }
}

async function readAllEntries(): Promise<LogEntry[]> {
  await ensureLogFile();
  const raw = await fs.readFile(LOG_FILE, "utf8");
  if (!raw.trim()) return [];

  const entries: LogEntry[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as LogEntry);
    } catch {
      // Skip corrupt lines rather than failing the whole log read
    }
  }
  return entries;
}

/** Returns newest-first logs (at least the last 10 available). */
export async function readLogs(limit = MIN_REQUIRED): Promise<LogEntry[]> {
  const entries = await readAllEntries();
  const take = Math.max(limit, MIN_REQUIRED);
  return entries.slice(-take).reverse();
}

export async function appendLog(entry: LogEntry): Promise<void> {
  const entries = await readAllEntries();
  entries.push(entry);
  const trimmed = entries.slice(-MAX_STORED);
  const payload = trimmed.map((item) => JSON.stringify(item)).join("\n") + "\n";
  await fs.writeFile(LOG_FILE, payload, "utf8");
}

export function createLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export { LOG_FILE, MIN_REQUIRED, MAX_STORED };
