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
import { ChevronsUp, ChevronsDown, Maximize2, Minimize2 } from "lucide-react";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";
import { usePlanning } from "@/lib/planning/store";
import { useWorkspace, type TabKey } from "@/lib/workspace/workspace-context";
import { Eye, Lock as LockIcon } from "lucide-react";
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
import { exportStyledMonthExcel, exportStyledYearExcel, importFromExcel } from "@/lib/planning/excel";
import {
  exportAgentsBookExcel,
  exportCodesBookExcel,
  exportFullWorkbookExcel,
  exportOvertimeBookExcel,
  exportRotationBookExcel,
} from "@/lib/planning/excel-export";
import { hardReload, useNewVersionAvailable } from "@/lib/planning/version-check";
import { useSelectableYears } from "@/hooks/use-selectable-years";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listPendingWorkspaces, syncPendingWorkspaces } from "@/lib/planning/offline-sync";


export function PlanningApp({ initialTab = "planning" }: { initialTab?: string }) {
  const { year, setYear, codes, planning, replaceState, clearYear, resetAll, yearRange } = usePlanning();
  const { memberships, activeWorkspace, activeWorkspaceId, setActiveWorkspaceId, canViewTab, canEditTab } = useWorkspace();
  const { user, signOut } = useAuth();
  const YEARS = useSelectableYears(yearRange);
  const [month, setMonth] = useState(new Date().getMonth());
  const [janWeeks, setJanWeeks] = useState(3);
  const [tab, setTab] = useState(initialTab);
  // If the current tab becomes hidden for this user, fall back to a visible one.
  useEffect(() => {
    if (!canViewTab(tab as TabKey)) {
      const fallback = (["planning", "team", "help"] as TabKey[]).find(canViewTab) ?? "team";
      setTab(fallback);
    }
  }, [tab, canViewTab]);
  const [status, setStatus] = useState<string | null>(null);
  const { hideHeader, setHideHeader, isFullscreen, toggleFullscreen } = useDisplayPrefs();
  const [importOpen, setImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStage, setImportStage] = useState<string>("");
  const [importResult, setImportResult] = useState<"idle" | "success" | "error">("idle");
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeImportSignatureRef = useRef<string | null>(null);
  const filePickerTimerRef = useRef<number | null>(null);

  const errors = countErrors(planning, codesMap(codes));
  const newVersion = useNewVersionAvailable();

  // Envoi des modifications faites hors ligne dès qu'une session est active
  // (la page de connexion ne peut pas le faire : l'utilisateur y est déconnecté).
  useEffect(() => {
    if (!user) return;
    let busy = false;
    const run = async () => {
      if (busy || !navigator.onLine) return;
      if (listPendingWorkspaces().length === 0) return;
      busy = true;
      try {
        const result = await syncPendingWorkspaces();
        if (result.sent > 0) toast.success(`${result.sent} planning(s) synchronisé(s).`);
      } finally {
        busy = false;
      }
    };
    void run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, [user]);

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
    setImportResult("idle");
    setImportProgress(0);
    setImportStage("Démarrage…");
    setImportMessage(`Fichier « ${file.name} » en cours de chargement…`);
    setStatus(`Fichier « ${file.name} » en cours de chargement…`);
    try {
      const res = await importFromExcel(file, year, (pct, label) => {
        setImportProgress(pct);
        if (label) setImportStage(label);
      });
      const hasData =
        !!res.state &&
        ((Array.isArray(res.state.agents) && res.state.agents.length > 0) ||
          !!res.state.planningByYear ||
          (Array.isArray(res.state.codes) && res.state.codes.length > 0));
      if (!hasData) {
        const message =
          res.summary ||
            "Fichier lu, mais aucune donnée reconnue (feuilles attendues : Planning, Paramètres, Base agents).";
        setImportResult("error");
        setImportProgress(100);
        setImportStage("Échec");
        setImportMessage(message);
        setStatus(message);
      } else {
        replaceState(res.state);
        if (res.year && res.year !== year) setYear(res.year);
        setImportResult("success");
        setImportProgress(100);
        setImportStage("Terminé");
        setImportMessage(res.summary);
        setStatus(res.summary);
        setSelectedImportFile(null);
        if (fileRef.current) fileRef.current.value = "";
        setFileInputKey((k) => k + 1);
        setTimeout(() => setImportOpen(false), 1600);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setImportResult("error");
      setImportStage("Échec");
      setImportMessage(`Échec de l'import : ${msg}`);
      setStatus(`Échec de l'import : ${msg}`);
      console.error("[import]", e);
    }
    if (fileRef.current) fileRef.current.value = "";
    setFileInputKey((k) => k + 1);
    setIsImporting(false);
    activeImportSignatureRef.current = null;
    setTimeout(() => setStatus(null), 8000);
  };

  const handleImportFilePick = (file: File | undefined) => {
    if (filePickerTimerRef.current) window.clearTimeout(filePickerTimerRef.current);
    const f = file;
    if (f) {
      setSelectedImportFile(f);
      setImportMessage(`Fichier « ${f.name} » sélectionné. Chargement automatique en cours…`);
      setStatus(`Fichier « ${f.name} » sélectionné. Chargement automatique en cours…`);
      void onImport(f);
    } else {
      setStatus("Aucun fichier sélectionné.");
      setImportMessage("Aucun fichier reçu. Cliquez à nouveau sur Choisir un fichier.");
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
      setImportProgress(0);
      setImportStage("");
      setImportResult("idle");
      activeImportSignatureRef.current = null;
      if (fileRef.current) fileRef.current.value = "";
      setFileInputKey((k) => k + 1);
    }
    // Ignore programmatic close requests.
  };

  const closeImportDialog = () => {
    setSelectedImportFile(null);
    activeImportSignatureRef.current = null;
    if (filePickerTimerRef.current) {
      window.clearTimeout(filePickerTimerRef.current);
      filePickerTimerRef.current = null;
    }
    if (fileRef.current) fileRef.current.value = "";
    setFileInputKey((k) => k + 1);
    setImportOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {hideHeader && (
        <div className="no-print sticky top-0 z-40 flex items-center justify-end gap-2 border-b border-border bg-card/95 px-4 py-1 backdrop-blur">
          <Button size="sm" variant="ghost" onClick={() => setHideHeader(false)}>
            <ChevronsDown className="mr-1.5 size-4" /> Afficher le bandeau
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      )}
      <header
        className={`no-print sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur ${hideHeader ? "hidden" : ""}`}
      >
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-accent">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">{activeWorkspace?.main_title ?? "Planning des agents"}</h1>
              <p className="text-xs text-muted-foreground">{activeWorkspace?.subtitle ?? "Gestion du planning annuel"}</p>
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
                <DropdownMenuLabel>Affichage</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setHideHeader(!hideHeader)}>
                  {hideHeader ? (
                    <ChevronsDown className="mr-2 size-4" />
                  ) : (
                    <ChevronsUp className="mr-2 size-4" />
                  )}
                  {hideHeader ? "Afficher le bandeau" : "Masquer le bandeau"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void toggleFullscreen()}>
                  {isFullscreen ? (
                    <Minimize2 className="mr-2 size-4" />
                  ) : (
                    <Maximize2 className="mr-2 size-4" />
                  )}
                  {isFullscreen ? "Quitter le plein écran" : "Plein écran"}
                </DropdownMenuItem>
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHideHeader(true)}
              title="Masquer le bandeau"
            >
              <ChevronsUp className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void toggleFullscreen()}
              title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
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

      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 px-4 py-6"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="planning-import-title"
            aria-describedby="planning-import-description"
            className="relative w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg"
          >
            <button
              type="button"
              aria-label="Fermer l'import"
              disabled={isImporting}
              onClick={closeImportDialog}
              className="absolute right-4 top-4 rounded-sm px-2 py-1 text-xl leading-none text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              ×
            </button>
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 id="planning-import-title" className="text-lg font-semibold leading-none tracking-tight">
                Importer un fichier Excel
              </h2>
              <p id="planning-import-description" className="text-sm text-muted-foreground">
                Sélectionnez le fichier du planning à charger dans l'année affichée.
              </p>
            </div>
          <div className="space-y-3 py-4">
            <input
              key={fileInputKey}
              id="planning-import-file"
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,.xlsb,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              disabled={isImporting}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                if (filePickerTimerRef.current) window.clearTimeout(filePickerTimerRef.current);
                filePickerTimerRef.current = window.setTimeout(() => {
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
            {(isImporting || importResult !== "idle") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">
                    {importStage || (isImporting ? "Chargement…" : "")}
                  </span>
                  <span
                    className={
                      importResult === "error"
                        ? "text-destructive"
                        : importResult === "success"
                          ? "text-emerald-600"
                          : "text-primary"
                    }
                  >
                    {importProgress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={
                      "h-full transition-all duration-300 " +
                      (importResult === "error"
                        ? "bg-destructive"
                        : importResult === "success"
                          ? "bg-emerald-500"
                          : "bg-primary")
                    }
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}
            {(isImporting || importMessage) && (
              <div
                className={
                  "rounded-md border px-3 py-2 text-sm font-medium " +
                  (importResult === "error"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : importResult === "success"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                      : "border-primary/30 bg-primary/10 text-primary")
                }
              >
                {isImporting
                  ? selectedImportFile
                    ? `Fichier « ${selectedImportFile.name} » — ${importStage || "chargement…"}`
                    : "Fichier en cours de chargement… merci de patienter."
                  : importResult === "success"
                    ? `✓ ${importMessage}`
                    : importResult === "error"
                      ? `✗ ${importMessage}`
                      : importMessage}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Si votre téléphone demande une source, choisissez Fichiers, Drive ou Téléchargements.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={!selectedImportFile || isImporting}
              onClick={() => selectedImportFile && void onImport(selectedImportFile)}
            >
              <Upload className="mr-1.5 size-4" /> Charger le fichier
            </Button>
            <Button variant="outline" disabled={isImporting} onClick={closeImportDialog}>
              Annuler
            </Button>
          </div>
          </section>
        </div>
      )}

      <main className="mx-auto max-w-[1600px] px-4 py-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="no-print flex-wrap h-auto">
            {canViewTab("planning") && (
              <TabsTrigger value="planning" className="tt tt-planning">
                <Table2 className="mr-1.5 size-4" /> Planning
              </TabsTrigger>
            )}
            {canViewTab("stats") && (
              <TabsTrigger value="stats" className="tt tt-stats">
                <BarChart3 className="mr-1.5 size-4" /> Statistiques
              </TabsTrigger>
            )}
            {canViewTab("rotation") && (
              <TabsTrigger value="rotation" className="tt tt-rotation">
                <CalendarClock className="mr-1.5 size-4" /> Roulement WE
              </TabsTrigger>
            )}
            {canViewTab("params") && (
              <TabsTrigger value="params" className="tt tt-params">
                <Settings2 className="mr-1.5 size-4" /> Paramètres
              </TabsTrigger>
            )}
            {canViewTab("agents") && (
              <TabsTrigger value="agents" className="tt tt-agents">
                <Users className="mr-1.5 size-4" /> Base agents
              </TabsTrigger>
            )}
            {canViewTab("mods") && (
              <TabsTrigger value="mods" className="tt tt-mods">
                <PencilLine className="mr-1.5 size-4" /> Modifications
              </TabsTrigger>
            )}
            {canViewTab("overtime") && (
              <TabsTrigger value="overtime" className="tt tt-overtime">
                <Clock className="mr-1.5 size-4" /> Heures supp.
              </TabsTrigger>
            )}
            {canViewTab("print") && (
              <TabsTrigger value="print" className="tt tt-print">
                <Printer className="mr-1.5 size-4" /> Impression
              </TabsTrigger>
            )}
            {canViewTab("team") && (
              <TabsTrigger value="team" className="tt tt-agents">
                <Users className="mr-1.5 size-4" /> Équipe
              </TabsTrigger>
            )}
            {canViewTab("qr") && (
              <TabsTrigger value="qr" className="tt tt-agents">
                <QrCode className="mr-1.5 size-4" /> QR codes
              </TabsTrigger>
            )}
            {canViewTab("help") && (
              <TabsTrigger value="help" className="tt tt-params">
                <HelpCircle className="mr-1.5 size-4" /> Aide
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="planning" className="tab-surface tint-planning space-y-3">
            <TabPermGate tab="planning" canEditTab={canEditTab}>
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
            </TabPermGate>
          </TabsContent>


          <TabsContent value="stats" className="tab-surface tint-stats">
            <TabPermGate tab="stats" canEditTab={canEditTab}><StatsTab /></TabPermGate>
          </TabsContent>

          <TabsContent value="rotation" className="tab-surface tint-rotation">
            <TabPermGate tab="rotation" canEditTab={canEditTab}><RotationTab /></TabPermGate>
          </TabsContent>

          <TabsContent value="params" className="tab-surface tint-params">
            <TabPermGate tab="params" canEditTab={canEditTab}><ParametersTab /></TabPermGate>
          </TabsContent>

          <TabsContent value="agents" className="tab-surface tint-agents">
            <TabPermGate tab="agents" canEditTab={canEditTab}><AgentsTab /></TabPermGate>
          </TabsContent>

          <TabsContent value="mods" className="tab-surface tint-mods">
            <TabPermGate tab="mods" canEditTab={canEditTab}><ModificationsTab /></TabPermGate>
          </TabsContent>

          <TabsContent value="overtime" className="tab-surface tint-overtime">
            <TabPermGate tab="overtime" canEditTab={canEditTab}><OvertimeTab /></TabPermGate>
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

function TabPermGate({
  tab,
  canEditTab,
  children,
}: {
  tab: TabKey;
  canEditTab: (t: TabKey) => boolean;
  children: React.ReactNode;
}) {
  const readOnly = !canEditTab(tab);
  if (!readOnly) return <>{children}</>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-sky-300/60 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100">
        <LockIcon className="size-4" />
        <span>
          <Eye className="mr-1 inline size-3.5" /> Lecture seule — vous n'avez pas les droits pour modifier cet onglet.
        </span>
      </div>
      <div data-readonly-tab="true" aria-disabled="true" className="readonly-tab opacity-90">
        {children}
      </div>
    </div>
  );
}

function ExportButton() {
  const {
    codes,
    agents,
    planning,
    planningByYear,
    year,
    colors,
    rotation,
    overtime,
    overtimeThreshold,
  } = usePlanning();
  const { activeWorkspace } = useWorkspace();
  const printTitle = activeWorkspace?.print_title ?? "PLANNING DES AGENTS";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [monthChoice, setMonthChoice] = useState<number>(new Date().getMonth());

  const state = { codes, agents, planningByYear, colors };
  const monthState = { codes, agents, planningByYear: { [year]: planning }, colors };

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      console.error("[export]", e);
      alert(`Échec de l'export : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const options: {
    id: string;
    title: string;
    desc: string;
    run: () => Promise<void>;
  }[] = [
    {
      id: "full",
      title: "Toute l'application",
      desc: `Un seul fichier avec les 12 mois de ${year}, la base agents, les codes, le roulement WE et les heures supplémentaires.`,
      run: () =>
        exportFullWorkbookExcel({
          state,
          year,
          printTitle,
          rotation,
          overtime,
          overtimeThreshold,
        }),
    },
    {
      id: "year",
      title: `Planning — Année complète (${year})`,
      desc: "Une feuille par mois avec les mêmes couleurs et mises en forme que l'écran.",
      run: () => exportStyledYearExcel(state, year, printTitle),
    },
    {
      id: "month",
      title: `Planning — Mois spécifique (${MONTHS[monthChoice]} ${year})`,
      desc: "Un seul mois, prêt à imprimer ou à retravailler dans Excel.",
      run: () => exportStyledMonthExcel(monthState, year, monthChoice, printTitle),
    },
    {
      id: "agents",
      title: "Base agents",
      desc: "Liste complète des agents avec équipe, dates d'arrivée / départ.",
      run: () => exportAgentsBookExcel(state),
    },
    {
      id: "codes",
      title: "Codes & Paramètres",
      desc: "Tous les codes avec leur libellé, heures, catégorie et couleur.",
      run: () => exportCodesBookExcel(state),
    },
    {
      id: "rotation",
      title: "Roulement WE",
      desc: `Grille du roulement pour chaque agent (cycle de ${rotation.cycleWeeks} semaines).`,
      run: () => exportRotationBookExcel(state, rotation, year),
    },
    {
      id: "overtime",
      title: `Heures supplémentaires (${year})`,
      desc: "Soldes par agent et détail de tous les mouvements de l'année.",
      run: () => exportOvertimeBookExcel(state, year, overtime, overtimeThreshold),
    },
  ];

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Download /> Exporter
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="size-5" /> Exporter au format Excel
            </DialogTitle>
            <DialogDescription>
              Choisissez ce que vous souhaitez exporter. Chaque fichier reprend
              exactement les couleurs, colonnes et mises en forme de
              l'application, prêt à être retravaillé dans Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {options.map((opt) => (
              <div
                key={opt.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-semibold">{opt.title}</div>
                  <p className="text-sm text-muted-foreground">{opt.desc}</p>
                  {opt.id === "month" && (
                    <div className="mt-2">
                      <Select
                        value={String(monthChoice)}
                        onValueChange={(v) => setMonthChoice(Number(v))}
                      >
                        <SelectTrigger className="w-40">
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
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  disabled={!!busy}
                  onClick={() => run(opt.id, opt.run)}
                  className="shrink-0"
                >
                  <Download className="mr-1.5 size-4" />
                  {busy === opt.id ? "Export…" : "Exporter"}
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={!!busy} onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
