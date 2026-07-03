import type { RotationState } from "./types";
import { dateOfDayIndex } from "./calc";

/** Day headers of the rotation template, Monday-first. */
export const WEEK_DAYS = ["L", "M", "Me", "J", "V", "S", "D"] as const;
export const WEEK_DAYS_LONG = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

/** Ensure the rotation has exactly `cycleWeeks` rows of 7 codes. */
export function normalizeRotation(r: RotationState | undefined): RotationState {
  const cycle = Math.max(1, Math.min(12, Math.round(r?.cycleWeeks || 1)));
  const templates: string[][] = [];
  for (let w = 0; w < cycle; w++) {
    const src = r?.templates?.[w] ?? [];
    const row: string[] = [];
    for (let d = 0; d < 7; d++) row.push(src[d] ?? "");
    templates.push(row);
  }
  return { cycleWeeks: cycle, templates, offsets: r?.offsets ?? {} };
}

/** Monday-based day of week (0 = Monday .. 6 = Sunday). */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Number of whole Monday-weeks between the anchor Monday and the given day. */
export function weekSinceAnchor(year: number, dayIndex: number): number {
  const jan1 = dateOfDayIndex(year, 0);
  const mon0 = mondayIndex(jan1);
  return Math.floor((dayIndex + mon0) / 7);
}

/** Position (0-based) of a day inside an agent's cycle. */
export function cyclePosition(
  year: number,
  dayIndex: number,
  cycle: number,
  offset: number,
): number {
  const w = weekSinceAnchor(year, dayIndex);
  return (((w + offset) % cycle) + cycle) % cycle;
}

/** Code produced by the rotation for a given agent offset and day. */
export function codeForCell(
  r: RotationState,
  offset: number,
  year: number,
  dayIndex: number,
): string | undefined {
  const pos = cyclePosition(year, dayIndex, r.cycleWeeks, offset);
  const d = dateOfDayIndex(year, dayIndex);
  const code = r.templates[pos]?.[mondayIndex(d)];
  return code || undefined;
}
