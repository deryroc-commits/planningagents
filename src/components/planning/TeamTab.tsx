import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Ban,
  Check,
  Clock,
  Copy,
  Crown,
  History,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  ShieldOff,
  Trash2,
  Unlock,
  Users,
  X,
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

const ACTION_LABEL: Record<string, string> = {
  member_blocked: "Membre bloqué",
  member_unblocked: "Membre débloqué",
  email_banned: "Email banni",
  email_unbanned: "Email retiré de la liste noire",
};

export function TeamTab() {
  const {
    activeWorkspace,
    isOwner,
    members,
    pendingMembers,
    blockedMembers,
    blocklist,
    accessLog,
    joinWorkspace,
    renameWorkspace,
    regenerateInviteCode,
    updateMemberRole,
    removeMember,
    approveMember,
    rejectMember,
    blockMember,
    unblockMember,
    addBlockedEmail,
    removeBlockedEmail,
    leaveWorkspace,
  } = useWorkspace();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [banEmail, setBanEmail] = useState("");
  const [banning, setBanning] = useState(false);

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
      toast.success("Demande envoyée", {
        description: "Le propriétaire doit approuver votre accès avant que vous voyiez le planning.",
      });
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

      {/* Pending requests — visible only to the owner */}
      {isOwner && (
        <div className={`rounded-2xl border p-5 shadow-sm ${pendingMembers.length > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10" : "border-border bg-card"}`}>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Clock className="size-4 text-amber-600" /> Demandes d'accès ({pendingMembers.length})
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Les personnes qui utilisent votre code d'invitation apparaissent ici en attente d'approbation.
          </p>
          {pendingMembers.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-sm text-muted-foreground">
              Aucune demande en attente.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pendingMembers.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl bg-background/80 px-3 py-2.5"
                >
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-amber-500/15 text-sm font-semibold text-amber-700 dark:text-amber-300">
                      {initials(m.display_name, m.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.display_name || m.email || "Nouveau membre"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Demande du{" "}
                      {new Date(m.joined_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      void approveMember(m.user_id).then(() => toast.success("Accès accordé"));
                    }}
                  >
                    <Check className="mr-1 size-4" /> Approuver
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 text-destructive hover:text-destructive"
                    onClick={() => {
                      void rejectMember(m.user_id).then(() => toast.success("Demande refusée"));
                    }}
                    title="Refuser"
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
              onRemove={() => {
                if (!confirm(`Supprimer définitivement ${m.display_name || m.email || "ce membre"} ?`)) return;
                void removeMember(m.user_id).then(() => toast.success("Membre supprimé"));
              }}
              onBlock={() => {
                void blockMember(m.user_id).then(() => toast.success("Accès bloqué"));
              }}
            />
          ))}
        </ul>
      </div>

      {/* Blocked members */}
      {isOwner && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Lock className="size-4 text-destructive" /> Comptes bloqués ({blockedMembers.length})
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ces comptes ne peuvent plus voir ni modifier le planning.
          </p>
          {blockedMembers.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-sm text-muted-foreground">
              Aucun compte bloqué.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {blockedMembers.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                >
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-destructive/15 text-sm font-semibold text-destructive">
                      {initials(m.display_name, m.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.display_name || m.email || "Membre"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">Accès bloqué</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void unblockMember(m.user_id).then(() => toast.success("Accès rétabli"))}
                  >
                    <Unlock className="mr-1 size-4" /> Débloquer
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 text-destructive hover:text-destructive"
                    title="Supprimer définitivement"
                    onClick={() => {
                      if (!confirm("Supprimer définitivement ce compte de l'équipe ?")) return;
                      void removeMember(m.user_id).then(() => toast.success("Membre supprimé"));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Email blocklist */}
      {isOwner && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <ShieldOff className="size-4 text-destructive" /> Emails bannis ({blocklist.length})
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Les adresses listées ici ne pourront plus rejoindre l'équipe, même avec le code d'invitation.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!banEmail.trim()) return;
              setBanning(true);
              try {
                await addBlockedEmail(banEmail);
                setBanEmail("");
                toast.success("Adresse ajoutée à la liste noire");
              } catch (err) {
                toast.error("Impossible d'ajouter", {
                  description: err instanceof Error ? err.message : undefined,
                });
              } finally {
                setBanning(false);
              }
            }}
          >
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={banEmail}
                onChange={(e) => setBanEmail(e.target.value)}
                placeholder="exemple@mail.com"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={banning || !banEmail.trim()}>
              {banning ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Plus className="mr-1 size-4" />}
              Bannir
            </Button>
          </form>
          {blocklist.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {blocklist.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <Ban className="size-4 shrink-0 text-destructive" />
                  <span className="min-w-0 flex-1 truncate">{b.email}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {new Date(b.created_at).toLocaleDateString("fr-FR")}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    title="Retirer"
                    onClick={() => void removeBlockedEmail(b.id).then(() => toast.success("Retiré de la liste"))}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Access log */}
      {isOwner && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <History className="size-4 text-primary" /> Journal d'accès
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            50 dernières actions d'administration (blocages, bannissements…).
          </p>
          {accessLog.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-sm text-muted-foreground">
              Aucune action enregistrée pour le moment.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {accessLog.map((e) => (
                <li key={e.id} className="flex items-start gap-2 rounded-lg border border-border/60 px-3 py-2">
                  <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>
                    {e.target_email && (
                      <span className="ml-1 text-muted-foreground">— {e.target_email}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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

      {/* Account / logout */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">Mon compte</h3>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="mr-1.5 size-4" /> Déconnexion
          </Button>
        </div>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  canManage,
  onRoleChange,
  onRemove,
  onBlock,
}: {
  member: Member;
  isSelf: boolean;
  canManage: boolean;
  onRoleChange: (role: WorkspaceRole) => void;
  onRemove: () => void;
  onBlock: () => void;
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
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Select value={member.role} onValueChange={(v) => onRoleChange(v as WorkspaceRole)}>
            <SelectTrigger className="h-9 w-[104px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">{ROLE_LABEL.editor}</SelectItem>
              <SelectItem value="viewer">{ROLE_LABEL.viewer}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-9 border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400"
            onClick={onBlock}
            title="Bloquer l'accès"
          >
            <Lock className="mr-1 size-4" /> Bloquer
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
            title="Supprimer définitivement"
          >
            <Trash2 className="mr-1 size-4" /> Supprimer
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
