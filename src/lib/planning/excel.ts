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
import { DEFAULT_AGENTS, DEFAULT_CODES, DEFAULT_COLORS } from "./defaults";
import type { ColorScheme } from "./types";

/** Strip a leading '#' so a hex color is valid as an Excel ARGB rgb value. */
const hx = (c: string) => c.replace(/^#/, "").toUpperCase();

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

/** Static banner / structural colors as ARGB hex (not user-customizable). */
const XLS_HEADER = { bg: "E7EAF0", fg: "222A38" };
const XLS_TEAM = { bg: "D7DEEA", fg: "1E2A44" };
const XLS_TITLE = { bg: "C0392B", fg: "FFFFFF" };
const XLS_BORDER = "B7BDC7";
const XLS_BORDER_STRONG = "6B7280";

const thin = { style: "thin", color: { rgb: XLS_BORDER } };
const medium = { style: "medium", color: { rgb: XLS_BORDER_STRONG } };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

/**
 * Thicken the outer perimeter of a rectangular cell region so the block reads
 * as a framed table (like a real Excel table) rather than a flat grid.
 */
function frameRegion(
  ws: any,
  XLSX: any,
  r0: number,
  c0: number,
  r1: number,
  c1: number,
) {
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
 * Build one styled worksheet for a single month that visually matches the
 * on-screen / print planning (colors, columns, rows, table borders).
 * Shared by both the single-month and the full-year styled exports.
 */
function buildStyledMonthSheet(
  XLSX: any,
  state: PlanningState,
  year: number,
  month: number,
  printTitle: string = "PLANNING AGENTS UCPA",
): any {
  const map = codesMap(state.codes);
  const holidays = holidaysForYear(year);
  const indices = dayIndicesForMonth(year, month);
  const planning = state.planningByYear[year] ?? {};
  const colCount = indices.length + 1;
  const printDate = new Date().toLocaleDateString("fr-FR");

  // Resolve the (possibly customized) color scheme into ARGB hex values.
  const scheme: ColorScheme = { ...DEFAULT_COLORS, ...(state.colors ?? {}) };
  const catColors: Record<CodeCategory, { bg: string; fg: string }> = {
    travail: { bg: hx(scheme.travail.bg), fg: hx(scheme.travail.fg) },
    poste: { bg: hx(scheme.poste.bg), fg: hx(scheme.poste.fg) },
    repos: { bg: hx(scheme.repos.bg), fg: hx(scheme.repos.fg) },
    recup: { bg: hx(scheme.recup.bg), fg: hx(scheme.recup.fg) },
    absence: { bg: hx(scheme.absence.bg), fg: hx(scheme.absence.fg) },
    autre: { bg: hx(scheme.autre.bg), fg: hx(scheme.autre.fg) },
  };
  const weekendBg = hx(scheme.weekend.bg);
  const holidayColor = { bg: hx(scheme.holiday.bg), fg: hx(scheme.holiday.fg) };
  const errorColor = { bg: hx(scheme.error.bg), fg: hx(scheme.error.fg) };

  const rows: any[][] = [];
  const merges: any[] = [];

  // Title banner mirroring the on-screen preview: a left "MONTH YEAR" box,
  // the red centered title, and the "Imprimé le …" text on the right — placed
  // inside the same red banner so the full date is always visible.
  const leftSpan = Math.min(3, colCount);
  // Reserve enough columns on the right for the full "Imprimé le JJ/MM/AAAA".
  const rightSpan = Math.min(7, Math.max(1, colCount - leftSpan - 1));
  const centerSpan = Math.max(1, colCount - leftSpan - rightSpan);
  const bannerBg = XLS_HEADER.bg;
  const titleRow: any[] = [];
  titleRow.push(
    cell(`${MONTHS[month].toUpperCase()} ${year}`, {
      bg: bannerBg,
      fg: XLS_HEADER.fg,
      bold: true,
      size: 12,
    }),
  );
  for (let k = 1; k < leftSpan; k++) titleRow.push(cell("", { bg: bannerBg }));
  titleRow.push(
    cell(printTitle, {
      bg: XLS_TITLE.bg,
      fg: XLS_TITLE.fg,
      bold: true,
      size: 14,
    }),
  );
  for (let k = 1; k < centerSpan; k++)
    titleRow.push(cell("", { bg: XLS_TITLE.bg }));
  // "Imprimé le …" sits on the red banner background, right-aligned.
  titleRow.push(
    cell(`Imprimé le ${printDate}`, {
      bg: XLS_TITLE.bg,
      fg: XLS_TITLE.fg,
      bold: true,
      align: "right",
      size: 9,
    }),
  );
  for (let k = 1; k < rightSpan; k++)
    titleRow.push(cell("", { bg: XLS_TITLE.bg }));
  rows.push(titleRow);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: leftSpan - 1 } });
  merges.push({
    s: { r: 0, c: leftSpan },
    e: { r: 0, c: leftSpan + centerSpan - 1 },
  });
  merges.push({
    s: { r: 0, c: leftSpan + centerSpan },
    e: { r: 0, c: colCount - 1 },
  });


  // Header row 1 — day letters.
  const hLetters = [cell("Jour", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" })];
  const hNumbers = [cell("Agents", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" })];
  for (const i of indices) {
    const d = dateOfDayIndex(year, i);
    const hol = holidays[i];
    const bg = hol ? holidayColor.bg : isWeekend(d) ? weekendBg : XLS_HEADER.bg;
    const fg = hol ? holidayColor.fg : XLS_HEADER.fg;
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
          bg = errorColor.bg;
          fg = errorColor.fg;
        } else if (v && map[v]) {
          const def = map[v];
          const meta = def.color
            ? { bg: hx(def.color.bg), fg: hx(def.color.fg) }
            : catColors[def.category];
          bg = meta.bg;
          fg = meta.fg;
        } else if (hol) {
          bg = holidayColor.bg;
          fg = holidayColor.fg;
        } else if (isWeekend(d)) {
          bg = weekendBg;
        }
        line.push(cell(v ?? "", { bg, fg, bold: true }));
      }
      rows.push(line);
    }
  }

  // Last row of the planning table (before the legend) — used to frame it.
  const tableEndRow = rows.length - 1;

  // Legend a couple of rows below the table.
  rows.push([]);
  const legendStart = rows.length;
  rows.push([
    cell("Légende", {
      bg: XLS_HEADER.bg,
      fg: XLS_HEADER.fg,
      bold: true,
      align: "left",
    }),
  ]);
  const legend: [string, { bg: string; fg: string }][] = [
    ...Object.entries(CATEGORY_META).map(
      ([k, meta]) =>
        [meta.label, { bg: catColors[k as CodeCategory].bg, fg: catColors[k as CodeCategory].fg }] as [
          string,
          { bg: string; fg: string },
        ],
    ),
    ["Week-end", { bg: weekendBg, fg: "222A38" }],
    ["Jour férié", holidayColor],
    ["Erreur / code invalide", errorColor],
  ];
  for (const [label, c] of legend) {
    rows.push([cell(label, { bg: c.bg, fg: c.fg, bold: true, align: "left" })]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;
  // Wider agent column + comfortable day columns so codes are readable.
  ws["!cols"] = [
    { wch: 26 },
    ...indices.map(() => ({ wch: 4 })),
  ];
  // Taller title, header and body rows for a more spacious, printable layout.
  ws["!rows"] = rows.map((_, r) => {
    if (r === 0) return { hpt: 30 };
    if (r === 1) return { hpt: 16 };
    if (r === 2) return { hpt: 20 };
    if (r === legendStart) return { hpt: 18 };
    return { hpt: 18 };
  });
  // Freeze the agent column + header rows and print in landscape on one page.
  ws["!freeze"] = { xSplit: 1, ySplit: 3 };

  ws["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 1 };
  ws["!margins"] = {
    left: 0.3,
    right: 0.3,
    top: 0.4,
    bottom: 0.4,
    header: 0.2,
    footer: 0.2,
  };

  // Frame the whole planning block and the header band with a strong border so
  // the sheet reads as a proper table.
  frameRegion(ws, XLSX, 0, 0, tableEndRow, colCount - 1);
  frameRegion(ws, XLSX, 1, 0, 2, colCount - 1);

  return ws;
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
  const ws = buildStyledMonthSheet(XLSX, state, year, month);
  XLSX.utils.book_append_sheet(wb, ws, MONTHS[month].slice(0, 20));
  XLSX.writeFile(wb, `planning-ucpa-${MONTHS[month].toLowerCase()}-${year}.xlsx`);
}

/**
 * Export the whole year as a styled workbook — one colored, printable sheet
 * per month (same look as the print view / single-month export).
 */
export async function exportStyledYearExcel(
  state: PlanningState,
  year: number,
): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  for (let month = 0; month < 12; month++) {
    const ws = buildStyledMonthSheet(XLSX, state, year, month);
    XLSX.utils.book_append_sheet(wb, ws, MONTHS[month].slice(0, 20));
  }
  XLSX.writeFile(wb, `planning-ucpa-${year}.xlsx`);
}

// ---------------------------------------------------------------------------
// Overtime ("Heures supplémentaires") export — A4 portrait, dynamic table
// with a per-agent balance summary and a detailed movement log.
// ---------------------------------------------------------------------------

export interface OvertimeExportRow {
  name: string;
  team: string;
  added: number;
  deducted: number;
  balance: number;
  over: boolean;
}

export interface OvertimeExportMovement {
  name: string;
  team: string;
  date: string;
  hours: number;
  reason: string;
}

const XLS_OT_OK = { bg: "CFEFD8", fg: "1F6B3A" };
const XLS_OT_ALERT = { bg: "F4C6C6", fg: "8B1E1E" };

function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return (Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")).replace(".", ",");
}

export async function exportOvertimeExcel(opts: {
  year: number;
  threshold: number;
  rows: OvertimeExportRow[];
  movements: OvertimeExportMovement[];
}): Promise<void> {
  const { year, threshold, rows, movements } = opts;
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  const printDate = new Date().toLocaleDateString("fr-FR");

  // ---- Summary sheet ----
  const sRows: any[][] = [];
  const sMerges: any[] = [];
  const SUM_COLS = 5;

  sRows.push([
    cell(`HEURES SUPPLÉMENTAIRES — ${year}`, {
      bg: XLS_TITLE.bg,
      fg: XLS_TITLE.fg,
      bold: true,
      size: 13,
      align: "left",
    }),
    ...Array.from({ length: SUM_COLS - 1 }, () => cell("", { bg: XLS_TITLE.bg })),
  ]);
  sMerges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: SUM_COLS - 1 } });

  sRows.push([
    cell(`Seuil d'alerte : ${fmtNum(threshold)} h — Imprimé le ${printDate}`, {
      bg: XLS_HEADER.bg,
      fg: XLS_HEADER.fg,
      align: "left",
    }),
    ...Array.from({ length: SUM_COLS - 1 }, () => cell("", { bg: XLS_HEADER.bg })),
  ]);
  sMerges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: SUM_COLS - 1 } });

  sRows.push([
    cell("Agent", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Équipe", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    cell("Ajoutées (h)", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
    cell("Récupérées (h)", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
    cell("Solde (h)", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
  ]);

  for (const r of rows) {
    const c = r.over ? XLS_OT_ALERT : XLS_OT_OK;
    sRows.push([
      cell(r.name.toUpperCase(), { align: "left", bold: true }),
      cell(r.team, { align: "left" }),
      cell(fmtNum(r.added)),
      cell(fmtNum(r.deducted)),
      cell(fmtNum(r.balance), { bg: c.bg, fg: c.fg, bold: true }),
    ]);
  }

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
  sRows.push([
    cell("TOTAL", { bg: XLS_TEAM.bg, fg: XLS_TEAM.fg, bold: true, align: "left" }),
    cell("", { bg: XLS_TEAM.bg }),
    cell(fmtNum(rows.reduce((s, r) => s + r.added, 0)), { bg: XLS_TEAM.bg, fg: XLS_TEAM.fg, bold: true }),
    cell(fmtNum(rows.reduce((s, r) => s + r.deducted, 0)), { bg: XLS_TEAM.bg, fg: XLS_TEAM.fg, bold: true }),
    cell(fmtNum(totalBalance), { bg: XLS_TEAM.bg, fg: XLS_TEAM.fg, bold: true }),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sRows);
  ws["!merges"] = sMerges;
  ws["!cols"] = [{ wch: 26 }, { wch: 20 }, { wch: 13 }, { wch: 15 }, { wch: 11 }];
  ws["!pageSetup"] = { orientation: "portrait", fitToWidth: 1, fitToHeight: 0 };
  XLSX.utils.book_append_sheet(wb, ws, "Soldes");

  // ---- Movements detail sheet ----
  if (movements.length) {
    const mRows: any[][] = [];
    mRows.push([
      cell("Date", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
      cell("Agent", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
      cell("Équipe", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
      cell("Heures", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true }),
      cell("Motif", { bg: XLS_HEADER.bg, fg: XLS_HEADER.fg, bold: true, align: "left" }),
    ]);
    for (const m of movements) {
      const pos = m.hours >= 0;
      mRows.push([
        cell(m.date, { align: "left" }),
        cell(m.name.toUpperCase(), { align: "left", bold: true }),
        cell(m.team, { align: "left" }),
        cell(`${pos ? "+" : "−"}${fmtNum(Math.abs(m.hours))}`, {
          bg: pos ? XLS_OT_OK.bg : XLS_OT_ALERT.bg,
          fg: pos ? XLS_OT_OK.fg : XLS_OT_ALERT.fg,
          bold: true,
        }),
        cell(m.reason, { align: "left" }),
      ]);
    }
    const wm = XLSX.utils.aoa_to_sheet(mRows);
    wm["!cols"] = [{ wch: 12 }, { wch: 26 }, { wch: 20 }, { wch: 10 }, { wch: 34 }];
    wm["!pageSetup"] = { orientation: "portrait", fitToWidth: 1, fitToHeight: 0 };
    XLSX.utils.book_append_sheet(wb, wm, "Mouvements");
  }

  XLSX.writeFile(wb, `heures-sup-ucpa-${year}.xlsx`);
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

function textKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function excelDate(value: unknown, XLSX: any): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && value > 20_000 && value < 80_000) {
    const parsed = XLSX.SSF?.parse_date_code?.(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]) - 1;
      const yy = Number(match[3]);
      const year = yy < 100 ? 2000 + yy : yy;
      const d = new Date(year, month, day);
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d;
    }
  }
  return null;
}

function codeListFromUsed(used: Iterable<string>): PlanningCode[] {
  const known = new Set(DEFAULT_CODES.map((c) => c.code.toUpperCase()));
  const out: PlanningCode[] = [];
  for (const raw of used) {
    const code = raw.trim();
    if (!code || code === "0" || known.has(code.toUpperCase())) continue;
    known.add(code.toUpperCase());
    const category = inferCategory(code, 0, "");
    const isShift = /^[A-Z]+\d+$/i.test(code);
    out.push({
      code,
      label: code,
      hours: category === "poste" || category === "travail" || isShift ? 7.5 : 0,
      category: isShift ? "poste" : category,
    });
  }
  return out;
}

function monthFromSheetName(name: string): number {
  const n = textKey(name);
  return MONTHS.findIndex((m) => n.includes(textKey(m)));
}

function firstDayIndexOfMonth(year: number, month: number): number {
  let offset = 0;
  for (let m = 0; m < month; m++) offset += new Date(year, m + 1, 0).getDate();
  return offset;
}

function detectYear(rows: any[][], fallback: number): number {
  for (const row of rows.slice(0, 8)) {
    for (const value of row ?? []) {
      const match = String(value ?? "").match(/\b(20\d{2}|19\d{2})\b/);
      if (match) return Number(match[1]);
    }
  }
  return fallback;
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
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const cnt = (rows[r] ?? []).filter((v) => excelDate(v, XLSX)).length;
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
    const parsedDate = excelDate(v, XLSX);
    if (parsedDate) {
      const y = parsedDate.getFullYear();
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
    const v = excelDate(dateRow[c], XLSX);
    if (v && v.getFullYear() === year) {
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

  const used = new Set<string>();
  for (const agId of Object.keys(yp)) {
    for (const day of Object.keys(yp[agId])) {
      used.add(yp[agId][day as unknown as number]);
    }
  }
  const existing = new Set(codes.map((c) => c.code.toUpperCase()));
  for (const c of codeListFromUsed(used)) {
    if (!existing.has(c.code.toUpperCase())) codes.push(c);
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

/** Parse the app's styled yearly export: one worksheet per month. */
function parseStyledMonthWorkbook(wb: any, XLSX: any, fallbackYear: number): ImportResult | null {
  const sheets = wb.SheetNames.map((name: string) => ({ name, month: monthFromSheetName(name) }))
    .filter((s: { name: string; month: number }) => s.month >= 0);
  if (!sheets.length) return null;

  let detectedYear = fallbackYear;
  const agentsByName = new Map<string, Agent>();
  const planning: YearPlanning = {};
  const usedCodes = new Set<string>();
  let parsedMonths = 0;

  for (const { name, month } of sheets) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      raw: true,
      blankrows: true,
    }) as any[][];
    detectedYear = detectYear(rows, detectedYear);
    const daysInMonth = new Date(detectedYear, month + 1, 0).getDate();
    const dayRow = rows.findIndex((row) => {
      const matches = (row ?? []).filter((v) => {
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n <= daysInMonth;
      }).length;
      return matches >= Math.min(7, daysInMonth);
    });
    if (dayRow < 0) continue;

    const dateCols: { col: number; day: number }[] = [];
    for (let c = 1; c < (rows[dayRow] ?? []).length; c++) {
      const day = Number(rows[dayRow][c]);
      if (Number.isInteger(day) && day >= 1 && day <= daysInMonth) dateCols.push({ col: c, day });
    }
    if (!dateCols.length) continue;

    const merges = (wb.Sheets[name]["!merges"] ?? []) as Array<{
      s: { r: number; c: number };
      e: { r: number; c: number };
    }>;
    const mergedBandRows = new Set(
      merges
        .filter((m) => m.s.r === m.e.r && m.s.c === 0 && m.e.c >= Math.min(3, dateCols.length))
        .map((m) => m.s.r),
    );

    let currentTeam: string | undefined;
    const monthOffset = firstDayIndexOfMonth(detectedYear, month);

    for (let r = dayRow + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const label = String(row[0] ?? "").trim();
      if (!label) continue;
      const key = textKey(label);
      if (key.includes("legende")) break;
      if (key === "jour" || key === "agents") continue;

      const hasMonthCells = dateCols.some(({ col }) => {
        const v = row[col];
        return v != null && String(v).trim() !== "" && String(v).trim() !== "0";
      });
      if (mergedBandRows.has(r) && !hasMonthCells) {
        currentTeam = label;
        continue;
      }

      const agentKey = textKey(label);
      let agent = agentsByName.get(agentKey);
      if (!agent) {
        agent = {
          id: `ag-${agentsByName.size + 1}-${Math.random().toString(36).slice(2, 6)}`,
          name: label,
          team: currentTeam,
        };
        agentsByName.set(agentKey, agent);
        planning[agent.id] = {};
      } else if (!agent.team && currentTeam) {
        agent.team = currentTeam;
      }

      const rowPlanning = planning[agent.id] ?? {};
      for (const { col, day } of dateCols) {
        const raw = row[col];
        const value = raw == null ? "" : String(raw).trim();
        if (!value || value === "0") continue;
        rowPlanning[monthOffset + day - 1] = value;
        usedCodes.add(value);
      }
      planning[agent.id] = rowPlanning;
    }
    parsedMonths++;
  }

  const agents = [...agentsByName.values()];
  if (!agents.length || parsedMonths === 0) return null;
  return {
    state: {
      agents,
      codes: codeListFromUsed(usedCodes),
      planningByYear: { [detectedYear]: planning },
    },
    year: detectedYear,
    summary: `Fichier Excel importé : ${agents.length} agents, ${parsedMonths} mois, planning ${detectedYear}.`,
  };
}

/** Best-effort import of .xlsb / .xlsx / .xlsm / .xls / .csv files. */
export async function importFromExcel(
  file: File,
  year: number,
  onProgress?: (pct: number, label?: string) => void,
): Promise<ImportResult> {
  const report = (p: number, l?: string) => {
    try { onProgress?.(Math.max(0, Math.min(100, Math.round(p))), l); } catch { /* noop */ }
  };
  report(2, "Préparation…");

  const fname = (file.name || "").toLowerCase();
  const ext = fname.includes(".") ? fname.slice(fname.lastIndexOf(".")) : "";
  const supported = [".xlsx", ".xlsm", ".xlsb", ".xls", ".csv"];
  if (ext && !supported.includes(ext)) {
    throw new Error(
      `Format « ${ext} » non pris en charge. Formats acceptés : .xlsx, .xlsm, .xlsb, .xls, .csv.`,
    );
  }

  const XLSX = await import("xlsx");
  report(10, "Lecture du fichier…");
  const buf = await file.arrayBuffer();
  if (!buf || buf.byteLength === 0) {
    throw new Error("Fichier vide ou illisible.");
  }
  report(35, "Analyse du classeur…");
  let wb: Awaited<ReturnType<typeof XLSX.read>>;
  try {
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/password|encrypt/i.test(raw)) {
      throw new Error("Fichier protégé par mot de passe : retirez la protection avant l'import.");
    }
    if (/bad|corrupt|zip|unsupported|unrecognized/i.test(raw)) {
      throw new Error(
        "Fichier illisible ou format non supporté (essayez de le ré-enregistrer en .xlsx depuis Excel).",
      );
    }
    throw new Error(`Impossible de lire le classeur : ${raw}`);
  }
  if (!wb.SheetNames?.length) {
    throw new Error("Classeur vide : aucune feuille détectée.");
  }
  report(55, "Extraction des feuilles…");

  // First try the real UCPA workbook layout.
  const native = parseUcpaWorkbook(wb, XLSX);
  if (native) {
    report(100, "Import terminé");
    return native;
  }
  const styled = parseStyledMonthWorkbook(wb, XLSX, year);
  if (styled) {
    report(100, "Import terminé");
    return styled;
  }
  report(70, "Lecture des paramètres et agents…");

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

  report(85, "Lecture du planning…");
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

  report(100, "Import terminé");
  return {
    state: partial,
    summary: parts.length
      ? `Importé : ${parts.join(", ")}.`
      : "Format non reconnu : aucune feuille exploitable (attendu : export annuel UCPA, export mensuel stylé, ou feuilles « Planning » / « Paramètres » / « Base agents »).",
  };
}

export const _unused = { DEFAULT_CODES, DEFAULT_AGENTS };
