import { useState } from "react";
import {
  Copy,
  Crown,
  Loader2,
  LogIn,
  LogOut,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  useWorkspace,
  type Member,
  type WorkspaceRole,
} from "@/lib/workspace/workspace-context";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Propriétaire",
  editor: "Éditeur",
  viewer: "Lecteur",
};

function initials(name: string | null, email: string | null): string {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function TeamTab() {
  const {
    activeWorkspace,
    isOwner,
    members,
    joinWorkspace,
    renameWorkspace,
    regenerateInviteCode,
    updateMemberRole,
    removeMember,
    leaveWorkspace,
  } = useWorkspace();
  const { user } = useAuth();

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  if (!activeWorkspace) return null;
  const code = activeWorkspace.invite_code;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copié");
    } catch {
      toast.error("Copie impossible");
    }
  };

  const shareCode = async () => {
    const text = `Rejoignez l'équipe "${activeWorkspace.name}" sur le Planning UCPA avec le code ${code} : ${window.location.origin}/app?tab=team`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Code d'invitation", text });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success("Invitation copiée");
  };

  const onRegenerate = async () => {
    setRegenerating(true);
    try {
      await regenerateInviteCode();
      toast.success("Nouveau code généré");
    } catch (err) {
      toast.error("Impossible de régénérer", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRegenerating(false);
    }
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    try {
      await joinWorkspace(joinCode.trim());
      setJoinCode("");
      toast.success("Équipe rejointe");
    } catch (err) {
      toast.error("Code invalide", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setJoining(false);
    }
  };

  const onSaveName = async () => {
    try {
      await renameWorkspace(nameDraft.trim() || activeWorkspace.name);
      setEditingName(false);
      toast.success("Nom mis à jour");
    } catch (err) {
      toast.error("Impossible de renommer", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Team name */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          {editingName ? (
            <div className="flex flex-1 items-center gap-2">
              <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus />
              <Button size="sm" onClick={onSaveName}>
                Enregistrer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                Annuler
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Users className="size-5 text-primary" />
                <h2 className="text-lg font-bold">{activeWorkspace.name}</h2>
              </div>
              {isOwner && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNameDraft(activeWorkspace.name);
                    setEditingName(true);
                  }}
                >
                  <Pencil className="mr-1.5 size-4" /> Renommer
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Invite code */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold">Code d'invitation</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Partagez ce code à 6 chiffres pour inviter d'autres membres.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
          <span className="text-3xl font-bold tracking-[0.3em]">{code}</span>
          <Button size="icon" variant="ghost" onClick={copyCode} title="Copier">
            <Copy className="size-5" />
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" className="flex-1" onClick={shareCode}>
            <Share2 className="mr-1.5 size-4" /> Partager
          </Button>
          {isOwner && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={onRegenerate}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 size-4" />
              )}
              Régénérer
            </Button>
          )}
        </div>
      </div>

      {/* Join another workspace */}
      <form
        onSubmit={onJoin}
        className="rounded-2xl border border-border bg-card p-5 shadow-sm"
      >
        <h3 className="text-base font-semibold">Rejoindre un workspace</h3>
        <p className="mt-1 text-sm text-muted-foreground">Entrez un code à 6 chiffres.</p>
        <div className="mt-3 flex gap-2">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            className="text-center text-lg font-bold tracking-[0.4em]"
          />
          <Button type="submit" disabled={joining || joinCode.length !== 6}>
            {joining ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <LogIn className="mr-1.5 size-4" />
            )}
            Rejoindre
          </Button>
        </div>
      </form>

      {/* Members */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold">Membres ({members.length})</h3>
        <ul className="mt-3 space-y-2">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isSelf={m.user_id === user?.id}
              canManage={isOwner && m.user_id !== user?.id}
              onRoleChange={(role) => void updateMemberRole(m.user_id, role)}
              onRemove={() => void removeMember(m.user_id)}
            />
          ))}
        </ul>
      </div>

      {!isOwner && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => void leaveWorkspace()}
          >
            <LogOut className="mr-1.5 size-4" /> Quitter cette équipe
          </Button>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  canManage,
  onRoleChange,
  onRemove,
}: {
  member: Member;
  isSelf: boolean;
  canManage: boolean;
  onRoleChange: (role: WorkspaceRole) => void;
  onRemove: () => void;
}) {
  const joined = new Date(member.joined_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
      <Avatar className="size-10">
        <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
          {initials(member.display_name, member.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {member.display_name || member.email || "Membre"}
          </span>
          {isSelf && (
            <Badge variant="secondary" className="shrink-0">
              Vous
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">Rejoint le {joined}</p>
      </div>

      {member.role === "owner" ? (
        <Badge className="shrink-0 gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
          <Crown className="size-3.5" /> Propriétaire
        </Badge>
      ) : canManage ? (
        <div className="flex items-center gap-1.5">
          <Select value={member.role} onValueChange={(v) => onRoleChange(v as WorkspaceRole)}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">{ROLE_LABEL.editor}</SelectItem>
              <SelectItem value="viewer">{ROLE_LABEL.viewer}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-destructive hover:text-destructive"
            onClick={onRemove}
            title="Retirer"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : (
        <Badge variant="outline" className="shrink-0">
          {ROLE_LABEL[member.role]}
        </Badge>
      )}
    </li>
  );
}
