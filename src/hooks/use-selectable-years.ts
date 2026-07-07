import { useEffect, useState } from "react";
import { selectableYears } from "@/lib/planning/calc";

/**
 * Returns the list of selectable years and keeps it up to date automatically
 * when the calendar year changes — even if the app stays open across New Year.
 *
 * The list is recomputed:
 *  - on a periodic check (every hour),
 *  - when the tab regains focus / becomes visible.
 *
 * When the current year actually changes, the returned array reference updates
 * so any consuming component re-renders with the new range.
 */
export function useSelectableYears(): number[] {
  const [years, setYears] = useState<number[]>(() => selectableYears());

  useEffect(() => {
    const refresh = () => {
      const next = selectableYears();
      setYears((prev) =>
        prev.length === next.length && prev[prev.length - 1] === next[next.length - 1]
          ? prev
          : next,
      );
    };

    const interval = window.setInterval(refresh, 60 * 60 * 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return years;
}
