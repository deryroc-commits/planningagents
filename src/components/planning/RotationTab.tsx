import { useMemo, useState } from "react";
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
import { codesMap, dateOfDayIndex, daysInYear } from "@/lib/planning/calc";
import {
  WEEK_DAYS,
  WEEK_DAYS_LONG,
  codeForCell,
} from "@/lib/planning/rotation";
import { CodePicker } from "./CodePicker";

interface ActiveTpl {
  week: number;
  day: number;
  rect: DOMRect;
}

const CYCLE_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export function RotationTab() {
  const { year, agents, codes, rotation, setRotation, applyRotation } =
    usePlanning();
  const map = useMemo(() => codesMap(codes), [codes]);
  const [active, setActive] = useState<ActiveTpl | null>(null);
  const [mode, setMode] = useState<"replace" | "fill">("fill");
  const [status, setStatus] = useState<string | null>(null);

  const setCycle = (n: number) => setRotation({ ...rotation, cycleWeeks: n });

  const setTplCell = (week: number, day: number, code: string | null) => {
    const templates = rotation.templates.map((r) => [...r]);
    templates[week][day] = code ?? "";
    setRotation({ ...rotation, templates });
  };

  const setOffset = (agentId: string, off: number) =>
    setRotation({
      ...rotation,
      offsets: { ...rotation.offsets, [agentId]: off },
    });

  const doApply = () => {
    const msg =
      mode === "replace"
        ? `Remplacer le planning ${year} par le roulement généré ?\nLes saisies manuelles des cases concernées seront écrasées.`
        : `Compléter les cases vides du planning ${year} avec le roulement ?\nLes saisies existantes seront conservées.`;
    if (!window.confirm(msg)) return;
    const n = applyRotation(mode);
    setStatus(`Roulement appliqué : ${n} case${n > 1 ? "s" : ""} mise${n > 1 ? "s" : ""} à jour.`);
    setTimeout(() => setStatus(null), 6000);
  };

  // Weekends of the year for the preview.
  const weekends = useMemo(() => {
    const total = daysInYear(year);
    const list: { sat: number; sun: number | null; label: string }[] = [];
    for (let i = 0; i < total; i++) {
      const d = dateOfDayIndex(year, i);
      if (d.getDay() === 6) {
        const sun = i + 1 < total ? i + 1 : null;
        const sd = dateOfDayIndex(year, i);
        const label = `${sd.getDate()}/${sd.getMonth() + 1}`;
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
      const off = rotation.offsets[a.id] ?? 0;
      let n = 0;
      for (const w of weekends) {
        const sat = codeForCell(rotation, off, year, w.sat);
        const sun = w.sun !== null ? codeForCell(rotation, off, year, w.sun) : undefined;
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
          Définissez un cycle de base (1 week-end sur N) puis générez
          automatiquement le roulement sur toute l'année {year}.
        </p>
      </div>

      {/* Cycle length */}
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <span className="text-sm font-medium">Cycle de base :</span>
        <Select
          value={String(rotation.cycleWeeks)}
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
          {rotation.cycleWeeks} semaine{rotation.cycleWeeks > 1 ? "s" : ""} de
          base
        </span>
      </section>

      {/* Base week templates */}
      <section className="space-y-3">
        <h3 className="font-semibold">Semaines-types du cycle</h3>
        <p className="text-sm text-muted-foreground">
          Cliquez sur une case pour définir le code (RH = repos hebdo). Les
          colonnes S/D sont les week-ends.
        </p>
        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="border-b border-r border-border px-3 py-1.5 text-left font-semibold">
                  Semaine
                </th>
                {WEEK_DAYS.map((d, i) => (
                  <th
                    key={i}
                    className={`min-w-[52px] border-b border-r border-border px-2 py-1.5 text-center font-medium ${
                      i >= 5 ? "cell-weekend" : ""
                    }`}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rotation.templates.map((row, w) => (
                <tr key={w} className="hover:bg-muted/40">
                  <td className="border-b border-r border-border px-3 py-1.5 font-medium">
                    Semaine {w + 1}
                  </td>
                  {row.map((code, d) => (
                    <td key={d} className="border-b border-r border-border p-0">
                      <button
                        type="button"
                        onClick={(e) =>
                          setActive({
                            week: w,
                            day: d,
                            rect: e.currentTarget.getBoundingClientRect(),
                          })
                        }
                        className={`h-9 w-full min-w-[52px] cursor-pointer text-center text-xs font-semibold outline-none transition-colors hover:ring-1 hover:ring-inset hover:ring-primary ${cellClassFor(code)}`}
                        style={cellStyleFor(code)}
                      >
                        {code || ""}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Agent offsets */}
      <section className="space-y-3">
        <h3 className="font-semibold">Position des agents dans le cycle</h3>
        <p className="text-sm text-muted-foreground">
          Décalez chaque agent d'une semaine pour répartir les week-ends.
        </p>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left">
                <th className="px-3 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">Départ du cycle</th>
                <th className="px-3 py-2 text-center font-medium">
                  Week-ends travaillés / an
                </th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={String(rotation.offsets[a.id] ?? 0)}
                      onValueChange={(v) => setOffset(a.id, Number(v))}
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rotation.templates.map((_, w) => (
                          <SelectItem key={w} value={String(w)}>
                            Semaine {w + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-center font-semibold tabular-nums">
                    {workedWeekends[a.id] ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Weekend preview */}
      <section className="space-y-3">
        <h3 className="font-semibold">Aperçu des week-ends {year}</h3>
        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-border bg-muted px-3 py-1.5 text-left font-semibold">
                  Agent
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
              {agents.map((a) => {
                const off = rotation.offsets[a.id] ?? 0;
                return (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-1.5 font-medium">
                      {a.name}
                    </td>
                    {weekends.map((w, idx) => {
                      const sat = codeForCell(rotation, off, year, w.sat);
                      const sun =
                        w.sun !== null
                          ? codeForCell(rotation, off, year, w.sun)
                          : undefined;
                      const rest = !isWorking(sat) && !isWorking(sun);
                      return (
                        <td
                          key={idx}
                          title={`Sam: ${sat ?? "—"} / Dim: ${sun ?? "—"}`}
                          className={`border-b border-r border-border px-1 text-center text-[11px] font-semibold ${
                            rest ? "cat-repos" : cellClassFor(sat || sun)
                          }`}
                          style={rest ? undefined : cellStyleFor(sat || sun)}
                        >
                          {rest ? "RH" : (sat || sun) ?? ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Apply */}
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <span className="text-sm font-medium">Appliquer au planning {year} :</span>
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
        <Button onClick={doApply}>
          <Wand2 /> Générer le roulement
        </Button>
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
          current={rotation.templates[active.week]?.[active.day] || undefined}
          onSelect={(code) => {
            setTplCell(active.week, active.day, code);
            setActive(null);
          }}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
