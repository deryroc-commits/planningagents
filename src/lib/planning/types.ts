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
 * Base weekend-rotation model ("1 week-end sur N").
 * The cycle spans `cycleWeeks` weeks; each week is a template of 7 codes
 * (Monday..Sunday). Every agent starts the cycle at a given week offset so
 * that the weekend duty rotates evenly across the team over the year.
 */
export interface RotationState {
  /** Length of the cycle in weeks (e.g. 5 = 1 week-end sur 5). */
  cycleWeeks: number;
  /** [weekIndex 0..cycleWeeks-1][dayMon0 0..6] = code ("" when empty). */
  templates: string[][];
  /** agentId -> starting week offset (0-based) inside the cycle. */
  offsets: Record<string, number>;
}

export interface PlanningState {
  codes: PlanningCode[];
  agents: Agent[];
  planningByYear: Record<number, YearPlanning>;
  /** Optional user color overrides; when absent the app uses DEFAULT_COLORS. */
  colors?: ColorScheme;
  /** Optional weekend-rotation configuration. */
  rotation?: RotationState;
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
