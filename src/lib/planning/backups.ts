import type { PlanningState } from "./types";
import { STORAGE_KEY } from "./defaults";

/** localStorage key that holds the list of dated backups. */
export const BACKUPS_KEY = `${STORAGE_KEY}:backups`;

/** Maximum number of backups kept (oldest are dropped beyond this). */
export const MAX_BACKUPS = 40;

/** A single dated snapshot of the whole application state. */
export interface Backup {
  id: string;
  /** Creation timestamp (ms). */
  at: number;
  /** Optional user label. */
  label?: string;
  /** Full application state at backup time. */
  state: PlanningState;
}

/** Read all backups (most recent first). */
export function loadBackups(): Backup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BACKUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Backup[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

function persist(list: Backup[]) {
  try {
    window.localStorage.setItem(BACKUPS_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
}

/** Create a new backup from the given state; returns the updated list. */
export function createBackup(state: PlanningState, label?: string): Backup[] {
  const backup: Backup = {
    id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    label: label?.trim() || undefined,
    // Deep clone so later edits never mutate the stored snapshot.
    state: JSON.parse(JSON.stringify(state)) as PlanningState,
  };
  const list = [backup, ...loadBackups()].slice(0, MAX_BACKUPS);
  persist(list);
  return list;
}

/** Delete one backup by id; returns the updated list. */
export function deleteBackup(id: string): Backup[] {
  const list = loadBackups().filter((b) => b.id !== id);
  persist(list);
  return list;
}

/** Rename one backup by id; returns the updated list. */
export function renameBackup(id: string, label: string): Backup[] {
  const list = loadBackups().map((b) =>
    b.id === id ? { ...b, label: label.trim() || undefined } : b,
  );
  persist(list);
  return list;
}

/** Human-readable date/time for a backup (fr-FR). */
export function formatBackupDate(at: number): string {
  return new Date(at).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
