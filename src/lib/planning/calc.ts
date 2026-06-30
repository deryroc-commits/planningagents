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
