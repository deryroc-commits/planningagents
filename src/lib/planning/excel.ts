import type {
  Agent,
  CodeCategory,
  PlanningCode,
  PlanningState,
  YearPlanning,
} from "./types";
import { daysInYear, dateOfDayIndex, dayLetter } from "./calc";
import { DEFAULT_AGENTS, DEFAULT_CODES } from "./defaults";

const CATEGORIES: CodeCategory[] = [
  "travail",
  "poste",
  "repos",
  "recup",
  "absence",
  "autre",
];

export async function exportToExcel(
  state: PlanningState,
  year: number,
): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Paramètres
  const paramRows = [
    ["Code", "Libellé", "Heures", "Catégorie"],
    ...state.codes.map((c) => [c.code, c.label, c.hours, c.category]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(paramRows),
    "Paramètres",
  );

  // Base agents
  const agentRows = [
    ["Id", "Nom", "Équipe"],
    ...state.agents.map((a) => [a.id, a.name, a.team ?? ""]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(agentRows),
    "Base agents",
  );

  // Planning (year)
  const total = daysInYear(year);
  const planning = state.planningByYear[year] ?? {};
  const header1: (string | number)[] = ["Agent"];
  const header2: (string | number)[] = [""];
  for (let i = 0; i < total; i++) {
    const d = dateOfDayIndex(year, i);
    header1.push(`${d.getDate()}/${d.getMonth() + 1}`);
    header2.push(dayLetter(d));
  }
  const planRows: (string | number)[][] = [header1, header2];
  for (const a of state.agents) {
    const row: (string | number)[] = [a.name];
    const r = planning[a.id] ?? {};
    for (let i = 0; i < total; i++) row.push(r[i] ?? "");
    planRows.push(row);
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(planRows),
    "Planning",
  );

  XLSX.writeFile(wb, `planning-ucpa-${year}.xlsx`);
}

export interface ImportResult {
  state: Partial<PlanningState>;
  summary: string;
}

/** Best-effort import of .xlsb / .xlsx / .xls files (SheetJS supports XLSB). */
export async function importFromExcel(
  file: File,
  year: number,
): Promise<ImportResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const findSheet = (...names: string[]) =>
    wb.SheetNames.find((n) =>
      names.some((q) => n.toLowerCase().includes(q.toLowerCase())),
    );

  let codes: PlanningCode[] | undefined;
  let agents: Agent[] | undefined;
  const partial: Partial<PlanningState> = {};
  const parts: string[] = [];

  // Paramètres
  const paramName = findSheet("paramètre", "parametre", "code");
  if (paramName) {
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[paramName], {
      header: 1,
    });
    const parsed: PlanningCode[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r[0] == null || String(r[0]).trim() === "") continue;
      const cat = String(r[3] ?? "autre").toLowerCase() as CodeCategory;
      parsed.push({
        code: String(r[0]).trim(),
        label: String(r[1] ?? "").trim(),
        hours: Number(r[2]) || 0,
        category: CATEGORIES.includes(cat) ? cat : "autre",
      });
    }
    if (parsed.length) {
      codes = parsed;
      parts.push(`${parsed.length} codes`);
    }
  }

  // Base agents
  const agentName = findSheet("base agent", "agent", "personnel");
  if (agentName) {
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[agentName], {
      header: 1,
    });
    const parsed: Agent[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const name = r?.[1] ?? r?.[0];
      if (!name || String(name).trim() === "") continue;
      parsed.push({
        id:
          r?.[0] && String(r[0]).startsWith("ag-")
            ? String(r[0])
            : `ag-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: String(name).trim(),
        team: r?.[2] ? String(r[2]).trim() : undefined,
      });
    }
    if (parsed.length) {
      agents = parsed;
      parts.push(`${parsed.length} agents`);
    }
  }

  if (codes) partial.codes = codes;
  if (agents) partial.agents = agents;

  // Planning sheet round-trip (matches export format)
  const planName = findSheet("planning");
  if (planName) {
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[planName], {
      header: 1,
    });
    if (rows.length > 2) {
      const total = daysInYear(year);
      const yp: YearPlanning = {};
      const agentList = agents ?? DEFAULT_AGENTS;
      const byName: Record<string, string> = {};
      for (const a of agentList) byName[a.name.trim().toLowerCase()] = a.id;
      // rows[0]=date header, rows[1]=letters, rows[2..]=agents
      let filled = 0;
      for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;
        const id = byName[String(r[0]).trim().toLowerCase()];
        if (!id) continue;
        const row: Record<number, string> = {};
        for (let d = 0; d < total; d++) {
          const v = r[d + 1];
          if (v != null && String(v).trim() !== "") {
            row[d] = String(v).trim();
            filled++;
          }
        }
        yp[id] = row;
      }
      if (filled) {
        partial.planningByYear = { [year]: yp };
        parts.push(`planning ${year}`);
      }
    }
  }

  return {
    state: partial,
    summary: parts.length
      ? `Importé : ${parts.join(", ")}.`
      : "Aucune feuille reconnue (Paramètres / Base agents / Planning).",
  };
}

export const _unused = { DEFAULT_CODES, DEFAULT_AGENTS };
