import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
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
  HelpCircle,
} from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import { useAuth } from "@/lib/auth/auth-context";
import { TeamTab } from "@/components/planning/TeamTab";
import { ShareQrTab } from "@/components/planning/ShareQrTab";
import { UserCircle2, LogOut, QrCode } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { TransitionGrid } from "@/components/planning/TransitionGrid";
import { ParametersTab } from "@/components/planning/ParametersTab";
import { AgentsTab } from "@/components/planning/AgentsTab";
import { StatsTab } from "@/components/planning/StatsTab";
import { RotationTab } from "@/components/planning/RotationTab";
import { PrintView } from "@/components/planning/PrintView";
import { ModificationsTab } from "@/components/planning/ModificationsTab";
import { OfflineSyncIndicator } from "@/components/planning/OfflineSyncIndicator";
import { HelpTab } from "@/components/planning/HelpTab";
import { OvertimeTab } from "@/components/planning/OvertimeTab";
import { BackupBar } from "@/components/planning/BackupBar";
import { CATEGORY_META } from "@/lib/planning/types";
import {
  codesMap,
  countErrors,
  MONTHS,
  TRANSITION_MONTH,
} from "@/lib/planning/calc";
import { exportStyledYearExcel, importFromExcel } from "@/lib/planning/excel";
import { hardReload, useNewVersionAvailable } from "@/lib/planning/version-check";
import { useSelectableYears } from "@/hooks/use-selectable-years";
import { RefreshCw } from "lucide-react";


export function PlanningApp({ initialTab = "planning" }: { initialTab?: string }) {
  const { year, setYear, codes, planning, replaceState, clearYear, resetAll, yearRange } = usePlanning();
  const { memberships, activeWorkspace, activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const { user, signOut } = useAuth();
  const YEARS = useSelectableYears(yearRange);
  const [month, setMonth] = useState(new Date().getMonth());
  const [janWeeks, setJanWeeks] = useState(3);
  const [tab, setTab] = useState(initialTab);
  const [status, setStatus] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeImportSignatureRef = useRef<string | null>(null);
  const filePickerOpenRef = useRef(false);
  const filePickerTimerRef = useRef<number | null>(null);

  const errors = countErrors(planning, codesMap(codes));
  const newVersion = useNewVersionAvailable();

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("planning-scroll-top-after-reload") !== "1") return;
      window.sessionStorage.removeItem("planning-scroll-top-after-reload");
      window.history.scrollRestoration = "manual";
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
    } catch {
      /* ignore */
    }
  }, []);

  const onImport = async (file: File) => {
    const signature = `${file.name}:${file.size}:${file.lastModified}`;
    if (activeImportSignatureRef.current === signature) return;
    activeImportSignatureRef.current = signature;
    setIsImporting(true);
    setImportMessage(`Fichier « ${file.name} » en cours de chargement…`);
    setStatus(`Fichier « ${file.name} » en cours de chargement…`);
    try {
      const res = await importFromExcel(file, year);
      const hasData =
        !!res.state &&
        ((Array.isArray(res.state.agents) && res.state.agents.length > 0) ||
          !!res.state.planningByYear ||
          (Array.isArray(res.state.codes) && res.state.codes.length > 0));
      if (!hasData) {
        const message =
          res.summary ||
            "Fichier lu, mais aucune donnée reconnue (feuilles attendues : Planning, Paramètres, Base agents).";
        setImportMessage(message);
        setStatus(message);
      } else {
        replaceState(res.state);
        if (res.year && res.year !== year) setYear(res.year);
        setImportMessage(res.summary);
        setStatus(res.summary);
        setSelectedImportFile(null);
        if (fileRef.current) fileRef.current.value = "";
        setTimeout(() => setImportOpen(false), 1200);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setImportMessage(`Échec de l'import : ${msg}`);
      setStatus(`Échec de l'import : ${msg}`);
      console.error("[import]", e);
    }
    setIsImporting(false);
    activeImportSignatureRef.current = null;
    setTimeout(() => setStatus(null), 8000);
  };

  const handleImportFilePick = (file: File | undefined) => {
    if (filePickerTimerRef.current) window.clearTimeout(filePickerTimerRef.current);
    filePickerOpenRef.current = false;
    const f = file;
    if (f) {
      setSelectedImportFile(f);
      setImportMessage(`Fichier « ${f.name} » sélectionné. Chargement automatique en cours…`);
      setStatus(`Fichier « ${f.name} » sélectionné. Chargement automatique en cours…`);
      void onImport(f);
    } else {
      setSelectedImportFile(null);
      setStatus("Aucun fichier sélectionné.");
      setImportMessage("Aucun fichier sélectionné. Cliquez à nouveau pour choisir un fichier.");
    }
  };

  const onImportInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleImportFilePick(e.currentTarget.files?.[0]);
  };

  const onImportInput = (e: FormEvent<HTMLInputElement>) => {
    handleImportFilePick(e.currentTarget.files?.[0]);
  };

  // Never auto-close the import dialog (focus loss, pointer outside, ESC,
  // mobile file picker returning focus). Only explicit user actions —
  // the Annuler button or a successful import — may close it.
  const resetImportDialog = (open: boolean) => {
    if (open) {
      setImportOpen(true);
      setSelectedImportFile(null);
      setImportMessage("Sélectionnez un fichier Excel, puis lancez le chargement.");
      activeImportSignatureRef.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
    // Ignore programmatic close requests.
  };

  const closeImportDialog = () => {
    setSelectedImportFile(null);
    activeImportSignatureRef.current = null;
    filePickerOpenRef.current = false;
    if (filePickerTimerRef.current) {
      window.clearTimeout(filePickerTimerRef.current);
      filePickerTimerRef.current = null;
    }
    if (fileRef.current) fileRef.current.value = "";
    setImportOpen(false);
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
            <OfflineSyncIndicator />
            {memberships.length > 1 ? (
              <Select
                value={activeWorkspaceId ?? undefined}
                onValueChange={(v) => setActiveWorkspaceId(v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Équipe" />
                </SelectTrigger>
                <SelectContent>
                  {memberships.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              activeWorkspace && (
                <span className="hidden items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-sm font-medium sm:inline-flex">
                  <Users className="size-4" /> {activeWorkspace.name}
                </span>
              )
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <UserCircle2 className="mr-1.5 size-4" />
                  <span className="max-w-32 truncate">{user?.email ?? "Compte"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="max-w-56 truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTab("team")}>
                  <Users className="mr-2 size-4" /> Équipe & partage
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => void signOut()}
                >
                  <LogOut className="mr-2 size-4" /> Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="nav-btn nav-emerald border-0" asChild>
              <Link to="/">
                <Home /> Accueil
              </Link>
            </Button>
            <Button
              size="sm"
              className={`nav-btn nav-amber border-0 ${newVersion ? "animate-pulse" : ""}`}
              onClick={() => void hardReload()}
              title={
                newVersion
                  ? "Nouvelle version disponible — cliquez pour actualiser"
                  : "Actualiser l'application (cache inclus)"
              }
            >
              <RefreshCw className="mr-1.5 size-4" /> Actualiser
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
            <Button
              size="sm"
              className="nav-btn nav-indigo border-0"
              onClick={() => {
                setStatus("Sélectionnez le fichier Excel à importer…");
                resetImportDialog(true);
              }}
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

      <Dialog open={importOpen} onOpenChange={resetImportDialog}>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Importer un fichier Excel</DialogTitle>
            <DialogDescription>
              Sélectionnez le fichier du planning à charger dans l'année affichée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <input
              id="planning-import-file"
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,.xlsb,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              disabled={isImporting}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                filePickerOpenRef.current = true;
                if (filePickerTimerRef.current) window.clearTimeout(filePickerTimerRef.current);
                filePickerTimerRef.current = window.setTimeout(() => {
                  filePickerOpenRef.current = false;
                  filePickerTimerRef.current = null;
                }, 4000);
                setImportMessage("Sélecteur de fichier ouvert… choisissez votre fichier Excel.");
                setStatus("Sélecteur de fichier ouvert…");
              }}
              onInput={onImportInput}
              onChange={onImportInputChange}
            />
            {selectedImportFile && (
              <div className="rounded-md border border-border bg-accent/40 px-3 py-2 text-sm">
                <span className="font-medium">Fichier prêt :</span> {selectedImportFile.name}
              </div>
            )}
            {(isImporting || importMessage) && (
              <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                {isImporting
                  ? selectedImportFile
                    ? `Fichier « ${selectedImportFile.name} » en cours de chargement… merci de patienter.`
                    : "Fichier en cours de chargement… merci de patienter."
                  : importMessage}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Si votre téléphone demande une source, choisissez Fichiers, Drive ou Téléchargements.
            </p>
          </div>
          <DialogFooter>
            <Button
              disabled={!selectedImportFile || isImporting}
              onClick={() => selectedImportFile && void onImport(selectedImportFile)}
            >
              <Upload className="mr-1.5 size-4" /> Charger le fichier
            </Button>
            <Button variant="outline" disabled={isImporting} onClick={closeImportDialog}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <TabsTrigger value="team" className="tt tt-agents">
              <Users className="mr-1.5 size-4" /> Équipe
            </TabsTrigger>
            <TabsTrigger value="qr" className="tt tt-agents">
              <QrCode className="mr-1.5 size-4" /> QR codes
            </TabsTrigger>
            <TabsTrigger value="help" className="tt tt-params">
              <HelpCircle className="mr-1.5 size-4" /> Aide
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planning" className="tab-surface tint-planning space-y-3">
            <BackupBar />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonth((m) => (m + 12) % 13)}
                >
                  <ChevronLeft />
                </Button>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i)}>
                        {m} {year}
                      </SelectItem>
                    ))}
                    <SelectItem value={String(TRANSITION_MONTH)}>
                      Transition déc. {year} → janv. {year + 1}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => setMonth((m) => (m + 1) % 13)}>
                  <ChevronRight />
                </Button>
                {month === TRANSITION_MONTH && (
                  <Select
                    value={String(janWeeks)}
                    onValueChange={(v) => setJanWeeks(Number(v))}
                  >
                    <SelectTrigger className="ml-1 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 semaines de janvier</SelectItem>
                      <SelectItem value="3">3 semaines de janvier</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Legend />
            </div>
            {month === TRANSITION_MONTH ? (
              <TransitionGrid year={year} janWeeks={janWeeks} />
            ) : (
              <PlanningGrid month={month} />
            )}
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
            <PrintView month={month === TRANSITION_MONTH ? 11 : month} setMonth={setMonth} />
          </TabsContent>

          <TabsContent value="team" className="tab-surface tint-agents">
            <TeamTab />
          </TabsContent>

          <TabsContent value="qr" className="tab-surface tint-agents">
            <ShareQrTab />
          </TabsContent>

          <TabsContent value="help" className="tab-surface tint-params">
            <HelpTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ExportButton() {
  const { codes, agents, planning, year, colors } = usePlanning();
  return (
    <Button
      size="sm"
      onClick={() =>
        exportStyledYearExcel(
          { codes, agents, planningByYear: { [year]: planning }, colors },
          year,
        )
      }
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
