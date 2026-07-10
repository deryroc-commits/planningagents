import { useState } from "react";
import { ArrowDown, ArrowUp, CalendarCheck, CalendarX, LogIn, LogOut, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import { MONTHS } from "@/lib/planning/calc";
import { useSelectableYears } from "@/hooks/use-selectable-years";
import type { Agent, AgentSortMode } from "@/lib/planning/types";
import { AGENT_SORT_LABELS } from "@/lib/planning/types";
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

function arrivalLabel(a: Agent): string | null {
  if (a.startYear == null || a.startMonth == null) return null;
  return `${MONTHS[a.startMonth]} ${a.startYear}`;
}
function departureLabel(a: Agent): string | null {
  if (a.endYear == null || a.endMonth == null) return null;
  return `${MONTHS[a.endMonth]} ${a.endYear}`;
}

export function AgentsTab() {
  const { agents, addAgent, updateAgent, removeAgent, yearRange, agentSort, setAgentSort, moveAgent } = usePlanning();
  const years = useSelectableYears(yearRange);
  const now = new Date();

  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftTeam, setDraftTeam] = useState("");

  // Add form.
  const [newName, setNewName] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [arrEnabled, setArrEnabled] = useState(false);
  const [newArrMonth, setNewArrMonth] = useState(now.getMonth());
  const [newArrYear, setNewArrYear] = useState(now.getFullYear());

  // Departure / arrival / delete dialog state.
  const [dialogAgent, setDialogAgent] = useState<Agent | null>(null);
  const [depEnabled, setDepEnabled] = useState(false);
  const [depMonth, setDepMonth] = useState(now.getMonth());
  const [depYear, setDepYear] = useState(now.getFullYear());
  const [dArrEnabled, setDArrEnabled] = useState(false);
  const [dArrMonth, setDArrMonth] = useState(now.getMonth());
  const [dArrYear, setDArrYear] = useState(now.getFullYear());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startEdit = (id: string, name: string, team?: string) => {
    setEditing(id);
    setDraftName(name);
    setDraftTeam(team ?? "");
  };
  const saveEdit = () => {
    if (!editing) return;
    if (draftName.trim())
      updateAgent(editing, {
        name: draftName.trim(),
        team: draftTeam.trim() || undefined,
      });
    setEditing(null);
  };
  const addNew = () => {
    if (!newName.trim()) return;
    addAgent({
      name: newName.trim(),
      team: newTeam.trim() || undefined,
      ...(arrEnabled ? { startYear: newArrYear, startMonth: newArrMonth } : {}),
    });
    setNewName("");
    setNewTeam("");
    setArrEnabled(false);
  };

  const openDialog = (a: Agent) => {
    setDialogAgent(a);
    setConfirmDelete(false);
    setDepEnabled(a.endYear != null && a.endMonth != null);
    setDepMonth(a.endMonth ?? now.getMonth());
    setDepYear(a.endYear ?? now.getFullYear());
    setDArrEnabled(a.startYear != null && a.startMonth != null);
    setDArrMonth(a.startMonth ?? now.getMonth());
    setDArrYear(a.startYear ?? now.getFullYear());
  };
  const closeDialog = () => {
    setDialogAgent(null);
    setConfirmDelete(false);
  };
  const saveDialog = () => {
    if (!dialogAgent) return;
    updateAgent(dialogAgent.id, {
      startYear: dArrEnabled ? dArrYear : undefined,
      startMonth: dArrEnabled ? dArrMonth : undefined,
      endYear: depEnabled ? depYear : undefined,
      endMonth: depEnabled ? depMonth : undefined,
    });
    closeDialog();
  };
  const deletePermanently = () => {
    if (!dialogAgent) return;
    removeAgent(dialogAgent.id);
    closeDialog();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Base agents</h2>
        <p className="text-sm text-muted-foreground">
          Liste des agents affichés dans le planning ({agents.length}).
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nom de l'agent
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNew()}
              placeholder="Nom Prénom"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Équipe (optionnel)
            </label>
            <Input
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNew()}
              placeholder="Équipe A"
            />
          </div>
          <Button onClick={addNew}>
            <Plus /> Ajouter
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/50 p-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={arrEnabled}
              onCheckedChange={(v) => setArrEnabled(v === true)}
            />
            Arrivée à partir d'un mois
          </label>
          {arrEnabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(newArrMonth)}
                onValueChange={(v) => setNewArrMonth(Number(v))}
              >
                <SelectTrigger className="w-36">
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
              <Select
                value={String(newArrYear)}
                onValueChange={(v) => setNewArrYear(Number(v))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              Présent tout de suite (tous les mois).
            </span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left">
              <th className="px-3 py-2 font-medium">Nom</th>
              <th className="px-3 py-2 font-medium">Équipe</th>
              <th className="px-3 py-2 font-medium">Arrivée</th>
              <th className="px-3 py-2 font-medium">Départ</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => {
              const arr = arrivalLabel(a);
              const dep = departureLabel(a);
              return (
                <tr key={a.id} className="border-b border-border last:border-0">
                  {editing === a.id ? (
                    <>
                      <td className="px-3 py-2">
                        <Input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={draftTeam}
                          onChange={(e) => setDraftTeam(e.target.value)}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {arr ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {dep ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" className="size-8" onClick={saveEdit}>
                            <Save />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setEditing(null)}
                          >
                            <X />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium">{a.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {a.team ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {arr ? (
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            <CalendarCheck className="size-3.5" /> {arr}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {dep ? (
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            <CalendarX className="size-3.5" /> {dep}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => startEdit(a.id, a.name, a.team)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            title="Arrivée / Départ / Suppression"
                            onClick={() => openDialog(a)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Arrival / departure / delete dialog */}
      <Dialog open={!!dialogAgent} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogAgent?.name}</DialogTitle>
            <DialogDescription>
              L'arrivée masque l'agent avant le mois choisi ; le départ le masque
              à partir du mois choisi (et les années suivantes). Les mois hors de
              cette période restent vides et l'historique est conservé. La
              suppression définitive efface tout son planning.
            </DialogDescription>
          </DialogHeader>

          {!confirmDelete ? (
            <div className="space-y-4">
              {/* Arrival */}
              <div className="rounded-lg border border-border p-3">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Checkbox
                    checked={dArrEnabled}
                    onCheckedChange={(v) => setDArrEnabled(v === true)}
                  />
                  <LogIn className="size-4" /> Arrivée à partir de
                </label>
                {dArrEnabled ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <Select
                      value={String(dArrMonth)}
                      onValueChange={(v) => setDArrMonth(Number(v))}
                    >
                      <SelectTrigger className="w-36">
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
                    <Select
                      value={String(dArrYear)}
                      onValueChange={(v) => setDArrYear(Number(v))}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Présent tout de suite (aucune date d'arrivée).
                  </span>
                )}
              </div>

              {/* Departure */}
              <div className="rounded-lg border border-border p-3">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Checkbox
                    checked={depEnabled}
                    onCheckedChange={(v) => setDepEnabled(v === true)}
                  />
                  <LogOut className="size-4" /> Départ à partir de
                </label>
                {depEnabled ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <Select
                      value={String(depMonth)}
                      onValueChange={(v) => setDepMonth(Number(v))}
                    >
                      <SelectTrigger className="w-36">
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
                    <Select
                      value={String(depYear)}
                      onValueChange={(v) => setDepYear(Number(v))}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Présent ensuite (aucune date de départ).
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-3">
                <span className="text-sm text-muted-foreground">
                  Retirer l'agent et tout son historique
                </span>
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" /> Suppression définitive
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                Cette action supprime définitivement{" "}
                <strong>{dialogAgent?.name}</strong> et tout son planning sur
                toutes les années. Elle est irréversible.
              </p>
            </div>
          )}

          <DialogFooter>
            {confirmDelete ? (
              <>
                <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                  Retour
                </Button>
                <Button
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={deletePermanently}
                >
                  <Trash2 className="size-4" /> Confirmer la suppression
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={closeDialog}>
                  Annuler
                </Button>
                <Button onClick={saveDialog}>
                  <Save className="size-4" /> Enregistrer
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
