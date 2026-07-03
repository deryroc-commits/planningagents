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

export interface PlanningState {
  codes: PlanningCode[];
  agents: Agent[];
  planningByYear: Record<number, YearPlanning>;
  /** Optional user color overrides; when absent the app uses DEFAULT_COLORS. */
  colors?: ColorScheme;
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
