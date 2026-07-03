import type { PlanningCode, YearPlanning } from "./types";
import {
  agentHoursForIndices,
  dateOfDayIndex,
  dayIndicesForMonth,
  daysInYear,
} from "./calc";

export interface WeekBucket {
  num: number;
  label: string;
  indices: number[];
}

/** Monday-based ISO-like week buckets covering the whole year. */
export function weekBucketsForYear(year: number): WeekBucket[] {
  const total = daysInYear(year);
  const jan1 = dateOfDayIndex(year, 0);
  const mon0 = (jan1.getDay() + 6) % 7;
  const buckets: WeekBucket[] = [];
  for (let i = 0; i < total; i++) {
    const w = Math.floor((i + mon0) / 7);
    if (!buckets[w]) buckets[w] = { num: w + 1, label: `S${w + 1}`, indices: [] };
    buckets[w].indices.push(i);
  }
  return buckets.filter(Boolean);
}

/** Hours per agent for each week bucket. */
export function hoursByWeek(
  planning: YearPlanning,
  agentId: string,
  buckets: WeekBucket[],
  map: Record<string, PlanningCode>,
): number[] {
  return buckets.map((b) => agentHoursForIndices(planning, agentId, b.indices, map));
}

/** Hours per agent for each of the 12 months. */
export function hoursByMonth(
  planning: YearPlanning,
  agentId: string,
  year: number,
  map: Record<string, PlanningCode>,
): number[] {
  const out: number[] = [];
  for (let m = 0; m < 12; m++) {
    out.push(
      agentHoursForIndices(planning, agentId, dayIndicesForMonth(year, m), map),
    );
  }
  return out;
}

/** Number of days matching a given code for an agent within `indices`. */
export function countDaysForCode(
  planning: YearPlanning,
  agentId: string,
  indices: number[],
  code: string,
): number {
  const row = planning[agentId];
  if (!row) return 0;
  let n = 0;
  for (const i of indices) if (row[i] === code) n++;
  return n;
}

/** Days matching a code per month (12 values). */
export function daysByMonthForCode(
  planning: YearPlanning,
  agentId: string,
  year: number,
  code: string,
): number[] {
  const out: number[] = [];
  for (let m = 0; m < 12; m++) {
    out.push(
      countDaysForCode(planning, agentId, dayIndicesForMonth(year, m), code),
    );
  }
  return out;
}

/** Total days for a code over the whole year for an agent. */
export function daysForCodeYear(
  planning: YearPlanning,
  agentId: string,
  year: number,
  code: string,
): number {
  const all = Array.from({ length: daysInYear(year) }, (_, i) => i);
  return countDaysForCode(planning, agentId, all, code);
}
