import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Planning des agents" },
      {
        name: "description",
        content: "Connectez-vous ou créez un compte pour accéder au planning des agents.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const explainAuthError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes("already") || lower.includes("registered")) {
      setMode("signin");
      return "Ce compte existe déjà. Passez sur Connexion et utilisez le mot de passe choisi lors de la création.";
    }
    if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
      return "Email ou mot de passe incorrect. Si ce compte a été créé avec Google, utilisez le bouton Google.";
    }
    if (lower.includes("email not confirmed")) {
      return "Ce compte attendait une confirmation email. Réessayez de créer le compte avec un autre email, ou contactez l’administrateur.";
    }
    return message;
  };

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/app", search: { tab: "planning" }, replace: true });
    }
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
            options: {
              emailRedirectTo: window.location.origin,
              data: { display_name: displayName || email.split("@")[0] },
            },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Compte créé", { description: "Vous êtes connecté." });
          navigate({ to: "/" });
          return;
        }
        toast.success("Compte créé", {
          description: "Vous pouvez maintenant vous connecter avec cet email et ce mot de passe.",
        });
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error("Échec", {
        description: err instanceof Error ? explainAuthError(err.message) : "Une erreur est survenue.",
      });
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Connexion Google impossible", {
          description: result.error.message ?? "Réessayez plus tard.",
        });
        setBusy(false);
        return;
      }
      if (result.redirected) return;
    } catch {
      toast.error("Connexion Google impossible");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/20 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays className="size-6" />
          </div>
          <h1 className="mt-3 text-xl font-bold">Planning des agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connectez-vous pour accéder à votre équipe.
          </p>
        </div>

        <OfflineNotice />



        <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Inscription</TabsTrigger>
          </TabsList>

          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <TabsContent value="signup" className="mt-0 space-y-2">
              <Label htmlFor="name">Nom affiché</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Prénom Nom"
                autoComplete="name"
              />
            </TabsContent>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "signup" ? "Créer mon compte" : "Se connecter"}
            </Button>
          </form>
        </Tabs>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={onGoogle} disabled={busy}>
          <GoogleIcon /> Continuer avec Google
        </Button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
