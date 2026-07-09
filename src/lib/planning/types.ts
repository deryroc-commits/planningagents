export type CodeCategory =
  | "travail"
  | "poste"
  | "repos"
  | "recup"
  | "absence"
  | "autre";

export interface PlanningCode {
  code: string;
  label: string;
  hours: number;
  category: CodeCategory;
  /** Optional per-code color override; falls back to the category color. */
  color?: ColorPair;
}

export interface Agent {
  id: string;
  name: string;
  team?: string;
  /**
   * Optional arrival (absolute, continues into following years). When set, the
   * agent is hidden from the planning before `startMonth` (0-11) of
   * `startYear`, so earlier months stay empty (the agent wasn't there yet).
   */
  startYear?: number;
  startMonth?: number;
  /**
   * Optional departure (absolute, continues into following years). When set,
   * the agent is hidden from the planning starting from `endMonth` (0-11) of
   * `endYear`, and hidden entirely for every following year. Months before the
   * departure keep their history untouched.
   */
  endYear?: number;
  endMonth?: number;
}

/**
 * Whether an agent should appear in the planning for a given year/month.
 * An agent is visible only within its optional arrival→departure window:
 * hidden before the arrival month and from the departure month onward (both
 * absolute and continuing across following years), so history is preserved.
 */
export function isAgentActiveInMonth(
  agent: Pick<Agent, "startYear" | "startMonth" | "endYear" | "endMonth">,
  year: number,
  month: number,
): boolean {
  if (agent.startYear != null && agent.startMonth != null) {
    if (year < agent.startYear) return false;
    if (year === agent.startYear && month < agent.startMonth) return false;
  }
  if (agent.endYear != null && agent.endMonth != null) {
    if (year > agent.endYear) return false;
    if (year === agent.endYear && month >= agent.endMonth) return false;
  }
  return true;
}

/** Keys for every colorable element shown in the legend. */
export type ColorKey =
  | CodeCategory
  | "weekend"
  | "holiday"
  | "error";

/** Background + foreground (text) color pair, stored as hex (#rrggbb). */
export interface ColorPair {
  bg: string;
  fg: string;
}

export type ColorScheme = Record<ColorKey, ColorPair>;

/** agentId -> dayIndex (0-based day of year) -> code */
export type YearPlanning = Record<string, Record<number, string>>;

/**
 * A single tracked planning modification, relative to the value that was in
 * the cell before the user started editing. `from`/`to` use "" for an empty
 * cell. Used by the "Modifications" tab to highlight & print every change.
 */
export interface PlanningChange {
  agentId: string;
  dayIndex: number;
  from: string;
  to: string;
  at: number;
}

/** key `${agentId}:${dayIndex}` -> change (for one year). */
export type YearChanges = Record<string, PlanningChange>;

/**
 * A month/year marker (month is 0-11) used to bound a rotation's validity.
 */
export interface RotationPeriod {
  year: number;
  month: number;
}

/**
 * Base weekend-rotation model ("1 week-end sur N").
 * The cycle spans `cycleWeeks` weeks. Each AGENT has their own template of
 * `cycleWeeks` weeks of 7 codes (Monday..Sunday): weekdays are usually a fixed
 * post (or left empty) and the weekend cells (Sat/Sun) hold the duty code on
 * the week the agent is on duty and "RH" (rest) otherwise. Repeating each
 * agent's template across the year produces the yearly rotation.
 */
export interface RotationState {
  /** Length of the cycle in weeks (e.g. 5 = 1 week-end sur 5). */
  cycleWeeks: number;
  /** agentId -> [weekIndex 0..cycleWeeks-1][dayMon0 0..6] = code ("" empty). */
  agentTemplates: Record<string, string[][]>;
  /**
   * Optional validity window. When set, the rotation produces no code before
   * `validFrom` or after `validUntil` (both inclusive, month-granularity), so a
   * rotation can start and/or stop mid-year while earlier/later months keep
   * their own history untouched.
   */
  validFrom?: RotationPeriod;
  validUntil?: RotationPeriod;
}


/**
 * A single overtime movement for an agent: positive `hours` add overtime,
 * negative `hours` record recovered / deducted time. Movements accumulate into
 * a running balance shown in the "Heures supp." tab.
 */
export interface OvertimeEntry {
  id: string;
  agentId: string;
  /** Positive = heures ajoutées ; négatif = heures récupérées/retirées. */
  hours: number;
  /** ISO date (yyyy-mm-dd) of the movement. */
  date: string;
  reason?: string;
  at: number;
}

/** All overtime movements for one year. */
export type YearOvertime = OvertimeEntry[];

/**
 * Configurable range of selectable years shown in the year pickers.
 * `start` is the first year offered; `ahead` is how many years past the current
 * calendar year to include (so the range auto-extends every new year).
 */
export interface YearRangeConfig {
  start: number;
  ahead: number;
}

export interface PlanningState {
  /** Internal data/catalog migration version. */
  catalogVersion?: number;
  codes: PlanningCode[];
  agents: Agent[];
  planningByYear: Record<number, YearPlanning>;
  /** Optional user color overrides; when absent the app uses DEFAULT_COLORS. */
  colors?: ColorScheme;
  /** Optional weekend-rotation configuration. */
  rotation?: RotationState;
  /** Tracked manual modifications per year (for the "Modifications" tab). */
  changesByYear?: Record<number, YearChanges>;
  /** Overtime movements per year (for the "Heures supp." tab). */
  overtimeByYear?: Record<number, YearOvertime>;
  /** Alert threshold (hours) above which an agent's balance is flagged. */
  overtimeThreshold?: number;
  /** Configurable selectable-year range for the year pickers. */
  yearRange?: YearRangeConfig;
}

/** Human labels for each colorable element (used by the color editor). */
export const COLOR_LABELS: Record<ColorKey, string> = {
  travail: "Travail",
  poste: "Poste",
  repos: "Repos",
  recup: "Récupération",
  absence: "Absence",
  autre: "Autre",
  weekend: "Week-end",
  holiday: "Jour férié",
  error: "Erreur / code invalide",
};

export const CATEGORY_META: Record<
  CodeCategory,
  { label: string; cls: string }
> = {
  travail: { label: "Travail", cls: "cat-travail" },
  poste: { label: "Poste", cls: "cat-poste" },
  repos: { label: "Repos", cls: "cat-repos" },
  recup: { label: "Récupération", cls: "cat-recup" },
  absence: { label: "Absence", cls: "cat-absence" },
  autre: { label: "Autre", cls: "cat-autre" },
};

/**
 * Inline style for a code badge/cell when it has a custom color override.
 * Returns undefined when the code uses its category color (handled by CSS class).
 */
export function codeInlineStyle(
  code?: { color?: ColorPair } | null,
): { backgroundColor: string; color: string } | undefined {
  if (code?.color) return { backgroundColor: code.color.bg, color: code.color.fg };
  return undefined;
}

/** Effective color of a code: its own override, otherwise the scheme category color. */
export function resolveCodeColor(
  code: PlanningCode,
  colors: ColorScheme,
): ColorPair {
  return code.color ?? colors[code.category];
}
