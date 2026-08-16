import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import { useWorkspace } from "@/lib/workspace/workspace-context";
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
import { getVisibleAgents } from "@/lib/planning/visible-agents";
import type { Agent } from "@/lib/planning/types";
import { exportStyledMonthExcel } from "@/lib/planning/excel";
import { exportElementToPdf, type PdfFormat } from "@/lib/planning/pdf";
import { printTicket, usePrinters } from "@/lib/printing/printers";
import { toast } from "sonner";

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

/** Maximum number of agent rows per printed page. Extra agents flow to a new page. */
const AGENTS_PER_PAGE = 26;

type Group = { team: string; agents: Agent[] };

/**
 * Split the full team-grouped agent list into pages of at most
 * AGENTS_PER_PAGE rows. Team banners are re-emitted at the top of a new page
 * whenever a team is split across pages, so context is never lost.
 */
function paginateGroups(groups: Group[], perPage: number): Group[][] {
  const pages: Group[][] = [];
  let current: Group[] = [];
  let count = 0;
  for (const g of groups) {
    let remaining = g.agents;
    while (remaining.length > 0) {
      const capacity = perPage - count;
      if (capacity <= 0) {
        pages.push(current);
        current = [];
        count = 0;
        continue;
      }
      const take = remaining.slice(0, capacity);
      current.push({ team: g.team, agents: take });
      count += take.length;
      remaining = remaining.slice(capacity);
      if (count >= perPage) {
        pages.push(current);
        current = [];
        count = 0;
      }
    }
  }
  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

export function PrintView({ month, setMonth }: PrintViewProps) {
  const { year, setYear, agents, codes, planning, colors, yearRange } = usePlanning();
  const { activeWorkspace } = useWorkspace();
  const printTitle = activeWorkspace?.print_title ?? "PLANNING DES AGENTS";
  const [xlsxOpen, setXlsxOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfSaving, setPdfSaving] = useState(false);
  const [pdfFormat, setPdfFormat] = useState<PdfFormat>("a4");
  const { printers, defaultPrinter } = usePrinters();
  const [printerId, setPrinterId] = useState<string>("");
  const selectedPrinter =
    printers.find((p) => p.id === printerId) ?? defaultPrinter;
  const [ticketBusy, setTicketBusy] = useState(false);

  const [includeInactive, setIncludeInactive] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
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
  // Nameless agents and agents outside their arrival/departure window are
  // excluded (unless the user opts in with the "inactive" toggle) so pagination
  // and header repetition always match the visible rows.
  const visibleAgents = useMemo(
    () =>
      getVisibleAgents(agents, {
        scope: { kind: "month", year, month },
        includeInactive,
      }),
    [agents, year, month, includeInactive],
  );
  const groups = useMemo(() => {
    const out: Group[] = [];
    for (const a of visibleAgents) {
      const team = a.team?.trim() || "Sans équipe";
      const last = out[out.length - 1];
      if (last && last.team === team) last.agents.push(a);
      else out.push({ team, agents: [a] });
    }
    return out;
  }, [visibleAgents]);

  const pages = useMemo(() => paginateGroups(groups, AGENTS_PER_PAGE), [groups]);
  const colCount = indices.length + 1;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Aperçu avant impression</h2>
          <p className="text-sm text-muted-foreground">
            Vue mensuelle formatée, prête à imprimer ou exporter en PDF.
            {pages.length > 1 && (
              <> {pages.length} pages générées automatiquement.</>
            )}
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
          <label className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Inclure inactifs
          </label>
          <Button variant="outline" onClick={() => setXlsxOpen(true)}>
            <FileSpreadsheet /> Aperçu Excel (XLSX)
          </Button>
          <Select
            value={pdfFormat}
            onValueChange={(v) => setPdfFormat(v as PdfFormat)}
          >
            <SelectTrigger className="w-24" aria-label="Format PDF">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">A4</SelectItem>
              <SelectItem value="a3">A3</SelectItem>
            </SelectContent>
          </Select>
          <Button
            disabled={pdfSaving}
            onClick={async () => {
              if (!pageRef.current) return;
              setPdfSaving(true);
              try {
                await exportElementToPdf(
                  pageRef.current,
                  `Planning Agents _ ${MONTHS[month]} ${year}.pdf`,
                  pdfFormat,
                );
              } finally {
                setPdfSaving(false);
              }
            }}
          >
            {pdfSaving ? <Loader2 className="animate-spin" /> : <Printer />}
            {pdfSaving ? "Génération…" : "Imprimer / PDF"}
          </Button>
        </div>
      </div>

      <div className="print-area overflow-auto rounded-lg border border-border bg-card p-3">
        <div ref={pageRef} className="mx-auto flex w-full max-w-[1188px] flex-col gap-4">
          {pages.map((pageGroups, pi) => (
            <PrintPage
              key={pi}
              pageIndex={pi}
              pageCount={pages.length}
              month={month}
              year={year}
              printDate={printDate}
              printTitle={printTitle}
              groups={pageGroups}
              indices={indices}
              planning={planning}
              map={map}
              holidays={holidays}
              colCount={colCount}
              showLegend={pi === pages.length - 1}
            />
          ))}
        </div>
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
          <div className="min-h-0 flex-1 space-y-4 overflow-auto rounded-lg border border-border bg-card p-3">
            {pages.map((pageGroups, pi) => (
              <PlanningSheet
                key={pi}
                month={month}
                year={year}
                printDate={printDate}
                printTitle={printTitle}
                groups={pageGroups}
                indices={indices}
                planning={planning}
                map={map}
                holidays={holidays}
                colCount={colCount}
                pageIndex={pi}
                pageCount={pages.length}
                showLegend={pi === pages.length - 1}
              />
            ))}
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
                    printTitle,
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

interface PrintPageProps extends SheetProps {
  pageIndex: number;
  pageCount: number;
  showLegend: boolean;
}

/**
 * One A4-landscape page. Owns its own scaling refs so pages with fewer rows
 * (typically the last one) enlarge their content to fill the available space
 * instead of leaving empty white area at the bottom.
 */
function PrintPage(props: PrintPageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const [printScale, setPrintScale] = useState(1);
  const [printOffset, setPrintOffset] = useState({ x: 0, y: 0 });

  const updateScale = useCallback(() => {
    const content = contentRef.current;
    const sheet = sheetRef.current;
    if (!content || !sheet) return;
    const contentRect = content.getBoundingClientRect();
    const sheetWidth = sheet.offsetWidth;
    const sheetHeight = sheet.offsetHeight;
    if (!contentRect.width || !contentRect.height || !sheetWidth || !sheetHeight) return;

    const nextScale = Math.min(
      contentRect.width / sheetWidth,
      contentRect.height / sheetHeight,
    );
    const clamped = Math.max(0.2, nextScale);
    const scaledWidth = sheetWidth * clamped;
    const scaledHeight = sheetHeight * clamped;
    setPreviewOffset({
      x: Math.max(0, (contentRect.width - scaledWidth) / 2),
      y: Math.max(0, (contentRect.height - scaledHeight) / 2),
    });
    setPreviewScale(clamped);

    const MM = 96 / 25.4;
    const printW = 287 * MM;
    const printH = 200 * MM;
    const pScale = Math.min(printW / sheetWidth, printH / sheetHeight);
    setPrintScale(pScale);
    setPrintOffset({
      x: Math.max(0, (printW - sheetWidth * pScale) / 2),
      y: Math.max(0, (printH - sheetHeight * pScale) / 2),
    });
  }, []);

  useLayoutEffect(() => {
    updateScale();
    const content = contentRef.current;
    const sheet = sheetRef.current;
    if (!content || !sheet) return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(content);
    observer.observe(sheet);
    window.addEventListener("resize", updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [updateScale, props.groups, props.indices.length]);

  return (
    <div className="planning-pdf-page mx-auto w-full max-w-[1188px] overflow-hidden rounded-sm bg-card shadow-sm">
      <div ref={contentRef} className="planning-pdf-content">
        <div
          ref={sheetRef}
          className="planning-pdf-sheet flex flex-col bg-card"
          style={{
            transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale})`,
            width: "1120px",
            minWidth: "1120px",
            minHeight: `${Math.round(1120 * (200 / 287))}px`,
            ["--print-x" as string]: `${printOffset.x}px`,
            ["--print-y" as string]: `${printOffset.y}px`,
            ["--print-scale" as string]: printScale,
          } as React.CSSProperties}
        >
          <PlanningSheet {...props} />
        </div>
      </div>
    </div>
  );
}

interface SheetProps {
  month: number;
  year: number;
  printDate: string;
  printTitle: string;
  groups: { team: string; agents: Agent[] }[];
  indices: number[];
  planning: ReturnType<typeof usePlanning>["planning"];
  map: ReturnType<typeof codesMap>;
  holidays: Record<number, string>;
  colCount: number;
  pageIndex?: number;
  pageCount?: number;
  showLegend?: boolean;
}

function PlanningSheet({
  month,
  year,
  printDate,
  printTitle,
  groups,
  indices,
  planning,
  map,
  holidays,
  colCount,
  pageIndex,
  pageCount,
  showLegend = true,
}: SheetProps) {
  return (
    <div className="flex h-full min-h-full flex-1 flex-col">
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
            {printTitle}
          </h1>
        </div>
        <div className="flex min-w-[150px] flex-col items-center justify-center rounded border border-border bg-muted px-3 py-1.5">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            Imprimé le
          </div>
          <div className="text-sm font-bold">{printDate}</div>
          {pageCount && pageCount > 1 && (
            <div className="text-[10px] font-semibold text-muted-foreground">
              Page {(pageIndex ?? 0) + 1} / {pageCount}
            </div>
          )}
        </div>
      </div>

      <table className="w-full flex-1 border-collapse text-[11px]" style={{ height: "100%" }}>

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
          {groups.map((g, gi) => (
            <GroupRows
              key={`${g.team}-${gi}`}
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
      {showLegend && <Legend />}
    </div>

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
