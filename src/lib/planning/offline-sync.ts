import { supabase } from "@/integrations/supabase/client";
import { STORAGE_KEY } from "./defaults";

/**
 * Synchronisation différée : quand l'application a été utilisée hors ligne,
 * chaque planning local (`ucpa-planning-v1:<workspaceId>`) peut être en avance
 * sur la copie Cloud. On mémorise l'empreinte du dernier état réellement
 * envoyé (`…:<workspaceId>:synced`) pour savoir ce qu'il reste à pousser.
 */

const CLOUD_TABLE = "workspace_planning";

/** Empreinte compacte et stable d'une chaîne (djb2). */
export function hashState(json: string): string {
  let h = 5381;
  for (let i = 0; i < json.length; i += 1) {
    h = ((h << 5) + h + json.charCodeAt(i)) | 0;
  }
  return `${h}:${json.length}`;
}

export function syncedKeyFor(workspaceId: string): string {
  return `${STORAGE_KEY}:${workspaceId}:synced`;
}

/** Marque un planning comme synchronisé avec le Cloud. */
export function markSynced(workspaceId: string, json: string): void {
  try {
    window.localStorage.setItem(syncedKeyFor(workspaceId), hashState(json));
  } catch {
    /* ignore */
  }
}

/** Identifiants des plannings locaux en attente d'envoi. */
export function listPendingWorkspaces(): string[] {
  if (typeof window === "undefined") return [];
  const pending: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(`${STORAGE_KEY}:`)) continue;
      const rest = key.slice(STORAGE_KEY.length + 1);
      // Ignorer les clés auxiliaires (backups, :synced, …)
      if (rest.includes(":") || rest === "backups") continue;
      const json = window.localStorage.getItem(key);
      if (!json) continue;
      const synced = window.localStorage.getItem(syncedKeyFor(rest));
      if (synced === hashState(json)) continue;
      pending.push(rest);
    }
  } catch {
    /* ignore */
  }
  return pending;
}

export interface SyncProgress {
  /** Nombre de plannings déjà traités. */
  done: number;
  /** Nombre total de plannings à envoyer. */
  total: number;
  /** Planning en cours d'envoi. */
  current?: string;
}

export interface SyncResult {
  sent: number;
  failed: number;
  total: number;
  lastError?: string;
}

/** Envoie tous les plannings locaux en attente vers le Cloud. */
export async function syncPendingWorkspaces(
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncResult> {
  const ids = listPendingWorkspaces();
  const total = ids.length;
  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;

  onProgress?.({ done: 0, total });

  for (const [index, workspaceId] of ids.entries()) {
    onProgress?.({ done: index, total, current: workspaceId });
    const json = window.localStorage.getItem(`${STORAGE_KEY}:${workspaceId}`);
    if (!json) {
      failed += 1;
      continue;
    }
    try {
      const { error } = await supabase
        .from(CLOUD_TABLE)
        .upsert(
          { workspace_id: workspaceId, state: JSON.parse(json) },
          { onConflict: "workspace_id" },
        );
      if (error) {
        failed += 1;
        lastError = error.message;
      } else {
        markSynced(workspaceId, json);
        sent += 1;
      }
    } catch (err) {
      failed += 1;
      lastError = err instanceof Error ? err.message : String(err);
    }
    onProgress?.({ done: index + 1, total, current: workspaceId });
  }

  return { sent, failed, total, lastError };
}
