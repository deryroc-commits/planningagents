import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Home,
  PencilLine,
  Trash2,
  Upload,
  Users,
  Settings2,
  Table2,
  Printer,
} from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlanningGrid } from "@/components/planning/PlanningGrid";
import { ParametersTab } from "@/components/planning/ParametersTab";
import { AgentsTab } from "@/components/planning/AgentsTab";
import { StatsTab } from "@/components/planning/StatsTab";
import { RotationTab } from "@/components/planning/RotationTab";
import { PrintView } from "@/components/planning/PrintView";
import { ModificationsTab } from "@/components/planning/ModificationsTab";
import { OvertimeTab } from "@/components/planning/OvertimeTab";
import { CATEGORY_META } from "@/lib/planning/types";
import { codesMap, countErrors, MONTHS, selectableYears } from "@/lib/planning/calc";
import { exportToExcel, importFromExcel } from "@/lib/planning/excel";

const YEARS = selectableYears();

export function PlanningApp({ initialTab = "planning" }: { initialTab?: string }) {
  const { year, setYear, codes, planning, replaceState, clearYear, resetAll } = usePlanning();
  const [month, setMonth] = useState(new Date().getMonth());
  const [tab, setTab] = useState(initialTab);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const errors = countErrors(planning, codesMap(codes));

  const onImport = async (file: File) => {
    try {
      const res = await importFromExcel(file, year);
      replaceState(res.state);
      if (res.year && res.year !== year) setYear(res.year);
      setStatus(res.summary);
    } catch (e) {
      setStatus("Échec de l'import du fichier.");
      console.error(e);
    }
    setTimeout(() => setStatus(null), 6000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-accent">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Planning des agents</h1>
              <p className="text-xs text-muted-foreground">Planification annuelle — UCPA</p>
            </div>
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" className="nav-btn nav-emerald border-0" asChild>
              <Link to="/">
                <Home /> Accueil
              </Link>
            </Button>
            {errors > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-sm font-medium text-destructive">
                <AlertTriangle className="size-4" />
                {errors} erreur{errors > 1 ? "s" : ""}
              </span>
            )}
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,.xlsb,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              className="nav-btn nav-indigo border-0"
              onClick={() => fileRef.current?.click()}
            >
              <Upload /> Importer
            </Button>
            <ExportButton />
            <ResetDialog
              year={year}
              onClearYear={() => {
                clearYear(year);
                setStatus(`Planning ${year} réinitialisé.`);
                setTimeout(() => setStatus(null), 4000);
              }}
              onResetAll={() => {
                resetAll();
                setStatus("Application réinitialisée aux valeurs par défaut.");
                setTimeout(() => setStatus(null), 4000);
              }}
            />

          </div>
        </div>
        {status && (
          <div className="border-t border-border bg-accent/50 px-4 py-1.5 text-center text-sm">
            {status}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="no-print flex-wrap h-auto">
            <TabsTrigger value="planning" className="tt tt-planning">
              <Table2 className="mr-1.5 size-4" /> Planning
            </TabsTrigger>
            <TabsTrigger value="stats" className="tt tt-stats">
              <BarChart3 className="mr-1.5 size-4" /> Statistiques
            </TabsTrigger>
            <TabsTrigger value="rotation" className="tt tt-rotation">
              <CalendarClock className="mr-1.5 size-4" /> Roulement WE
            </TabsTrigger>
            <TabsTrigger value="params" className="tt tt-params">
              <Settings2 className="mr-1.5 size-4" /> Paramètres
            </TabsTrigger>
            <TabsTrigger value="agents" className="tt tt-agents">
              <Users className="mr-1.5 size-4" /> Base agents
            </TabsTrigger>
            <TabsTrigger value="mods" className="tt tt-mods">
              <PencilLine className="mr-1.5 size-4" /> Modifications
            </TabsTrigger>
            <TabsTrigger value="overtime" className="tt tt-overtime">
              <Clock className="mr-1.5 size-4" /> Heures supp.
            </TabsTrigger>
            <TabsTrigger value="print" className="tt tt-print">
              <Printer className="mr-1.5 size-4" /> Impression
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planning" className="tab-surface tint-planning space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonth((m) => (m + 11) % 12)}
                >
                  <ChevronLeft />
                </Button>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i)}>
                        {m} {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => setMonth((m) => (m + 1) % 12)}>
                  <ChevronRight />
                </Button>
              </div>
              <Legend />
            </div>
            <PlanningGrid month={month} />
            <p className="text-xs text-muted-foreground">
              Cliquez sur une cellule pour choisir un code. Seules les valeurs définies dans «
              Paramètres » sont autorisées — toute autre valeur apparaît en rouge.
            </p>
          </TabsContent>

          <TabsContent value="stats" className="tab-surface tint-stats">
            <StatsTab />
          </TabsContent>

          <TabsContent value="rotation" className="tab-surface tint-rotation">
            <RotationTab />
          </TabsContent>

          <TabsContent value="params" className="tab-surface tint-params">
            <ParametersTab />
          </TabsContent>

          <TabsContent value="agents" className="tab-surface tint-agents">
            <AgentsTab />
          </TabsContent>

          <TabsContent value="mods" className="tab-surface tint-mods">
            <ModificationsTab />
          </TabsContent>

          <TabsContent value="overtime" className="tab-surface tint-overtime">
            <OvertimeTab />
          </TabsContent>

          <TabsContent value="print" className="tab-surface tint-print">
            <PrintView month={month} setMonth={setMonth} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ExportButton() {
  const { codes, agents, planning, year } = usePlanning();
  return (
    <Button
      size="sm"
      onClick={() => exportToExcel({ codes, agents, planningByYear: { [year]: planning } }, year)}
    >
      <Download /> Exporter
    </Button>
  );
}

function ResetDialog({
  year,
  onClearYear,
  onResetAll,
}: {
  year: number;
  onClearYear: () => void;
  onResetAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
        onClick={() => setOpen(true)}
      >
        <Trash2 /> Réinitialiser
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser</DialogTitle>
            <DialogDescription>
              Choisissez ce que vous souhaitez effacer. Ces actions sont irréversibles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Effacer le planning {year}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Efface uniquement les valeurs saisies pour l'année {year}. Les autres années,
                les agents, les codes et les paramètres sont conservés.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => {
                  onClearYear();
                  setOpen(false);
                }}
              >
                Effacer l'année {year}
              </Button>
            </div>
            <div className="rounded-lg border border-destructive/40 p-3">
              <p className="text-sm font-medium">Tout remettre à zéro</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Réinitialise l'application entière aux valeurs par défaut : plannings (toutes
                années), agents, codes, couleurs, roulement et paramètres.
              </p>
              <Button
                size="sm"
                className="mt-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  onResetAll();
                  setOpen(false);
                }}
              >
                Tout réinitialiser par défaut
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      {Object.entries(CATEGORY_META).map(([key, meta]) => (
        <div key={key} className="flex items-center gap-1">
          <span className={`inline-block size-3 rounded ${meta.cls}`} />
          {meta.label}
        </div>
      ))}
      <div className="flex items-center gap-1">
        <span className="inline-block size-3 rounded cell-weekend" />
        Week-end
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block size-3 rounded cell-holiday" />
        Férié
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block size-3 rounded cat-error" />
        Erreur
      </div>
    </div>
  );
}
