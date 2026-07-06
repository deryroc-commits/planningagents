import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { PlanningProvider } from "@/lib/planning/store";
import { PlanningApp } from "@/components/planning/PlanningApp";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace/workspace-context";
import { WorkspaceOnboarding } from "@/components/workspace/WorkspaceOnboarding";
import { useAuth } from "@/lib/auth/auth-context";

type AppSearch = { tab: string };

const VALID_TABS = [
  "planning",
  "stats",
  "rotation",
  "params",
  "agents",
  "mods",
  "overtime",
  "print",
  "team",
];

export const Route = createFileRoute("/app")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): AppSearch => {
    const tab = String(search.tab ?? "planning");
    return { tab: VALID_TABS.includes(tab) ? tab : "planning" };
  },
  head: () => ({
    meta: [
      { title: "Planning des agents — UCPA" },
      {
        name: "description",
        content:
          "Grille de planning annuel type Excel : saisie contrôlée, calcul automatique des heures, jours fériés et week-ends colorés, impression et export.",
      },
      { property: "og:title", content: "Planning des agents — UCPA" },
      {
        property: "og:description",
        content:
          "Planning annuel type Excel : saisie contrôlée, calcul des heures, jours fériés, impression et export.",
      },
    ],
  }),
  component: AppRoute,
});

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}

function AppRoute() {
  const { tab } = Route.useSearch();
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth" });
    }
  }, [loading, session, navigate]);

  if (loading || !session) return <Spinner />;

  return (
    <WorkspaceProvider>
      <WorkspaceGate tab={tab} />
    </WorkspaceProvider>
  );
}

function WorkspaceGate({ tab }: { tab: string }) {
  const { loading, memberships, activeWorkspaceId, canEdit } = useWorkspace();

  if (loading) return <Spinner />;
  if (!memberships.length || !activeWorkspaceId) return <WorkspaceOnboarding />;

  return (
    <PlanningProvider key={activeWorkspaceId} workspaceId={activeWorkspaceId} writable={canEdit}>
      <PlanningApp initialTab={tab} />
    </PlanningProvider>
  );
}
