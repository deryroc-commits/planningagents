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
} from "./types";
import {
  DEFAULT_AGENTS,
  DEFAULT_CODES,
  DEFAULT_COLORS,
  DEFAULT_OVERTIME_THRESHOLD,
  DEFAULT_ROTATION,
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
  // cell
  setCell: (agentId: string, dayIndex: number, code: string | null) => void;
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

function hasExampleAgents(agents: Agent[] | undefined): boolean {
  if (!agents?.length) return false;
  const exampleNames = new Set([
    "Dupont Marie",
    "Martin Lucas",
    "Bernard Sophie",
    "Petit Thomas",
    "Robert Julie",
    "Richard Antoine",
  ]);
  return agents.some((agent) => exampleNames.has(agent.name));
}

function loadState(): PlanningState {
  const base: PlanningState = {
    codes: DEFAULT_CODES,
    agents: DEFAULT_AGENTS,
    planningByYear: {},
    colors: DEFAULT_COLORS,
    rotation: DEFAULT_ROTATION,
    overtimeByYear: {},
    overtimeThreshold: DEFAULT_OVERTIME_THRESHOLD,
  };
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PlanningState>;
    const agents = hasExampleAgents(parsed.agents) ? DEFAULT_AGENTS : parsed.agents;
    return {
      codes: parsed.codes?.length ? parsed.codes : DEFAULT_CODES,
      agents: agents?.length ? agents : DEFAULT_AGENTS,
      planningByYear: parsed.planningByYear ?? {},
      // Merge stored overrides over defaults so newly added keys always exist.
      colors: { ...DEFAULT_COLORS, ...(parsed.colors ?? {}) },
      rotation: normalizeRotation(parsed.rotation ?? DEFAULT_ROTATION),
      changesByYear: parsed.changesByYear ?? {},
      overtimeByYear: parsed.overtimeByYear ?? {},
      overtimeThreshold:
        typeof parsed.overtimeThreshold === "number"
          ? parsed.overtimeThreshold
          : DEFAULT_OVERTIME_THRESHOLD,
    };
  } catch {
    return base;
  }
}

export function PlanningProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [state, setState] = useState<PlanningState>(() => ({
    codes: DEFAULT_CODES,
    agents: DEFAULT_AGENTS,
    planningByYear: {},
    colors: DEFAULT_COLORS,
    rotation: DEFAULT_ROTATION,
  }));
  const hydrated = useRef(false);

  // Hydrate from localStorage on client
  useEffect(() => {
    setState(loadState());
    // Mark hydrated only AFTER the loaded state is committed, so the persist
    // effect below never writes the pre-hydration default back to storage.
  }, []);

  // Persist — but skip the initial mount. Writing the default state before
  // hydration finishes would fire a `storage` event that reverts other open
  // viewers (Impression / Base agents) back to defaults.
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state]);

  // Keep every open view (other tabs/viewers) in sync: when the stored data
  // changes elsewhere (e.g. an import), reload it so Impression & Base agents
  // never stay out of date.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== STORAGE_KEY) return;
      setState(loadState());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  const resetAll = useCallback(() => {
    setState({
      codes: DEFAULT_CODES,
      agents: DEFAULT_AGENTS,
      planningByYear: {},
      colors: DEFAULT_COLORS,
      rotation: DEFAULT_ROTATION,
      changesByYear: {},
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
      setCell,
      fillRange,
      upsertCode,
      removeCode,
      addAgent,
      updateAgent,
      removeAgent,
      replaceState,
      resetAll,
      clearPlanning,
      clearYear,
      changes,
      clearChanges,
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
      setCell,
      fillRange,
      upsertCode,
      removeCode,
      addAgent,
      updateAgent,
      removeAgent,
      replaceState,
      resetAll,
      clearPlanning,
      clearYear,
      changes,
      clearChanges,
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
