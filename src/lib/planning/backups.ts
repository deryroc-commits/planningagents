import type { PlanningState } from "./types";
import { STORAGE_KEY } from "./defaults";

/**
 * Backups are kept in separate lists per "scope" so the Planning tab and the
 * Paramètres tab each have their own independent saves.
 */
export type BackupScope = "planning" | "params";

/** localStorage key that holds the list of dated backups for a scope. */
export const BACKUPS_KEY = `${STORAGE_KEY}:backups`;

function keyFor(scope: BackupScope): string {
  // Keep the historical key for the planning scope so existing backups survive.
  return scope === "planning" ? BACKUPS_KEY : `${BACKUPS_KEY}:${scope}`;
}

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

/** Read all backups (most recent first) for a scope. */
export function loadBackups(scope: BackupScope): Backup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Backup[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

function persist(scope: BackupScope, list: Backup[]) {
  try {
    window.localStorage.setItem(keyFor(scope), JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
}

/** Create a new backup from the given state; returns the updated list. */
export function createBackup(
  scope: BackupScope,
  state: PlanningState,
  label?: string,
): Backup[] {
  const backup: Backup = {
    id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    label: label?.trim() || undefined,
    // Deep clone so later edits never mutate the stored snapshot.
    state: JSON.parse(JSON.stringify(state)) as PlanningState,
  };
  const list = [backup, ...loadBackups(scope)].slice(0, MAX_BACKUPS);
  persist(scope, list);
  return list;
}

/** Delete one backup by id; returns the updated list. */
export function deleteBackup(scope: BackupScope, id: string): Backup[] {
  const list = loadBackups(scope).filter((b) => b.id !== id);
  persist(scope, list);
  return list;
}

/** Rename one backup by id; returns the updated list. */
export function renameBackup(
  scope: BackupScope,
  id: string,
  label: string,
): Backup[] {
  const list = loadBackups(scope).map((b) =>
    b.id === id ? { ...b, label: label.trim() || undefined } : b,
  );
  persist(scope, list);
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
