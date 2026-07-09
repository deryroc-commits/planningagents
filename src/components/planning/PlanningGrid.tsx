import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { CATEGORY_META, codeInlineStyle } from "@/lib/planning/types";
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
  const { year, agents, codes, planning, changes, setCell, pasteBlock } =
    usePlanning();
  const [active, setActive] = useState<ActiveCell | null>(null);

  // Excel-style rectangular selection + copy/paste. Press on a cell and drag to
  // select a block (across agents and days), Ctrl/Cmd+C to copy it, then select
  // the top-left target cell and Ctrl/Cmd+V to paste the block onto other days.
  const [sel, setSel] = useState<{
    r0: number;
    c0: number;
    r1: number;
    c1: number;
  } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const movedRef = useRef(false);
  // Copied block: rows of agents × columns of days (values or undefined).
  const clipboard = useRef<(string | undefined)[][] | null>(null);
  // Right-click context menu (mouse copy/paste).
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const map = useMemo(() => codesMap(codes), [codes]);
  const holidays = useMemo(() => holidaysForYear(year), [year]);
  const indices = useMemo(
    () => dayIndicesForMonth(year, month),
    [year, month],
  );

  const posteCodes = useMemo(
    () => codes.filter((c) => c.category === "poste"),
    [codes],
  );
  const posteCounts = useMemo(() => {
    const res: Record<string, number[]> = {};
    for (const c of posteCodes) res[c.code] = indices.map(() => 0);
    for (const a of agents) {
      const row = planning[a.id];
      if (!row) continue;
      indices.forEach((di, col) => {
        const v = row[di];
        if (v && res[v]) res[v][col]++;
      });
    }
    return res;
  }, [posteCodes, agents, planning, indices]);

  // Normalized selection bounds.
  const bounds = useMemo(() => {
    if (!sel) return null;
    return {
      r0: Math.min(sel.r0, sel.r1),
      r1: Math.max(sel.r0, sel.r1),
      c0: Math.min(sel.c0, sel.c1),
      c1: Math.max(sel.c0, sel.c1),
    };
  }, [sel]);

  // End the drag-selection on pointer release anywhere.
  useEffect(() => {
    if (!selecting) return;
    const onUp = () => setSelecting(false);
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [selecting]);

  // Shared copy/paste logic used by both keyboard shortcuts and the mouse menu.
  const copySelection = () => {
    if (!bounds) return;
    const block: (string | undefined)[][] = [];
    for (let r = bounds.r0; r <= bounds.r1; r++) {
      const rowVals: (string | undefined)[] = [];
      for (let c = bounds.c0; c <= bounds.c1; c++) {
        rowVals.push(planning[agents[r].id]?.[indices[c]]);
      }
      block.push(rowVals);
    }
    clipboard.current = block;
  };

  const pasteSelection = () => {
    if (!bounds) return;
    const block = clipboard.current;
    if (!block) return;
    const cells: {
      agentId: string;
      dayIndex: number;
      code: string | null;
    }[] = [];
    for (let dr = 0; dr < block.length; dr++) {
      const r = bounds.r0 + dr;
      if (r >= agents.length) break;
      for (let dc = 0; dc < block[dr].length; dc++) {
        const c = bounds.c0 + dc;
        if (c >= indices.length) break;
        cells.push({
          agentId: agents[r].id,
          dayIndex: indices[c],
          code: block[dr][dc] ?? null,
        });
      }
    }
    pasteBlock(cells);
    // Reflect the pasted block as the new selection.
    const lastR = Math.min(bounds.r0 + block.length - 1, agents.length - 1);
    const lastC = Math.min(bounds.c0 + block[0].length - 1, indices.length - 1);
    setSel({ r0: bounds.r0, c0: bounds.c0, r1: lastR, c1: lastC });
  };

  // Copy (Ctrl/Cmd+C) the selected block; paste (Ctrl/Cmd+V) at the selection
  // top-left. Ignored while typing in an input (e.g. the code picker search).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      if (!bounds) return;
      const key = e.key.toLowerCase();
      if (key === "c") {
        copySelection();
        e.preventDefault();
      } else if (key === "v") {
        pasteSelection();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, agents, indices, planning, pasteBlock]);

  // Close the mouse context menu on any outside click / scroll / escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

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
              Agents
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
          {agents.map((a, r) => {
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
                {indices.map((i, col) => {
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
                  const changed = !!changes[`${a.id}:${i}`];
                  const selected =
                    bounds &&
                    r >= bounds.r0 &&
                    r <= bounds.r1 &&
                    col >= bounds.c0 &&
                    col <= bounds.c1;
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
                        onPointerDown={() => {
                          movedRef.current = false;
                          setSel({ r0: r, c0: col, r1: r, c1: col });
                          setSelecting(true);
                        }}
                        onPointerEnter={() => {
                          if (!selecting) return;
                          movedRef.current = true;
                          setSel((s) =>
                            s ? { ...s, r1: r, c1: col } : s,
                          );
                        }}
                        onClick={(e) => {
                          if (movedRef.current) return;
                          setActive({
                            agentId: a.id,
                            dayIndex: i,
                            rect: e.currentTarget.getBoundingClientRect(),
                          });
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          const inSel =
                            bounds &&
                            r >= bounds.r0 &&
                            r <= bounds.r1 &&
                            col >= bounds.c0 &&
                            col <= bounds.c1;
                          if (!inSel) setSel({ r0: r, c0: col, r1: r, c1: col });
                          setMenu({ x: e.clientX, y: e.clientY });
                        }}
                        className={`h-9 w-10 cursor-pointer select-none text-center text-xs font-semibold outline-none transition-colors hover:ring-1 hover:ring-inset hover:ring-primary focus:ring-1 focus:ring-inset focus:ring-primary ${cls} ${changed ? "cell-changed" : ""} ${selected ? "ring-2 ring-inset ring-primary" : ""}`}
                        style={style}
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

          {posteCodes.length > 0 && (
            <>
              <tr className="no-print">
                <td
                  colSpan={indices.length + 3}
                  className="sticky left-0 border-t-2 border-border bg-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
                >
                  Nombre de postes par jour
                </td>
              </tr>
              {posteCodes.map((c) => {
                const counts = posteCounts[c.code];
                const monthTotal = counts.reduce((s, n) => s + n, 0);
                return (
                  <tr key={c.code} className="no-print">
                    <td
                      title={c.label}
                      className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-0.5 text-xs font-medium"
                    >
                      {c.code}
                    </td>
                    {counts.map((n, col) => (
                      <td
                        key={col}
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
                    <td
                      colSpan={2}
                      className="border-b border-l border-r border-border bg-accent/40 px-2 text-center text-xs font-semibold tabular-nums"
                    >
                      {monthTotal > 0 ? monthTotal : ""}
                    </td>
                  </tr>
                );
              })}
              <tr className="no-print font-bold">
                <td className="sticky left-0 z-10 border-r border-t border-border bg-destructive px-3 py-1 text-xs uppercase text-destructive-foreground">
                  Total de postes
                </td>
                {indices.map((_, col) => {
                  let sum = 0;
                  for (const c of posteCodes) sum += posteCounts[c.code][col];
                  return (
                    <td
                      key={col}
                      className="border-r border-t border-border bg-destructive/90 px-0 py-1 text-center text-[11px] tabular-nums text-destructive-foreground"
                    >
                      {sum > 0 ? sum : ""}
                    </td>
                  );
                })}
                <td
                  colSpan={2}
                  className="border-r border-t border-border bg-destructive px-2 text-center text-xs tabular-nums text-destructive-foreground"
                >
                  {posteCodes.reduce(
                    (s, c) =>
                      s + posteCounts[c.code].reduce((a, n) => a + n, 0),
                    0,
                  )}
                </td>
              </tr>
            </>
          )}
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
