import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarRange,
  Settings2,
  Users,
  Printer,
  ArrowRight,
} from "lucide-react";
import homeHero from "@/assets/home-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Planning agents UCPA — Cuisine centrale" },
      {
        name: "description",
        content:
          "Application de gestion du planning annuel des agents de la cuisine centrale UCPA : planning général, paramètres, base agents et impression.",
      },
      { property: "og:title", content: "Planning agents UCPA — Cuisine centrale" },
      {
        property: "og:description",
        content:
          "Gestion du planning annuel des agents UCPA : planning général, paramètres, base agents, impression.",
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
  },
  {
    label: "Paramètres",
    description: "Codes, libellés, heures et catégories de couleur.",
    icon: Settings2,
    tab: "params",
  },
  {
    label: "Base Agents",
    description: "Gestion des agents et de leurs équipes.",
    icon: Users,
    tab: "agents",
  },
  {
    label: "Impression",
    description: "Aperçu mensuel prêt à imprimer ou exporter en PDF.",
    icon: Printer,
    tab: "print",
  },
] as const;

function HomePage() {
  return (
    <div className="min-h-screen home-bg">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:py-16">
        {/* Navigation buttons */}
        <div className="space-y-4">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Cuisine Centrale — UCPA
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              Planning des agents
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Planification annuelle type Excel : choisissez une section pour
              commencer.
            </p>
          </div>

          {NAV.map((item) => (
            <Link
              key={item.tab}
              to="/app"
              search={{ tab: item.tab }}
              className="home-btn group flex items-center gap-4 rounded-xl px-5 py-4"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/20">
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

        {/* Hero illustration */}
        <div className="hidden lg:block">
          <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-xl backdrop-blur">
            <img
              src={homeHero}
              alt="Illustration planning cuisine centrale UCPA"
              width={1024}
              height={768}
              className="w-full rounded-2xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
