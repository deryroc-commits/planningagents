import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Home,
  RotateCcw,
  Trash2,
  Upload,
  Users,
  Settings2,
  Table2,
  Printer,
} from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlanningGrid } from "@/components/planning/PlanningGrid";
import { ParametersTab } from "@/components/planning/ParametersTab";
import { AgentsTab } from "@/components/planning/AgentsTab";
import { StatsTab } from "@/components/planning/StatsTab";
import { RotationTab } from "@/components/planning/RotationTab";
import { PrintView } from "@/components/planning/PrintView";
import { CATEGORY_META } from "@/lib/planning/types";
import { codesMap, countErrors, MONTHS, selectableYears } from "@/lib/planning/calc";
import { exportToExcel, importFromExcel } from "@/lib/planning/excel";

const YEARS = selectableYears();

export function PlanningApp({ initialTab = "planning" }: { initialTab?: string }) {
  const { year, setYear, codes, planning, replaceState } = usePlanning();
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
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-accent"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">
                Planning des agents
              </h1>
              <p className="text-xs text-muted-foreground">
                Planification annuelle — UCPA
              </p>
            </div>
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
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
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload /> Importer
            </Button>
            <ExportButton />
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
          <TabsList className="no-print">
            <TabsTrigger value="planning">
              <Table2 className="mr-1.5 size-4" /> Planning
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="mr-1.5 size-4" /> Statistiques
            </TabsTrigger>
            <TabsTrigger value="rotation">
              <CalendarClock className="mr-1.5 size-4" /> Roulement WE
            </TabsTrigger>
            <TabsTrigger value="params">
              <Settings2 className="mr-1.5 size-4" /> Paramètres
            </TabsTrigger>
            <TabsTrigger value="agents">
              <Users className="mr-1.5 size-4" /> Base agents
            </TabsTrigger>
            <TabsTrigger value="print">
              <Printer className="mr-1.5 size-4" /> Impression
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planning" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonth((m) => (m + 11) % 12)}
                >
                  <ChevronLeft />
                </Button>
                <Select
                  value={String(month)}
                  onValueChange={(v) => setMonth(Number(v))}
                >
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
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonth((m) => (m + 1) % 12)}
                >
                  <ChevronRight />
                </Button>
              </div>
              <Legend />
            </div>
            <PlanningGrid month={month} />
            <p className="text-xs text-muted-foreground">
              Cliquez sur une cellule pour choisir un code. Seules les valeurs
              définies dans « Paramètres » sont autorisées — toute autre valeur
              apparaît en rouge.
            </p>
          </TabsContent>

          <TabsContent value="stats">
            <StatsTab />
          </TabsContent>

          <TabsContent value="rotation">
            <RotationTab />
          </TabsContent>

          <TabsContent value="params">
            <ParametersTab />
          </TabsContent>

          <TabsContent value="agents">
            <AgentsTab />
          </TabsContent>

          <TabsContent value="print">
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
      onClick={() =>
        exportToExcel(
          { codes, agents, planningByYear: { [year]: planning } },
          year,
        )
      }
    >
      <Download /> Exporter
    </Button>
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
