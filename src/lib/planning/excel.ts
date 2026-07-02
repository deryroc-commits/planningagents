import type {
  Agent,
  CodeCategory,
  PlanningCode,
  PlanningState,
  YearPlanning,
} from "./types";
import { CATEGORY_META } from "./types";
import {
  codesMap,
  dateOfDayIndex,
  dayIndicesForMonth,
  dayLetter,
  daysInYear,
  holidaysForYear,
  isInvalid,
  isWeekend,
  MONTHS,
} from "./calc";
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

// ---------------------------------------------------------------------------
// Styled (colored) export that mirrors the print view: one landscape-friendly
// sheet per month, colored cells matching each code category, weekends and
// public holidays, team bands, and a legend — all as an Excel table with
// borders, so the workbook looks like the application on screen.
// ---------------------------------------------------------------------------

/** Category / cell colors as ARGB hex (background + font), matching the app. */
const XLS_COLORS: Record<CodeCategory, { bg: string; fg: string }> = {
  travail: { bg: "CFEFD8", fg: "1F6B3A" },
  poste: { bg: "CFDDF7", fg: "254690" },
  repos: { bg: "EAEAEE", fg: "5C5C63" },
  recup: { bg: "CCE8F1", fg: "1E5E75" },
  absence: { bg: "F5E6C2", fg: "7A5A18" },
  autre: { bg: "EEDAEC", fg: "6E2E68" },
};
const XLS_WEEKEND = "ECECF0";
const XLS_HOLIDAY = { bg: "F6DE9A", fg: "6B5410" };
const XLS_ERROR = { bg: "F4C6C6", fg: "8B1E1E" };
const XLS_HEADER = { bg: "E7EAF0", fg: "222A38" };
const XLS_TEAM = { bg: "D7DEEA", fg: "1E2A44" };
const XLS_TITLE = { bg: "C0392B", fg: "FFFFFF" };
const XLS_BORDER = "B7BDC7";

const thin = { style: "thin", color: { rgb: XLS_BORDER } };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

function cell(
  value: string | number,
  opts: {
    bg?: string;
    fg?: string;
    bold?: boolean;
    align?: "center" | "left" | "right";
    size?: number;
  } = {},
) {
  return {
    v: value,
    t: typeof value === "number" ? "n" : "s",
    s: {
      font: {
        name: "Arial",
        sz: opts.size ?? 9,
        bold: !!opts.bold,
        color: { rgb: opts.fg ?? "222A38" },
      },
      fill: opts.bg ? { patternType: "solid", fgColor: { rgb: opts.bg } } : undefined,
      alignment: {
        horizontal: opts.align ?? "center",
        vertical: "center",
      },
      border: allBorders,
    },
  };
}

/**
 * Export a single month as a styled worksheet that visually matches the
 * on-screen / print planning (colors, columns, rows, table borders).
 */
export async function exportStyledMonthExcel(
  state: PlanningState,
  year: number,
  month: number,
): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();

  const map = codesMap(state.codes);
  const holidays = holidaysForYear(year);
  const indices = dayIndicesForMonth(year, month);
  const planning = state.planningByYear[year] ?? {};
  const colCount = indices.length + 1;
  const printDate = new Date().toLocaleDateString("fr-FR");

  const rows: any[][] = [];
  const merges: any[] = [];

  // Title band (merged across all columns).
  rows.push([
    cell(`PLANNING AGENTS UCPA — ${MONTHS[month]} ${year}`, {
      bg: XLS_TITLE.bg,
      fg: XLS_TITLE.fg,
      bold: true,
      size: 13,
    }),
    ...Array.from({ length: colCount - 1 }, () =>
      cell("", { bg: XLS_TITLE.bg }),
    ),
  ]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });

  // Print-date band (merged, right aligned) just under the title.
  rows.push([
    cell(`Imprimé le ${printDate}`, {
      bg: XLS_HEADER.bg,
      fg: XLS_HEADER.fg,
      bold: true,
      align: "right",
      size: 9,
    }),
    ...Array.from({ length: colCount - 1 }, () =>
      cell("", { bg: XLS_HEADER.bg }),
    ),
  ]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });

  // Header row 1 — day letters.
  const hLetters = [cell("Jour", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" })];
  const hNumbers = [cell("Agent", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" })];
  for (const i of indices) {
    const d = dateOfDayIndex(year, i);
    const hol = holidays[i];
    const bg = hol ? XLS_HOLIDAY.bg : isWeekend(d) ? XLS_WEEKEND : XLS_HEADER.bg;
    const fg = hol ? XLS_HOLIDAY.fg : XLS_HEADER.fg;
    hLetters.push(cell(dayLetter(d), { bg, fg, bold: true, size: 8 }));
    hNumbers.push(cell(d.getDate(), { bg, fg, bold: true }));
  }
  rows.push(hLetters);
  rows.push(hNumbers);

  // Group agents by team, preserving order.
  const groups: { team: string; agents: Agent[] }[] = [];
  for (const a of state.agents) {
    const team = a.team?.trim() || "Sans équipe";
    const last = groups[groups.length - 1];
    if (last && last.team === team) last.agents.push(a);
    else groups.push({ team, agents: [a] });
  }

  for (const g of groups) {
    const bandRow = rows.length;
    rows.push([
      cell(g.team, { bg: XLS_TEAM.bg, fg: XLS_TEAM.fg, bold: true, align: "left" }),
      ...Array.from({ length: colCount - 1 }, () => cell("", { bg: XLS_TEAM.bg })),
    ]);
    merges.push({ s: { r: bandRow, c: 0 }, e: { r: bandRow, c: colCount - 1 } });

    for (const a of g.agents) {
      const row = planning[a.id] ?? {};
      const line = [cell(a.name.toUpperCase(), { align: "left", bold: true })];
      for (const i of indices) {
        const v = row[i];
        const d = dateOfDayIndex(year, i);
        const hol = holidays[i];
        let bg: string | undefined;
        let fg = "222A38";
        if (isInvalid(v, map)) {
          bg = XLS_ERROR.bg;
          fg = XLS_ERROR.fg;
        } else if (v && map[v]) {
          const meta = XLS_COLORS[map[v].category];
          bg = meta.bg;
          fg = meta.fg;
        } else if (hol) {
          bg = XLS_HOLIDAY.bg;
          fg = XLS_HOLIDAY.fg;
        } else if (isWeekend(d)) {
          bg = XLS_WEEKEND;
        }
        line.push(cell(v ?? "", { bg, fg, bold: true }));
      }
      rows.push(line);
    }
  }

  // Legend a couple of rows below the table.
  rows.push([]);
  const legend: [string, { bg: string; fg: string }][] = [
    ...Object.entries(CATEGORY_META).map(
      ([k, meta]) =>
        [meta.label, { bg: XLS_COLORS[k as CodeCategory].bg, fg: XLS_COLORS[k as CodeCategory].fg }] as [
          string,
          { bg: string; fg: string },
        ],
    ),
    ["Week-end", { bg: XLS_WEEKEND, fg: "222A38" }],
    ["Jour férié", XLS_HOLIDAY],
    ["Erreur / code invalide", XLS_ERROR],
  ];
  for (const [label, c] of legend) {
    rows.push([cell(label, { bg: c.bg, fg: c.fg, bold: true, align: "left" })]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 22 },
    ...indices.map(() => ({ wch: 3.2 })),
  ];
  ws["!rows"] = rows.map((_, r) => ({ hpt: r === 0 ? 22 : 15 }));
  // Freeze the agent column + header rows and print in landscape on one page.
  ws["!freeze"] = { xSplit: 1, ySplit: 3 };
  ws["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 1 };

  XLSX.utils.book_append_sheet(wb, ws, MONTHS[month].slice(0, 20));
  XLSX.writeFile(wb, `planning-ucpa-${MONTHS[month].toLowerCase()}-${year}.xlsx`);
}

export interface ImportResult {
  state: Partial<PlanningState>;
  summary: string;
  /** Year detected in the imported planning, if any. */
  year?: number;
}

/** Guess a category for a UCPA code from its hours / label. */
function inferCategory(
  code: string,
  hours: number,
  label: string,
): CodeCategory {
  const c = code.toUpperCase().trim();
  const l = label.toLowerCase();
  if (c === "T") return "travail";
  if (hours >= 5 || /ucpa/i.test(label) || c === "ST") return "poste";
  if (c === "RH") return "repos";
  if (["RF", "RHS", "RC", "TP", "RT"].includes(c)) return "recup";
  if (["F", "FER", "FÉ"].includes(c) || l.includes("férié")) return "autre";
  if (c === "FC" || c === "FOR" || l.includes("formation")) return "autre";
  return "absence";
}

/**
 * Native parser for the real UCPA workbook layout:
 * - "Paramètres" sheet with a "Postes" column listing code / label / hours
 * - "planning_général" sheet with a date row and one line per agent
 * Returns null when the workbook does not match this layout.
 */
function parseUcpaWorkbook(wb: any, XLSX: any): ImportResult | null {
  const find = (...names: string[]) =>
    wb.SheetNames.find((n: string) =>
      names.some((q) => n.toLowerCase().includes(q.toLowerCase())),
    );

  const planName = find(
    "planning_général",
    "planning_general",
    "planning gé",
    "planning",
  );
  if (!planName) return null;

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[planName], {
    header: 1,
    raw: true,
    blankrows: true,
  }) as any[][];

  // Locate the date row (the one holding the most Date values).
  let dateRowIdx = -1;
  let best = 0;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cnt = (rows[r] ?? []).filter((v) => v instanceof Date).length;
    if (cnt > best) {
      best = cnt;
      dateRowIdx = r;
    }
  }
  if (dateRowIdx < 0 || best < 20) return null;
  const dateRow = rows[dateRowIdx];

  // Dominant year across the date columns.
  const yearCounts: Record<number, number> = {};
  for (const v of dateRow) {
    if (v instanceof Date) {
      const y = v.getFullYear();
      yearCounts[y] = (yearCounts[y] ?? 0) + 1;
    }
  }
  const year = Number(
    Object.entries(yearCounts).sort((a, b) => b[1] - a[1])[0][0],
  );

  // Map each column -> day-of-year index (only for the dominant year).
  const colDay: Record<number, number> = {};
  const yearStart = new Date(year, 0, 1).getTime();
  for (let c = 0; c < dateRow.length; c++) {
    const v = dateRow[c];
    if (v instanceof Date && v.getFullYear() === year) {
      const d = new Date(v.getFullYear(), v.getMonth(), v.getDate()).getTime();
      colDay[c] = Math.round((d - yearStart) / 86400000);
    }
  }
  const dateCols = Object.keys(colDay).map(Number);
  if (dateCols.length === 0) return null;
  const nameCol = Math.min(...dateCols) - 1; // agent names sit just left of dates

  const agents: Agent[] = [];
  const yp: YearPlanning = {};
  let currentTeam: string | undefined;
  let seen = 0;

  for (let r = dateRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const raw = row[nameCol];
    if (raw == null || String(raw).trim() === "") continue;
    const name = String(raw).trim();
    if (/remarque/i.test(name)) break; // notes block starts here

    const cells: Record<number, string> = {};
    let codeCount = 0;
    for (const c of dateCols) {
      const v = row[c];
      const s = v == null ? "" : String(v).trim();
      // "0" is used to pad service-header rows; treat it as empty.
      if (s !== "" && s !== "0") {
        cells[colDay[c]] = s;
        codeCount++;
      }
    }
    if (codeCount === 0) {
      currentTeam = name; // section / service header
      continue;
    }
    const id = `ag-${++seen}-${Math.random().toString(36).slice(2, 6)}`;
    agents.push({ id, name, team: currentTeam });
    yp[id] = cells;
  }

  if (agents.length === 0) return null;

  // Codes from the "Paramètres" sheet ("Postes" column block).
  let codes: PlanningCode[] = [];
  const paramName = find("paramètre", "parametre");
  if (paramName) {
    const prows = XLSX.utils.sheet_to_json(wb.Sheets[paramName], {
      header: 1,
      raw: true,
    }) as any[][];
    let hr = -1;
    let hc = -1;
    for (let r = 0; r < prows.length && hr < 0; r++) {
      const rr = prows[r] ?? [];
      for (let c = 0; c < rr.length; c++) {
        if (String(rr[c] ?? "").trim().toLowerCase() === "postes") {
          hr = r;
          hc = c;
          break;
        }
      }
    }
    if (hr >= 0) {
      for (let r = hr + 1; r < prows.length; r++) {
        const rr = prows[r] ?? [];
        const cell = rr[hc];
        if (cell == null || String(cell).trim() === "") {
          if (codes.length) break; // contiguous block ended
          continue;
        }
        const code = String(cell).trim();
        const label = String(rr[hc + 1] ?? "").trim();
        const hours = Number(rr[hc + 2]) || 0;
        codes.push({
          code,
          label: label || code,
          hours,
          category: inferCategory(code, hours, label),
        });
      }
    }
  }
  if (!codes.length) codes = DEFAULT_CODES;

  // Auto-register every code actually used in the planning that isn't defined
  // in "Paramètres". In the source Excel these appear as red/manual cells;
  // here we turn them into recognized "postes" so nothing is flagged as error.
  const known = new Set(codes.map((c) => c.code.toUpperCase()));
  const used = new Set<string>();
  for (const agId of Object.keys(yp)) {
    for (const day of Object.keys(yp[agId])) {
      used.add(yp[agId][day as unknown as number]);
    }
  }
  for (const raw of used) {
    const code = raw.trim();
    if (!code || known.has(code.toUpperCase())) continue;
    known.add(code.toUpperCase());
    const category = inferCategory(code, 0, "");
    // A UCPA work shift (A6, S4, C6…) or a travail/poste code counts 7.5 h.
    const isShift = /^[A-Z]+\d+$/i.test(code);
    const hours =
      category === "poste" || category === "travail" || isShift ? 7.5 : 0;
    codes.push({
      code,
      label: code,
      hours,
      category: isShift ? "poste" : category,
    });
  }

  return {
    state: {
      codes,
      agents,
      planningByYear: { [year]: yp },
    },
    year,
    summary: `Fichier UCPA importé : ${codes.length} codes, ${agents.length} agents, planning ${year}.`,
  };
}

/** Best-effort import of .xlsb / .xlsx / .xlsm / .xls / .csv files. */
export async function importFromExcel(
  file: File,
  year: number,
): Promise<ImportResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  // First try the real UCPA workbook layout.
  const native = parseUcpaWorkbook(wb, XLSX);
  if (native) return native;

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
