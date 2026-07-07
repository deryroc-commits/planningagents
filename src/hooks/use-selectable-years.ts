import { useEffect, useState } from "react";
import { selectableYears } from "@/lib/planning/calc";
import type { YearRangeConfig } from "@/lib/planning/types";

/**
 * Returns the list of selectable years and keeps it up to date automatically
 * when the calendar year changes — even if the app stays open across New Year.
 *
 * An optional `range` (configured in Paramètres) overrides the first year and
 * how many years ahead of the current year to include.
 *
 * The list is recomputed:
 *  - when the `range` changes,
 *  - on a periodic check (every hour),
 *  - when the tab regains focus / becomes visible.
 */
export function useSelectableYears(range?: YearRangeConfig): number[] {
  const [years, setYears] = useState<number[]>(() => selectableYears(range));

  const start = range?.start;
  const ahead = range?.ahead;

  useEffect(() => {
    const current = range ?? undefined;
    const refresh = () => {
      const next = selectableYears(current);
      setYears((prev) =>
        prev.length === next.length &&
        prev[0] === next[0] &&
        prev[prev.length - 1] === next[next.length - 1]
          ? prev
          : next,
      );
    };

    refresh();
    const interval = window.setInterval(refresh, 60 * 60 * 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, ahead]);

  return years;
}
