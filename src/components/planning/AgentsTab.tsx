import { useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { usePlanning } from "@/lib/planning/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AgentsTab() {
  const { agents, addAgent, updateAgent, removeAgent } = usePlanning();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftTeam, setDraftTeam] = useState("");
  const [newName, setNewName] = useState("");
  const [newTeam, setNewTeam] = useState("");

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
    addAgent({ name: newName.trim(), team: newTeam.trim() || undefined });
    setNewName("");
    setNewTeam("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Base agents</h2>
        <p className="text-sm text-muted-foreground">
          Liste des agents affichés dans le planning ({agents.length}).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
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

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left">
              <th className="px-3 py-2 font-medium">Nom</th>
              <th className="px-3 py-2 font-medium">Équipe</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
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
                          onClick={() => removeAgent(a.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
