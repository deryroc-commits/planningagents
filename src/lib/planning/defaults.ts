import type { Agent, ColorScheme, PlanningCode, RotationState } from "./types";

/**
 * Default color scheme (hex) shared by the on-screen grid, the legend, the
 * print view and the Excel export. Users can override any of these.
 */
export const DEFAULT_COLORS: ColorScheme = {
  travail: { bg: "#CFEFD8", fg: "#1F6B3A" },
  poste: { bg: "#CFDDF7", fg: "#254690" },
  repos: { bg: "#EAEAEE", fg: "#5C5C63" },
  recup: { bg: "#CCE8F1", fg: "#1E5E75" },
  absence: { bg: "#F5E6C2", fg: "#7A5A18" },
  autre: { bg: "#EEDAEC", fg: "#6E2E68" },
  weekend: { bg: "#ECECF0", fg: "#5C5C63" },
  holiday: { bg: "#F6DE9A", fg: "#6B5410" },
  error: { bg: "#F4C6C6", fg: "#8B1E1E" },
};


export const DEFAULT_CODES: PlanningCode[] = [
  { code: "T", label: "Travail", hours: 7.5, category: "travail" },
  { code: "A1", label: "Poste A1 (matin)", hours: 7.5, category: "poste" },
  { code: "A2", label: "Poste A2 (matin)", hours: 7.5, category: "poste" },
  { code: "M1", label: "Poste M1 (après-midi)", hours: 7.5, category: "poste" },
  { code: "M2", label: "Poste M2 (après-midi)", hours: 7.5, category: "poste" },
  { code: "PL", label: "Poste polyvalent", hours: 7.5, category: "poste" },
  { code: "RH", label: "Repos hebdomadaire", hours: 0, category: "repos" },
  { code: "RF", label: "Repos / récupération férié", hours: 0, category: "recup" },
  { code: "RHS", label: "Récupération heures sup.", hours: 0, category: "recup" },
  { code: "RC", label: "Récupération compensatrice", hours: 0, category: "recup" },
  { code: "CA", label: "Congé annuel", hours: 0, category: "absence" },
  { code: "CH", label: "Congé hiver", hours: 0, category: "absence" },
  { code: "CM", label: "Maladie", hours: 0, category: "absence" },
  { code: "MP", label: "Maladie professionnelle", hours: 0, category: "absence" },
  { code: "FOR", label: "Formation", hours: 7.5, category: "autre" },
  { code: "FER", label: "Jour férié", hours: 0, category: "autre" },
];

export const DEFAULT_AGENTS: Agent[] = [
  { id: "ag-1", name: "Dupont Marie", team: "Équipe A" },
  { id: "ag-2", name: "Martin Lucas", team: "Équipe A" },
  { id: "ag-3", name: "Bernard Sophie", team: "Équipe A" },
  { id: "ag-4", name: "Petit Thomas", team: "Équipe B" },
  { id: "ag-5", name: "Robert Julie", team: "Équipe B" },
  { id: "ag-6", name: "Richard Antoine", team: "Équipe B" },
];

export const DEFAULT_ROTATION: RotationState = {
  cycleWeeks: 5,
  templates: [],
  offsets: {},
};

export const STORAGE_KEY = "ucpa-planning-v1";
