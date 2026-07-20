import type { Agent } from "./types";
import { isAgentActiveInMonth, isAgentActiveInYear } from "./types";

/**
 * Centralised agent-visibility logic used by every tab that renders one row
 * per agent. Ensures a consistent rule set:
 *   - agents with a blank/whitespace name are ALWAYS excluded (they would
 *     otherwise show up as an empty row with a zero total),
 *   - inactive agents (outside their arrival/departure window) are excluded
 *     unless the caller explicitly opts in with `includeInactive`.
 *
 * `scope` picks the activity window:
 *   - `{ kind: "month", year, month }`   → active during that month
 *   - `{ kind: "months", year, months }` → active during at least one of those months
 *   - `{ kind: "year", year }`           → active during at least one month of the year
 *   - `{ kind: "yearOrNext", year }`     → active during `year` or `year + 1`
 *
 * Any new tab that lists agents SHOULD use this helper so filtering behaviour
 * (including the "include inactive" toggle) stays uniform across the app.
 */
export type VisibilityScope =
  | { kind: "month"; year: number; month: number }
  | { kind: "months"; year: number; months: number[] }
  | { kind: "year"; year: number }
  | { kind: "yearOrNext"; year: number };

export interface VisibleAgentsOptions {
  scope: VisibilityScope;
  /** When true, keep agents outside their activity window. Defaults to false. */
  includeInactive?: boolean;
}

/** True when the agent has a non-empty display name. */
export function hasAgentName(a: Pick<Agent, "name">): boolean {
  return !!a.name && a.name.trim().length > 0;
}

/** True when the agent is active in the given scope. */
export function isAgentActiveInScope(
  a: Agent,
  scope: VisibilityScope,
): boolean {
  switch (scope.kind) {
    case "month":
      return isAgentActiveInMonth(a, scope.year, scope.month);
    case "months":
      return scope.months.some((m) => isAgentActiveInMonth(a, scope.year, m));
    case "year":
      return isAgentActiveInYear(a, scope.year);
    case "yearOrNext":
      return (
        isAgentActiveInYear(a, scope.year) ||
        isAgentActiveInYear(a, scope.year + 1)
      );
  }
}

/**
 * Return the agents that should be rendered as rows for the given scope.
 * Always drops nameless agents; drops inactive agents unless `includeInactive`.
 */
export function getVisibleAgents(
  agents: Agent[],
  { scope, includeInactive = false }: VisibleAgentsOptions,
): Agent[] {
  return agents.filter((a) => {
    if (!hasAgentName(a)) return false;
    if (includeInactive) return true;
    return isAgentActiveInScope(a, scope);
  });
}
