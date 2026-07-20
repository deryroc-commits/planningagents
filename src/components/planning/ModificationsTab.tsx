import { Fragment, useMemo, useState } from "react";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  Printer,
  Sparkles,
} from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import {
  codesMap,
  dateOfDayIndex,
  dayIndicesForMonth,
  dayLetter,
  fmtHours,
  holidaysForYear,
  isWeekend,
  MONTHS,
} from "@/lib/planning/calc";
import type { Agent, PlanningChange } from "@/lib/planning/types";
import { CATEGORY_META, codeInlineStyle, isAgentActiveInMonth } from "@/lib/planning/types";
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

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ModificationsTab() {
  const { year, agents: allAgents, codes, changes, fillRange, clearChanges } = usePlanning();
  const [month, setMonth] = useState(new Date().getMonth());
  const agents = useMemo(
    () => allAgents.filter((a) => isAgentActiveInMonth(a, year, month)),
    [allAgents, year, month],
  );
  const [agentId, setAgentId] = useState<string>("");
  const [codeValue, setCodeValue] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const map = useMemo(() => codesMap(codes), [codes]);
  const holidays = useMemo(() => holidaysForYear(year), [year]);
  const indices = useMemo(() => dayIndicesForMonth(year, month), [year, month]);

  /** Flat list of all changes for the year, sorted by date then agent name. */
  const changeList = useMemo(() => {
    const arr: (PlanningChange & { agent: Agent | undefined; date: Date })[] = [];
    for (const key in changes) {
      const c = changes[key];
      const agent = agents.find((a) => a.id === c.agentId);
      arr.push({ ...c, agent, date: dateOfDayIndex(year, c.dayIndex) });
    }
    arr.sort((a, b) => a.dayIndex - b.dayIndex || (a.agent?.name ?? "").localeCompare(b.agent?.name ?? ""));
    return arr;
  }, [changes, agents, year]);

  const changesCount = changeList.length;

  /** Apply selected code to selected days for selected agent. */
  const applyBulk = () => {
    if (!agentId) return;
    if (selected.size === 0) return;
    if (!codeValue) return;
    const indicesArr = Array.from(selected);
    const code = codeValue === "__clear" ? null : codeValue;
    fillRange(agentId, indicesArr, code);
    setSelected(new Set());
    setStatus(`${indicesArr.length} cellule(s) modifiée(s).`);
    setTimeout(() => setStatus(null), 4000);
  };

  const toggleDay = (i: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const selectAllMonth = () => setSelected(new Set(indices));
  const selectNone = () => setSelected(new Set());

  return (
    <div className="space-y-6">
      {/* Bulk editor */}
      <section className="no-print rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <CalendarCheck className="size-5" /> Édition multiple
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          {/* Agent */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Agent</label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="— Choisir —" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Month */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Mois</label>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => (m + 11) % 12)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-32">
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
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => (m + 1) % 12)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          {/* Code */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Code</label>
            <Select value={codeValue} onValueChange={setCodeValue}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="— Choisir —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__clear">
                  <span className="text-muted-foreground">Vider</span>
                </SelectItem>
                {codes.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span
                      className={`mr-1.5 inline-flex min-w-7 justify-center rounded px-1 py-0.5 text-[10px] font-semibold ${CATEGORY_META[c.category].cls}`}
                      style={codeInlineStyle(c)}
                    >
                      {c.code}
                    </span>
                    {c.label}{" "}
                    <span className="text-xs text-muted-foreground">({fmtHours(c.hours)}h)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Day grid */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={selectAllMonth}>
            Tout sélectionner
          </Button>
          <Button variant="ghost" size="sm" onClick={selectNone}>
            Tout désélectionner
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {indices.map((i) => {
            const d = dateOfDayIndex(year, i);
            const hol = holidays[i];
            const we = isWeekend(d);
            const isSel = selected.has(i);
            return (
              <button
                key={i}
                type="button"
                title={hol ?? ""}
                onClick={() => toggleDay(i)}
                className={`flex size-9 flex-col items-center justify-center rounded text-xs font-medium ring-inset transition-colors ${
                  isSel
                    ? "ring-2 ring-primary bg-primary/20"
                    : hol
                      ? "cell-holiday"
                      : we
                        ? "cell-weekend"
                        : "bg-muted"
                } hover:ring-primary hover:ring-1`}
              >
                <span className="text-[9px] text-muted-foreground">{dayLetter(d)}</span>
                <span>{d.getDate()}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={applyBulk}
            disabled={!agentId || selected.size === 0 || !codeValue}
            className="bg-primary"
          >
            <Sparkles className="size-4" /> Appliquer aux {selected.size} jour(s)
          </Button>
          {status && (
            <span className="rounded-md bg-accent px-2 py-1 text-sm font-medium">{status}</span>
          )}
        </div>
      </section>

      {/* Changes summary + print */}
      <section className="space-y-3">
        <header className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Aperçu des modifications</h2>
            <p className="text-sm text-muted-foreground">
              {changesCount > 0
                ? `${changesCount} modification(s) enregistrée(s) pour ${year}.`
                : `Aucune modification enregistrée pour ${year}.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              disabled={changesCount === 0}
              onClick={() => setConfirmClear(true)}
            >
              <Eraser className="size-4" /> Effacer les modifications
            </Button>
            <Button disabled={changesCount === 0} onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimer / PDF
            </Button>
          </div>
        </header>

        {/* Print preview sheet */}
        <div className="print-area overflow-auto rounded-lg border border-border bg-card p-4">
          <ModificationsSheet year={year} changeList={changeList} map={map} />
        </div>
      </section>

      {/* Clear confirm dialog */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Effacer les modifications ?</DialogTitle>
            <DialogDescription>
              Vous avez enregistré {changesCount} modification(s) pour {year}. Cette action
              effacera le journal de modifications, mais ne modifiera pas le planning.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Annuler
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                clearChanges(year);
                setConfirmClear(false);
              }}
            >
              <Eraser className="size-4" /> Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Print sheet ---------- */

interface SheetProps {
  year: number;
  changeList: (PlanningChange & { agent: Agent | undefined; date: Date })[];
  map: ReturnType<typeof codesMap>;
}

function ModificationsSheet({ year, changeList, map }: SheetProps) {
  const printDate = new Date().toLocaleDateString("fr-FR");

  if (changeList.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucune modification à afficher.
      </div>
    );
  }

  /** Group by month index for easier reading. */
  const byMonth: Map<number, typeof changeList> = new Map();
  for (const c of changeList) {
    const m = c.date.getMonth();
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(c);
  }

  return (
    <>
      {/* Title banner */}
      <div className="mb-4 flex items-stretch gap-2">
        <div className="flex min-w-[140px] flex-col items-center justify-center rounded border border-border bg-muted px-3 py-1.5">
          <div className="text-sm font-semibold text-muted-foreground">Année</div>
          <div className="text-lg font-bold">{year}</div>
        </div>
        <div className="flex flex-1 items-center justify-center rounded bg-gradient-to-r from-[var(--change-flash)] to-emerald-400 px-4 py-1.5">
          <h1 className="text-xl font-bold text-[#1a1a1a] tracking-wide">
            MODIFICATIONS DU PLANNING
          </h1>
        </div>
        <div className="flex min-w-[130px] flex-col items-center justify-center rounded border border-border bg-muted px-3 py-1.5">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            Imprimé le
          </div>
          <div className="text-sm font-bold">{printDate}</div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-muted text-xs">
            <th className="border border-border px-2 py-1 text-left">Date</th>
            <th className="border border-border px-2 py-1 text-left">Jour</th>
            <th className="border border-border px-2 py-1 text-left">Agent</th>
            <th className="border border-border px-2 py-1 text-left">Équipe</th>
            <th className="border border-border px-2 py-1 text-center">Ancien</th>
            <th className="border border-border px-2 py-1 text-center">Nouveau</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(byMonth.entries()).map(([mIdx, items]) => (
            <Fragment key={`grp-${mIdx}`}>
              <tr>
                <td
                  colSpan={6}
                  className="border border-border bg-secondary px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-secondary-foreground"
                >
                  {MONTHS[mIdx]} {year}
                </td>
              </tr>
              {items.map((c) => {
                const fromDef = c.from ? map[c.from] : undefined;
                return (
                  <tr key={`${c.agentId}:${c.dayIndex}`}>
                    <td className="border border-border px-2 py-0.5">
                      {DATE_FMT.format(c.date)}
                    </td>
                    <td className="border border-border px-2 py-0.5">{dayLetter(c.date)}</td>
                    <td className="border border-border px-2 py-0.5 font-medium">
                      {c.agent?.name ?? "(inconnu)"}
                    </td>
                    <td className="border border-border px-2 py-0.5 text-muted-foreground">
                      {c.agent?.team ?? ""}
                    </td>
                    <td className="border border-border px-1 py-0.5 text-center">
                      {c.from ? (
                        <span
                          className={`inline-flex min-w-8 justify-center rounded px-1 py-0.5 text-[10px] font-semibold ${fromDef ? CATEGORY_META[fromDef.category].cls : "bg-muted"}`}
                        >
                          {c.from}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="border border-border px-1 py-0.5 text-center">
                      {c.to ? (
                        <span className="change-flash inline-flex min-w-8 justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold">
                          {c.to}
                        </span>
                      ) : (
                        <span className="change-flash inline-flex min-w-8 justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold">
                          (vide)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Fragment>

          ))}
        </tbody>
      </table>
    </>
  );
}
