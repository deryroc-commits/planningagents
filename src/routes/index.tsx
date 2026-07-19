import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarDays, LogOut, Loader2, ArrowRight } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";

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

function HomePage() {
  const { session, loading, user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth", replace: true });
    }
  }, [session, loading, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/20 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Planning des agents — UCPA</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bienvenue{user?.email ? `, ${user.email}` : ""}.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg" className="w-full">
            <Link to="/app" search={{ tab: "planning" }}>
              Ouvrir le planning <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link to="/app" search={{ tab: "team" }}>
              Équipe & partage
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => void signOut()}
          >
            <LogOut className="mr-2 size-4" /> Se déconnecter
          </Button>
        </div>
      </div>
    </div>
  );
}
