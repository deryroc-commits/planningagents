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
export type MembershipStatus = "active" | "pending";

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
  refreshMemberships: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  createWorkspace: (name: string) => Promise<WorkspaceMembership>;
  joinWorkspace: (code: string) => Promise<WorkspaceMembership>;
  renameWorkspace: (name: string) => Promise<void>;
  regenerateInviteCode: () => Promise<string>;
  updateMemberRole: (userId: string, role: WorkspaceRole) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  approveMember: (userId: string) => Promise<void>;
  rejectMember: (userId: string) => Promise<void>;
  cancelPending: (workspaceId: string) => Promise<void>;
  leaveWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const ACTIVE_KEY = "planning-active-workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
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
      setMemberships([]);
      return;
    }
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspaces(id, name, invite_code, owner_id)")
      .eq("user_id", user.id);

    if (error) {
      console.warn("Impossible de charger les équipes", error.message);
      return;
    }

    const list: WorkspaceMembership[] = (data ?? [])
      .filter((row) => row.workspaces)
      .map((row) => {
        const ws = row.workspaces as unknown as Workspace;
        return { ...ws, role: row.role as WorkspaceRole };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setMemberships(list);
  }, [user]);

  // Initial load of memberships.
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

  // Keep a valid active workspace selected.
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
      .select("id, user_id, role, joined_at")
      .eq("workspace_id", activeWorkspaceId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.warn("Impossible de charger les membres", error.message);
      return;
    }

    const rows = data ?? [];
    // workspace_members has no FK to profiles (it references auth.users), so
    // fetch the matching profiles separately and merge them in.
    // Email addresses are private: co-members only expose their display name,
    // so we never read the `email` column here (RLS blocks it anyway). The
    // current user's own email comes from their authenticated session.
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

  // Realtime: refresh members when membership rows for the active workspace change.
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const channel = supabase
      .channel(`workspace-members-${activeWorkspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        () => {
          void refreshMembers();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, refreshMembers]);

  const createWorkspace = useCallback(
    async (name: string) => {
      const { data, error } = await supabase.rpc("create_workspace", { _name: name });
      if (error) throw new Error(error.message);
      await refreshMemberships();
      const ws = data as unknown as Workspace;
      setActiveWorkspaceId(ws.id);
      return { ...ws, role: "owner" as WorkspaceRole };
    },
    [refreshMemberships, setActiveWorkspaceId],
  );

  const joinWorkspace = useCallback(
    async (code: string) => {
      const { data, error } = await supabase.rpc("join_workspace", { _code: code });
      if (error) throw new Error(error.message);
      await refreshMemberships();
      const ws = data as unknown as Workspace;
      setActiveWorkspaceId(ws.id);
      return { ...ws, role: "editor" as WorkspaceRole };
    },
    [refreshMemberships, setActiveWorkspaceId],
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

  const role = activeWorkspace?.role ?? null;

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      loading,
      memberships,
      activeWorkspace,
      activeWorkspaceId,
      setActiveWorkspaceId,
      role,
      canEdit: role === "owner" || role === "editor",
      isOwner: role === "owner",
      members,
      refreshMemberships,
      refreshMembers,
      createWorkspace,
      joinWorkspace,
      renameWorkspace,
      regenerateInviteCode,
      updateMemberRole,
      removeMember,
      leaveWorkspace,
    }),
    [
      loading,
      memberships,
      activeWorkspace,
      activeWorkspaceId,
      setActiveWorkspaceId,
      role,
      members,
      refreshMemberships,
      refreshMembers,
      createWorkspace,
      joinWorkspace,
      renameWorkspace,
      regenerateInviteCode,
      updateMemberRole,
      removeMember,
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
