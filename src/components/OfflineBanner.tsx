import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useSyncStatus } from "@/lib/planning/store";

/**
 * Bandeau persistant « mode hors ligne » : visible tant que le réseau est
 * indisponible (ou qu'une synchro a échoué faute de réseau). Explique que les
 * données locales sont utilisées et rassure : aucun rechargement forcé, la
 * synchronisation reprendra automatiquement au retour du réseau.
 */
export function OfflineBanner() {
  const { isOnline, status } = useSyncStatus();

  if (isOnline && status !== "offline") return null;

  return (
    <div
      role="alert"
      className="no-print fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 border-b border-red-300 bg-red-50 px-3 py-1.5 text-center text-xs font-medium text-red-900 dark:border-red-900 dark:bg-red-950/80 dark:text-red-100"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>
        Mode hors ligne : les données locales enregistrées sur cet appareil sont utilisées. Vos
        modifications sont conservées et seront synchronisées automatiquement dès le retour de la
        connexion — inutile de recharger la page.
      </span>
    </div>
  );
}
