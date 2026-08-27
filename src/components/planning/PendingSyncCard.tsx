import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudUpload, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth/auth-context";
import { listPendingWorkspaces, syncPendingWorkspaces } from "@/lib/planning/offline-sync";

/**
 * Carte affichée sur la page de connexion quand des modifications faites hors
 * ligne attendent d'être envoyées. Envoi manuel via le bouton « Synchroniser »
 * et envoi automatique dès que le réseau revient (si une session est active).
 */
export function PendingSyncCard() {
  const { session } = useAuth();
  const [pending, setPending] = useState<string[]>([]);
  const [online, setOnline] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const runningRef = useRef(false);

  const refresh = useCallback(() => setPending(listPendingWorkspaces()), []);

  useEffect(() => {
    refresh();
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  const runSync = useCallback(async () => {
    if (runningRef.current || !session) return;
    runningRef.current = true;
    setRunning(true);
    setDoneMessage(null);
    setErrorMessage(null);
    setProgress({ done: 0, total: listPendingWorkspaces().length });

    const result = await syncPendingWorkspaces((p) =>
      setProgress({ done: p.done, total: p.total }),
    );

    runningRef.current = false;
    setRunning(false);
    refresh();

    if (result.total === 0) {
      setDoneMessage("Aucune modification en attente.");
      return;
    }
    if (result.failed > 0) {
      setErrorMessage(
        result.lastError
          ? `${result.failed} planning(s) non envoyé(s) : ${result.lastError}`
          : `${result.failed} planning(s) non envoyé(s).`,
      );
      toast.error("Synchronisation incomplète");
      return;
    }
    setDoneMessage(`${result.sent} planning(s) synchronisé(s).`);
    toast.success("Modifications synchronisées");
  }, [refresh]);

  // Envoi automatique au retour du réseau.
  useEffect(() => {
    if (!online || !session || pending.length === 0 || runningRef.current) return;
    void runSync();
  }, [online, session, pending.length, runSync]);

  if (pending.length === 0 && !running && !doneMessage && !errorMessage) return null;

  const percent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : running ? 0 : 100;

  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-start gap-2">
        <CloudUpload className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {pending.length > 0
              ? `${pending.length} planning(s) modifié(s) hors ligne`
              : "Synchronisation"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {!online
              ? "Hors ligne : l'envoi démarrera automatiquement dès le retour du réseau."
              : session
                ? "Vos modifications locales peuvent être envoyées au cloud."
                : "Connectez-vous ci-dessous : l'envoi démarre automatiquement après la connexion."}
          </p>

          {(running || progress.total > 0) && (
            <div className="mt-2 space-y-1">
              <Progress value={percent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {running ? `Envoi en cours… ${percent}%` : `Terminé — ${percent}%`}
              </p>
            </div>
          )}

          {doneMessage && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-3.5" />
              {doneMessage}
            </p>
          )}
          {errorMessage && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
              <TriangleAlert className="size-3.5" />
              {errorMessage}
            </p>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={running || !online || !session || pending.length === 0}
            onClick={() => void runSync()}
          >
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Synchronisation…
              </>
            ) : (
              <>
                <CloudUpload className="size-4" />
                Synchroniser
              </>
            )}
          </Button>
          {!session && pending.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Connectez-vous pour autoriser l'envoi vers le cloud.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
