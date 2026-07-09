import type { RotationPeriod, RotationState } from "./types";
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

/** Default code applied to weekend cells (Saturday & Sunday) when unset. */
export const WEEKEND_DEFAULT_CODE = "RH";

/** Normalize a single agent template to exactly `cycle` rows of 7 codes. */
export function normalizeAgentTemplate(
  rows: string[][] | undefined,
  cycle: number,
): string[][] {
  const out: string[][] = [];
  for (let w = 0; w < cycle; w++) {
    const src = rows?.[w];
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      const cell = src?.[d];
      // Weekend days (Samedi = 5, Dimanche = 6) default to RH when never set.
      if (cell === undefined) {
        row.push(d >= 5 ? WEEKEND_DEFAULT_CODE : "");
      } else {
        row.push(cell);
      }
    }
    out.push(row);
  }
  return out;
}

/** Normalize an optional validity marker (drops invalid values). */
function normalizePeriod(p: RotationPeriod | undefined): RotationPeriod | undefined {
  if (!p) return undefined;
  const year = Math.round(p.year);
  const month = Math.round(p.month);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return undefined;
  if (month < 0 || month > 11) return undefined;
  return { year, month };
}

/** Ensure the rotation has a valid cycle length and per-agent templates. */
export function normalizeRotation(r: RotationState | undefined): RotationState {
  const cycle = Math.max(1, Math.min(12, Math.round(r?.cycleWeeks || 1)));
  const agentTemplates: Record<string, string[][]> = {};
  const src = r?.agentTemplates ?? {};
  for (const id in src) {
    agentTemplates[id] = normalizeAgentTemplate(src[id], cycle);
  }
  const out: RotationState = { cycleWeeks: cycle, agentTemplates };
  const validFrom = normalizePeriod(r?.validFrom);
  const validUntil = normalizePeriod(r?.validUntil);
  if (validFrom) out.validFrom = validFrom;
  if (validUntil) out.validUntil = validUntil;
  return out;
}

/** Absolute month index (year*12+month) for comparing validity bounds. */
function periodValue(p: RotationPeriod): number {
  return p.year * 12 + p.month;
}

/**
 * Whether a given day falls inside the rotation's validity window. A rotation
 * with no bounds is always valid; bounds are inclusive at month granularity.
 */
export function isWithinValidity(
  r: RotationState,
  year: number,
  dayIndex: number,
): boolean {
  if (!r.validFrom && !r.validUntil) return true;
  const d = dateOfDayIndex(year, dayIndex);
  const v = year * 12 + d.getMonth();
  if (r.validFrom && v < periodValue(r.validFrom)) return false;
  if (r.validUntil && v > periodValue(r.validUntil)) return false;
  return true;
}

/** Get an agent's template, normalized to the current cycle length. */
export function getAgentTemplate(
  r: RotationState,
  agentId: string,
): string[][] {
  return normalizeAgentTemplate(r.agentTemplates[agentId], r.cycleWeeks);
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

/** Position (0-based) of a day inside the cycle. */
export function cyclePosition(
  year: number,
  dayIndex: number,
  cycle: number,
): number {
  const w = weekSinceAnchor(year, dayIndex);
  return ((w % cycle) + cycle) % cycle;
}

/** Code produced by an agent's rotation template for a given day. */
export function codeForCell(
  r: RotationState,
  agentId: string,
  year: number,
  dayIndex: number,
): string | undefined {
  if (!r.agentTemplates[agentId]) return undefined;
  const tpl = getAgentTemplate(r, agentId);
  const pos = cyclePosition(year, dayIndex, r.cycleWeeks);
  const d = dateOfDayIndex(year, dayIndex);
  const code = tpl[pos]?.[mondayIndex(d)];
  return code || undefined;
}
