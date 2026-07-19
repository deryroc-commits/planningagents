import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  Agent,
  AgentSortMode,
  ColorKey,
  ColorScheme,
  OvertimeEntry,
  PlanningCode,
  PlanningState,
  RotationState,
  YearChanges,
  YearOvertime,
  YearPlanning,
  YearRangeConfig,
} from "./types";
import { sortAgents, listTeams, orderTeams } from "./types";
import {
  DEFAULT_AGENTS,
  DEFAULT_CATALOG_VERSION,
  DEFAULT_CODES,
  DEFAULT_COLORS,
  DEFAULT_OVERTIME_THRESHOLD,
  DEFAULT_ROTATION,
  DEFAULT_YEAR_RANGE,
  STORAGE_KEY,
} from "./defaults";
import { codeForCell, normalizeRotation } from "./rotation";
import { daysInYear } from "./calc";

export type SyncStatus = "idle" | "pending" | "syncing" | "error" | "offline";

type SyncStatusValue = {
  status: SyncStatus;
  isOnline: boolean;
  hasPendingChanges: boolean;
};

const SyncStatusContext = createContext<SyncStatusValue | null>(null);

export function useSyncStatus(): SyncStatusValue {
  return (
    useContext(SyncStatusContext) ?? {
      status: "idle",
      isOnline: true,
      hasPendingChanges: false,
    }
  );
}

/**
 * Record (or clear) a change for one cell, relative to the original value the
 * cell held before editing started. Reverting a cell to its original value
 * removes the entry. Returns a NEW map (never mutates the input).
 */
function recordChange(
  prev: YearChanges,
  agentId: string,
  dayIndex: number,
  before: string | undefined,
  after: string | undefined,
): YearChanges {
  const key = `${agentId}:${dayIndex}`;
  const b = before ?? "";
  const a = after ?? "";
  const existing = prev[key];
  const origin = existing ? existing.from : b;
  const next = { ...prev };
  if (a === origin) {
    delete next[key];
  } else {
    next[key] = { agentId, dayIndex, from: origin, to: a, at: Date.now() };
  }
  return next;
}

interface PlanningContextValue {
  year: number;
  setYear: (y: number) => void;
  codes: PlanningCode[];
  agents: Agent[];
  planning: YearPlanning;
  /** Full planning for every year (read-only view; used by the transition sheet). */
  planningByYear: Record<number, YearPlanning>;
  // cell
  setCell: (agentId: string, dayIndex: number, code: string | null) => void;
  /** Like setCell but targets an explicit year (for cross-year editing). */
  setCellForYear: (
    year: number,
    agentId: string,
    dayIndex: number,
    code: string | null,
  ) => void;
  fillRange: (agentId: string, indices: number[], code: string | null) => void;
  /** Set many cells at once (used by range copy/paste). */
  pasteBlock: (
    cells: { agentId: string; dayIndex: number; code: string | null }[],
  ) => void;
  // codes
  upsertCode: (code: PlanningCode, originalCode?: string) => void;
  removeCode: (code: string) => void;
  // agents
  addAgent: (a: Omit<Agent, "id">) => void;
  updateAgent: (id: string, patch: Partial<Omit<Agent, "id">>) => void;
  removeAgent: (id: string) => void;
  /** How agents are ordered in every view. */
  agentSort: AgentSortMode;
  setAgentSort: (mode: AgentSortMode) => void;
  /** Move an agent up/down in the custom (manual) order. */
  moveAgent: (id: string, dir: "up" | "down") => void;
  /** Drag-and-drop: move an agent to a target index in the custom order. */
  reorderAgent: (id: string, toIndex: number) => void;
  /** Effective ordered list of the teams present (for the "team" sort modes). */
  teamOrder: string[];
  /** Move a team up/down in the admin-defined team order. */
  moveTeam: (team: string, dir: "up" | "down") => void;
  /** Drag-and-drop: move a team to a target index in the admin order. */
  reorderTeam: (team: string, toIndex: number) => void;
  /** Reset the admin-defined team order to the default (alphabetical). */
  resetTeamOrder: () => void;
  // bulk
  replaceState: (s: Partial<PlanningState>) => void;
  /** Full, deep snapshot of the whole application state (for backups). */
  snapshotState: () => PlanningState;
  /** Replace the ENTIRE application state (restore a backup). */
  restoreFullState: (s: PlanningState) => void;
  /**
   * Restore only the rotation from a backup into a single year (the currently
   * selected year by default, or an explicit `targetYear`). Every other year
   * and all other data are left untouched, so restoring one year's rotation
   * never overwrites the other years' history. Useful to reuse an existing
   * rotation as the starting point for a brand-new year.
   */
  restoreYearRotation: (s: PlanningState, targetYear?: number) => void;
  resetAll: () => void;
  clearPlanning: () => void;
  clearYear: (year: number) => void;
  // changes (Modifications tab)
  changes: YearChanges;
  clearChanges: (year: number) => void;
  // overtime (Heures supp. tab)
  overtime: YearOvertime;
  overtimeThreshold: number;
  addOvertime: (entry: Omit<OvertimeEntry, "id" | "at">) => void;
  removeOvertime: (id: string) => void;
  clearOvertimeAgent: (agentId: string) => void;
  clearOvertimeYear: (year: number) => void;
  setOvertimeThreshold: (hours: number) => void;
  // selectable-year range
  yearRange: YearRangeConfig;
  setYearRange: (range: YearRangeConfig) => void;
  // colors
  colors: ColorScheme;
  setColor: (key: ColorKey, part: "bg" | "fg", hex: string) => void;
  resetColors: () => void;
  // rotation
  rotation: RotationState;
  setRotation: (r: RotationState) => void;
  /** True when the current year uses its own rotation (vs the shared base). */
  rotationYearSpecific: boolean;
  /** Switch the current year between the shared base rotation and its own copy. */
  setRotationYearSpecific: (specific: boolean) => void;
  applyRotation: (
    mode: "replace" | "fill",
    fromDayIndex?: number,
    toDayIndex?: number,
  ) => number;
}

const PlanningContext = createContext<PlanningContextValue | null>(null);

const CLOUD_TABLE = "workspace_planning";
const CLOUD_SAVE_DEBOUNCE_MS = 700;

/** Build a <style> string that maps the color scheme onto the CSS variables. */
function colorsToCss(colors: ColorScheme): string {
  return `:root{
    --cat-travail-bg:${colors.travail.bg};--cat-travail-fg:${colors.travail.fg};
    --cat-poste-bg:${colors.poste.bg};--cat-poste-fg:${colors.poste.fg};
    --cat-repos-bg:${colors.repos.bg};--cat-repos-fg:${colors.repos.fg};
    --cat-recup-bg:${colors.recup.bg};--cat-recup-fg:${colors.recup.fg};
    --cat-absence-bg:${colors.absence.bg};--cat-absence-fg:${colors.absence.fg};
    --cat-autre-bg:${colors.autre.bg};--cat-autre-fg:${colors.autre.fg};
    --cat-error-bg:${colors.error.bg};--cat-error-fg:${colors.error.fg};
    --cell-weekend:${colors.weekend.bg};
    --cell-holiday:${colors.holiday.bg};--cell-holiday-fg:${colors.holiday.fg};
  }`;
}

const EXAMPLE_AGENT_NAMES = new Set([
  "Dupont Marie",
  "Martin Lucas",
  "Bernard Sophie",
  "Petit Thomas",
  "Robert Julie",
  "Richard Antoine",
]);

/**
 * Existing browsers keep their own localStorage copy forever. When the default
 * Paramètres catalog changes, add only the new built-in codes once, while
 * preserving any user edits or custom codes already stored locally.
 */
function mergeDefaultCodes(stored: PlanningCode[] | undefined): PlanningCode[] {
  if (!stored?.length) return DEFAULT_CODES;
  const seen = new Set(stored.map((code) => code.code));
  const missingDefaults = DEFAULT_CODES.filter((code) => !seen.has(code.code));
  return missingDefaults.length ? [...stored, ...missingDefaults] : stored;
}

/** Clamp/validate a stored year-range config, falling back to defaults. */
function normalizeYearRange(input: unknown): YearRangeConfig {
  const r = (input ?? {}) as Partial<YearRangeConfig>;
  const start =
    typeof r.start === "number" && Number.isFinite(r.start)
      ? Math.round(r.start)
      : DEFAULT_YEAR_RANGE.start;
  const ahead =
    typeof r.ahead === "number" && Number.isFinite(r.ahead)
      ? Math.round(r.ahead)
      : DEFAULT_YEAR_RANGE.ahead;
  return {
    start: Math.min(Math.max(start, 1970), 2100),
    ahead: Math.min(Math.max(ahead, 0), 50),
  };
}

/** Validate a stored agent-sort mode, defaulting to "custom". */
function normalizeAgentSort(v: unknown): AgentSortMode {
  return v === "alpha" || v === "team" || v === "team-alpha" ? v : "custom";
}

/** Normalize a per-year rotation map, dropping empty/invalid entries. */
function normalizeRotationByYear(
  input: Record<number, RotationState> | undefined,
): Record<number, RotationState> {
  const out: Record<number, RotationState> = {};
  if (!input) return out;
  for (const key in input) {
    const y = Number(key);
    if (!Number.isFinite(y)) continue;
    if (!input[key as unknown as number]) continue;
    out[y] = normalizeRotation(input[key as unknown as number]);
  }
  return out;
}

function normalizePlanningState(input: Partial<PlanningState> | null | undefined): PlanningState {
  const parsed = input ?? {};
  const agents = isPristineDemoInstall(parsed) ? DEFAULT_AGENTS : parsed.agents;
  const codes =
    (parsed.catalogVersion ?? 0) < DEFAULT_CATALOG_VERSION
      ? mergeDefaultCodes(parsed.codes)
      : parsed.codes?.length
        ? parsed.codes
        : DEFAULT_CODES;

  return {
    catalogVersion: DEFAULT_CATALOG_VERSION,
    codes,
    agents: agents?.length ? agents : DEFAULT_AGENTS,
    agentSort: normalizeAgentSort(parsed.agentSort),
    teamOrder: Array.isArray(parsed.teamOrder)
      ? parsed.teamOrder.filter((t): t is string => typeof t === "string")
      : [],
    planningByYear: parsed.planningByYear ?? {},
    colors: { ...DEFAULT_COLORS, ...(parsed.colors ?? {}) },
    rotation: normalizeRotation(parsed.rotation ?? DEFAULT_ROTATION),
    rotationByYear: normalizeRotationByYear(parsed.rotationByYear),
    changesByYear: parsed.changesByYear ?? {},
    overtimeByYear: parsed.overtimeByYear ?? {},
    overtimeThreshold:
      typeof parsed.overtimeThreshold === "number"
        ? parsed.overtimeThreshold
        : DEFAULT_OVERTIME_THRESHOLD,
    yearRange: normalizeYearRange(parsed.yearRange),
  };
}


/**
 * True only for a pristine, untouched demo install: every stored agent is one
 * of the built-in demo names AND the user has entered no planning, no tracked
 * changes and no overtime. In that case (and only that case) it is safe to
 * upgrade the roster to the current DEFAULT_AGENTS without losing user data.
 *
 * If the user added their own agents, or entered any data against the demo
 * agents, we keep their stored agents untouched so nothing gets orphaned or
 * wiped.
 */
function isPristineDemoInstall(parsed: Partial<PlanningState>): boolean {
  const agents = parsed.agents;
  if (!agents?.length) return false;
  if (!agents.every((agent) => EXAMPLE_AGENT_NAMES.has(agent.name))) return false;

  const hasPlanning = Object.values(parsed.planningByYear ?? {}).some(
    (yp) => yp && Object.keys(yp).length > 0,
  );
  const hasChanges = Object.values(parsed.changesByYear ?? {}).some(
    (yc) => yc && Object.keys(yc).length > 0,
  );
  const hasOvertime = Object.values(parsed.overtimeByYear ?? {}).some(
    (list) => list && list.length > 0,
  );
  return !hasPlanning && !hasChanges && !hasOvertime;
}

function emptyPlanningState(): PlanningState {
  const base = normalizePlanningState(null);
  return { ...base, agents: [], planningByYear: {} };
}

function loadState(key: string): PlanningState {
  if (typeof window === "undefined") return emptyPlanningState();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return emptyPlanningState();
    const parsed = JSON.parse(raw) as Partial<PlanningState>;
    return normalizePlanningState(parsed);
  } catch {
    return emptyPlanningState();
  }
}

/**
 * 3-way merge of a record-of-records (e.g. planningByYear[y] keyed by agent,
 * or changesByYear[y] keyed by cell). Starts from `remote` and re-applies any
 * inner entry the local copy changed relative to `base`. This preserves remote
 * edits to untouched entries while keeping local pending edits, so two editors
 * touching different cells no longer overwrite each other.
 */
function mergeRecordOfRecords<T>(
  base: Record<string, Record<string, T>> | undefined,
  remote: Record<string, Record<string, T>> | undefined,
  local: Record<string, Record<string, T>> | undefined,
  eq: (a: T | undefined, b: T | undefined) => boolean,
): Record<string, Record<string, T>> {
  const b = base ?? {};
  const r = remote ?? {};
  const l = local ?? {};
  const result: Record<string, Record<string, T>> = {};
  const outerKeys = new Set([
    ...Object.keys(r),
    ...Object.keys(l),
    ...Object.keys(b),
  ]);
  for (const ok of outerKeys) {
    const bi = b[ok] ?? {};
    const ri = r[ok] ?? {};
    const li = l[ok] ?? {};
    const inner: Record<string, T> = { ...ri };
    const innerKeys = new Set([...Object.keys(bi), ...Object.keys(li)]);
    for (const ik of innerKeys) {
      const bv = bi[ik];
      const lv = li[ik];
      if (!eq(lv, bv)) {
        // The local copy changed this entry since the last known server state.
        if (lv === undefined) delete inner[ik];
        else inner[ik] = lv;
      }
    }
    if (Object.keys(inner).length > 0) result[ok] = inner;
  }
  return result;
}

/**
 * 3-way merge of the whole planning state. `base` is the last state we know the
 * server had; `remote` is the incoming realtime update; `local` is our current
 * (possibly unsaved) state. Planning cells and tracked changes merge per-cell;
 * other fields keep the local copy only when it changed relative to `base`.
 */
function mergeCloudState(
  base: PlanningState,
  remote: PlanningState,
  local: PlanningState,
): PlanningState {
  const localChanged = (key: keyof PlanningState) =>
    JSON.stringify(local[key]) !== JSON.stringify(base[key]);
  const pick = <K extends keyof PlanningState>(key: K): PlanningState[K] =>
    localChanged(key) ? local[key] : remote[key];

  return {
    catalogVersion: remote.catalogVersion,
    codes: pick("codes"),
    agents: pick("agents"),
    agentSort: pick("agentSort"),
    teamOrder: pick("teamOrder"),
    planningByYear: mergeRecordOfRecords(
      base.planningByYear,
      remote.planningByYear,
      local.planningByYear,
      (a, b) => a === b,
    ),
    colors: pick("colors"),
    rotation: pick("rotation"),
    rotationByYear: pick("rotationByYear"),
    changesByYear: mergeRecordOfRecords(
      base.changesByYear,
      remote.changesByYear,
      local.changesByYear,
      (a, b) => JSON.stringify(a) === JSON.stringify(b),
    ),
    overtimeByYear: pick("overtimeByYear"),
    overtimeThreshold: pick("overtimeThreshold"),
    yearRange: pick("yearRange"),
  };
}

export function PlanningProvider({
  children,
  workspaceId,
  writable = true,
}: {
  children: ReactNode;
  workspaceId: string;
  writable?: boolean;
}) {
  const localKey = `${STORAGE_KEY}:${workspaceId}`;
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [state, setState] = useState<PlanningState>(() => ({
    codes: DEFAULT_CODES,
    catalogVersion: DEFAULT_CATALOG_VERSION,
    agents: DEFAULT_AGENTS,
    planningByYear: {},
    colors: DEFAULT_COLORS,
    rotation: DEFAULT_ROTATION,
    overtimeByYear: {},
    overtimeThreshold: DEFAULT_OVERTIME_THRESHOLD,
    yearRange: DEFAULT_YEAR_RANGE,
  }));
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const hydrated = useRef(false);
  const lastCloudJson = useRef<string | null>(null);
  const cloudSaveTimer = useRef<number | null>(null);
  // Always-current snapshot of local state, so the realtime handler can 3-way
  // merge incoming updates against unsaved local edits without stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);


  const writeLocalState = useCallback(
    (next: PlanningState) => {
      try {
        window.localStorage.setItem(localKey, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    },
    [localKey],
  );

  // Hydrate from localStorage first, then replace it with the shared Cloud copy.
  useEffect(() => {
    let cancelled = false;
    const localState = loadState(localKey);
    setState(localState);

    async function loadCloudState() {
      const { data, error } = await supabase
        .from(CLOUD_TABLE)
        .select("state")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn("Impossible de charger la sauvegarde Cloud", error.message);
        return;
      }

      if (data?.state) {
        const next = normalizePlanningState(data.state as Partial<PlanningState>);
        lastCloudJson.current = JSON.stringify(next);
        setState(next);
        writeLocalState(next);
        setCloudReady(true);
        return;
      }

      // No planning yet for this workspace. Only editors may create the row.
      if (!writable) {
        setCloudReady(true);
        return;
      }

      const json = JSON.stringify(localState);
      const { error: seedError } = await supabase
        .from(CLOUD_TABLE)
        .upsert(
          { workspace_id: workspaceId, state: localState as unknown as Json },
          { onConflict: "workspace_id" },
        );

      if (cancelled) return;
      if (seedError) {
        console.warn("Impossible d'initialiser la sauvegarde Cloud", seedError.message);
        return;
      }

      lastCloudJson.current = json;
      setCloudReady(true);
    }

    void loadCloudState();

    return () => {
      cancelled = true;
    };
  }, [localKey, workspaceId, writable, writeLocalState]);

  // Persist — but skip the initial mount. Writing the default state before
  // hydration finishes would fire a `storage` event that reverts other open
  // viewers (Impression / Base agents) back to defaults.
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    writeLocalState(state);
  }, [state, writeLocalState]);

  // Persist changes to Cloud after the first Cloud read has completed.
  useEffect(() => {
    if (!cloudReady || !writable) {
      setSyncStatus("idle");
      return;
    }

    const json = JSON.stringify(state);
    if (json === lastCloudJson.current) {
      setSyncStatus(isOnline ? "idle" : "offline");
      return;
    }

    // Local edits not yet reflected in the Cloud snapshot.
    setSyncStatus(isOnline ? "pending" : "offline");

    if (!isOnline) {
      // Wait until we come back online — effect re-runs when isOnline flips.
      return;
    }

    if (cloudSaveTimer.current !== null) {
      window.clearTimeout(cloudSaveTimer.current);
    }

    cloudSaveTimer.current = window.setTimeout(() => {
      setSyncStatus("syncing");
      void supabase
        .from(CLOUD_TABLE)
        .upsert(
          { workspace_id: workspaceId, state: state as unknown as Json },
          { onConflict: "workspace_id" },
        )
        .then(({ error }) => {
          if (error) {
            console.warn("Impossible de sauvegarder le planning dans le Cloud", error.message);
            setSyncStatus(
              typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error",
            );
            return;
          }
          lastCloudJson.current = json;
          setSyncStatus("idle");
        });
    }, CLOUD_SAVE_DEBOUNCE_MS);

    return () => {
      if (cloudSaveTimer.current !== null) {
        window.clearTimeout(cloudSaveTimer.current);
      }
    };
  }, [cloudReady, writable, workspaceId, state, isOnline]);


  // Receive updates saved from another browser/device for this workspace.
  useEffect(() => {
    const channel = supabase
      .channel(`workspace-planning-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: CLOUD_TABLE,
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const remoteState = (payload.new as { state?: unknown } | null)?.state;
          if (!remoteState) return;

          const remote = normalizePlanningState(remoteState as Partial<PlanningState>);
          const remoteJson = JSON.stringify(remote);
          // We already have this exact server state (e.g. our own echo). Skip.
          if (remoteJson === lastCloudJson.current) return;

          // Without a known base we cannot merge safely — adopt remote as-is.
          if (lastCloudJson.current === null) {
            lastCloudJson.current = remoteJson;
            setState(remote);
            writeLocalState(remote);
            return;
          }

          // 3-way merge: keep any local edits made since the last known server
          // state, layered on top of the incoming remote update.
          const base = normalizePlanningState(
            JSON.parse(lastCloudJson.current) as Partial<PlanningState>,
          );
          const merged = normalizePlanningState(
            mergeCloudState(base, remote, stateRef.current),
          );

          // Baseline is the actual server state; if our merge added local-only
          // edits, the save effect will detect the diff and push them back.
          lastCloudJson.current = remoteJson;
          setState(merged);
          writeLocalState(merged);
        },

      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, writeLocalState]);

  // Keep every open view (other tabs/viewers) in sync: when the stored data
  // changes elsewhere (e.g. an import), reload it so Impression & Base agents
  // never stay out of date.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== localKey) return;
      setState(loadState(localKey));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [localKey]);


  const planning = state.planningByYear[year] ?? {};

  const setCell = useCallback(
    (agentId: string, dayIndex: number, code: string | null) => {
      setState((prev) => {
        const yp = { ...(prev.planningByYear[year] ?? {}) };
        const row = { ...(yp[agentId] ?? {}) };
        const before = row[dayIndex];
        const after = code === null || code === "" ? undefined : code;
        if (after === undefined) delete row[dayIndex];
        else row[dayIndex] = after;
        yp[agentId] = row;
        const yc = recordChange(
          prev.changesByYear?.[year] ?? {},
          agentId,
          dayIndex,
          before,
          after,
        );
        return {
          ...prev,
          planningByYear: { ...prev.planningByYear, [year]: yp },
          changesByYear: { ...prev.changesByYear, [year]: yc },
        };
      });
    },
    [year],
  );

  const setCellForYear = useCallback(
    (y: number, agentId: string, dayIndex: number, code: string | null) => {
      setState((prev) => {
        const yp = { ...(prev.planningByYear[y] ?? {}) };
        const row = { ...(yp[agentId] ?? {}) };
        const before = row[dayIndex];
        const after = code === null || code === "" ? undefined : code;
        if (after === undefined) delete row[dayIndex];
        else row[dayIndex] = after;
        yp[agentId] = row;
        const yc = recordChange(
          prev.changesByYear?.[y] ?? {},
          agentId,
          dayIndex,
          before,
          after,
        );
        return {
          ...prev,
          planningByYear: { ...prev.planningByYear, [y]: yp },
          changesByYear: { ...prev.changesByYear, [y]: yc },
        };
      });
    },
    [],
  );

  const fillRange = useCallback(
    (agentId: string, indices: number[], code: string | null) => {
      setState((prev) => {
        const yp = { ...(prev.planningByYear[year] ?? {}) };
        const row = { ...(yp[agentId] ?? {}) };
        let yc = prev.changesByYear?.[year] ?? {};
        const after = code === null || code === "" ? undefined : code;
        for (const i of indices) {
          const before = row[i];
          if (after === undefined) delete row[i];
          else row[i] = after;
          yc = recordChange(yc, agentId, i, before, after);
        }
        yp[agentId] = row;
        return {
          ...prev,
          planningByYear: { ...prev.planningByYear, [year]: yp },
          changesByYear: { ...prev.changesByYear, [year]: yc },
        };
      });
    },
    [year],
  );

  const pasteBlock = useCallback(
    (cells: { agentId: string; dayIndex: number; code: string | null }[]) => {
      if (cells.length === 0) return;
      setState((prev) => {
        const yp = { ...(prev.planningByYear[year] ?? {}) };
        let yc = prev.changesByYear?.[year] ?? {};
        const rows: Record<string, Record<number, string>> = {};
        for (const { agentId, dayIndex, code } of cells) {
          const row = rows[agentId] ?? { ...(yp[agentId] ?? {}) };
          const before = row[dayIndex];
          const after = code === null || code === "" ? undefined : code;
          if (after === undefined) delete row[dayIndex];
          else row[dayIndex] = after;
          rows[agentId] = row;
          yc = recordChange(yc, agentId, dayIndex, before, after);
        }
        for (const agentId in rows) yp[agentId] = rows[agentId];
        return {
          ...prev,
          planningByYear: { ...prev.planningByYear, [year]: yp },
          changesByYear: { ...prev.changesByYear, [year]: yc },
        };
      });
    },
    [year],
  );



  const upsertCode = useCallback((code: PlanningCode, originalCode?: string) => {
    setState((prev) => {
      const codes = [...prev.codes];
      const key = originalCode ?? code.code;
      const idx = codes.findIndex((c) => c.code === key);
      if (idx >= 0) codes[idx] = code;
      else codes.push(code);
      return { ...prev, codes };
    });
  }, []);

  const removeCode = useCallback((code: string) => {
    setState((prev) => ({
      ...prev,
      codes: prev.codes.filter((c) => c.code !== code),
    }));
  }, []);

  const addAgent = useCallback((a: Omit<Agent, "id">) => {
    setState((prev) => ({
      ...prev,
      agents: [
        ...prev.agents,
        { ...a, id: `ag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
      ],
    }));
  }, []);

  const updateAgent = useCallback((id: string, patch: Partial<Omit<Agent, "id">>) => {
    setState((prev) => ({
      ...prev,
      agents: prev.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }, []);

  const removeAgent = useCallback((id: string) => {
    setState((prev) => {
      const planningByYear: Record<number, YearPlanning> = {};
      for (const y in prev.planningByYear) {
        const yp = { ...prev.planningByYear[y] };
        delete yp[id];
        planningByYear[Number(y)] = yp;
      }
      return {
        ...prev,
        agents: prev.agents.filter((a) => a.id !== id),
        planningByYear,
      };
    });
  }, []);

  const agentSort = normalizeAgentSort(state.agentSort);

  const setAgentSort = useCallback((mode: AgentSortMode) => {
    setState((prev) => ({ ...prev, agentSort: normalizeAgentSort(mode) }));
  }, []);

  const moveAgent = useCallback((id: string, dir: "up" | "down") => {
    setState((prev) => {
      const arr = [...prev.agents];
      const i = arr.findIndex((a) => a.id === id);
      if (i < 0) return prev;
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...prev, agents: arr };
    });
  }, []);

  const reorderAgent = useCallback((id: string, toIndex: number) => {
    setState((prev) => {
      const arr = [...prev.agents];
      const from = arr.findIndex((a) => a.id === id);
      if (from < 0) return prev;
      let to = Math.max(0, Math.min(toIndex, arr.length - 1));
      if (from === to) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return { ...prev, agents: arr };
    });
  }, []);
  const teamOrder = useMemo(
    () => orderTeams(listTeams(state.agents), state.teamOrder),
    [state.agents, state.teamOrder],
  );

  const moveTeam = useCallback((team: string, dir: "up" | "down") => {
    setState((prev) => {
      const ordered = orderTeams(listTeams(prev.agents), prev.teamOrder);
      const i = ordered.indexOf(team);
      if (i < 0) return prev;
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= ordered.length) return prev;
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      return { ...prev, teamOrder: ordered };
    });
  }, []);

  const reorderTeam = useCallback((team: string, toIndex: number) => {
    setState((prev) => {
      const ordered = orderTeams(listTeams(prev.agents), prev.teamOrder);
      const from = ordered.indexOf(team);
      if (from < 0) return prev;
      let to = Math.max(0, Math.min(toIndex, ordered.length - 1));
      if (from === to) return prev;
      const [moved] = ordered.splice(from, 1);
      ordered.splice(to, 0, moved);
      return { ...prev, teamOrder: ordered };
    });
  }, []);

  const resetTeamOrder = useCallback(() => {
    setState((prev) => ({ ...prev, teamOrder: [] }));
  }, []);

  /** Agents ordered per the chosen mode; every view reads this. */
  const sortedAgents = useMemo(
    () => sortAgents(state.agents, agentSort, teamOrder),
    [state.agents, agentSort, teamOrder],
  );

  const replaceState = useCallback((s: Partial<PlanningState>) => {
    setState((prev) => {
      // Reconcile imported agents with the existing roster by name so a fresh
      // import (which mints new random agent IDs) reuses the IDs already in
      // use. Without this, re-importing another year re-keys the agents and
      // orphans every previously imported year's planning (it disappears).
      const norm = (name: string) => name.trim().toLowerCase();
      const idRemap: Record<string, string> = {};
      let agents = prev.agents;

      if (s.agents) {
        const existingByName = new Map(prev.agents.map((a) => [norm(a.name), a]));
        const usedIds = new Set<string>();
        agents = s.agents.map((incoming) => {
          const match = existingByName.get(norm(incoming.name));
          const id = match && !usedIds.has(match.id) ? match.id : incoming.id;
          usedIds.add(id);
          if (id !== incoming.id) idRemap[incoming.id] = id;
          return { ...incoming, id };
        });
        // Keep existing agents that weren't part of the import so their data
        // from other years survives.
        const importedIds = new Set(agents.map((a) => a.id));
        for (const a of prev.agents) {
          if (!importedIds.has(a.id)) agents.push(a);
        }
      }

      // Apply the ID remap to the imported planning years before merging.
      const remapYear = (yp: YearPlanning): YearPlanning => {
        if (!Object.keys(idRemap).length) return yp;
        const out: YearPlanning = {};
        for (const [agId, cells] of Object.entries(yp)) {
          out[idRemap[agId] ?? agId] = cells;
        }
        return out;
      };
      let incomingPlanning = s.planningByYear;
      if (incomingPlanning && Object.keys(idRemap).length) {
        incomingPlanning = Object.fromEntries(
          Object.entries(incomingPlanning).map(([y, yp]) => [y, remapYear(yp)]),
        );
      }

      return {
        catalogVersion: DEFAULT_CATALOG_VERSION,
        // Preserve the user's own code parameters (labels, hours, categories,
        // colors). Keep every existing code untouched and only append codes
        // from the import that aren't already defined, so a new-year import
        // never overwrites the settings the user configured.
        codes: s.codes
          ? [
              ...prev.codes,
              ...s.codes.filter(
                (ic) =>
                  !prev.codes.some(
                    (pc) => pc.code.toUpperCase() === ic.code.toUpperCase(),
                  ),
              ),
            ]
          : prev.codes,
        agents,
        agentSort: s.agentSort ?? prev.agentSort,
        teamOrder: s.teamOrder ?? prev.teamOrder,
        // Merge per-year so importing one year never wipes other years.
        planningByYear: incomingPlanning
          ? { ...prev.planningByYear, ...incomingPlanning }
          : prev.planningByYear,
        colors: s.colors ?? prev.colors,
        rotation: s.rotation ? normalizeRotation(s.rotation) : prev.rotation,
        rotationByYear: s.rotationByYear
          ? { ...prev.rotationByYear, ...normalizeRotationByYear(s.rotationByYear) }
          : prev.rotationByYear,
        changesByYear: s.changesByYear
          ? { ...prev.changesByYear, ...s.changesByYear }
          : prev.changesByYear,
      };
    });
  }, []);


  const snapshotState = useCallback((): PlanningState => {
    return JSON.parse(JSON.stringify(state)) as PlanningState;
  }, [state]);

  const restoreFullState = useCallback((s: PlanningState) => {
    setState({
      catalogVersion: DEFAULT_CATALOG_VERSION,
      codes: s.codes?.length ? s.codes : DEFAULT_CODES,
      agents: s.agents?.length ? s.agents : DEFAULT_AGENTS,
      agentSort: normalizeAgentSort(s.agentSort),
      teamOrder: Array.isArray(s.teamOrder) ? s.teamOrder : [],
      planningByYear: s.planningByYear ?? {},
      colors: { ...DEFAULT_COLORS, ...(s.colors ?? {}) },
      rotation: normalizeRotation(s.rotation ?? DEFAULT_ROTATION),
      rotationByYear: normalizeRotationByYear(s.rotationByYear),
      changesByYear: s.changesByYear ?? {},
      overtimeByYear: s.overtimeByYear ?? {},
      overtimeThreshold:
        typeof s.overtimeThreshold === "number"
          ? s.overtimeThreshold
          : DEFAULT_OVERTIME_THRESHOLD,
      yearRange: normalizeYearRange(s.yearRange),
    });
  }, []);

  const restoreYearRotation = useCallback(
    (s: PlanningState, targetYear?: number) => {
      const dest = targetYear ?? year;
      setState((prev) => {
        // Take the backup's effective rotation for the source year (its
        // year-specific copy, or the backup's shared base) and write it into
        // the destination year only, leaving every other year and all other
        // data intact. This lets an existing rotation seed a brand-new year.
        const rot = normalizeRotation(
          s.rotationByYear?.[dest] ??
            s.rotationByYear?.[year] ??
            s.rotation ??
            DEFAULT_ROTATION,
        );
        return {
          ...prev,
          rotationByYear: { ...prev.rotationByYear, [dest]: rot },
        };
      });
    },
    [year],
  );

  const resetAll = useCallback(() => {
    setState({
      catalogVersion: DEFAULT_CATALOG_VERSION,
      codes: DEFAULT_CODES,
      agents: DEFAULT_AGENTS,
      planningByYear: {},
      colors: DEFAULT_COLORS,
      rotation: DEFAULT_ROTATION,
      rotationByYear: {},
      changesByYear: {},
      overtimeByYear: {},
      overtimeThreshold: DEFAULT_OVERTIME_THRESHOLD,
      yearRange: DEFAULT_YEAR_RANGE,
    });
  }, []);

  const clearPlanning = useCallback(() => {
    setState((prev) => ({ ...prev, planningByYear: {} }));
  }, []);

  const clearYear = useCallback((y: number) => {
    setState((prev) => {
      const next = { ...prev.planningByYear };
      delete next[y];
      const nextChanges = { ...prev.changesByYear };
      delete nextChanges[y];
      return { ...prev, planningByYear: next, changesByYear: nextChanges };
    });
  }, []);

  const clearChanges = useCallback((y: number) => {
    setState((prev) => {
      const nextChanges = { ...prev.changesByYear };
      delete nextChanges[y];
      return { ...prev, changesByYear: nextChanges };
    });
  }, []);

  const changes = state.changesByYear?.[year] ?? {};

  const overtime = state.overtimeByYear?.[year] ?? [];
  const overtimeThreshold = state.overtimeThreshold ?? DEFAULT_OVERTIME_THRESHOLD;

  const addOvertime = useCallback(
    (entry: Omit<OvertimeEntry, "id" | "at">) => {
      setState((prev) => {
        const list = prev.overtimeByYear?.[year] ?? [];
        const next: OvertimeEntry = {
          ...entry,
          id: `ot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          at: Date.now(),
        };
        return {
          ...prev,
          overtimeByYear: { ...prev.overtimeByYear, [year]: [...list, next] },
        };
      });
    },
    [year],
  );

  const removeOvertime = useCallback(
    (id: string) => {
      setState((prev) => {
        const list = prev.overtimeByYear?.[year] ?? [];
        return {
          ...prev,
          overtimeByYear: {
            ...prev.overtimeByYear,
            [year]: list.filter((e) => e.id !== id),
          },
        };
      });
    },
    [year],
  );

  const clearOvertimeAgent = useCallback(
    (agentId: string) => {
      setState((prev) => {
        const list = prev.overtimeByYear?.[year] ?? [];
        return {
          ...prev,
          overtimeByYear: {
            ...prev.overtimeByYear,
            [year]: list.filter((e) => e.agentId !== agentId),
          },
        };
      });
    },
    [year],
  );

  const clearOvertimeYear = useCallback((y: number) => {
    setState((prev) => {
      const next = { ...prev.overtimeByYear };
      delete next[y];
      return { ...prev, overtimeByYear: next };
    });
  }, []);

  const setOvertimeThreshold = useCallback((hours: number) => {
    setState((prev) => ({ ...prev, overtimeThreshold: hours }));
  }, []);

  const yearRange = normalizeYearRange(state.yearRange);

  const setYearRange = useCallback((range: YearRangeConfig) => {
    setState((prev) => ({ ...prev, yearRange: normalizeYearRange(range) }));
  }, []);


  const colors = state.colors ?? DEFAULT_COLORS;

  const setColor = useCallback((key: ColorKey, part: "bg" | "fg", hex: string) => {
    setState((prev) => {
      const current = prev.colors ?? DEFAULT_COLORS;
      return {
        ...prev,
        colors: {
          ...current,
          [key]: { ...current[key], [part]: hex },
        },
      };
    });
  }, []);

  const resetColors = useCallback(() => {
    setState((prev) => ({ ...prev, colors: DEFAULT_COLORS }));
  }, []);

  // Effective rotation for the current year: a per-year override when present,
  // otherwise the shared base rotation.
  const rotationYearSpecific = !!state.rotationByYear?.[year];
  const rotation = normalizeRotation(
    state.rotationByYear?.[year] ?? state.rotation ?? DEFAULT_ROTATION,
  );

  const setRotation = useCallback(
    (r: RotationState) => {
      setState((prev) => {
        const norm = normalizeRotation(r);
        // Write into the year-specific slot if this year has one, else the base.
        if (prev.rotationByYear?.[year]) {
          return {
            ...prev,
            rotationByYear: { ...prev.rotationByYear, [year]: norm },
          };
        }
        return { ...prev, rotation: norm };
      });
    },
    [year],
  );

  const setRotationYearSpecific = useCallback(
    (specific: boolean) => {
      setState((prev) => {
        const byYear = { ...(prev.rotationByYear ?? {}) };
        if (specific) {
          // Seed the year's copy from the current base so nothing is lost.
          if (!byYear[year]) {
            byYear[year] = normalizeRotation(prev.rotation ?? DEFAULT_ROTATION);
          }
        } else {
          delete byYear[year];
        }
        return { ...prev, rotationByYear: byYear };
      });
    },
    [year],
  );

  /**
   * Generate the weekend rotation into the current year's planning.
   * "replace" overwrites every cell the rotation produces; "fill" only writes
   * into empty cells. An optional `toDayIndex` (inclusive) bounds the range so
   * only a slice of the year is touched. Returns the number of cells written.
   */
  const applyRotation = useCallback(
    (mode: "replace" | "fill", fromDayIndex = 0, toDayIndex?: number) => {
      let written = 0;
      setState((prev) => {
        const rot = normalizeRotation(
          prev.rotationByYear?.[year] ?? prev.rotation ?? DEFAULT_ROTATION,
        );
        const total = daysInYear(year);
        const start = Math.max(0, fromDayIndex);
        const end =
          toDayIndex != null ? Math.min(total - 1, toDayIndex) : total - 1;
        const yp = { ...(prev.planningByYear[year] ?? {}) };
        for (const a of prev.agents) {
          if (!rot.agentTemplates[a.id]) continue;
          const row = { ...(yp[a.id] ?? {}) };
          for (let i = start; i <= end; i++) {
            const code = codeForCell(rot, a.id, year, i);
            if (!code) continue;
            if (mode === "fill" && row[i]) continue;
            row[i] = code;
            written++;
          }
          yp[a.id] = row;
        }
        return {
          ...prev,
          planningByYear: { ...prev.planningByYear, [year]: yp },
        };
      });
      return written;
    },
    [year],
  );

  const value = useMemo<PlanningContextValue>(
    () => ({
      year,
      setYear,
      codes: state.codes,
      agents: sortedAgents,
      planning,
      planningByYear: state.planningByYear,
      setCell,
      setCellForYear,
      fillRange,
      pasteBlock,
      upsertCode,
      removeCode,
      addAgent,
      updateAgent,
      removeAgent,
      agentSort,
      setAgentSort,
      moveAgent,
      reorderAgent,
      teamOrder,
      moveTeam,
      reorderTeam,
      resetTeamOrder,
      replaceState,
      snapshotState,
      restoreFullState,
      restoreYearRotation,
      resetAll,
      clearPlanning,
      clearYear,
      changes,
      clearChanges,
      overtime,
      overtimeThreshold,
      addOvertime,
      removeOvertime,
      clearOvertimeAgent,
      clearOvertimeYear,
      setOvertimeThreshold,
      yearRange,
      setYearRange,
      colors,
      setColor,
      resetColors,
      rotation,
      setRotation,
      rotationYearSpecific,
      setRotationYearSpecific,
      applyRotation,
    }),
    [
      year,
      state.codes,
      sortedAgents,
      planning,
      state.planningByYear,
      setCell,
      setCellForYear,
      fillRange,
      pasteBlock,
      upsertCode,
      removeCode,
      addAgent,
      updateAgent,
      removeAgent,
      agentSort,
      setAgentSort,
      moveAgent,
      reorderAgent,
      teamOrder,
      moveTeam,
      reorderTeam,
      resetTeamOrder,
      replaceState,
      snapshotState,
      restoreFullState,
      restoreYearRotation,
      resetAll,
      clearPlanning,
      clearYear,
      changes,
      clearChanges,
      overtime,
      overtimeThreshold,
      addOvertime,
      removeOvertime,
      clearOvertimeAgent,
      clearOvertimeYear,
      setOvertimeThreshold,
      yearRange,
      setYearRange,
      colors,
      setColor,
      resetColors,
      rotation,
      setRotation,
      rotationYearSpecific,
      setRotationYearSpecific,
      applyRotation,
    ],
  );

  const syncValue = useMemo<SyncStatusValue>(
    () => ({
      status: syncStatus,
      isOnline,
      hasPendingChanges: syncStatus === "pending" || syncStatus === "syncing",
    }),
    [syncStatus, isOnline],
  );

  return (
    <PlanningContext.Provider value={value}>
      <SyncStatusContext.Provider value={syncValue}>
        <style>{colorsToCss(colors)}</style>
        {children}
      </SyncStatusContext.Provider>
    </PlanningContext.Provider>
  );
}

export function usePlanning() {
  const ctx = useContext(PlanningContext);
  if (!ctx) throw new Error("usePlanning must be used within PlanningProvider");
  return ctx;
}
