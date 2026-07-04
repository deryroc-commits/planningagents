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
  { id: "ag-1-lrlg", name: "ALIS STEPHANE" },
  { id: "ag-2-kgjh", name: "LECLERC CYRIL" },
  { id: "ag-3-yuey", name: "CAHOREAU DAVID", team: "PRODUCTION" },
  { id: "ag-4-5dt4", name: "DUCHENE TEDDY", team: "PRODUCTION" },
  { id: "ag-5-akex", name: "BRIERE  ALLAN", team: "PRODUCTION" },
  { id: "ag-6-lnfd", name: "LAIGLE  LOIC", team: "PRODUCTION" },
  { id: "ag-7-io36", name: "LEMARIE DAVID", team: "PRODUCTION" },
  { id: "ag-8-cdjj", name: "MONNERIE JEROME", team: "PRODUCTION" },
  { id: "ag-9-i0lf", name: "VINCELOT ANTHONY", team: "PRODUCTION" },
  { id: "ag-10-ixdz", name: "STAGIAIRE", team: "PRODUCTION" },
  { id: "ag-11-uwyc", name: "LEBLANC AMELIE", team: "PRODUCTION" },
  { id: "ag-12-qx9r", name: "CHERIE KELLY", team: "ALLOTISSEMENT" },
  { id: "ag-13-b2ge", name: "BREUX BARBARA", team: "ALLOTISSEMENT" },
  { id: "ag-14-3pdu", name: "JEUSSE AURELIE", team: "ALLOTISSEMENT" },
  { id: "ag-15-s2ra", name: "JOURDAN MARYLISE", team: "ALLOTISSEMENT" },
  { id: "ag-16-7bgv", name: "POLLAS MARTINE", team: "ALLOTISSEMENT" },
  { id: "ag-17-13eh", name: "LESAGE  NADINE", team: "ALLOTISSEMENT" },
  { id: "ag-18-ehc2", name: "MONNIER  MARINA", team: "ALLOTISSEMENT" },
  { id: "ag-19-ns94", name: "COMTE  THAÏS", team: "ALLOTISSEMENT" },
  { id: "ag-20-x8g8", name: "GAHERY PHILIPPE", team: "MAGASIN/ PLONGE" },
  { id: "ag-21-di1q", name: "FORVEILLE STEPHANE", team: "MAGASIN/ PLONGE" },
  { id: "ag-22-vhiz", name: "GARETTE ERIC", team: "MAGASIN/ PLONGE" },
  { id: "ag-23-kepa", name: "LAOUENAN YANN", team: "MAGASIN/ PLONGE" },
  { id: "ag-24-2c4b", name: "LHUISSIER ARNAUD", team: "MAGASIN/ PLONGE" },
  { id: "ag-25-xdma", name: "BERTTHELOT  MICKAEL", team: "MAGASIN/ PLONGE" },
  { id: "ag-26-1nw8", name: "BOISMAL  BAPTISTE", team: "MAGASIN/ PLONGE" },
];

export const DEFAULT_ROTATION: RotationState = {
  cycleWeeks: 5,
  agentTemplates: {},
};

export const STORAGE_KEY = "ucpa-planning-v1";
