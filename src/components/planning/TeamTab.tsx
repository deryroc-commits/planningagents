import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Ban,
  Check,
  Clock,
  Copy,
  Crown,
  Eye,
  History,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Share2,
  Shield,
  ShieldCheck,
  ShieldOff,
  Sliders,
  Trash2,
  Unlock,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  useWorkspace,
  ALL_TABS,
  TAB_LABELS,
  defaultTabPermissions,
  type InviteLevel,
  type Member,
  type TabKey,
  type TabPermission,
  type TabPermissions,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  editor: "Éditeur",
  viewer: "Lecteur",
  custom: "Personnalisé",
};

const ROLE_DESCRIPTION: Record<WorkspaceRole, string> = {
  owner: "Contrôle total. Seul rôle pouvant supprimer l'équipe.",
  admin: "Peut modifier tout et gérer les membres.",
  editor: "Peut modifier tous les onglets.",
  viewer: "Peut consulter tous les onglets, sans modification.",
  custom: "Droits définis onglet par onglet (voir / modifier / masquer).",
};

const INVITE_META: Record<
  InviteLevel,
  { label: string; description: string; badgeCls: string; iconCls: string; icon: typeof Eye }
> = {
  editor: {
    label: "Code Éditeur",
    description: "Accès complet en modification (tous les onglets).",
    badgeCls: "bg-primary/15 text-primary",
    iconCls: "text-primary",
    icon: Pencil,
  },
  viewer: {
    label: "Code Lecteur",
    description: "Accès en lecture seule sur tous les onglets.",
    badgeCls: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    iconCls: "text-sky-600 dark:text-sky-300",
    icon: Eye,
  },
  admin: {
    label: "Code Administrateur",
    description: "Peut modifier et gérer les membres (sauf suppression de l'équipe).",
    badgeCls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    iconCls: "text-amber-600 dark:text-amber-300",
    icon: ShieldCheck,
  },
  custom: {
    label: "Code Personnalisé",
    description: "Droits attribués ensuite par l'administrateur, onglet par onglet.",
    badgeCls: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    iconCls: "text-purple-600 dark:text-purple-300",
    icon: Sliders,
  },
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
    isAdmin,
    members,
    pendingMembers,
    blockedMembers,
    blocklist,
    accessLog,
    joinWorkspace,
    renameWorkspace,
    regenerateInviteCode,
    updateMemberRole,
    updateMemberTabPermissions,
    removeMember,
    approveMember,
    rejectMember,
    blockMember,
    unblockMember,
    addBlockedEmail,
    removeBlockedEmail,
    leaveWorkspace,
    pendingMemberships,
    cancelPending,
  } = useWorkspace();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [regenerating, setRegenerating] = useState<InviteLevel | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [banEmail, setBanEmail] = useState("");
  const [banning, setBanning] = useState(false);
  const [permsMember, setPermsMember] = useState<Member | null>(null);

  if (!activeWorkspace) return null;

  const codes: Record<InviteLevel, string> = {
    editor: activeWorkspace.invite_code,
    viewer: activeWorkspace.invite_code_viewer,
    admin: activeWorkspace.invite_code_admin,
    custom: activeWorkspace.invite_code_custom,
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Code copié");
    } catch {
      toast.error("Copie impossible");
    }
  };

  const share = async (level: InviteLevel) => {
    const info = INVITE_META[level];
    const text = `Rejoignez l'équipe « ${activeWorkspace.name} » — ${info.label} : ${codes[level]}\n${window.location.origin}/app?tab=team`;
    if (navigator.share) {
      try {
        await navigator.share({ title: info.label, text });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success("Invitation copiée");
  };

  const onRegenerate = async (level: InviteLevel) => {
    setRegenerating(level);
    try {
      await regenerateInviteCode(level);
      toast.success("Nouveau code généré");
    } catch (err) {
      toast.error("Impossible de régénérer", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRegenerating(null);
    }
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    try {
      await joinWorkspace(joinCode.trim());
      setJoinCode("");
      toast.success("Demande envoyée", {
        description:
          "L'administrateur doit approuver votre accès avant que vous voyiez le planning.",
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
              {isAdmin && (
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

      {/* My invitation status */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Mail className="size-4 text-primary" /> Mon statut d'accès
        </h3>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{activeWorkspace.name}</div>
              <div className="text-xs text-muted-foreground">
                Rôle : {ROLE_LABEL[activeWorkspace.role]}
              </div>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">
              <Check className="mr-1 size-3" /> Actif
            </Badge>
          </div>
          {pendingMemberships.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-500/10"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{m.name}</div>
                <div className="text-xs text-amber-800/80 dark:text-amber-200/80">
                  En attente d'approbation par l'administrateur
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200">
                  <Clock className="mr-1 size-3" /> En attente
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void cancelPending(m.id)}
                >
                  <X className="mr-1 size-4" /> Annuler
                </Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Si une demande a disparu de cette liste sans être approuvée, elle a été refusée par l'administrateur. Redemandez un accès avec un nouveau code d'invitation.
          </p>
        </div>
      </div>

      {/* Invite codes — 4 levels */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Shield className="size-4 text-primary" /> Codes d'invitation
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez le niveau d'accès à partager. Chaque code correspond à un rôle différent.
        </p>
        <div className="mt-3 space-y-3">
          {(Object.keys(INVITE_META) as InviteLevel[]).map((level) => {
            const meta = INVITE_META[level];
            const Icon = meta.icon;
            const codeValue = codes[level];
            const isRegen = regenerating === level;
            return (
              <div key={level} className="rounded-xl border border-border/70 p-3">
                <div className="flex items-center gap-2">
                  <Icon className={`size-4 ${meta.iconCls}`} />
                  <span className="font-medium">{meta.label}</span>
                  <Badge className={`ml-auto ${meta.badgeCls}`}>{ROLE_LABEL[level === "editor" ? "editor" : level === "viewer" ? "viewer" : level === "admin" ? "admin" : "custom"]}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                  <span className="text-2xl font-bold tracking-[0.25em]">{codeValue || "——————"}</span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => void copy(codeValue)} title="Copier">
                      <Copy className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => void share(level)} title="Partager">
                      <Share2 className="size-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void onRegenerate(level)}
                        disabled={isRegen}
                        title="Régénérer"
                      >
                        {isRegen ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* Pending requests — admins */}
      {isAdmin && (
        <div className={`rounded-2xl border p-5 shadow-sm ${pendingMembers.length > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10" : "border-border bg-card"}`}>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Clock className="size-4 text-amber-600" /> Demandes d'accès ({pendingMembers.length})
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Les personnes qui utilisent un code d'invitation apparaissent ici en attente d'approbation.
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
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-background/80 px-3 py-2.5"
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
                      Demande : <span className="font-medium">{ROLE_LABEL[m.role]}</span>
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
              canManage={isAdmin && m.role !== "owner" && m.user_id !== user?.id}
              onRoleChange={(role) => void updateMemberRole(m.user_id, role)}
              onCustomize={() => setPermsMember(m)}
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
      {isAdmin && (
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
      {isAdmin && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <ShieldOff className="size-4 text-destructive" /> Emails bannis ({blocklist.length})
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Les adresses listées ici ne pourront plus rejoindre l'équipe, même avec un code d'invitation.
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
      {isAdmin && (
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

      <CustomPermissionsDialog
        member={permsMember}
        onClose={() => setPermsMember(null)}
        onSave={async (perms) => {
          if (!permsMember) return;
          try {
            await updateMemberTabPermissions(permsMember.user_id, perms);
            toast.success("Droits mis à jour");
            setPermsMember(null);
          } catch (err) {
            toast.error("Impossible d'enregistrer", {
              description: err instanceof Error ? err.message : undefined,
            });
          }
        }}
      />
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  canManage,
  onRoleChange,
  onCustomize,
  onRemove,
  onBlock,
}: {
  member: Member;
  isSelf: boolean;
  canManage: boolean;
  onRoleChange: (role: WorkspaceRole) => void;
  onCustomize: () => void;
  onRemove: () => void;
  onBlock: () => void;
}) {
  const joined = new Date(member.joined_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
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
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
              <SelectItem value="editor">{ROLE_LABEL.editor}</SelectItem>
              <SelectItem value="viewer">{ROLE_LABEL.viewer}</SelectItem>
              <SelectItem value="custom">{ROLE_LABEL.custom}</SelectItem>
            </SelectContent>
          </Select>
          {member.role === "custom" && (
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={onCustomize}
              title="Configurer les droits"
            >
              <Settings2 className="mr-1 size-4" /> Droits
            </Button>
          )}
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

const PERM_OPTIONS: { value: TabPermission; label: string }[] = [
  { value: "edit", label: "Modifier" },
  { value: "read", label: "Lecture seule" },
  { value: "hidden", label: "Masquer" },
];

function CustomPermissionsDialog({
  member,
  onClose,
  onSave,
}: {
  member: Member | null;
  onClose: () => void;
  onSave: (perms: TabPermissions) => Promise<void>;
}) {
  const [perms, setPerms] = useState<TabPermissions>(() =>
    member?.tab_permissions ?? defaultTabPermissions(),
  );
  const [saving, setSaving] = useState(false);

  // Reset when a different member opens the dialog
  const memberId = member?.id ?? null;
  useState(() => memberId);

  const open = !!member;

  const setAll = (v: TabPermission) => {
    const next: TabPermissions = {};
    for (const t of ALL_TABS) next[t] = v;
    setPerms(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
        else if (member) setPerms(member.tab_permissions ?? defaultTabPermissions());
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Droits personnalisés</DialogTitle>
          <DialogDescription>
            Choisissez pour chaque onglet si le membre peut modifier, uniquement consulter ou ne pas voir l'onglet.
          </DialogDescription>
        </DialogHeader>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setAll("edit")}>
            Tout modifier
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAll("read")}>
            Tout en lecture
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAll("hidden")}>
            Tout masquer
          </Button>
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-auto pr-1">
          {ALL_TABS.map((tab) => (
            <div
              key={tab}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
            >
              <span className="font-medium">{TAB_LABELS[tab]}</span>
              <Select
                value={perms[tab] ?? "read"}
                onValueChange={(v) => setPerms({ ...perms, [tab]: v as TabPermission })}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(perms);
              setSaving(false);
            }}
          >
            {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Suppress unused type warnings for exported types used only in props above.
export type _UnusedTabKey = TabKey;
