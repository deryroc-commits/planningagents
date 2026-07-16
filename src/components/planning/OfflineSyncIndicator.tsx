import { CheckCircle2, CloudOff, Loader2, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useSyncStatus } from "@/lib/planning/store";
import { cn } from "@/lib/utils";

/**
 * Small pill that shows connection + sync state:
 *  - Hors ligne (rouge) : pas de réseau
 *  - En attente (ambre) : modifs locales pas encore envoyées
 *  - Synchronisation… (bleu) : envoi en cours
 *  - Erreur (rouge) : dernier envoi a échoué
 *  - Synchronisé (vert) : tout est à jour (masqué après quelques secondes)
 */
export function OfflineSyncIndicator() {
  const { status, isOnline } = useSyncStatus();
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    if (status === "idle" && isOnline) {
      setJustSynced(true);
      const t = window.setTimeout(() => setJustSynced(false), 3000);
      return () => window.clearTimeout(t);
    }
    setJustSynced(false);
  }, [status, isOnline]);

  let icon: React.ReactNode;
  let label: string;
  let title: string;
  let tone: string;

  if (!isOnline || status === "offline") {
    icon = <WifiOff className="size-3.5" />;
    label = "Hors ligne";
    title =
      "Aucune connexion : les modifications sont enregistrées localement et seront synchronisées au retour du réseau.";
    tone = "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900";
  } else if (status === "syncing") {
    icon = <Loader2 className="size-3.5 animate-spin" />;
    label = "Synchronisation…";
    title = "Envoi des modifications au cloud.";
    tone = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900";
  } else if (status === "pending") {
    icon = <RefreshCw className="size-3.5" />;
    label = "En attente de synchro";
    title = "Modifications locales à envoyer au cloud.";
    tone =
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900";
  } else if (status === "error") {
    icon = <TriangleAlert className="size-3.5" />;
    label = "Erreur de synchro";
    title = "La dernière tentative a échoué. Nouvelle tentative automatique.";
    tone = "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900";
  } else if (justSynced) {
    icon = <CheckCircle2 className="size-3.5" />;
    label = "Synchronisé";
    title = "Toutes les modifications sont enregistrées dans le cloud.";
    tone =
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900";
  } else {
    icon = <CloudOff className="size-3.5 opacity-0" />;
    label = "";
    title = "";
    tone = "hidden";
  }

  return (
    <span
      role="status"
      aria-live="polite"
      title={title}
      className={cn(
        "no-print inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium",
        tone,
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
