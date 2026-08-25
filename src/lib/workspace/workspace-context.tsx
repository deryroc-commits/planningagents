import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer" | "custom";
export type MembershipStatus = "active" | "pending" | "blocked";
export type InviteLevel = "editor" | "viewer" | "admin" | "custom";

export type TabKey =
  | "planning"
  | "stats"
  | "rotation"
  | "params"
  | "agents"
  | "mods"
  | "overtime"
  | "print"
  | "team"
  | "qr"
  | "help";

export type TabPermission = "hidden" | "read" | "edit";

export type TabPermissions = Partial<Record<TabKey, TabPermission>>;

export const TAB_LABELS: Record<TabKey, string> = {
  planning: "Planning",
  stats: "Statistiques",
  rotation: "Roulement WE",
  params: "Paramètres",
  agents: "Base agents",
  mods: "Modifications",
  overtime: "Heures supp.",
  print: "Impression",
  team: "Équipe",
  qr: "QR codes",
  help: "Aide",
};

export const ALL_TABS: TabKey[] = [
  "planning",
  "stats",
  "rotation",
  "params",
  "agents",
  "mods",
  "overtime",
  "print",
  "team",
  "qr",
  "help",
];

/**
 * Onglets toujours accessibles quel que soit le rôle. « team » permet à
 * l'utilisateur de voir son statut d'accès et de quitter l'équipe. « help »
 * est l'aide de l'application.
 */
const ALWAYS_VISIBLE: TabKey[] = ["team", "help"];

export interface Workspace {
  id: string;
  name: string;
  invite_code: string;
  invite_code_viewer: string;
  invite_code_admin: string;
  invite_code_custom: string;
  owner_id: string;
  main_title: string;
  subtitle: string;
  print_title: string;
}

export const DEFAULT_TITLES = {
  main_title: "Planning des agents",
  subtitle: "Gestion du planning annuel",
  print_title: "PLANNING DES AGENTS",
} as const;

export interface WorkspaceTitles {
  main_title?: string;
  subtitle?: string;
  print_title?: string;
}

export interface WorkspaceMembership extends Workspace {
  role: WorkspaceRole;
  status: MembershipStatus;
  tab_permissions: TabPermissions | null;
}

export interface Member {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  joined_at: string;
  display_name: string | null;
  email: string | null;
  tab_permissions: TabPermissions | null;
}

export interface BlocklistEntry {
  id: string;
  email: string;
  reason: string | null;
  created_at: string;
}

export interface AccessLogEntry {
  id: string;
  action: string;
  target_email: string | null;
  target_user_id: string | null;
  actor_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface WorkspaceContextValue {
  loading: boolean;
  memberships: WorkspaceMembership[];
  pendingMemberships: WorkspaceMembership[];
  activeWorkspace: WorkspaceMembership | null;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  role: WorkspaceRole | null;
  canEdit: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  canViewTab: (tab: TabKey) => boolean;
  canEditTab: (tab: TabKey) => boolean;
  members: Member[];
  pendingMembers: Member[];
  blockedMembers: Member[];
  blocklist: BlocklistEntry[];
  accessLog: AccessLogEntry[];
  refreshMemberships: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshBlocklist: () => Promise<void>;
  refreshAccessLog: () => Promise<void>;
  createWorkspace: (name: string, titles?: WorkspaceTitles) => Promise<WorkspaceMembership>;
  joinWorkspace: (code: string) => Promise<WorkspaceMembership>;
  renameWorkspace: (name: string) => Promise<void>;
  updateWorkspaceTitles: (titles: WorkspaceTitles) => Promise<void>;
  regenerateInviteCode: (level?: InviteLevel) => Promise<string>;
  updateMemberRole: (userId: string, role: WorkspaceRole) => Promise<void>;
  updateMemberTabPermissions: (userId: string, perms: TabPermissions) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  approveMember: (userId: string) => Promise<void>;
  rejectMember: (userId: string) => Promise<void>;
  blockMember: (userId: string) => Promise<void>;
  unblockMember: (userId: string) => Promise<void>;
  addBlockedEmail: (email: string, reason?: string) => Promise<void>;
  removeBlockedEmail: (id: string) => Promise<void>;
  cancelPending: (workspaceId: string) => Promise<void>;
  leaveWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const ACTIVE_KEY = "planning-active-workspace";

function parseTabPermissions(raw: unknown): TabPermissions | null {
  if (!raw || typeof raw !== "object") return null;
  const out: TabPermissions = {};
  for (const key of ALL_TABS) {
    const v = (raw as Record<string, unknown>)[key];
    if (v === "hidden" || v === "read" || v === "edit") out[key] = v;
  }
  return out;
}

export function defaultTabPermissions(): TabPermissions {
  const out: TabPermissions = {};
  for (const t of ALL_TABS) out[t] = "read";
  return out;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [allMemberships, setAllMemberships] = useState<WorkspaceMembership[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    try {
      window.localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshMemberships = useCallback(async () => {
    if (!user) {
      setAllMemberships([]);
      return;
    }
    const cacheKey = `${ACTIVE_KEY}:cache:${user.id}`;

    /** Hors ligne : réutiliser la dernière liste d'équipes connue. */
    const restoreFromCache = () => {
      try {
        const raw = window.localStorage.getItem(cacheKey);
        if (!raw) return;
        const cached = JSON.parse(raw) as WorkspaceMembership[];
        if (Array.isArray(cached) && cached.length) setAllMemberships(cached);
      } catch {
        /* ignore */
      }
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      restoreFromCache();
      return;
    }

    const { data, error } = await supabase
      .from("workspace_members")
      .select(
        "role, status, tab_permissions, workspaces(id, name, invite_code, invite_code_viewer, invite_code_admin, invite_code_custom, owner_id, main_title, subtitle, print_title)",
      )
      .eq("user_id", user.id);

    if (error) {
      console.warn("Impossible de charger les équipes", error.message);
      restoreFromCache();
      return;
    }

    const list: WorkspaceMembership[] = (data ?? [])
      .filter((row) => row.workspaces)
      .map((row) => {
        const ws = row.workspaces as unknown as Partial<Workspace> & {
          id: string;
          name: string;
          invite_code: string;
          owner_id: string;
        };
        return {
          id: ws.id,
          name: ws.name,
          invite_code: ws.invite_code,
          invite_code_viewer: ws.invite_code_viewer ?? "",
          invite_code_admin: ws.invite_code_admin ?? "",
          invite_code_custom: ws.invite_code_custom ?? "",
          owner_id: ws.owner_id,
          main_title: ws.main_title ?? DEFAULT_TITLES.main_title,
          subtitle: ws.subtitle ?? DEFAULT_TITLES.subtitle,
          print_title: ws.print_title ?? DEFAULT_TITLES.print_title,
          role: row.role as WorkspaceRole,
          status:
            ((row as { status?: string }).status as MembershipStatus) ?? "active",
          tab_permissions: parseTabPermissions(
            (row as { tab_permissions?: unknown }).tab_permissions,
          ),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setAllMemberships(list);
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }, [user]);


  const memberships = useMemo(
    () => allMemberships.filter((m) => m.status === "active"),
    [allMemberships],
  );
  const pendingMemberships = useMemo(
    () => allMemberships.filter((m) => m.status === "pending"),
    [allMemberships],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      await refreshMemberships();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMemberships]);

  useEffect(() => {
    if (loading) return;
    if (!memberships.length) {
      setActiveWorkspaceIdState(null);
      return;
    }
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    const valid =
      (activeWorkspaceId && memberships.some((m) => m.id === activeWorkspaceId) && activeWorkspaceId) ||
      (stored && memberships.some((m) => m.id === stored) && stored) ||
      memberships[0].id;
    if (valid !== activeWorkspaceId) setActiveWorkspaceIdState(valid);
  }, [loading, memberships, activeWorkspaceId]);

  const activeWorkspace = useMemo(
    () => memberships.find((m) => m.id === activeWorkspaceId) ?? null,
    [memberships, activeWorkspaceId],
  );

  const refreshMembers = useCallback(async () => {
    if (!activeWorkspaceId) {
      setMembers([]);
      return;
    }
    const { data, error } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, status, joined_at, tab_permissions")
      .eq("workspace_id", activeWorkspaceId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.warn("Impossible de charger les membres", error.message);
      return;
    }

    const rows = data ?? [];
    const ids = rows.map((r) => r.user_id);
    const profileMap = new Map<string, { display_name: string | null }>();
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      for (const pr of profiles ?? []) {
        profileMap.set(pr.id, { display_name: pr.display_name });
      }
    }

    const { data: authData } = await supabase.auth.getUser();
    const selfId = authData.user?.id ?? null;
    const selfEmail = authData.user?.email ?? null;

    const list: Member[] = rows.map((row) => {
      const profile = profileMap.get(row.user_id);
      return {
        id: row.id,
        user_id: row.user_id,
        role: row.role as WorkspaceRole,
        status: ((row as { status?: string }).status as MembershipStatus) ?? "active",
        joined_at: row.joined_at,
        display_name: profile?.display_name ?? null,
        email: row.user_id === selfId ? selfEmail : null,
        tab_permissions: parseTabPermissions(
          (row as { tab_permissions?: unknown }).tab_permissions,
        ),
      };
    });
    setMembers(list);
  }, [activeWorkspaceId]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  // Retour du réseau : rafraîchir la liste des équipes mise en cache hors ligne.
  useEffect(() => {
    const onOnline = () => {
      void refreshMemberships();
      void refreshMembers();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refreshMemberships, refreshMembers]);



  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`workspace-members-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_members" },
        () => {
          void refreshMemberships();
          void refreshMembers();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshMemberships, refreshMembers]);

  const createWorkspace = useCallback(
    async (name: string, titles?: WorkspaceTitles): Promise<WorkspaceMembership> => {
      const { data, error } = await supabase.rpc("create_workspace", { _name: name });
      if (error) throw new Error(error.message);
      const ws = data as unknown as Workspace;
      const patch: WorkspaceTitles = {};
      if (titles?.main_title?.trim()) patch.main_title = titles.main_title.trim();
      if (titles?.subtitle?.trim()) patch.subtitle = titles.subtitle.trim();
      if (titles?.print_title?.trim()) patch.print_title = titles.print_title.trim();
      if (Object.keys(patch).length) {
        const { error: upErr } = await supabase
          .from("workspaces")
          .update(patch)
          .eq("id", ws.id);
        if (upErr) console.warn("Titres personnalisés non enregistrés", upErr.message);
      }
      await refreshMemberships();
      setActiveWorkspaceId(ws.id);
      return {
        ...ws,
        main_title: patch.main_title ?? ws.main_title ?? DEFAULT_TITLES.main_title,
        subtitle: patch.subtitle ?? ws.subtitle ?? DEFAULT_TITLES.subtitle,
        print_title: patch.print_title ?? ws.print_title ?? DEFAULT_TITLES.print_title,
        role: "owner",
        status: "active",
        tab_permissions: null,
      };
    },
    [refreshMemberships, setActiveWorkspaceId],
  );

  const joinWorkspace = useCallback(
    async (code: string): Promise<WorkspaceMembership> => {
      const { data, error } = await supabase.rpc("join_workspace", { _code: code });
      if (error) throw new Error(error.message);
      await refreshMemberships();
      const ws = data as unknown as Workspace;
      return {
        ...ws,
        invite_code_viewer: ws.invite_code_viewer ?? "",
        invite_code_admin: ws.invite_code_admin ?? "",
        invite_code_custom: ws.invite_code_custom ?? "",
        main_title: ws.main_title ?? DEFAULT_TITLES.main_title,
        subtitle: ws.subtitle ?? DEFAULT_TITLES.subtitle,
        print_title: ws.print_title ?? DEFAULT_TITLES.print_title,
        role: "editor",
        status: "pending",
        tab_permissions: null,
      };
    },
    [refreshMemberships],
  );

  const renameWorkspace = useCallback(
    async (name: string) => {
      if (!activeWorkspaceId) return;
      const { error } = await supabase
        .from("workspaces")
        .update({ name })
        .eq("id", activeWorkspaceId);
      if (error) throw new Error(error.message);
      await refreshMemberships();
    },
    [activeWorkspaceId, refreshMemberships],
  );

  const updateWorkspaceTitles = useCallback(
    async (titles: WorkspaceTitles) => {
      if (!activeWorkspaceId) return;
      const patch: WorkspaceTitles = {};
      if (typeof titles.main_title === "string")
        patch.main_title = titles.main_title.trim() || DEFAULT_TITLES.main_title;
      if (typeof titles.subtitle === "string")
        patch.subtitle = titles.subtitle.trim() || DEFAULT_TITLES.subtitle;
      if (typeof titles.print_title === "string")
        patch.print_title = titles.print_title.trim() || DEFAULT_TITLES.print_title;
      if (!Object.keys(patch).length) return;
      const { error } = await supabase
        .from("workspaces")
        .update(patch)
        .eq("id", activeWorkspaceId);
      if (error) throw new Error(error.message);
      await refreshMemberships();
    },
    [activeWorkspaceId, refreshMemberships],
  );

  const regenerateInviteCode = useCallback(
    async (level: InviteLevel = "editor") => {
      if (!activeWorkspaceId) throw new Error("Aucune équipe active");
      const { data, error } = await supabase.rpc("regenerate_invite_code", {
        _workspace: activeWorkspaceId,
        _level: level,
      });
      if (error) throw new Error(error.message);
      await refreshMemberships();
      return data as unknown as string;
    },
    [activeWorkspaceId, refreshMemberships],
  );

  const updateMemberRole = useCallback(
    async (userId: string, role: WorkspaceRole) => {
      if (!activeWorkspaceId) return;
      const patch: { role: WorkspaceRole; tab_permissions?: TabPermissions } = { role };
      if (role === "custom") patch.tab_permissions = defaultTabPermissions();
      const { error } = await supabase
        .from("workspace_members")
        .update(patch as never)
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      await refreshMembers();
    },
    [activeWorkspaceId, refreshMembers],
  );

  const updateMemberTabPermissions = useCallback(
    async (userId: string, perms: TabPermissions) => {
      if (!activeWorkspaceId) return;
      const { error } = await supabase
        .from("workspace_members")
        .update({ role: "custom", tab_permissions: perms as never })
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      await refreshMembers();
    },
    [activeWorkspaceId, refreshMembers],
  );

  const removeMember = useCallback(
    async (userId: string) => {
      if (!activeWorkspaceId) return;
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      await refreshMembers();
    },
    [activeWorkspaceId, refreshMembers],
  );

  const approveMember = useCallback(
    async (userId: string) => {
      if (!activeWorkspaceId) return;
      const { error } = await supabase
        .from("workspace_members")
        .update({ status: "active" })
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      await refreshMembers();
    },
    [activeWorkspaceId, refreshMembers],
  );

  const rejectMember = useCallback(
    async (userId: string) => {
      if (!activeWorkspaceId) return;
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", userId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      await refreshMembers();
    },
    [activeWorkspaceId, refreshMembers],
  );

  const cancelPending = useCallback(
    async (workspaceId: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
      await refreshMemberships();
    },
    [user, refreshMemberships],
  );

  const leaveWorkspace = useCallback(async () => {
    if (!activeWorkspaceId || !user) return;
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", activeWorkspaceId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    setActiveWorkspaceIdState(null);
    await refreshMemberships();
  }, [activeWorkspaceId, user, refreshMemberships]);

  const refreshBlocklist = useCallback(async () => {
    if (!activeWorkspaceId) {
      setBlocklist([]);
      return;
    }
    const { data, error } = await supabase
      .from("workspace_email_blocklist")
      .select("id, email, reason, created_at")
      .eq("workspace_id", activeWorkspaceId)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("Impossible de charger la liste noire", error.message);
      return;
    }
    setBlocklist((data ?? []) as BlocklistEntry[]);
  }, [activeWorkspaceId]);

  const refreshAccessLog = useCallback(async () => {
    if (!activeWorkspaceId) {
      setAccessLog([]);
      return;
    }
    const { data, error } = await supabase
      .from("workspace_access_log")
      .select("id, action, target_email, target_user_id, actor_id, details, created_at")
      .eq("workspace_id", activeWorkspaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.warn("Impossible de charger le journal", error.message);
      return;
    }
    setAccessLog((data ?? []) as AccessLogEntry[]);
  }, [activeWorkspaceId]);

  useEffect(() => {
    void refreshBlocklist();
    void refreshAccessLog();
  }, [refreshBlocklist, refreshAccessLog]);

  const logAction = useCallback(
    async (action: string, extra: Partial<AccessLogEntry> = {}) => {
      if (!activeWorkspaceId || !user) return;
      await supabase.from("workspace_access_log").insert({
        workspace_id: activeWorkspaceId,
        actor_id: user.id,
        target_user_id: extra.target_user_id ?? null,
        target_email: extra.target_email ?? null,
        details: (extra.details ?? null) as never,
        action,
      });
      void refreshAccessLog();
    },
    [activeWorkspaceId, user, refreshAccessLog],
  );

  const blockMember = useCallback(
    async (userId: string) => {
      if (!activeWorkspaceId) return;
      const target = members.find((m) => m.user_id === userId);
      const { error } = await supabase
        .from("workspace_members")
        .update({ status: "blocked" })
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      await refreshMembers();
      await logAction("member_blocked", {
        target_user_id: userId,
        target_email: target?.email ?? null,
      });
    },
    [activeWorkspaceId, members, refreshMembers, logAction],
  );

  const unblockMember = useCallback(
    async (userId: string) => {
      if (!activeWorkspaceId) return;
      const target = members.find((m) => m.user_id === userId);
      const { error } = await supabase
        .from("workspace_members")
        .update({ status: "active" })
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      await refreshMembers();
      await logAction("member_unblocked", {
        target_user_id: userId,
        target_email: target?.email ?? null,
      });
    },
    [activeWorkspaceId, members, refreshMembers, logAction],
  );

  const addBlockedEmail = useCallback(
    async (email: string, reason?: string) => {
      if (!activeWorkspaceId) return;
      const clean = email.trim().toLowerCase();
      if (!clean) throw new Error("Email vide");
      const { error } = await supabase.from("workspace_email_blocklist").insert({
        workspace_id: activeWorkspaceId,
        email: clean,
        reason: reason ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      await refreshBlocklist();
      await logAction("email_banned", { target_email: clean });
    },
    [activeWorkspaceId, user, refreshBlocklist, logAction],
  );

  const removeBlockedEmail = useCallback(
    async (id: string) => {
      const entry = blocklist.find((b) => b.id === id);
      const { error } = await supabase
        .from("workspace_email_blocklist")
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
      await refreshBlocklist();
      if (entry) await logAction("email_unbanned", { target_email: entry.email });
    },
    [blocklist, refreshBlocklist, logAction],
  );

  const activeMembers = useMemo(() => members.filter((m) => m.status === "active"), [members]);
  const pendingMembers = useMemo(() => members.filter((m) => m.status === "pending"), [members]);
  const blockedMembers = useMemo(() => members.filter((m) => m.status === "blocked"), [members]);

  const role = activeWorkspace?.role ?? null;
  const isOwner = role === "owner";
  const isAdmin = role === "owner" || role === "admin";

  const canViewTab = useCallback(
    (tab: TabKey): boolean => {
      if (!role) return false;
      if (ALWAYS_VISIBLE.includes(tab)) return true;
      if (role === "owner" || role === "admin" || role === "editor" || role === "viewer") return true;
      // custom
      const perms = activeWorkspace?.tab_permissions ?? {};
      const p = perms[tab] ?? "read";
      return p !== "hidden";
    },
    [role, activeWorkspace],
  );

  const canEditTab = useCallback(
    (tab: TabKey): boolean => {
      if (!role) return false;
      // Team/help are never "edit-writable" for the planning store itself; team
      // actions have their own permission checks server-side and help is static.
      if (role === "owner" || role === "admin" || role === "editor") return true;
      if (role === "viewer") return false;
      // custom
      const perms = activeWorkspace?.tab_permissions ?? {};
      return (perms[tab] ?? "read") === "edit";
    },
    [role, activeWorkspace],
  );

  const canEdit = useMemo(() => {
    if (role === "owner" || role === "admin" || role === "editor") return true;
    if (role === "viewer" || !role) return false;
    const perms = activeWorkspace?.tab_permissions ?? {};
    return ALL_TABS.some((t) => (perms[t] ?? "read") === "edit");
  }, [role, activeWorkspace]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      loading,
      memberships,
      pendingMemberships,
      activeWorkspace,
      activeWorkspaceId,
      setActiveWorkspaceId,
      role,
      canEdit,
      isOwner,
      isAdmin,
      canViewTab,
      canEditTab,
      members: activeMembers,
      pendingMembers,
      blockedMembers,
      blocklist,
      accessLog,
      refreshMemberships,
      refreshMembers,
      refreshBlocklist,
      refreshAccessLog,
      createWorkspace,
      joinWorkspace,
      renameWorkspace,
      updateWorkspaceTitles,
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
      cancelPending,
      leaveWorkspace,
    }),
    [
      loading,
      memberships,
      pendingMemberships,
      activeWorkspace,
      activeWorkspaceId,
      setActiveWorkspaceId,
      role,
      canEdit,
      isOwner,
      isAdmin,
      canViewTab,
      canEditTab,
      activeMembers,
      pendingMembers,
      blockedMembers,
      blocklist,
      accessLog,
      refreshMemberships,
      refreshMembers,
      refreshBlocklist,
      refreshAccessLog,
      createWorkspace,
      joinWorkspace,
      renameWorkspace,
      updateWorkspaceTitles,
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
      cancelPending,
      leaveWorkspace,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
