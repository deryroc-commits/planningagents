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

export interface PlanningState {
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
