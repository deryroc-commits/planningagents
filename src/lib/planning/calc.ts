import type { PlanningCode, YearPlanning } from "./types";

export const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// getDay(): 0=Sunday .. 6=Saturday
const DAY_LETTERS = ["D", "L", "M", "Me", "J", "V", "S"];

export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number): number {
  return isLeap(year) ? 366 : 365;
}

export function dateOfDayIndex(year: number, dayIndex: number): Date {
  return new Date(year, 0, 1 + dayIndex);
}

export function dayLetter(date: Date): string {
  return DAY_LETTERS[date.getDay()];
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

/** Returns the 0-based day-of-year indices that fall within the given month. */
export function dayIndicesForMonth(year: number, month: number): number[] {
  const result: number[] = [];
  const total = daysInYear(year);
  for (let i = 0; i < total; i++) {
    if (dateOfDayIndex(year, i).getMonth() === month) result.push(i);
  }
  return result;
}

export function codesMap(codes: PlanningCode[]): Record<string, PlanningCode> {
  const m: Record<string, PlanningCode> = {};
  for (const c of codes) m[c.code] = c;
  return m;
}

export function isInvalid(
  value: string | undefined,
  map: Record<string, PlanningCode>,
): boolean {
  return !!value && !map[value];
}

export function hoursForCell(
  value: string | undefined,
  map: Record<string, PlanningCode>,
): number {
  if (!value) return 0;
  const c = map[value];
  return c ? c.hours : 0;
}

export function agentHoursForIndices(
  planning: YearPlanning,
  agentId: string,
  indices: number[],
  map: Record<string, PlanningCode>,
): number {
  const row = planning[agentId];
  if (!row) return 0;
  let sum = 0;
  for (const i of indices) sum += hoursForCell(row[i], map);
  return Math.round(sum * 100) / 100;
}

export function agentYearHours(
  planning: YearPlanning,
  agentId: string,
  year: number,
  map: Record<string, PlanningCode>,
): number {
  const all = Array.from({ length: daysInYear(year) }, (_, i) => i);
  return agentHoursForIndices(planning, agentId, all, map);
}

export function countErrors(
  planning: YearPlanning,
  map: Record<string, PlanningCode>,
): number {
  let n = 0;
  for (const agentId in planning) {
    const row = planning[agentId];
    for (const k in row) {
      if (isInvalid(row[Number(k)], map)) n++;
    }
  }
  return n;
}

export function fmtHours(h: number): string {
  if (h === 0) return "0";
  return Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ",");
}

/** Sentinel "month" value for the cross-year transition sheet (déc. → janv.). */
export const TRANSITION_MONTH = 12;

/** One column of the transition sheet: it may belong to `year` or `year + 1`. */
export interface TransitionColumn {
  year: number;
  dayIndex: number;
  date: Date;
}

/**
 * Columns for the cross-year transition sheet: the last 3 weeks (21 days) of
 * December of `year`, followed by the first `janWeeks` weeks of January of
 * `year + 1`.
 */
export function transitionColumns(
  year: number,
  janWeeks: number,
): TransitionColumn[] {
  const cols: TransitionColumn[] = [];
  // Last 3 weeks of December (Dec 11 → 31).
  for (let day = 11; day <= 31; day++) {
    const date = new Date(year, 11, day);
    cols.push({ year, dayIndex: dayIndexOfDate(year, date), date });
  }
  // First `janWeeks` weeks of January of the next year.
  const ny = year + 1;
  const total = Math.max(1, janWeeks) * 7;
  for (let day = 1; day <= total; day++) {
    const date = new Date(ny, 0, day);
    cols.push({ year: ny, dayIndex: dayIndexOfDate(ny, date), date });
  }
  return cols;
}

/**
 * Range of selectable years. By default it spans from 2020 (or 4 years before
 * the current year, whichever is earlier) up to the current year + 10.
 * A configurable `range` overrides both ends: `start` is the first year and
 * `ahead` is how many years past the current calendar year to include, so the
 * range keeps auto-extending each new year.
 */
export function selectableYears(range?: {
  start: number;
  ahead: number;
}): number[] {
  const now = new Date().getFullYear();
  const start = range ? range.start : Math.min(now - 4, 2020);
  const ahead = range ? Math.max(0, range.ahead) : 10;
  const end = now + ahead;
  const first = Math.min(start, end);
  const out: number[] = [];
  for (let y = first; y <= end; y++) out.push(y);
  return out;
}

/** Easter Sunday (Meeus/Jones/Butcher algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function dayIndexOfDate(year: number, date: Date): number {
  const start = new Date(year, 0, 1).getTime();
  return Math.round((date.getTime() - start) / 86400000);
}

/** Map of 0-based day-of-year index -> French public holiday label. */
export function holidaysForYear(year: number): Record<number, string> {
  const res: Record<number, string> = {};
  const addFixed = (m: number, d: number, label: string) => {
    res[dayIndexOfDate(year, new Date(year, m, d))] = label;
  };
  addFixed(0, 1, "Jour de l'An");
  addFixed(4, 1, "Fête du Travail");
  addFixed(4, 8, "Victoire 1945");
  addFixed(6, 14, "Fête nationale");
  addFixed(7, 15, "Assomption");
  addFixed(10, 1, "Toussaint");
  addFixed(10, 11, "Armistice");
  addFixed(11, 25, "Noël");

  const easter = easterSunday(year);
  const addOffset = (off: number, label: string) => {
    const dt = new Date(easter);
    dt.setDate(dt.getDate() + off);
    res[dayIndexOfDate(year, dt)] = label;
  };
  addOffset(1, "Lundi de Pâques");
  addOffset(39, "Ascension");
  addOffset(50, "Lundi de Pentecôte");
  return res;
}
