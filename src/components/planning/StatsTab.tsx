import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
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
import { codesMap, fmtHours, MONTHS } from "@/lib/planning/calc";
import {
  daysByMonthForCode,
  daysForCodeYear,
  hoursByMonth,
  hoursByWeek,
  weekBucketsForYear,
} from "@/lib/planning/stats";

const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3));

export function StatsTab() {
  const { year, agents, codes, planning } = usePlanning();
  const map = useMemo(() => codesMap(codes), [codes]);
  const weeks = useMemo(() => weekBucketsForYear(year), [year]);

  const [axis, setAxis] = useState<"week" | "month">("month");
  const [critCode, setCritCode] = useState<string>(codes[0]?.code ?? "");

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Aucun agent. Ajoutez des agents dans l'onglet « Base agents ».
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="size-5 text-primary" /> Statistiques {year}
        </h2>
        <p className="text-sm text-muted-foreground">
          Analyse des heures et des postes par agent, calculée à partir du
          planning saisi.
        </p>
      </div>

      {/* Bloc A — Heures travaillées */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Heures travaillées par agent</h3>
          <ToggleGroup
            type="single"
            value={axis}
            onValueChange={(v) => v && setAxis(v as "week" | "month")}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="month">Par mois</ToggleGroupItem>
            <ToggleGroupItem value="week">Par semaine</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="sticky left-0 z-10 min-w-[180px] border-b border-r border-border bg-muted px-3 py-1.5 text-left font-semibold">
                  Agent
                </th>
                <th className="border-b border-r border-border bg-accent px-2 py-1.5 text-center font-semibold">
                  Total
                </th>
                {axis === "month"
                  ? MONTH_SHORT.map((m, i) => (
                      <th
                        key={i}
                        className="min-w-[52px] border-b border-r border-border px-2 py-1.5 text-center font-medium"
                      >
                        {m}
                      </th>
                    ))
                  : weeks.map((w) => (
                      <th
                        key={w.num}
                        className="min-w-[44px] border-b border-r border-border px-1 py-1.5 text-center text-xs font-medium"
                      >
                        {w.label}
                      </th>
                    ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const vals =
                  axis === "month"
                    ? hoursByMonth(planning, a.id, year, map)
                    : hoursByWeek(planning, a.id, weeks, map);
                const total = vals.reduce((s, v) => s + v, 0);
                return (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-1.5 font-medium">
                      {a.name}
                    </td>
                    <td className="border-b border-r border-border bg-accent/40 px-2 text-center font-semibold tabular-nums">
                      {fmtHours(total)}
                    </td>
                    {vals.map((v, i) => (
                      <td
                        key={i}
                        className="border-b border-r border-border px-1 text-center tabular-nums"
                      >
                        {v > 0 ? fmtHours(v) : ""}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bloc B — Nombre de journées par critère */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Nombre de journées selon un critère</h3>
          <Select value={critCode} onValueChange={setCritCode}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Choisir un code" />
            </SelectTrigger>
            <SelectContent>
              {codes.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="sticky left-0 z-10 min-w-[180px] border-b border-r border-border bg-muted px-3 py-1.5 text-left font-semibold">
                  Agent
                </th>
                <th className="border-b border-r border-border bg-accent px-2 py-1.5 text-center font-semibold">
                  Année
                </th>
                {MONTH_SHORT.map((m) => (
                  <th
                    key={m}
                    className="min-w-[52px] border-b border-r border-border px-2 py-1.5 text-center font-medium"
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const months = critCode
                  ? daysByMonthForCode(planning, a.id, year, critCode)
                  : new Array(12).fill(0);
                const total = months.reduce((s, v) => s + v, 0);
                return (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-1.5 font-medium">
                      {a.name}
                    </td>
                    <td className="border-b border-r border-border bg-accent/40 px-2 text-center font-semibold tabular-nums">
                      {total || ""}
                    </td>
                    {months.map((v, i) => (
                      <td
                        key={i}
                        className="border-b border-r border-border px-1 text-center tabular-nums"
                      >
                        {v > 0 ? v : ""}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bloc C — Répartition de chaque poste par agent */}
      <section className="space-y-3">
        <h3 className="font-semibold">
          Répartition de chaque poste / code par agent (jours / an)
        </h3>
        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="sticky left-0 z-10 min-w-[180px] border-b border-r border-border bg-muted px-3 py-1.5 text-left font-semibold">
                  Agent
                </th>
                {codes.map((c) => (
                  <th
                    key={c.code}
                    title={c.label}
                    className="min-w-[44px] border-b border-r border-border px-1 py-1.5 text-center"
                  >
                    <span
                      className={`inline-flex min-w-8 justify-center rounded px-1 py-0.5 text-xs font-semibold ${CATEGORY_META[c.category].cls}`}
                      style={codeInlineStyle(c)}
                    >
                      {c.code}
                    </span>
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
                  {codes.map((c) => {
                    const n = daysForCodeYear(planning, a.id, year, c.code);
                    return (
                      <td
                        key={c.code}
                        className="border-b border-r border-border px-1 text-center tabular-nums"
                      >
                        {n > 0 ? n : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
