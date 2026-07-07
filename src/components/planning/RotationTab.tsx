import { Fragment, useMemo, useState } from "react";
import { CalendarClock, Wand2, RotateCcw } from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { CATEGORY_META, codeInlineStyle } from "@/lib/planning/types";
import type { Agent } from "@/lib/planning/types";
import {
  MONTHS,
  codesMap,
  dateOfDayIndex,
  dayIndicesForMonth,
  daysInYear,
} from "@/lib/planning/calc";
import {
  WEEK_DAYS,
  WEEKEND_DEFAULT_CODE,
  codeForCell,
  getAgentTemplate,
} from "@/lib/planning/rotation";
import { CodePicker } from "./CodePicker";

interface ActiveCell {
  agentId: string;
  week: number;
  day: number;
  rect: DOMRect;
}

const CYCLE_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

export function RotationTab() {
  const { year, agents, codes, rotation, setRotation, applyRotation } =
    usePlanning();
  const map = useMemo(() => codesMap(codes), [codes]);
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [mode, setMode] = useState<"replace" | "fill">("fill");
  const [fromMonth, setFromMonth] = useState<number>(0);
  const [status, setStatus] = useState<string | null>(null);

  const cycle = rotation.cycleWeeks;

  const setCycle = (n: number) =>
    setRotation({ ...rotation, cycleWeeks: n });

  const setTplCell = (
    agentId: string,
    week: number,
    day: number,
    code: string | null,
  ) => {
    const tpl = getAgentTemplate(rotation, agentId).map((r) => [...r]);
    tpl[week][day] = code ?? "";
    setRotation({
      ...rotation,
      agentTemplates: { ...rotation.agentTemplates, [agentId]: tpl },
    });
  };

  const clearAgent = (agentId: string) => {
    const next = { ...rotation.agentTemplates };
    delete next[agentId];
    setRotation({ ...rotation, agentTemplates: next });
  };

  /** Remet toutes les cases de week-end (S/D) au poste RH pour chaque agent. */
  const resetWeekendsToRH = () => {
    if (
      !window.confirm(
        `Réinitialiser tous les week-ends (samedi & dimanche) au poste ${WEEKEND_DEFAULT_CODE} ?\nLes semaines (L→V) ne sont pas modifiées.`,
      )
    )
      return;
    const next: Record<string, string[][]> = {};
    for (const a of agents) {
      const tpl = getAgentTemplate(rotation, a.id).map((row, _w) =>
        row.map((code, d) => (d >= 5 ? WEEKEND_DEFAULT_CODE : code)),
      );
      next[a.id] = tpl;
    }
    setRotation({ ...rotation, agentTemplates: next });
    setStatus(`Week-ends réinitialisés au poste ${WEEKEND_DEFAULT_CODE}.`);
    setTimeout(() => setStatus(null), 6000);
  };

  const doApply = () => {
    const fromDayIndex =
      fromMonth > 0 ? dayIndicesForMonth(year, fromMonth)[0] ?? 0 : 0;
    const scope =
      fromMonth > 0
        ? ` à partir de ${MONTHS[fromMonth]} (les mois précédents ne seront pas modifiés)`
        : " sur toute l'année";
    const msg =
      mode === "replace"
        ? `Remplacer le planning ${year}${scope} par le roulement généré ?\nLes saisies manuelles des cases concernées seront écrasées.`
        : `Compléter les cases vides du planning ${year}${scope} avec le roulement ?\nLes saisies existantes seront conservées.`;
    if (!window.confirm(msg)) return;
    const n = applyRotation(mode, fromDayIndex);
    setStatus(
      `Roulement appliqué : ${n} case${n > 1 ? "s" : ""} mise${n > 1 ? "s" : ""} à jour.`,
    );
    setTimeout(() => setStatus(null), 6000);
  };

  // Group agents by team, keeping input order.
  const groups = useMemo(() => {
    const out: { team: string; agents: Agent[] }[] = [];
    for (const a of agents) {
      const team = a.team?.trim() || "Sans équipe";
      let g = out.find((x) => x.team === team);
      if (!g) {
        g = { team, agents: [] };
        out.push(g);
      }
      g.agents.push(a);
    }
    return out;
  }, [agents]);

  // Weekends of the year for the preview.
  const weekends = useMemo(() => {
    const total = daysInYear(year);
    const list: { sat: number; sun: number | null; label: string }[] = [];
    for (let i = 0; i < total; i++) {
      const d = dateOfDayIndex(year, i);
      if (d.getDay() === 6) {
        const sun = i + 1 < total ? i + 1 : null;
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        list.push({ sat: i, sun, label });
      }
    }
    return list;
  }, [year]);

  const isWorking = (code?: string) => {
    if (!code) return false;
    const c = map[code];
    return !!c && (c.category === "travail" || c.category === "poste");
  };

  const workedWeekends = useMemo(() => {
    const res: Record<string, number> = {};
    for (const a of agents) {
      let n = 0;
      for (const w of weekends) {
        const sat = codeForCell(rotation, a.id, year, w.sat);
        const sun =
          w.sun !== null ? codeForCell(rotation, a.id, year, w.sun) : undefined;
        if (isWorking(sat) || isWorking(sun)) n++;
      }
      res[a.id] = n;
    }
    return res;
  }, [agents, rotation, weekends, year, map]);

  const cellStyleFor = (code?: string) => {
    if (!code) return undefined;
    return codeInlineStyle(map[code]);
  };
  const cellClassFor = (code?: string) => {
    if (!code) return "";
    const c = map[code];
    return c ? CATEGORY_META[c.category].cls : "cat-error";
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="size-5 text-primary" /> Roulement des
          week-ends
        </h2>
        <p className="text-sm text-muted-foreground">
          Construisez le roulement de base : chaque agent a ses{" "}
          {cycle} semaines-types. Laissez la semaine (L→V) vide ou choisissez un
          poste, et placez le poste de week-end (S/D) sur la semaine de garde.
          Le cycle se répète ensuite sur toute l'année {year}.
        </p>
      </div>

      {/* Cycle length */}
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <span className="text-sm font-medium">Roulement de week-end :</span>
        <Select
          value={String(cycle)}
          onValueChange={(v) => setCycle(Number(v))}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CYCLE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                1 week-end sur {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {cycle} semaine{cycle > 1 ? "s" : ""} de base
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={resetWeekendsToRH}
          title={`Remettre tous les week-ends au poste ${WEEKEND_DEFAULT_CODE}`}
        >
          <RotateCcw /> Réinitialiser les week-ends ({WEEKEND_DEFAULT_CODE})
        </Button>
      </section>

      {/* Per-agent base weeks grid */}
      <section className="space-y-3">
        <h3 className="font-semibold">
          Les {cycle} semaines de base — 1 week-end sur {cycle}
        </h3>
        <p className="text-sm text-muted-foreground">
          Cliquez sur une case pour choisir un code. Utilisez l'ascenseur
          horizontal pour parcourir les {cycle} semaines. Colonnes S/D =
          week-ends.
        </p>
        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="border-collapse text-xs">
            <thead>
              {/* Week band */}
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
                          row.map((code, d) => (
                            <td
                              key={`${w}-${d}`}
                              className={`border-b border-border p-0 ${
                                d === 6 ? "border-r-2" : "border-r"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={(e) =>
                                  setActive({
                                    agentId: a.id,
                                    week: w,
                                    day: d,
                                    rect: e.currentTarget.getBoundingClientRect(),
                                  })
                                }
                                className={`h-7 w-full min-w-[34px] cursor-pointer text-center text-[11px] font-semibold outline-none transition-colors hover:ring-1 hover:ring-inset hover:ring-primary ${
                                  d >= 5 && !code ? "cell-weekend" : ""
                                } ${cellClassFor(code)}`}
                                style={cellStyleFor(code)}
                              >
                                {code || ""}
                              </button>
                            </td>
                          )),
                        )}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Weekend preview */}
      <section className="space-y-3">
        <h3 className="font-semibold">Aperçu des week-ends {year}</h3>
        <p className="text-sm text-muted-foreground">
          Roulement généré par la répétition des semaines-types sur l'année.
        </p>
        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-border bg-muted px-3 py-1.5 text-left font-semibold">
                  Agents
                </th>
                <th className="min-w-[52px] border-b border-r border-border px-2 py-1 text-center text-[11px] font-semibold">
                  WE / an
                </th>
                {weekends.map((w, idx) => (
                  <th
                    key={idx}
                    className="min-w-[40px] border-b border-r border-border px-1 py-1 text-center text-[11px] font-medium"
                  >
                    {w.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="hover:bg-muted/40">
                  <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-1.5 font-medium">
                    {a.name}
                  </td>
                  <td className="border-b border-r border-border px-2 text-center font-semibold tabular-nums">
                    {workedWeekends[a.id] ?? 0}
                  </td>
                  {weekends.map((w, idx) => {
                    const sat = codeForCell(rotation, a.id, year, w.sat);
                    const sun =
                      w.sun !== null
                        ? codeForCell(rotation, a.id, year, w.sun)
                        : undefined;
                    const shown = sat || sun;
                    const rest = !isWorking(sat) && !isWorking(sun);
                    return (
                      <td
                        key={idx}
                        title={`Sam: ${sat ?? "—"} / Dim: ${sun ?? "—"}`}
                        className={`border-b border-r border-border px-1 text-center text-[11px] font-semibold ${
                          shown ? cellClassFor(shown) : ""
                        }`}
                        style={cellStyleFor(shown)}
                      >
                        {shown ?? (rest ? "" : "")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Apply */}
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <span className="text-sm font-medium">
          Appliquer au planning {year} :
        </span>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && setMode(v as "replace" | "fill")}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="fill">Compléter les vides</ToggleGroupItem>
          <ToggleGroupItem value="replace">Remplacer</ToggleGroupItem>
        </ToggleGroup>
        <span className="text-sm font-medium">À partir de :</span>
        <Select
          value={String(fromMonth)}
          onValueChange={(v) => setFromMonth(Number(v))}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Toute l'année (janvier)</SelectItem>
            {MONTHS.map((m, i) =>
              i === 0 ? null : (
                <SelectItem key={i} value={String(i)}>
                  {m}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Button onClick={doApply}>
          <Wand2 /> Générer le roulement
        </Button>
        {fromMonth > 0 && (
          <span className="w-full text-xs text-muted-foreground">
            Les mois avant {MONTHS[fromMonth]} ne seront pas modifiés — pratique
            pour changer le roulement en cours d'année.
          </span>
        )}
        {status && (
          <span className="inline-flex items-center gap-1.5 text-sm text-primary">
            <RotateCcw className="size-4" /> {status}
          </span>
        )}
      </section>

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
            setTplCell(active.agentId, active.week, active.day, code);
            setActive(null);
          }}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
