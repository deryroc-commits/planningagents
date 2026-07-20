import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarRange,
  Settings2,
  Users,
  Printer,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Clock,
  Loader2,
} from "lucide-react";
import homeBg from "@/assets/home-bg.png.asset.json";
import { useAuth } from "@/lib/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TITLES } from "@/lib/workspace/workspace-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Planning agents UCPA — Cuisine centrale" },
      {
        name: "description",
        content:
          "Application de gestion du planning annuel des agents de la cuisine centrale UCPA : planning général, statistiques, roulement des week-ends, paramètres, base agents et impression.",
      },
      { property: "og:title", content: "Planning agents UCPA — Cuisine centrale" },
      {
        property: "og:description",
        content:
          "Gestion du planning annuel des agents UCPA : planning général, statistiques, roulement des week-ends, paramètres, base agents, impression.",
      },
    ],
  }),
  component: HomePage,
});

const NAV = [
  {
    label: "Planning Général",
    description: "Grille annuelle, saisie contrôlée et calcul des heures.",
    icon: CalendarRange,
    tab: "planning",
    color: "nav-emerald",
  },
  {
    label: "Statistiques",
    description: "Heures et postes analysés par agent, par mois et semaine.",
    icon: BarChart3,
    tab: "stats",
    color: "nav-indigo",
  },
  {
    label: "Roulement week-ends",
    description: "Cycle de base (1 week-end sur N) généré sur l'année.",
    icon: CalendarClock,
    tab: "rotation",
    color: "nav-amber",
  },
  {
    label: "Paramètres",
    description: "Codes, libellés, heures et catégories de couleur.",
    icon: Settings2,
    tab: "params",
    color: "nav-rose",
  },
  {
    label: "Base Agents",
    description: "Gestion des agents et de leurs équipes.",
    icon: Users,
    tab: "agents",
    color: "nav-emerald",
  },
  {
    label: "Heures supp.",
    description: "Gestion des heures supplémentaires par agent : alertes et export.",
    icon: Clock,
    tab: "overtime",
    color: "nav-amber",
  },
  {
    label: "Impression",
    description: "Aperçu mensuel prêt à imprimer ou exporter en PDF.",
    icon: Printer,
    tab: "print",
    color: "nav-indigo",
  },
  {
    label: "Équipe & partage",
    description: "Membres de l'équipe, rôles et code d'invitation à partager.",
    icon: Users,
    tab: "team",
    color: "nav-rose",
  },
] as const;

function HomePage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${homeBg.url})` }}
    >

      {/* Readability overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/65 via-white/45 to-white/20 backdrop-blur-[1px]" />

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-12">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Cuisine Centrale — UCPA
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            Planning des agents
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Planification annuelle type Excel : choisissez une section pour
            commencer.
          </p>
        </div>

        <div className="space-y-4">
          {NAV.map((item) => (
            <Link
              key={item.tab}
              to="/app"
              search={{ tab: item.tab }}
              className={`nav-btn ${item.color} group flex items-center gap-4 rounded-2xl px-5 py-4`}
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/25">
                <item.icon className="size-6" />
              </span>
              <span className="flex-1">
                <span className="block text-lg font-bold leading-tight">
                  {item.label}
                </span>
                <span className="block text-sm opacity-90">
                  {item.description}
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 opacity-70 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
