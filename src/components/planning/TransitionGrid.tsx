import { useMemo, useState } from "react";
import { usePlanning } from "@/lib/planning/store";
import {
  codesMap,
  dayLetter,
  fmtHours,
  holidaysForYear,
  hoursForCell,
  isInvalid,
  isWeekend,
  transitionColumns,
} from "@/lib/planning/calc";
import { CATEGORY_META, codeInlineStyle, isAgentActiveInYear } from "@/lib/planning/types";
import { CodePicker } from "./CodePicker";

interface TransitionGridProps {
  /** Base year: December of this year → January of year + 1. */
  year: number;
  /** Number of January weeks to show (2 or 3). */
  janWeeks: number;
}

interface ActiveCell {
  agentId: string;
  colYear: number;
  dayIndex: number;
  rect: DOMRect;
}

export function TransitionGrid({ year, janWeeks }: TransitionGridProps) {
  const { agents: allAgents, codes, planningByYear, setCellForYear, changes } =
    usePlanning();
  const agents = useMemo(
    () => allAgents.filter((a) => isAgentActiveInYear(a, year) || isAgentActiveInYear(a, year + 1)),
    [allAgents, year],
  );
  const [active, setActive] = useState<ActiveCell | null>(null);

  const map = useMemo(() => codesMap(codes), [codes]);
  const columns = useMemo(
    () => transitionColumns(year, janWeeks),
    [year, janWeeks],
  );
  const holidaysByYear = useMemo(() => {
    const res: Record<number, Record<number, string>> = {};
    res[year] = holidaysForYear(year);
    res[year + 1] = holidaysForYear(year + 1);
    return res;
  }, [year]);

  const cellValue = (agentId: string, colYear: number, dayIndex: number) =>
    planningByYear[colYear]?.[agentId]?.[dayIndex];

  const posteCodes = useMemo(
    () => codes.filter((c) => c.category === "poste"),
    [codes],
  );
  const posteCounts = useMemo(() => {
    const res: Record<string, number[]> = {};
    for (const c of posteCodes) res[c.code] = columns.map(() => 0);
    for (const a of agents) {
      columns.forEach((col, ci) => {
        const v = cellValue(a.id, col.year, col.dayIndex);
        if (v && res[v]) res[v][ci]++;
      });
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posteCodes, agents, planningByYear, columns]);

  const agentTotal = (agentId: string) =>
    columns.reduce(
      (s, col) => s + hoursForCell(cellValue(agentId, col.year, col.dayIndex), map),
      0,
    );

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Aucun agent. Ajoutez des agents dans l'onglet « Base agents ».
      </div>
    );
  }

  // Index of the first January column (to draw a year separator).
  const firstJanIndex = columns.findIndex((c) => c.year === year + 1);

  return (
    <div className="overflow-auto rounded-lg border border-border bg-card">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-[180px] border-b border-r border-border bg-muted px-3 py-1.5 text-left font-semibold">
              Agent
            </th>
            {columns.map((col, ci) => {
              const we = isWeekend(col.date);
              const hol = holidaysByYear[col.year][col.dayIndex];
              const yearStart = ci === firstJanIndex;
              return (
                <th
                  key={`${col.year}-${col.dayIndex}`}
                  title={hol}
                  className={`sticky top-0 z-20 w-10 min-w-10 border-b border-r border-border px-0 py-1 text-center font-medium ${
                    yearStart ? "border-l-2 border-l-primary" : ""
                  } ${hol ? "cell-holiday" : we ? "cell-weekend" : "bg-muted"}`}
                >
                  <div className="text-[10px] leading-tight text-muted-foreground">
                    {dayLetter(col.date)}
                  </div>
                  <div className="text-xs font-semibold leading-tight">
                    {col.date.getDate()}
                  </div>
                  <div className="text-[9px] leading-tight text-muted-foreground">
                    {col.date.getMonth() === 11 ? "déc" : "jan"}
                  </div>
                </th>
              );
            })}
            <th className="sticky top-0 z-20 min-w-[64px] border-b border-r border-border bg-accent px-2 py-1 text-center text-xs font-semibold">
              H total
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id} className="hover:bg-muted/40">
              <td className="sticky left-0 z-10 min-w-[180px] border-b border-r border-border bg-card px-3 py-1.5">
                <div className="font-medium leading-tight">{a.name}</div>
                {a.team && (
                  <div className="text-[11px] text-muted-foreground">
                    {a.team}
                  </div>
                )}
              </td>
              {columns.map((col, ci) => {
                const value = cellValue(a.id, col.year, col.dayIndex);
                const invalid = isInvalid(value, map);
                const codeDef = value ? map[value] : undefined;
                const cat = codeDef ? codeDef.category : null;
                const we = isWeekend(col.date);
                const hol = holidaysByYear[col.year][col.dayIndex];
                const cls = invalid
                  ? "cat-error"
                  : cat
                    ? CATEGORY_META[cat].cls
                    : hol
                      ? "cell-holiday"
                      : we
                        ? "cell-weekend"
                        : "";
                const style = invalid ? undefined : codeInlineStyle(codeDef);
                const changed =
                  col.year === year && !!changes[`${a.id}:${col.dayIndex}`];
                const yearStart = ci === firstJanIndex;
                return (
                  <td
                    key={`${col.year}-${col.dayIndex}`}
                    className={`border-b border-r border-border p-0 ${
                      yearStart ? "border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <button
                      type="button"
                      title={
                        value && map[value]
                          ? map[value].label
                          : hol
                            ? hol
                            : value
                      }
                      onClick={(e) =>
                        setActive({
                          agentId: a.id,
                          colYear: col.year,
                          dayIndex: col.dayIndex,
                          rect: e.currentTarget.getBoundingClientRect(),
                        })
                      }
                      className={`h-9 w-10 cursor-pointer text-center text-xs font-semibold outline-none transition-colors hover:ring-1 hover:ring-inset hover:ring-primary focus:ring-1 focus:ring-inset focus:ring-primary ${cls} ${changed ? "cell-changed" : ""}`}
                      style={style}
                    >
                      {value ?? ""}
                    </button>
                  </td>
                );
              })}
              <td className="border-b border-r border-border bg-accent/40 px-2 text-center font-semibold tabular-nums">
                {fmtHours(agentTotal(a.id))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted font-semibold">
            <td className="sticky left-0 z-10 border-r border-t border-border bg-muted px-3 py-1.5 text-right text-xs">
              Total / jour
            </td>
            {columns.map((col, ci) => {
              let sum = 0;
              for (const a of agents)
                sum += hoursForCell(
                  cellValue(a.id, col.year, col.dayIndex),
                  map,
                );
              const yearStart = ci === firstJanIndex;
              return (
                <td
                  key={`${col.year}-${col.dayIndex}`}
                  className={`border-r border-t border-border px-0 py-1 text-center text-[11px] tabular-nums ${
                    yearStart ? "border-l-2 border-l-primary" : ""
                  }`}
                >
                  {sum > 0 ? fmtHours(sum) : ""}
                </td>
              );
            })}
            <td className="border-r border-t border-border bg-accent px-2 text-center tabular-nums">
              {fmtHours(agents.reduce((s, a) => s + agentTotal(a.id), 0))}
            </td>
          </tr>

          {posteCodes.length > 0 && (
            <>
              <tr className="no-print">
                <td
                  colSpan={columns.length + 2}
                  className="sticky left-0 border-t-2 border-border bg-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
                >
                  Nombre de postes par jour
                </td>
              </tr>
              {posteCodes.map((c) => {
                const counts = posteCounts[c.code];
                const total = counts.reduce((s, n) => s + n, 0);
                return (
                  <tr key={c.code} className="no-print">
                    <td
                      title={c.label}
                      className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-0.5 text-xs font-medium"
                    >
                      {c.code}
                    </td>
                    {counts.map((n, ci) => (
                      <td
                        key={ci}
                        className={`border-b border-r border-border px-0 py-0.5 text-center text-[11px] tabular-nums ${
                          n > 1
                            ? "bg-destructive font-bold text-destructive-foreground"
                            : n === 0
                              ? "text-muted-foreground/30"
                              : ""
                        }`}
                      >
                        {n > 0 ? n : ""}
                      </td>
                    ))}
                    <td className="border-b border-r border-border bg-accent/40 px-2 text-center text-xs font-semibold tabular-nums">
                      {total > 0 ? total : ""}
                    </td>
                  </tr>
                );
              })}
            </>
          )}
        </tfoot>
      </table>

      {active && (
        <CodePicker
          anchor={active.rect}
          codes={codes}
          current={cellValue(active.agentId, active.colYear, active.dayIndex)}
          onSelect={(code) => {
            setCellForYear(active.colYear, active.agentId, active.dayIndex, code);
            setActive(null);
          }}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
