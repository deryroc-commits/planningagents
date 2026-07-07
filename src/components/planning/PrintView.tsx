import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import {
  codesMap,
  dateOfDayIndex,
  dayIndicesForMonth,
  dayLetter,
  holidaysForYear,
  isInvalid,
  isWeekend,
} from "@/lib/planning/calc";
import { MONTHS } from "@/lib/planning/calc";
import { useSelectableYears } from "@/hooks/use-selectable-years";
import { CATEGORY_META, codeInlineStyle } from "@/lib/planning/types";
import type { Agent } from "@/lib/planning/types";
import { exportStyledMonthExcel } from "@/lib/planning/excel";
import { exportElementToPdf } from "@/lib/planning/pdf";
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
  const { year, setYear, agents, codes, planning, colors, yearRange } = usePlanning();
  const [xlsxOpen, setXlsxOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfSaving, setPdfSaving] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const map = useMemo(() => codesMap(codes), [codes]);
  const holidays = useMemo(() => holidaysForYear(year), [year]);
  const indices = useMemo(
    () => dayIndicesForMonth(year, month),
    [year, month],
  );
  const years = useSelectableYears(yearRange);
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
          <Button variant="outline" onClick={() => setXlsxOpen(true)}>
            <FileSpreadsheet /> Aperçu Excel (XLSX)
          </Button>
          <Button
            onClick={() => {
              const prev = document.title;
              // The browser uses document.title as the default PDF filename.
              document.title = `Planning Agents _ ${MONTHS[month]} ${year}`;
              const restore = () => {
                document.title = prev;
                window.removeEventListener("afterprint", restore);
              };
              window.addEventListener("afterprint", restore);
              window.print();
              // Fallback restore in case afterprint doesn't fire.
              setTimeout(restore, 1000);
            }}
          >
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

      <Dialog open={xlsxOpen} onOpenChange={setXlsxOpen}>
        <DialogContent className="flex h-[95vh] max-h-[95vh] w-[98vw] max-w-[98vw] flex-col overflow-hidden sm:max-w-[98vw]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5" />
              Aperçu du fichier Excel — {MONTHS[month]} {year}
            </DialogTitle>
            <DialogDescription>
              Aperçu avant enregistrement. Le fichier XLSX conserve les mêmes
              couleurs, colonnes et lignes. Imprimé le {printDate}.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card p-3">

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
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setXlsxOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await exportStyledMonthExcel(
                    { codes, agents, planningByYear: { [year]: planning }, colors },
                    year,
                    month,
                  );
                  setXlsxOpen(false);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Download /> {saving ? "Enregistrement…" : "Enregistrer le fichier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
              Agents
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
              const codeDef = v ? map[v] : undefined;
              const cat = codeDef ? codeDef.category : null;
              const hol = holidays[i];
              const invalid = isInvalid(v, map);
              const cls = invalid
                ? "cat-error"
                : cat
                  ? CATEGORY_META[cat].cls
                  : hol
                    ? "cell-holiday"
                    : isWeekend(dateOfDayIndex(year, i))
                      ? "cell-weekend"
                      : "";
              const style = invalid ? undefined : codeInlineStyle(codeDef);
              return (
                <td
                  key={i}
                  className={`border border-border px-0 py-0.5 text-center font-semibold ${cls}`}
                  style={style}
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
