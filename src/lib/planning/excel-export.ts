/**
 * Export options dialog helpers.
 *
 * Provides styled per-tab Excel exports plus a "full application" workbook
 * that gathers every tab into a single .xlsx file, all mirroring the on-screen
 * colors and layout so the file can be reworked directly in Excel.
 */
import type {
  Agent,
  CodeCategory,
  ColorScheme,
  PlanningCode,
  PlanningState,
  RotationState,
  YearOvertime,
} from "./types";
import { CATEGORY_META } from "./types";
import { MONTHS } from "./calc";
import { DEFAULT_COLORS } from "./defaults";
import { WEEK_DAYS_LONG, getAgentTemplate } from "./rotation";

const hx = (c: string) => c.replace(/^#/, "").toUpperCase();

const XLS_HEADER = { bg: "E7EAF0", fg: "222A38" };
const XLS_TEAM = { bg: "D7DEEA", fg: "1E2A44" };
const XLS_TITLE = { bg: "C0392B", fg: "FFFFFF" };
const XLS_BORDER = "B7BDC7";
const XLS_BORDER_STRONG = "6B7280";

const thin = { style: "thin", color: { rgb: XLS_BORDER } };
const medium = { style: "medium", color: { rgb: XLS_BORDER_STRONG } };
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
        sz: opts.size ?? 10,
        bold: !!opts.bold,
        color: { rgb: opts.fg ?? "222A38" },
      },
      fill: opts.bg
        ? { patternType: "solid", fgColor: { rgb: opts.bg } }
        : undefined,
      alignment: {
        horizontal: opts.align ?? "center",
        vertical: "center",
        wrapText: true,
      },
      border: allBorders,
    },
  };
}

function frameRegion(ws: any, XLSX: any, r0: number, c0: number, r1: number, c1: number) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cellObj = ws[addr];
      if (!cellObj || !cellObj.s) continue;
      const b = { ...(cellObj.s.border ?? {}) };
      if (r === r0) b.top = medium;
      if (r === r1) b.bottom = medium;
      if (c === c0) b.left = medium;
      if (c === c1) b.right = medium;
      cellObj.s = { ...cellObj.s, border: b };
    }
  }
}

function resolveScheme(state: PlanningState) {
  const scheme: ColorScheme = { ...DEFAULT_COLORS, ...(state.colors ?? {}) };
  const catColors: Record<CodeCategory, { bg: string; fg: string }> = {
    travail: { bg: hx(scheme.travail.bg), fg: hx(scheme.travail.fg) },
    poste: { bg: hx(scheme.poste.bg), fg: hx(scheme.poste.fg) },
    repos: { bg: hx(scheme.repos.bg), fg: hx(scheme.repos.fg) },
    recup: { bg: hx(scheme.recup.bg), fg: hx(scheme.recup.fg) },
    absence: { bg: hx(scheme.absence.bg), fg: hx(scheme.absence.fg) },
    autre: { bg: hx(scheme.autre.bg), fg: hx(scheme.autre.fg) },
  };
  return { scheme, catColors };
}

/** Insert a red "TITLE — subtitle" banner spanning `colCount` columns. */
function pushTitle(rows: any[][], merges: any[], title: string, colCount: number) {
  const row: any[] = [
    cell(title, {
      bg: XLS_TITLE.bg,
      fg: XLS_TITLE.fg,
      bold: true,
      size: 13,
      align: "left",
    }),
  ];
  for (let k = 1; k < colCount; k++) row.push(cell("", { bg: XLS_TITLE.bg }));
  merges.push({
    s: { r: rows.length, c: 0 },
    e: { r: rows.length, c: Math.max(0, colCount - 1) },
  });
  rows.push(row);
}

// ---------------------------------------------------------------------------
// Sheet builders
// ---------------------------------------------------------------------------

/** "Base agents" tab as a styled sheet. */
export function buildAgentsSheet(XLSX: any, state: PlanningState): any {
  const rows: any[][] = [];
  const merges: any[] = [];
  const cols = 6;
  pushTitle(rows, merges, "BASE AGENTS", cols);
  rows.push([
    cell("Nom", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Équipe", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Arrivée", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
    cell("Départ", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
    cell("Identifiant", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Actif", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
  ]);
  const fmt = (y?: number, m?: number) =>
    y != null && m != null ? `${MONTHS[m]} ${y}` : "—";
  for (const a of state.agents) {
    if (!a.name?.trim() || a.name.trim() === "0") continue;
    rows.push([
      cell(a.name, { align: "left", bold: true }),
      cell(a.team ?? "", { align: "left" }),
      cell(fmt(a.startYear, a.startMonth)),
      cell(fmt(a.endYear, a.endMonth)),
      cell(a.id, { align: "left" }),
      cell(a.endYear == null ? "Oui" : "Voir dates"),
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 10 }];
  ws["!rows"] = rows.map((_, r) => ({ hpt: r === 0 ? 24 : 18 }));
  ws["!freeze"] = { xSplit: 0, ySplit: 2 };
  ws["!pageSetup"] = { orientation: "portrait", fitToWidth: 1, fitToHeight: 0 };
  frameRegion(ws, XLSX, 1, 0, rows.length - 1, cols - 1);
  return ws;
}

/** "Paramètres" (codes) tab as a styled sheet with per-code coloring. */
export function buildCodesSheet(XLSX: any, state: PlanningState): any {
  const { catColors } = resolveScheme(state);
  const rows: any[][] = [];
  const merges: any[] = [];
  const cols = 5;
  pushTitle(rows, merges, "CODES & PARAMÈTRES", cols);
  rows.push([
    cell("Code", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
    cell("Libellé", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Heures", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
    cell("Catégorie", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Aperçu", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
  ]);
  const sorted = [...state.codes].sort((a, b) =>
    a.category.localeCompare(b.category) || a.code.localeCompare(b.code),
  );
  for (const c of sorted) {
    const cc = c.color
      ? { bg: hx(c.color.bg), fg: hx(c.color.fg) }
      : catColors[c.category];
    rows.push([
      cell(c.code, { bold: true }),
      cell(c.label, { align: "left" }),
      cell(c.hours),
      cell(CATEGORY_META[c.category].label, { align: "left" }),
      cell(c.code, { bg: cc.bg, fg: cc.fg, bold: true }),
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 10 }, { wch: 34 }, { wch: 10 }, { wch: 18 }, { wch: 12 }];
  ws["!rows"] = rows.map((_, r) => ({ hpt: r === 0 ? 24 : 18 }));
  ws["!freeze"] = { ySplit: 2 };
  ws["!pageSetup"] = { orientation: "portrait", fitToWidth: 1, fitToHeight: 0 };
  frameRegion(ws, XLSX, 1, 0, rows.length - 1, cols - 1);
  return ws;
}

/**
 * "Roulement WE" tab as a styled sheet — one row per agent × week of the
 * cycle, with all 7 days colored like the on-screen grid.
 */
export function buildRotationSheet(
  XLSX: any,
  state: PlanningState,
  rotation: RotationState,
): any {
  const { catColors } = resolveScheme(state);
  const codeMeta: Record<string, { bg: string; fg: string }> = {};
  for (const c of state.codes) {
    codeMeta[c.code] = c.color
      ? { bg: hx(c.color.bg), fg: hx(c.color.fg) }
      : catColors[c.category];
  }
  const rows: any[][] = [];
  const merges: any[] = [];
  const cols = 2 + 7;
  pushTitle(
    rows,
    merges,
    `ROULEMENT WE — Cycle de ${rotation.cycleWeeks} semaine${rotation.cycleWeeks > 1 ? "s" : ""}`,
    cols,
  );
  const header: any[] = [
    cell("Agent", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Semaine", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
  ];
  for (const d of WEEK_DAYS_LONG) {
    header.push(cell(d, { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }));
  }
  rows.push(header);

  const visibleAgents = state.agents.filter((a) => a.name?.trim() && a.name.trim() !== "0");
  for (const a of visibleAgents) {
    const tpl = getAgentTemplate(rotation, a.id);
    for (let w = 0; w < rotation.cycleWeeks; w++) {
      const line: any[] = [];
      if (w === 0) {
        line.push(cell(a.name, { align: "left", bold: true }));
      } else {
        line.push(cell("", { align: "left" }));
      }
      line.push(cell(`S${w + 1}`, { bg: XLS_TEAM.bg, fg: XLS_TEAM.fg, bold: true }));
      const week = tpl[w] ?? Array(7).fill("");
      for (let d = 0; d < 7; d++) {
        const v = week[d] ?? "";
        const meta = v ? codeMeta[v] : undefined;
        line.push(
          cell(v, {
            bg: meta?.bg,
            fg: meta?.fg,
            bold: !!v,
          }),
        );
      }
      rows.push(line);
      if (w === rotation.cycleWeeks - 1 && a !== visibleAgents[visibleAgents.length - 1]) {
        // Blank separator row between agents
        rows.push(Array.from({ length: cols }, () => cell("")));
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 26 }, { wch: 10 }, ...Array(7).fill({ wch: 8 })];
  ws["!rows"] = rows.map((_, r) => ({ hpt: r === 0 ? 24 : 18 }));
  ws["!freeze"] = { xSplit: 2, ySplit: 2 };
  ws["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0 };
  frameRegion(ws, XLSX, 1, 0, rows.length - 1, cols - 1);
  return ws;
}

/** "Heures supplémentaires" tab as a styled sheet (balances + movements). */
export function buildOvertimeSheet(
  XLSX: any,
  state: PlanningState,
  year: number,
  overtime: YearOvertime,
  threshold: number,
): any {
  const nameById: Record<string, string> = {};
  for (const a of state.agents) nameById[a.id] = a.name;

  const totals = new Map<string, { added: number; deducted: number }>();
  for (const a of state.agents) totals.set(a.id, { added: 0, deducted: 0 });
  for (const e of overtime) {
    const acc = totals.get(e.agentId);
    if (!acc) continue;
    if (e.hours >= 0) acc.added += e.hours;
    else acc.deducted += -e.hours;
  }

  const rows: any[][] = [];
  const merges: any[] = [];
  const cols = 5;
  pushTitle(rows, merges, `HEURES SUPPLÉMENTAIRES — ${year}`, cols);
  rows.push([
    cell(`Seuil d'alerte : ${threshold} h`, {
      bg: XLS_HEADER.bg,
      fg: XLS_HEADER.fg,
      bold: true,
      align: "left",
    }),
    cell("", { bg: XLS_HEADER.bg }),
    cell("", { bg: XLS_HEADER.bg }),
    cell("", { bg: XLS_HEADER.bg }),
    cell("", { bg: XLS_HEADER.bg }),
  ]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } });

  rows.push([
    cell("Agent", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Équipe", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Ajoutées", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
    cell("Récupérées", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
    cell("Solde (h)", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
  ]);

  for (const a of state.agents) {
    if (!a.name?.trim() || a.name.trim() === "0") continue;
    const acc = totals.get(a.id) ?? { added: 0, deducted: 0 };
    const balance = Math.round((acc.added - acc.deducted) * 100) / 100;
    const over = threshold > 0 && balance >= threshold;
    rows.push([
      cell(a.name, { align: "left", bold: true }),
      cell(a.team ?? "", { align: "left" }),
      cell(Math.round(acc.added * 100) / 100),
      cell(Math.round(acc.deducted * 100) / 100),
      cell(balance, over ? { bg: "F4C6C6", fg: "8B1E1E", bold: true } : { bold: true }),
    ]);
  }

  // Movements
  const movementsStart = rows.length + 1;
  rows.push([]);
  pushTitle(rows, merges, "MOUVEMENTS", cols);
  rows.push([
    cell("Date", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
    cell("Agent", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Équipe", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Heures", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
    cell("Motif", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
  ]);
  const teamById: Record<string, string> = {};
  for (const a of state.agents) teamById[a.id] = a.team ?? "";
  const sorted = [...overtime].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of sorted) {
    rows.push([
      cell(e.date),
      cell(nameById[e.agentId] ?? e.agentId, { align: "left" }),
      cell(teamById[e.agentId] ?? "", { align: "left" }),
      cell(e.hours),
      cell(e.reason ?? "", { align: "left" }),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 20 }, { wch: 12 }, { wch: 40 }];
  ws["!rows"] = rows.map((_, r) => ({ hpt: r === 0 || r === movementsStart ? 24 : 18 }));
  ws["!pageSetup"] = { orientation: "portrait", fitToWidth: 1, fitToHeight: 0 };
  return ws;
}

// ---------------------------------------------------------------------------
// Public single-tab export helpers
// ---------------------------------------------------------------------------

async function saveOne(sheet: any, name: string, file: string) {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 30));
  XLSX.writeFile(wb, file);
}

export async function exportAgentsBookExcel(state: PlanningState): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildAgentsSheet(XLSX, state), "Base agents");
  XLSX.writeFile(wb, `planning-base-agents.xlsx`);
}

export async function exportCodesBookExcel(state: PlanningState): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildCodesSheet(XLSX, state), "Paramètres");
  XLSX.writeFile(wb, `planning-parametres.xlsx`);
}

export async function exportRotationBookExcel(
  state: PlanningState,
  rotation: RotationState,
  year: number,
): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    buildRotationSheet(XLSX, state, rotation),
    "Roulement WE",
  );
  XLSX.writeFile(wb, `planning-roulement-we-${year}.xlsx`);
}

export async function exportOvertimeBookExcel(
  state: PlanningState,
  year: number,
  overtime: YearOvertime,
  threshold: number,
): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    buildOvertimeSheet(XLSX, state, year, overtime, threshold),
    "Heures supp.",
  );
  XLSX.writeFile(wb, `planning-heures-supp-${year}.xlsx`);
}

// ---------------------------------------------------------------------------
// Full workbook — every tab in one file
// ---------------------------------------------------------------------------

export async function exportFullWorkbookExcel(opts: {
  state: PlanningState;
  year: number;
  printTitle?: string;
  rotation: RotationState;
  overtime: YearOvertime;
  overtimeThreshold: number;
}): Promise<void> {
  const { state, year, printTitle, rotation, overtime, overtimeThreshold } = opts;
  const XLSX = await import("xlsx-js-style");
  // Reuse the styled monthly builder from excel.ts to keep months in sync.
  const { buildStyledMonthSheetPublic } = await import("./excel-month-builder");
  const wb = XLSX.utils.book_new();

  // 12 monthly planning sheets
  for (let m = 0; m < 12; m++) {
    const ws = buildStyledMonthSheetPublic(XLSX, state, year, m, printTitle);
    XLSX.utils.book_append_sheet(wb, ws, MONTHS[m].slice(0, 20));
  }
  // Extra tabs
  XLSX.utils.book_append_sheet(wb, buildAgentsSheet(XLSX, state), "Base agents");
  XLSX.utils.book_append_sheet(wb, buildCodesSheet(XLSX, state), "Paramètres");
  XLSX.utils.book_append_sheet(
    wb,
    buildRotationSheet(XLSX, state, rotation),
    "Roulement WE",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildOvertimeSheet(XLSX, state, year, overtime, overtimeThreshold),
    "Heures supp.",
  );
  XLSX.writeFile(wb, `planning-complet-${year}.xlsx`);
}
