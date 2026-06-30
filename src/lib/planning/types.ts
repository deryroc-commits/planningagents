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
}

export interface Agent {
  id: string;
  name: string;
  team?: string;
}

/** agentId -> dayIndex (0-based day of year) -> code */
export type YearPlanning = Record<string, Record<number, string>>;

export interface PlanningState {
  codes: PlanningCode[];
  agents: Agent[];
  planningByYear: Record<number, YearPlanning>;
}

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
