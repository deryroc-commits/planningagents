import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Download,
  Eraser,
  FileSpreadsheet,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import { fmtHours } from "@/lib/planning/calc";
import type { Agent, OvertimeEntry } from "@/lib/planning/types";
import {
  exportOvertimeExcel,
  type OvertimeExportMovement,
  type OvertimeExportRow,
} from "@/lib/planning/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  month: "2-digit",
  year: "numeric",
});

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return DATE_FMT.format(new Date(y, m - 1, d));
}

interface AgentBalance {
  agent: Agent;
  added: number;
  deducted: number;
  balance: number;
  over: boolean;
}

export function OvertimeTab() {
  const {
    year,
    agents,
    overtime,
    overtimeThreshold,
    addOvertime,
    removeOvertime,
    clearOvertimeAgent,
    clearOvertimeYear,
    setOvertimeThreshold,
  } = usePlanning();

  // Add-movement form state
  const [agentId, setAgentId] = useState<string>("");
  const [sign, setSign] = useState<1 | -1>(1);
  const [hours, setHours] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [reason, setReason] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);

  // Print / export selection
  const [selected, setSelected] = useState<Set<string>>(new Set(agents.map((a) => a.id)));
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmAgent, setConfirmAgent] = useState<Agent | null>(null);

  const balances = useMemo<AgentBalance[]>(() => {
    const byAgent = new Map<string, { added: number; deducted: number }>();
    for (const a of agents) byAgent.set(a.id, { added: 0, deducted: 0 });
    for (const e of overtime) {
      const acc = byAgent.get(e.agentId);
      if (!acc) continue;
      if (e.hours >= 0) acc.added += e.hours;
      else acc.deducted += -e.hours;
    }
    return agents.map((agent) => {
      const acc = byAgent.get(agent.id)!;
      const balance = Math.round((acc.added - acc.deducted) * 100) / 100;
      return {
        agent,
        added: Math.round(acc.added * 100) / 100,
        deducted: Math.round(acc.deducted * 100) / 100,
        balance,
        over: balance >= overtimeThreshold && overtimeThreshold > 0,
      };
    });
  }, [agents, overtime, overtimeThreshold]);

  const alertCount = balances.filter((b) => b.over).length;

  const nameById = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  const sortedEntries = useMemo(
    () =>
      [...overtime].sort(
        (a, b) => a.date.localeCompare(b.date) || a.at - b.at,
      ),
    [overtime],
  );

  const selectedBalances = balances.filter((b) => selected.has(b.agent.id));

  const onAdd = () => {
    const n = Number(hours.replace(",", "."));
    if (!agentId || !n || Number.isNaN(n)) return;
    addOvertime({
      agentId,
      hours: sign * Math.abs(n),
      date,
      reason: reason.trim() || undefined,
    });
    setHours("");
    setReason("");
    const who = nameById.get(agentId)?.name ?? "";
    setStatus(`${sign > 0 ? "+" : "−"}${fmtHours(Math.abs(n))} h enregistré pour ${who}.`);
    setTimeout(() => setStatus(null), 4000);
  };

  const toggleAgent = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doExport = () => {
    const rows: OvertimeExportRow[] = selectedBalances.map((b) => ({
      name: b.agent.name,
      team: b.agent.team ?? "",
      added: b.added,
      deducted: b.deducted,
      balance: b.balance,
      over: b.over,
    }));
    const movements: OvertimeExportMovement[] = sortedEntries
      .filter((e) => selected.has(e.agentId))
      .map((e) => ({
        name: nameById.get(e.agentId)?.name ?? "(inconnu)",
        team: nameById.get(e.agentId)?.team ?? "",
        date: fmtDate(e.date),
        hours: e.hours,
        reason: e.reason ?? "",
      }));
    exportOvertimeExcel({ year, threshold: overtimeThreshold, rows, movements });
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <section className="no-print rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="size-5" /> Gestion des heures supplémentaires
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">Seuil d'alerte (h)</label>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={overtimeThreshold}
              onChange={(e) => setOvertimeThreshold(Math.max(0, Number(e.target.value) || 0))}
              className="w-24"
            />
            {alertCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-sm font-medium text-destructive">
                <AlertTriangle className="size-4" />
                {alertCount} agent{alertCount > 1 ? "s" : ""} au seuil
              </span>
            )}
          </div>
        </div>

        {/* Add movement */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Agent</label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-52">
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Sens</label>
            <div className="flex overflow-hidden rounded-md border border-input">
              <button
                type="button"
                onClick={() => setSign(1)}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${
                  sign === 1 ? "bg-emerald-500 text-white" : "bg-background"
                }`}
              >
                <Plus className="size-4" /> Ajout
              </button>
              <button
                type="button"
                onClick={() => setSign(-1)}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${
                  sign === -1 ? "bg-destructive text-destructive-foreground" : "bg-background"
                }`}
              >
                <Minus className="size-4" /> Récup.
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Heures</label>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0"
              className="w-24"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Motif (facultatif)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. renfort week-end"
              className="min-w-40"
            />
          </div>
          <Button onClick={onAdd} disabled={!agentId || !hours}>
            <Plus className="size-4" /> Enregistrer
          </Button>
        </div>
        {status && (
          <div className="mt-3">
            <span className="rounded-md bg-accent px-2 py-1 text-sm font-medium">{status}</span>
          </div>
        )}
      </section>

      {/* Balances table */}
      <section className="no-print rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Soldes par agent — {year}</h3>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            disabled={overtime.length === 0}
            onClick={() => setConfirmClearAll(true)}
          >
            <Eraser className="size-4" /> Tout remettre à zéro
          </Button>
        </div>
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-xs">
              <tr>
                <th className="px-2 py-2 text-left">
                  <Checkbox
                    checked={selected.size === agents.length && agents.length > 0}
                    onCheckedChange={(v) =>
                      setSelected(v ? new Set(agents.map((a) => a.id)) : new Set())
                    }
                  />
                </th>
                <th className="px-2 py-2 text-left">Agent</th>
                <th className="px-2 py-2 text-left">Équipe</th>
                <th className="px-2 py-2 text-right">Ajoutées</th>
                <th className="px-2 py-2 text-right">Récupérées</th>
                <th className="px-2 py-2 text-right">Solde</th>
                <th className="px-2 py-2 text-center">Statut</th>
                <th className="px-2 py-2 text-center">Reset</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.agent.id} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    <Checkbox
                      checked={selected.has(b.agent.id)}
                      onCheckedChange={() => toggleAgent(b.agent.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 font-medium uppercase">{b.agent.name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{b.agent.team ?? ""}</td>
                  <td className="px-2 py-1.5 text-right text-emerald-600">
                    {b.added ? `+${fmtHours(b.added)}` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-destructive">
                    {b.deducted ? `−${fmtHours(b.deducted)}` : "—"}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-bold ${
                      b.over ? "text-destructive" : b.balance < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {fmtHours(b.balance)} h
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {b.over ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                        <AlertTriangle className="size-3" /> Alerte
                      </span>
                    ) : b.balance !== 0 ? (
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                        OK
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={b.added === 0 && b.deducted === 0}
                      onClick={() => setConfirmAgent(b.agent)}
                      title="Remettre à zéro cet agent"
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Movement log */}
        {sortedEntries.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
              Journal des mouvements
            </h4>
            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-muted text-xs">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-left">Agent</th>
                    <th className="px-2 py-1.5 text-right">Heures</th>
                    <th className="px-2 py-1.5 text-left">Motif</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((e) => (
                    <MovementRow
                      key={e.id}
                      entry={e}
                      agent={nameById.get(e.agentId)}
                      onRemove={() => removeOvertime(e.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Print / export */}
      <section className="space-y-3">
        <header className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Aperçu avant impression</h2>
            <p className="text-sm text-muted-foreground">
              {selected.size} agent(s) sélectionné(s) — format A4 portrait pleine page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={doExport} disabled={selected.size === 0}>
              <FileSpreadsheet className="size-4" /> Export Excel
            </Button>
            <Button onClick={() => window.print()} disabled={selected.size === 0}>
              <Printer className="size-4" /> Imprimer / PDF
            </Button>
          </div>
        </header>

        <div className="print-area overtime-print-area overflow-auto rounded-lg border border-border bg-card p-4">
          <OvertimeSheet
            year={year}
            threshold={overtimeThreshold}
            balances={selectedBalances}
            entries={sortedEntries.filter((e) => selected.has(e.agentId))}
            nameById={nameById}
          />
        </div>
      </section>

      {/* Reset all confirm */}
      <Dialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tout remettre à zéro ?</DialogTitle>
            <DialogDescription>
              Cette action efface tous les mouvements d'heures supplémentaires de {year} pour
              tous les agents. Elle est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearAll(false)}>
              Annuler
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                clearOvertimeYear(year);
                setConfirmClearAll(false);
              }}
            >
              <Eraser className="size-4" /> Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset one agent confirm */}
      <Dialog open={!!confirmAgent} onOpenChange={(o) => !o && setConfirmAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remettre à zéro {confirmAgent?.name} ?</DialogTitle>
            <DialogDescription>
              Tous les mouvements d'heures supplémentaires de {confirmAgent?.name} pour {year}
              seront effacés. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAgent(null)}>
              Annuler
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmAgent) clearOvertimeAgent(confirmAgent.id);
                setConfirmAgent(null);
              }}
            >
              <RotateCcw className="size-4" /> Remettre à zéro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MovementRow({
  entry,
  agent,
  onRemove,
}: {
  entry: OvertimeEntry;
  agent: Agent | undefined;
  onRemove: () => void;
}) {
  const pos = entry.hours >= 0;
  return (
    <tr className="border-t border-border">
      <td className="px-2 py-1">{fmtDate(entry.date)}</td>
      <td className="px-2 py-1 font-medium uppercase">{agent?.name ?? "(inconnu)"}</td>
      <td
        className={`px-2 py-1 text-right font-semibold ${pos ? "text-emerald-600" : "text-destructive"}`}
      >
        {pos ? "+" : "−"}
        {fmtHours(Math.abs(entry.hours))}
      </td>
      <td className="px-2 py-1 text-muted-foreground">{entry.reason ?? ""}</td>
      <td className="px-2 py-1 text-right">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title="Supprimer ce mouvement"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </td>
    </tr>
  );
}

/* ---------- Print sheet (A4 portrait) ---------- */

interface SheetProps {
  year: number;
  threshold: number;
  balances: AgentBalance[];
  entries: OvertimeEntry[];
  nameById: Map<string, Agent>;
}

function OvertimeSheet({ year, threshold, balances, entries, nameById }: SheetProps) {
  const printDate = new Date().toLocaleDateString("fr-FR");
  const totalAdded = balances.reduce((s, b) => s + b.added, 0);
  const totalDeducted = balances.reduce((s, b) => s + b.deducted, 0);
  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  if (balances.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Sélectionnez au moins un agent pour afficher l'aperçu.
      </div>
    );
  }

  return (
    <>
      {/* Title banner */}
      <div className="mb-4 flex items-stretch gap-2">
        <div className="flex min-w-[120px] flex-col items-center justify-center rounded border border-border bg-muted px-3 py-1.5">
          <div className="text-xs font-semibold text-muted-foreground">Année</div>
          <div className="text-lg font-bold">{year}</div>
        </div>
        <div className="flex flex-1 items-center justify-center rounded bg-destructive px-4 py-1.5">
          <h1 className="text-lg font-bold tracking-wide text-destructive-foreground">
            HEURES SUPPLÉMENTAIRES — UCPA
          </h1>
        </div>
        <div className="flex min-w-[120px] flex-col items-center justify-center rounded border border-border bg-muted px-3 py-1.5">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            Imprimé le
          </div>
          <div className="text-sm font-bold">{printDate}</div>
        </div>
      </div>

      <p className="mb-2 text-[11px] text-muted-foreground">
        Seuil d'alerte : <strong>{fmtHours(threshold)} h</strong>. Les soldes égaux ou
        supérieurs au seuil sont surlignés.
      </p>

      {/* Summary table */}
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-muted text-[11px]">
            <th className="border border-border px-2 py-1 text-left">Agent</th>
            <th className="border border-border px-2 py-1 text-left">Équipe</th>
            <th className="border border-border px-2 py-1 text-right">Ajoutées (h)</th>
            <th className="border border-border px-2 py-1 text-right">Récupérées (h)</th>
            <th className="border border-border px-2 py-1 text-right">Solde (h)</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((b) => (
            <tr key={b.agent.id}>
              <td className="border border-border px-2 py-0.5 font-medium uppercase">
                {b.agent.name}
              </td>
              <td className="border border-border px-2 py-0.5 text-muted-foreground">
                {b.agent.team ?? ""}
              </td>
              <td className="border border-border px-2 py-0.5 text-right">
                {b.added ? fmtHours(b.added) : "—"}
              </td>
              <td className="border border-border px-2 py-0.5 text-right">
                {b.deducted ? fmtHours(b.deducted) : "—"}
              </td>
              <td
                className="border border-border px-2 py-0.5 text-right font-bold"
                style={
                  b.over
                    ? { backgroundColor: "#F4C6C6", color: "#8B1E1E" }
                    : { backgroundColor: "#CFEFD8", color: "#1F6B3A" }
                }
              >
                {fmtHours(b.balance)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-secondary font-bold text-secondary-foreground">
            <td className="border border-border px-2 py-1" colSpan={2}>
              TOTAL
            </td>
            <td className="border border-border px-2 py-1 text-right">{fmtHours(totalAdded)}</td>
            <td className="border border-border px-2 py-1 text-right">{fmtHours(totalDeducted)}</td>
            <td className="border border-border px-2 py-1 text-right">{fmtHours(totalBalance)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Movement detail */}
      {entries.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide">
            Détail des mouvements
          </h2>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border px-2 py-1 text-left">Date</th>
                <th className="border border-border px-2 py-1 text-left">Agent</th>
                <th className="border border-border px-2 py-1 text-right">Heures</th>
                <th className="border border-border px-2 py-1 text-left">Motif</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const pos = e.hours >= 0;
                return (
                  <tr key={e.id}>
                    <td className="border border-border px-2 py-0.5">{fmtDate(e.date)}</td>
                    <td className="border border-border px-2 py-0.5 font-medium uppercase">
                      {nameById.get(e.agentId)?.name ?? "(inconnu)"}
                    </td>
                    <td
                      className="border border-border px-2 py-0.5 text-right font-semibold"
                      style={
                        pos
                          ? { color: "#1F6B3A" }
                          : { color: "#8B1E1E" }
                      }
                    >
                      {pos ? "+" : "−"}
                      {fmtHours(Math.abs(e.hours))}
                    </td>
                    <td className="border border-border px-2 py-0.5">{e.reason ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
