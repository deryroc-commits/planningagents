import { useMemo, useState } from "react";
import { usePlanning } from "@/lib/planning/store";
import {
  agentHoursForIndices,
  agentYearHours,
  codesMap,
  dateOfDayIndex,
  dayIndicesForMonth,
  dayLetter,
  fmtHours,
  holidaysForYear,
  hoursForCell,
  isInvalid,
  isWeekend,
} from "@/lib/planning/calc";
import { CATEGORY_META } from "@/lib/planning/types";
import { CodePicker } from "./CodePicker";

interface PlanningGridProps {
  month: number;
}

interface ActiveCell {
  agentId: string;
  dayIndex: number;
  rect: DOMRect;
}

export function PlanningGrid({ month }: PlanningGridProps) {
  const { year, agents, codes, planning, setCell } = usePlanning();
  const [active, setActive] = useState<ActiveCell | null>(null);

  const map = useMemo(() => codesMap(codes), [codes]);
  const holidays = useMemo(() => holidaysForYear(year), [year]);
  const indices = useMemo(
    () => dayIndicesForMonth(year, month),
    [year, month],
  );

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Aucun agent. Ajoutez des agents dans l'onglet « Base agents ».
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border border-border bg-card">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-[180px] border-b border-r border-border bg-muted px-3 py-1.5 text-left font-semibold">
              Agent
            </th>
            {indices.map((i) => {
              const d = dateOfDayIndex(year, i);
              const we = isWeekend(d);
              const hol = holidays[i];
              return (
                <th
                  key={i}
                  title={hol}
                  className={`sticky top-0 z-20 w-10 min-w-10 border-b border-r border-border px-0 py-1 text-center font-medium ${
                    hol ? "cell-holiday" : we ? "cell-weekend" : "bg-muted"
                  }`}
                >
                  <div className="text-[11px] leading-tight text-muted-foreground">
                    {dayLetter(d)}
                  </div>
                  <div className="text-xs font-semibold leading-tight">
                    {d.getDate()}
                  </div>
                </th>
              );
            })}
            <th className="sticky top-0 z-20 min-w-[64px] border-b border-l border-border bg-accent px-2 py-1 text-center text-xs font-semibold">
              H mois
            </th>
            <th className="sticky top-0 z-20 min-w-[64px] border-b border-r border-border bg-accent px-2 py-1 text-center text-xs font-semibold">
              H année
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => {
            const row = planning[a.id] ?? {};
            const monthH = agentHoursForIndices(planning, a.id, indices, map);
            const yearH = agentYearHours(planning, a.id, year, map);
            return (
              <tr key={a.id} className="hover:bg-muted/40">
                <td className="sticky left-0 z-10 min-w-[180px] border-b border-r border-border bg-card px-3 py-1.5">
                  <div className="font-medium leading-tight">{a.name}</div>
                  {a.team && (
                    <div className="text-[11px] text-muted-foreground">
                      {a.team}
                    </div>
                  )}
                </td>
                {indices.map((i) => {
                  const value = row[i];
                  const invalid = isInvalid(value, map);
                  const codeDef = value ? map[value] : undefined;
                  const cat = codeDef ? codeDef.category : null;
                  const d = dateOfDayIndex(year, i);
                  const we = isWeekend(d);
                  const hol = holidays[i];
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
                  return (
                    <td
                      key={i}
                      className="border-b border-r border-border p-0"
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
                            dayIndex: i,
                            rect: e.currentTarget.getBoundingClientRect(),
                          })
                        }
                        className={`h-9 w-10 cursor-pointer text-center text-xs font-semibold outline-none transition-colors hover:ring-1 hover:ring-inset hover:ring-primary focus:ring-1 focus:ring-inset focus:ring-primary ${cls}`}
                      >
                        {value ?? ""}
                      </button>
                    </td>
                  );
                })}
                <td className="border-b border-l border-border bg-accent/40 px-2 text-center font-semibold tabular-nums">
                  {fmtHours(monthH)}
                </td>
                <td className="border-b border-r border-border bg-accent/40 px-2 text-center font-semibold tabular-nums">
                  {fmtHours(yearH)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-muted font-semibold">
            <td className="sticky left-0 z-10 border-r border-t border-border bg-muted px-3 py-1.5 text-right text-xs">
              Total / jour
            </td>
            {indices.map((i) => {
              let sum = 0;
              for (const a of agents) sum += hoursForCell(planning[a.id]?.[i], map);
              return (
                <td
                  key={i}
                  className="border-r border-t border-border px-0 py-1 text-center text-[11px] tabular-nums"
                >
                  {sum > 0 ? fmtHours(sum) : ""}
                </td>
              );
            })}
            <td className="border-l border-t border-border bg-accent px-2 text-center tabular-nums">
              {fmtHours(
                agents.reduce(
                  (s, a) => s + agentHoursForIndices(planning, a.id, indices, map),
                  0,
                ),
              )}
            </td>
            <td className="border-r border-t border-border bg-accent px-2 text-center tabular-nums">
              {fmtHours(
                agents.reduce(
                  (s, a) => s + agentYearHours(planning, a.id, year, map),
                  0,
                ),
              )}
            </td>
          </tr>
        </tfoot>
      </table>

      {active && (
        <CodePicker
          anchor={active.rect}
          codes={codes}
          current={planning[active.agentId]?.[active.dayIndex]}
          onSelect={(code) => {
            setCell(active.agentId, active.dayIndex, code);
            setActive(null);
          }}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
