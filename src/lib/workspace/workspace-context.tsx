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

export type WorkspaceRole = "owner" | "editor" | "viewer";
export type MembershipStatus = "active" | "pending" | "blocked";

export interface Workspace {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
}

export interface WorkspaceMembership extends Workspace {
  role: WorkspaceRole;
  status: MembershipStatus;
}

export interface Member {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  joined_at: string;
  display_name: string | null;
  email: string | null;
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
  members: Member[];
  pendingMembers: Member[];
  blockedMembers: Member[];
  blocklist: BlocklistEntry[];
  accessLog: AccessLogEntry[];
  refreshMemberships: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshBlocklist: () => Promise<void>;
  refreshAccessLog: () => Promise<void>;
  createWorkspace: (name: string) => Promise<WorkspaceMembership>;
  joinWorkspace: (code: string) => Promise<WorkspaceMembership>;
  renameWorkspace: (name: string) => Promise<void>;
  regenerateInviteCode: () => Promise<string>;
  updateMemberRole: (userId: string, role: WorkspaceRole) => Promise<void>;
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
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, status, workspaces(id, name, invite_code, owner_id)")
      .eq("user_id", user.id);

    if (error) {
      console.warn("Impossible de charger les équipes", error.message);
      return;
    }

    const list: WorkspaceMembership[] = (data ?? [])
      .filter((row) => row.workspaces)
      .map((row) => {
        const ws = row.workspaces as unknown as Workspace;
        return {
          ...ws,
          role: row.role as WorkspaceRole,
          status: ((row as { status?: string }).status as MembershipStatus) ?? "active",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setAllMemberships(list);
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
      .select("id, user_id, role, status, joined_at")
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
      };
    });
    setMembers(list);
  }, [activeWorkspaceId]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

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
    async (name: string): Promise<WorkspaceMembership> => {
      const { data, error } = await supabase.rpc("create_workspace", { _name: name });
      if (error) throw new Error(error.message);
      await refreshMemberships();
      const ws = data as unknown as Workspace;
      setActiveWorkspaceId(ws.id);
      return { ...ws, role: "owner", status: "active" };
    },
    [refreshMemberships, setActiveWorkspaceId],
  );

  const joinWorkspace = useCallback(
    async (code: string): Promise<WorkspaceMembership> => {
      const { data, error } = await supabase.rpc("join_workspace", { _code: code });
      if (error) throw new Error(error.message);
      await refreshMemberships();
      const ws = data as unknown as Workspace;
      return { ...ws, role: "editor", status: "pending" };
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

  const regenerateInviteCode = useCallback(async () => {
    if (!activeWorkspaceId) throw new Error("Aucune équipe active");
    const { data, error } = await supabase.rpc("regenerate_invite_code", {
      _workspace: activeWorkspaceId,
    });
    if (error) throw new Error(error.message);
    await refreshMemberships();
    return data as unknown as string;
  }, [activeWorkspaceId, refreshMemberships]);

  const updateMemberRole = useCallback(
    async (userId: string, role: WorkspaceRole) => {
      if (!activeWorkspaceId) return;
      const { error } = await supabase
        .from("workspace_members")
        .update({ role })
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

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      loading,
      memberships,
      pendingMemberships,
      activeWorkspace,
      activeWorkspaceId,
      setActiveWorkspaceId,
      role,
      canEdit: role === "owner" || role === "editor",
      isOwner: role === "owner",
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
      regenerateInviteCode,
      updateMemberRole,
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
      regenerateInviteCode,
      updateMemberRole,
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
