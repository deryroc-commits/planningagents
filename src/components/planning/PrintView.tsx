import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Printer } from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import {
  codesMap,
  dateOfDayIndex,
  dayIndicesForMonth,
  dayLetter,
  holidaysForYear,
  isInvalid,
  isWeekend,
  selectableYears,
} from "@/lib/planning/calc";
import { MONTHS } from "@/lib/planning/calc";
import { CATEGORY_META } from "@/lib/planning/types";
import type { Agent } from "@/lib/planning/types";
import { exportStyledMonthExcel } from "@/lib/planning/excel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PrintViewProps {
  month: number;
  setMonth: (m: number) => void;
}

export function PrintView({ month, setMonth }: PrintViewProps) {
  const { year, setYear, agents, codes, planning } = usePlanning();
  const map = useMemo(() => codesMap(codes), [codes]);
  const holidays = useMemo(() => holidaysForYear(year), [year]);
  const indices = useMemo(
    () => dayIndicesForMonth(year, month),
    [year, month],
  );
  const years = useMemo(() => selectableYears(), []);
  const printDate = useMemo(
    () => new Date().toLocaleDateString("fr-FR"),
    [],
  );

  // Group agents by team, preserving order — inserts a section band per team.
  const groups = useMemo(() => {
    const out: { team: string; agents: Agent[] }[] = [];
    for (const a of agents) {
      const team = a.team?.trim() || "Sans équipe";
      const last = out[out.length - 1];
      if (last && last.team === team) last.agents.push(a);
      else out.push({ team, agents: [a] });
    }
    return out;
  }, [agents]);

  const colCount = indices.length + 1;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Aperçu avant impression</h2>
          <p className="text-sm text-muted-foreground">
            Vue mensuelle formatée, prête à imprimer ou exporter en PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth((month + 11) % 12)}
              aria-label="Mois précédent"
            >
              <ChevronLeft />
            </Button>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth((month + 1) % 12)}
              aria-label="Mois suivant"
            >
              <ChevronRight />
            </Button>
          </div>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() =>
              exportStyledMonthExcel(
                { codes, agents, planningByYear: { [year]: planning } },
                year,
                month,
              )
            }
          >
            <FileSpreadsheet /> Aperçu Excel (XLSX)
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Imprimer / PDF
          </Button>
        </div>
      </div>

      <div className="print-area overflow-auto rounded-lg border border-border bg-card p-3">
        <PlanningSheet
          month={month}
          year={year}
          printDate={printDate}
          groups={groups}
          indices={indices}
          planning={planning}
          map={map}
          holidays={holidays}
          colCount={colCount}
        />
      </div>
    </div>
  );
}

interface SheetProps {
  month: number;
  year: number;
  printDate: string;
  groups: { team: string; agents: Agent[] }[];
  indices: number[];
  planning: ReturnType<typeof usePlanning>["planning"];
  map: ReturnType<typeof codesMap>;
  holidays: Record<number, string>;
  colCount: number;
}

function PlanningSheet({
  month,
  year,
  printDate,
  groups,
  indices,
  planning,
  map,
  holidays,
  colCount,
}: SheetProps) {
  return (
    <>
      {/* Title banner */}
      <div className="mb-3 flex items-stretch gap-2">
        <div className="flex min-w-[180px] flex-col items-center justify-center rounded border border-border bg-muted px-3 py-1.5">
          <div className="text-lg font-bold uppercase tracking-wide">
            {MONTHS[month]}
          </div>
          <div className="text-sm font-semibold text-muted-foreground">
            {year}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center rounded bg-destructive px-4 py-1.5">
          <h1 className="text-xl font-bold tracking-wide text-destructive-foreground">
            PLANNING AGENTS UCPA
          </h1>
        </div>
        <div className="flex min-w-[150px] flex-col items-center justify-center rounded border border-border bg-muted px-3 py-1.5">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            Imprimé le
          </div>
          <div className="text-sm font-bold">{printDate}</div>
        </div>
      </div>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="w-[180px] min-w-[180px] border border-border bg-muted px-2 py-1 text-left">
              Agent
            </th>
            {indices.map((i) => {
              const d = dateOfDayIndex(year, i);
              const hol = holidays[i];
              return (
                <th
                  key={`l-${i}`}
                  title={hol}
                  className={`w-7 border border-border px-0 py-0.5 text-center text-[9px] ${
                    hol
                      ? "cell-holiday"
                      : isWeekend(d)
                        ? "cell-weekend"
                        : "bg-muted"
                  }`}
                >
                  {dayLetter(d)}
                </th>
              );
            })}
          </tr>
          <tr>
            <th className="border border-border bg-muted px-2 py-1 text-left text-[9px] uppercase text-muted-foreground">
              Jour
            </th>
            {indices.map((i) => {
              const d = dateOfDayIndex(year, i);
              const hol = holidays[i];
              return (
                <th
                  key={`n-${i}`}
                  title={hol}
                  className={`w-7 border border-border px-0 py-0.5 text-center font-semibold ${
                    hol
                      ? "cell-holiday"
                      : isWeekend(d)
                        ? "cell-weekend"
                        : "bg-muted"
                  }`}
                >
                  {d.getDate()}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows
              key={g.team}
              team={g.team}
              agents={g.agents}
              indices={indices}
              planning={planning}
              map={map}
              holidays={holidays}
              year={year}
              colCount={colCount}
            />
          ))}
        </tbody>
      </table>
      <Legend />
    </>
  );
}

function GroupRows({
  team,
  agents,
  indices,
  planning,
  map,
  holidays,
  year,
  colCount,
}: {
  team: string;
  agents: Agent[];
  indices: number[];
  planning: ReturnType<typeof usePlanning>["planning"];
  map: ReturnType<typeof codesMap>;
  holidays: Record<number, string>;
  year: number;
  colCount: number;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={colCount}
          className="border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground"
        >
          {team}
        </td>
      </tr>
      {agents.map((a) => {
        const row = planning[a.id] ?? {};
        return (
          <tr key={a.id}>
            <td className="border border-border px-2 py-0.5 font-medium uppercase">
              {a.name}
            </td>
            {indices.map((i) => {
              const v = row[i];
              const cat = v && map[v] ? map[v].category : null;
              const hol = holidays[i];
              const cls = isInvalid(v, map)
                ? "cat-error"
                : cat
                  ? CATEGORY_META[cat].cls
                  : hol
                    ? "cell-holiday"
                    : isWeekend(dateOfDayIndex(year, i))
                      ? "cell-weekend"
                      : "";
              return (
                <td
                  key={i}
                  className={`border border-border px-0 py-0.5 text-center font-semibold ${cls}`}
                >
                  {v ?? ""}
                </td>
              );
            })}
          </tr>

        );
      })}
    </>
  );
}

function Legend() {
  const cats = Object.entries(CATEGORY_META);
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-[11px]">
      {cats.map(([key, meta]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className={`inline-block size-3 rounded ${meta.cls}`} />
          {meta.label}
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded cell-weekend" />
        Week-end
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded cell-holiday" />
        Jour férié
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded cat-error" />
        Erreur / code invalide
      </div>
    </div>
  );
}
