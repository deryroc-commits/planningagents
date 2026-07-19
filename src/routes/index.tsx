import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-context";

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
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (session) {
      navigate({ to: "/app", replace: true });
    } else {
      navigate({ to: "/auth", replace: true });
    }
  }, [session, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}
