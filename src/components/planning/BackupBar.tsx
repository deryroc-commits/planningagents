import { useEffect, useState } from "react";
import { Check, History, Pencil, RotateCcw, Save, Trash2, X } from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import {
  createBackup,
  deleteBackup,
  formatBackupDate,
  loadBackups,
  renameBackup,
  type Backup,
  type BackupScope,
} from "@/lib/planning/backups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Save / restore bar: create a dated backup of the full application state
 * (data + colors/formatting) and restore any previous one from a dated list.
 *
 * Backups are kept per `scope` so the Planning tab and the Paramètres tab each
 * have their own independent list of saves.
 */
export function BackupBar({ scope = "planning" }: { scope?: BackupScope }) {
  const { year, snapshotState, restoreFullState, restoreYearRotation } =
    usePlanning();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [targetYear, setTargetYear] = useState<number>(year);

  // Keep the target year in sync with the selected year when the dialog opens.
  useEffect(() => {
    if (restoreOpen) setTargetYear(year);
  }, [restoreOpen, year]);

  // Offer a small window of years around the current one as restore targets.
  const yearOptions = Array.from({ length: 8 }, (_, i) => year - 2 + i);

  useEffect(() => {
    setBackups(loadBackups(scope));
  }, [scope]);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 4000);
  };

  const confirmSave = () => {
    const list = createBackup(scope, snapshotState(), label);
    setBackups(list);
    setLabel("");
    setSaveOpen(false);
    flash(`Sauvegarde créée le ${formatBackupDate(list[0].at)}.`);
  };

  const onRestore = (b: Backup) => {
    restoreFullState(b.state);
    setRestoreOpen(false);
    flash(`Sauvegarde du ${formatBackupDate(b.at)} restaurée.`);
  };

  const onRestoreYearRotation = (b: Backup) => {
    restoreYearRotation(b.state, targetYear);
    setRestoreOpen(false);
    flash(`Roulement ${targetYear} restauré depuis le ${formatBackupDate(b.at)}.`);
  };

  const onDelete = (id: string) => {
    setBackups(deleteBackup(scope, id));
  };

  const startRename = (b: Backup) => {
    setEditingId(b.id);
    setEditLabel(b.label ?? "");
  };

  const saveRename = () => {
    if (!editingId) return;
    setBackups(renameBackup(scope, editingId, editLabel));
    setEditingId(null);
    setEditLabel("");
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 p-2">
      <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <History className="size-4" />{" "}
        {scope === "params"
          ? "Sauvegardes paramètres"
          : scope === "rotation"
            ? "Sauvegardes roulement"
            : "Sauvegardes planning"}
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setBackups(loadBackups(scope));
          setRestoreOpen(true);
        }}
      >
        <RotateCcw /> Restaurer
        {backups.length > 0 && (
          <span className="ml-1 rounded bg-muted px-1.5 text-xs">{backups.length}</span>
        )}
      </Button>
      <Button size="sm" onClick={() => setSaveOpen(true)}>
        <Save /> Sauvegarder
      </Button>
      {status && <span className="text-sm text-muted-foreground">{status}</span>}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Sauvegarder{" "}
              {scope === "params"
                ? "les paramètres"
                : scope === "rotation"
                  ? "le roulement"
                  : "le planning"}
            </DialogTitle>
            <DialogDescription>
              Donnez un nom personnalisé à cette sauvegarde, ou laissez vide pour
              utiliser la date seule.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nom (optionnel)"
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmSave();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Annuler
            </Button>
            <Button onClick={confirmSave}>
              <Save /> Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurer une sauvegarde</DialogTitle>
            <DialogDescription>
              {scope === "rotation"
                ? `Choisissez une sauvegarde datée. « Roulement → année » ne restaure le roulement que dans l'année cible choisie ci-dessous (idéal pour réutiliser un roulement existant sur une nouvelle année) ; les autres années sont préservées. « Tout restaurer » remplace l'ensemble des données.`
                : "Choisissez une sauvegarde datée. La restauration remplace l'ensemble des données et de la mise en forme actuelles."}
            </DialogDescription>
          </DialogHeader>
          {scope === "rotation" && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5 text-sm">
              <span className="text-muted-foreground">Année cible du roulement :</span>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="max-h-[50vh] space-y-2 overflow-auto py-1">
            {backups.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune sauvegarde enregistrée pour le moment.
              </p>
            )}
            {backups.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2 rounded-lg border border-border p-2.5"
              >
                {editingId === b.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Nom de la sauvegarde"
                      className="h-8 flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button size="icon" onClick={saveRename} aria-label="Enregistrer le nom">
                      <Check />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      aria-label="Annuler"
                    >
                      <X />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {b.label || "Sauvegarde"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBackupDate(b.at)}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startRename(b)}
                      aria-label="Renommer la sauvegarde"
                    >
                      <Pencil />
                    </Button>
                    {scope === "rotation" && (
                      <Button
                        size="sm"
                        onClick={() => onRestoreYearRotation(b)}
                        title={`Ne restaurer que le roulement de ${year} (les autres années sont préservées)`}
                      >
                        Roulement {year}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={scope === "rotation" ? "outline" : "default"}
                      onClick={() => onRestore(b)}
                    >
                      {scope === "rotation" ? "Tout restaurer" : "Restaurer"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => onDelete(b.id)}
                      aria-label="Supprimer la sauvegarde"
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
