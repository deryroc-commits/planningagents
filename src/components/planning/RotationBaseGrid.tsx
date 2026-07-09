import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { codesMap } from "@/lib/planning/calc";
import {
  CATEGORY_META,
  codeInlineStyle,
  type Agent,
  type PlanningCode,
  type RotationState,
} from "@/lib/planning/types";
import { WEEK_DAYS, getAgentTemplate } from "@/lib/planning/rotation";
import { CodePicker } from "./CodePicker";

interface RotationBaseGridProps {
  agents: Agent[];
  groups: { team: string; agents: Agent[] }[];
  cycle: number;
  rotation: RotationState;
  codes: PlanningCode[];
  setRotation: (r: RotationState) => void;
}

interface ActiveCell {
  agentId: string;
  week: number;
  day: number;
  rect: DOMRect;
}

/**
 * Base-weeks grid of the WE rotation, with the same Excel-style cell
 * interactions as the main planning grid: rectangular selection + drag,
 * copy/paste (keyboard Ctrl/Cmd+C/V and right-click menu), and autofill
 * by dragging the little handle at the bottom-right of the selection.
 */
export function RotationBaseGrid({
  agents,
  groups,
  cycle,
  rotation,
  codes,
  setRotation,
}: RotationBaseGridProps) {
  const map = useMemo(() => codesMap(codes), [codes]);
  const [active, setActive] = useState<ActiveCell | null>(null);

  const cols = cycle * 7;
  // Column index -> (week, day) helpers.
  const weekOf = (c: number) => Math.floor(c / 7);
  const dayOf = (c: number) => c % 7;

  // Flat row index per agent (agents are rendered grouped, but selection works
  // on the flat ordered list).
  const rowIndex = useMemo(() => {
    const m: Record<string, number> = {};
    agents.forEach((a, i) => (m[a.id] = i));
    return m;
  }, [agents]);

  const valueAt = (r: number, c: number): string | undefined => {
    const a = agents[r];
    if (!a) return undefined;
    return getAgentTemplate(rotation, a.id)[weekOf(c)]?.[dayOf(c)] || undefined;
  };

  // ---- Selection / copy-paste / autofill state (mirrors PlanningGrid) ----
  const [sel, setSel] = useState<{
    r0: number;
    c0: number;
    r1: number;
    c1: number;
  } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const movedRef = useRef(false);
  const clipboard = useRef<(string | undefined)[][] | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [fillBase, setFillBase] = useState<{
    r0: number;
    c0: number;
    r1: number;
    c1: number;
  } | null>(null);
  const [fillTo, setFillTo] = useState<{ r: number; c: number } | null>(null);

  const bounds = useMemo(() => {
    if (!sel) return null;
    return {
      r0: Math.min(sel.r0, sel.r1),
      r1: Math.max(sel.r0, sel.r1),
      c0: Math.min(sel.c0, sel.c1),
      c1: Math.max(sel.c0, sel.c1),
    };
  }, [sel]);

  const fillBounds = useMemo(() => {
    if (!fillBase || !fillTo) return null;
    return {
      r0: fillBase.r0,
      c0: fillBase.c0,
      r1: Math.max(fillBase.r1, fillTo.r),
      c1: Math.max(fillBase.c1, fillTo.c),
    };
  }, [fillBase, fillTo]);

  const hi = fillBounds ?? bounds;

  // Batch-write many template cells at once.
  const setCells = (
    cells: { agentId: string; week: number; day: number; code: string | null }[],
  ) => {
    if (!cells.length) return;
    const templates = { ...rotation.agentTemplates };
    const touched = new Set<string>();
    for (const c of cells) {
      if (!touched.has(c.agentId)) {
        templates[c.agentId] = getAgentTemplate(rotation, c.agentId).map((r) => [
          ...r,
        ]);
        touched.add(c.agentId);
      }
      templates[c.agentId][c.week][c.day] = c.code ?? "";
    }
    setRotation({ ...rotation, agentTemplates: templates });
  };

  // End drag-selection on pointer release.
  useEffect(() => {
    if (!selecting) return;
    const onUp = () => setSelecting(false);
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [selecting]);

  // Apply autofill when the handle drag ends.
  useEffect(() => {
    if (!fillBase) return;
    const onUp = () => {
      if (fillBounds && fillTo) {
        const baseRows = fillBase.r1 - fillBase.r0 + 1;
        const baseCols = fillBase.c1 - fillBase.c0 + 1;
        const cells: {
          agentId: string;
          week: number;
          day: number;
          code: string | null;
        }[] = [];
        for (let r = fillBounds.r0; r <= fillBounds.r1 && r < agents.length; r++) {
          for (let c = fillBounds.c0; c <= fillBounds.c1 && c < cols; c++) {
            if (r <= fillBase.r1 && c <= fillBase.c1) continue; // keep base
            const sr = fillBase.r0 + ((r - fillBase.r0) % baseRows);
            const sc = fillBase.c0 + ((c - fillBase.c0) % baseCols);
            cells.push({
              agentId: agents[r].id,
              week: weekOf(c),
              day: dayOf(c),
              code: valueAt(sr, sc) ?? null,
            });
          }
        }
        setCells(cells);
        setSel(fillBounds);
      }
      setFillBase(null);
      setFillTo(null);
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillBase, fillBounds, fillTo, agents, rotation, cols]);

  const copySelection = () => {
    if (!bounds) return;
    const block: (string | undefined)[][] = [];
    for (let r = bounds.r0; r <= bounds.r1; r++) {
      const rowVals: (string | undefined)[] = [];
      for (let c = bounds.c0; c <= bounds.c1; c++) rowVals.push(valueAt(r, c));
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
      week: number;
      day: number;
      code: string | null;
    }[] = [];
    for (let dr = 0; dr < block.length; dr++) {
      const r = bounds.r0 + dr;
      if (r >= agents.length) break;
      for (let dc = 0; dc < block[dr].length; dc++) {
        const c = bounds.c0 + dc;
        if (c >= cols) break;
        cells.push({
          agentId: agents[r].id,
          week: weekOf(c),
          day: dayOf(c),
          code: block[dr][dc] ?? null,
        });
      }
    }
    setCells(cells);
    const lastR = Math.min(bounds.r0 + block.length - 1, agents.length - 1);
    const lastC = Math.min(bounds.c0 + block[0].length - 1, cols - 1);
    setSel({ r0: bounds.r0, c0: bounds.c0, r1: lastR, c1: lastC });
  };

  // Keyboard copy/paste.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
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
  }, [bounds, agents, rotation, cols]);

  // Close context menu on outside interaction.
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

  const clearAgent = (agentId: string) => {
    const next = { ...rotation.agentTemplates };
    delete next[agentId];
    setRotation({ ...rotation, agentTemplates: next });
  };

  const cellStyleFor = (code?: string) =>
    code ? codeInlineStyle(map[code]) : undefined;
  const cellClassFor = (code?: string) => {
    if (!code) return "";
    const c = map[code];
    return c ? CATEGORY_META[c.category].cls : "cat-error";
  };

  return (
    <div className="overflow-auto rounded-lg border border-border bg-card">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 z-20 min-w-[170px] border-b border-r border-border bg-muted px-3 py-1.5 text-left align-bottom font-semibold"
            >
              Agents
            </th>
            {Array.from({ length: cycle }).map((_, w) => (
              <th
                key={w}
                colSpan={7}
                className={`border-b border-r-2 border-border px-2 py-1 text-center font-semibold ${
                  w % 2 === 0 ? "bg-primary/15" : "bg-accent"
                }`}
              >
                Semaine {w + 1}
              </th>
            ))}
          </tr>
          <tr className="bg-muted">
            {Array.from({ length: cycle }).map((_, w) =>
              WEEK_DAYS.map((d, i) => (
                <th
                  key={`${w}-${i}`}
                  className={`min-w-[34px] border-b border-border px-1 py-1 text-center font-medium ${
                    i === 6 ? "border-r-2" : "border-r"
                  } ${i >= 5 ? "cell-weekend" : ""}`}
                >
                  {d}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={`team-${g.team}`}>
              <tr className="bg-muted/70">
                <td
                  colSpan={cycle * 7 + 1}
                  className="sticky left-0 border-b border-border px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {g.team}
                </td>
              </tr>
              {g.agents.map((a) => {
                const r = rowIndex[a.id];
                const tpl = getAgentTemplate(rotation, a.id);
                return (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="group sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-1 font-medium">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate">{a.name}</span>
                        <button
                          type="button"
                          title="Vider ce roulement"
                          onClick={() => clearAgent(a.id)}
                          className="hidden text-[10px] text-muted-foreground hover:text-destructive group-hover:inline"
                        >
                          vider
                        </button>
                      </span>
                    </td>
                    {tpl.map((row, w) =>
                      row.map((code, d) => {
                        const col = w * 7 + d;
                        const selected =
                          hi &&
                          r >= hi.r0 &&
                          r <= hi.r1 &&
                          col >= hi.c0 &&
                          col <= hi.c1;
                        const isFillCorner =
                          bounds &&
                          !fillBase &&
                          r === bounds.r1 &&
                          col === bounds.c1;
                        return (
                          <td
                            key={`${w}-${d}`}
                            className={`relative border-b border-border p-0 ${
                              d === 6 ? "border-r-2" : "border-r"
                            }`}
                          >
                            <button
                              type="button"
                              onPointerDown={() => {
                                movedRef.current = false;
                                setSel({ r0: r, c0: col, r1: r, c1: col });
                                setSelecting(true);
                              }}
                              onPointerEnter={() => {
                                if (fillBase) {
                                  setFillTo({ r, c: col });
                                  return;
                                }
                                if (!selecting) return;
                                movedRef.current = true;
                                setSel((s) => (s ? { ...s, r1: r, c1: col } : s));
                              }}
                              onClick={(e) => {
                                if (movedRef.current) return;
                                setActive({
                                  agentId: a.id,
                                  week: w,
                                  day: d,
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
                                if (!inSel)
                                  setSel({ r0: r, c0: col, r1: r, c1: col });
                                setMenu({ x: e.clientX, y: e.clientY });
                              }}
                              className={`h-7 w-full min-w-[34px] cursor-pointer select-none text-center text-[11px] font-semibold outline-none transition-colors hover:ring-1 hover:ring-inset hover:ring-primary ${
                                d >= 5 && !code ? "cell-weekend" : ""
                              } ${cellClassFor(code)} ${
                                selected ? "ring-2 ring-inset ring-primary" : ""
                              }`}
                              style={cellStyleFor(code)}
                            >
                              {code || ""}
                            </button>
                            {isFillCorner && (
                              <span
                                role="button"
                                aria-label="Recopier vers le bas / la droite"
                                title="Glisser pour recopier"
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (bounds) {
                                    setFillBase(bounds);
                                    setFillTo({ r: bounds.r1, c: bounds.c1 });
                                  }
                                }}
                                className="absolute -bottom-[3px] -right-[3px] z-10 size-2 cursor-crosshair rounded-[1px] border border-background bg-primary"
                              />
                            )}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>

      {active && (
        <CodePicker
          anchor={active.rect}
          codes={codes}
          current={
            getAgentTemplate(rotation, active.agentId)[active.week]?.[
              active.day
            ] || undefined
          }
          onSelect={(code) => {
            setCells([
              {
                agentId: active.agentId,
                week: active.week,
                day: active.day,
                code,
              },
            ]);
            setActive(null);
          }}
          onClose={() => setActive(null)}
        />
      )}

      {menu &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: Math.min(menu.y, window.innerHeight - 96),
              left: Math.min(menu.x, window.innerWidth - 180),
              width: 168,
            }}
            className="z-50 overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                copySelection();
                setMenu(null);
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-accent"
            >
              Copier
              <span className="text-xs text-muted-foreground">Ctrl+C</span>
            </button>
            <button
              type="button"
              disabled={!clipboard.current}
              onClick={() => {
                pasteSelection();
                setMenu(null);
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              Coller
              <span className="text-xs text-muted-foreground">Ctrl+V</span>
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
