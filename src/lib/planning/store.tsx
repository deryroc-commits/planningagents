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
  PlanningCode,
  PlanningState,
  YearPlanning,
} from "./types";
import { DEFAULT_AGENTS, DEFAULT_CODES, DEFAULT_COLORS, STORAGE_KEY } from "./defaults";

interface PlanningContextValue {
  year: number;
  setYear: (y: number) => void;
  codes: PlanningCode[];
  agents: Agent[];
  planning: YearPlanning;
  // cell
  setCell: (agentId: string, dayIndex: number, code: string | null) => void;
  fillRange: (
    agentId: string,
    indices: number[],
    code: string | null,
  ) => void;
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
}

const PlanningContext = createContext<PlanningContextValue | null>(null);

function loadState(): PlanningState {
  const base: PlanningState = {
    codes: DEFAULT_CODES,
    agents: DEFAULT_AGENTS,
    planningByYear: {},
  };
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PlanningState>;
    return {
      codes: parsed.codes?.length ? parsed.codes : DEFAULT_CODES,
      agents: parsed.agents ?? DEFAULT_AGENTS,
      planningByYear: parsed.planningByYear ?? {},
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
        if (code === null || code === "") delete row[dayIndex];
        else row[dayIndex] = code;
        yp[agentId] = row;
        return {
          ...prev,
          planningByYear: { ...prev.planningByYear, [year]: yp },
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
        for (const i of indices) {
          if (code === null || code === "") delete row[i];
          else row[i] = code;
        }
        yp[agentId] = row;
        return {
          ...prev,
          planningByYear: { ...prev.planningByYear, [year]: yp },
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

  const updateAgent = useCallback(
    (id: string, patch: Partial<Omit<Agent, "id">>) => {
      setState((prev) => ({
        ...prev,
        agents: prev.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }));
    },
    [],
  );

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
    }));
  }, []);


  const resetAll = useCallback(() => {
    setState({
      codes: DEFAULT_CODES,
      agents: DEFAULT_AGENTS,
      planningByYear: {},
    });
  }, []);

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
    ],
  );

  return (
    <PlanningContext.Provider value={value}>
      {children}
    </PlanningContext.Provider>
  );
}

export function usePlanning() {
  const ctx = useContext(PlanningContext);
  if (!ctx) throw new Error("usePlanning must be used within PlanningProvider");
  return ctx;
}
