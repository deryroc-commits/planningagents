import { createFileRoute } from "@tanstack/react-router";
import { PlanningProvider } from "@/lib/planning/store";
import { PlanningApp } from "@/components/planning/PlanningApp";

type AppSearch = { tab: string };

const VALID_TABS = ["planning", "stats", "rotation", "params", "agents", "print"];

export const Route = createFileRoute("/app")({
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

function AppRoute() {
  const { tab } = Route.useSearch();
  return (
    <PlanningProvider>
      <PlanningApp initialTab={tab} />
    </PlanningProvider>
  );
}
