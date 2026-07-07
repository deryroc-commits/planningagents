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
  // codes
  upsertCode: (code: PlanningCode, originalCode?: string) => void;
  removeCode: (code: string) => void;
  // agents
  addAgent: (a: Omit<Agent, "id">) => void;
  updateAgent: (id: string, patch: Partial<Omit<Agent, "id">>) => void;
  removeAgent: (id: string) => void;
  // bulk
  replaceState: (s: Partial<PlanningState>) => void;
  /** Full, deep snapshot of the whole application state (for backups). */
  snapshotState: () => PlanningState;
  /** Replace the ENTIRE application state (restore a backup). */
  restoreFullState: (s: PlanningState) => void;
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
  applyRotation: (mode: "replace" | "fill", fromDayIndex?: number) => number;
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
    planningByYear: parsed.planningByYear ?? {},
    colors: { ...DEFAULT_COLORS, ...(parsed.colors ?? {}) },
    rotation: normalizeRotation(parsed.rotation ?? DEFAULT_ROTATION),
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

function loadState(key: string): PlanningState {
  const base = normalizePlanningState(null);
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PlanningState>;
    return normalizePlanningState(parsed);
  } catch {
    return base;
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
    planningByYear: mergeRecordOfRecords(
      base.planningByYear,
      remote.planningByYear,
      local.planningByYear,
      (a, b) => a === b,
    ),
    colors: pick("colors"),
    rotation: pick("rotation"),
    changesByYear: mergeRecordOfRecords(
      base.changesByYear,
      remote.changesByYear,
      local.changesByYear,
      (a, b) => JSON.stringify(a) === JSON.stringify(b),
    ),
    overtimeByYear: pick("overtimeByYear"),
    overtimeThreshold: pick("overtimeThreshold"),
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
  }));
  const [cloudReady, setCloudReady] = useState(false);
  const hydrated = useRef(false);
  const lastCloudJson = useRef<string | null>(null);
  const cloudSaveTimer = useRef<number | null>(null);
  // Always-current snapshot of local state, so the realtime handler can 3-way
  // merge incoming updates against unsaved local edits without stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;

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
    if (!cloudReady || !writable) return;

    const json = JSON.stringify(state);
    if (json === lastCloudJson.current) return;

    if (cloudSaveTimer.current !== null) {
      window.clearTimeout(cloudSaveTimer.current);
    }

    cloudSaveTimer.current = window.setTimeout(() => {
      void supabase
        .from(CLOUD_TABLE)
        .upsert(
          { workspace_id: workspaceId, state: state as unknown as Json },
          { onConflict: "workspace_id" },
        )
        .then(({ error }) => {
          if (error) {
            console.warn("Impossible de sauvegarder le planning dans le Cloud", error.message);
            return;
          }
          lastCloudJson.current = json;
        });
    }, CLOUD_SAVE_DEBOUNCE_MS);

    return () => {
      if (cloudSaveTimer.current !== null) {
        window.clearTimeout(cloudSaveTimer.current);
      }
    };
  }, [cloudReady, writable, workspaceId, state]);

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

  const replaceState = useCallback((s: Partial<PlanningState>) => {
    setState((prev) => ({
      catalogVersion: DEFAULT_CATALOG_VERSION,
      codes: s.codes ?? prev.codes,
      agents: s.agents ?? prev.agents,
      // Merge per-year so importing one year never wipes other years.
      planningByYear: s.planningByYear
        ? { ...prev.planningByYear, ...s.planningByYear }
        : prev.planningByYear,
      colors: s.colors ?? prev.colors,
      rotation: s.rotation ? normalizeRotation(s.rotation) : prev.rotation,
      changesByYear: s.changesByYear
        ? { ...prev.changesByYear, ...s.changesByYear }
        : prev.changesByYear,
    }));
  }, []);

  const snapshotState = useCallback((): PlanningState => {
    return JSON.parse(JSON.stringify(state)) as PlanningState;
  }, [state]);

  const restoreFullState = useCallback((s: PlanningState) => {
    setState({
      catalogVersion: DEFAULT_CATALOG_VERSION,
      codes: s.codes?.length ? s.codes : DEFAULT_CODES,
      agents: s.agents?.length ? s.agents : DEFAULT_AGENTS,
      planningByYear: s.planningByYear ?? {},
      colors: { ...DEFAULT_COLORS, ...(s.colors ?? {}) },
      rotation: normalizeRotation(s.rotation ?? DEFAULT_ROTATION),
      changesByYear: s.changesByYear ?? {},
      overtimeByYear: s.overtimeByYear ?? {},
      overtimeThreshold:
        typeof s.overtimeThreshold === "number"
          ? s.overtimeThreshold
          : DEFAULT_OVERTIME_THRESHOLD,
    });
  }, []);

  const resetAll = useCallback(() => {
    setState({
      catalogVersion: DEFAULT_CATALOG_VERSION,
      codes: DEFAULT_CODES,
      agents: DEFAULT_AGENTS,
      planningByYear: {},
      colors: DEFAULT_COLORS,
      rotation: DEFAULT_ROTATION,
      changesByYear: {},
      overtimeByYear: {},
      overtimeThreshold: DEFAULT_OVERTIME_THRESHOLD,
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

  const rotation = normalizeRotation(state.rotation ?? DEFAULT_ROTATION);

  const setRotation = useCallback((r: RotationState) => {
    setState((prev) => ({ ...prev, rotation: normalizeRotation(r) }));
  }, []);

  /**
   * Generate the weekend rotation into the current year's planning.
   * "replace" overwrites every cell the rotation produces; "fill" only writes
   * into empty cells. Returns the number of cells written.
   */
  const applyRotation = useCallback(
    (mode: "replace" | "fill", fromDayIndex = 0) => {
      let written = 0;
      setState((prev) => {
        const rot = normalizeRotation(prev.rotation ?? DEFAULT_ROTATION);
        const total = daysInYear(year);
        const start = Math.max(0, fromDayIndex);
        const yp = { ...(prev.planningByYear[year] ?? {}) };
        for (const a of prev.agents) {
          if (!rot.agentTemplates[a.id]) continue;
          const row = { ...(yp[a.id] ?? {}) };
          for (let i = start; i < total; i++) {
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
      agents: state.agents,
      planning,
      planningByYear: state.planningByYear,
      setCell,
      setCellForYear,
      fillRange,
      upsertCode,
      removeCode,
      addAgent,
      updateAgent,
      removeAgent,
      replaceState,
      snapshotState,
      restoreFullState,
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
      colors,
      setColor,
      resetColors,
      rotation,
      setRotation,
      applyRotation,
    }),
    [
      year,
      state.codes,
      state.agents,
      planning,
      state.planningByYear,
      setCell,
      setCellForYear,
      fillRange,
      upsertCode,
      removeCode,
      addAgent,
      updateAgent,
      removeAgent,
      replaceState,
      snapshotState,
      restoreFullState,
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
      colors,
      setColor,
      resetColors,
      rotation,
      setRotation,
      applyRotation,
    ],
  );

  return (
    <PlanningContext.Provider value={value}>
      <style>{colorsToCss(colors)}</style>
      {children}
    </PlanningContext.Provider>
  );
}

export function usePlanning() {
  const ctx = useContext(PlanningContext);
  if (!ctx) throw new Error("usePlanning must be used within PlanningProvider");
  return ctx;
}
