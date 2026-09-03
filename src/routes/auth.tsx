import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, WifiOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PendingSyncCard } from "@/components/planning/PendingSyncCard";

import { appRedirectUrl, isLovableHosted } from "@/lib/auth/oauth-config";

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

/** Bandeau affiché quand le navigateur n'a pas de réseau. */
function OfflineNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <WifiOff className="mt-0.5 size-4 shrink-0" />
      <span>
        Hors ligne : la connexion à un compte est impossible. Si vous vous êtes déjà connecté sur
        cet appareil, le dernier planning enregistré reste consultable.
      </span>
    </div>
  );
}

const FALLBACK_ORIGIN = "https://planningagentsucpa.lovable.app";

function AuthPage() {

  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  // Domaine personnalisé (hors Lovable / localhost) : détecté côté client.
  const [customDomain, setCustomDomain] = useState(false);
  // Redirection automatique vers l'adresse de secours en cas de blocage réseau.
  const [fallbackRedirect, setFallbackRedirect] = useState(false);
  // Détecte un retour depuis le lien e-mail de réinitialisation.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    if (window.location.hash.includes("type=recovery")) setRecovery(true);
    return () => sub.subscription.unsubscribe();
  }, []);

  // Détection du domaine personnalisé (hydratation sûre : client uniquement).
  useEffect(() => {
    const host = window.location.hostname;
    setCustomDomain(!isLovableHosted() && host !== "localhost" && host !== "127.0.0.1");
  }, []);

  const triggerFallback = () => {
    if (fallbackRedirect) return;
    setFallbackRedirect(true);
    // Petite pause pour laisser le temps de lire le message, puis redirection.
    window.setTimeout(() => {
      window.location.href = `${FALLBACK_ORIGIN}/auth`;
    }, 2500);
  };

  // Sur un domaine personnalisé, vérifie que le backend d'authentification est
  // joignable. Si le réseau professionnel le bloque, redirection automatique
  // vers l'adresse de secours Lovable.
  useEffect(() => {
    if (!customDomain || !navigator.onLine) return;
    const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
    if (!base) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4000);
    fetch(`${base.replace(/\/+$/, "")}/auth/v1/health`, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    })
      .catch(() => triggerFallback())
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customDomain]);

  const isNetworkError = (err: unknown) => {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed") || msg.includes("network request failed");
  };

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
    if (!loading && session && !recovery) {
      navigate({ to: "/app", search: { tab: "planning" }, replace: true });
    }
  }, [loading, session, navigate, recovery]);

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
      if (customDomain && isNetworkError(err)) {
        triggerFallback();
      } else {
        toast.error("Échec", {
          description: err instanceof Error ? explainAuthError(err.message) : "Une erreur est survenue.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const onForgotPassword = async () => {
    if (!email) {
      toast.error("Saisissez votre e-mail, puis cliquez sur « Mot de passe oublié ? ».");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth",
      });
      if (error) throw error;
      toast.success("E-mail envoyé", {
        description: "Cliquez sur le lien reçu pour choisir un nouveau mot de passe.",
      });
    } catch (err) {
      toast.error("Envoi impossible", {
        description: err instanceof Error ? err.message : "Réessayez plus tard.",
      });
    } finally {
      setBusy(false);
    }
  };

  const onSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Mot de passe modifié", { description: "Vous êtes connecté." });
      setRecovery(false);
      navigate({ to: "/app", search: { tab: "planning" }, replace: true });
    } catch (err) {
      toast.error("Échec", {
        description: err instanceof Error ? err.message : "Réessayez plus tard.",
      });
    } finally {
      setBusy(false);
    }
  };

  const onOAuth = async (provider: "google" | "microsoft" | "apple") => {
    const label = provider === "google" ? "Google" : provider === "microsoft" ? "Microsoft" : "Apple";
    setBusy(true);
    try {
      // Google fonctionne en direct (Supabase) sur les domaines personnalisés.
      // Microsoft/Apple passent toujours par le broker Lovable : hors domaines
      // Lovable, on force la redirection vers le domaine lovable.app pour que
      // la connexion aboutisse et que l'utilisateur y soit authentifié.
      if (provider === "google" && !isLovableHosted()) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: appRedirectUrl(),
            queryParams: { prompt: "select_account" },
          },
        });
        if (error) {
          toast.error(`Connexion ${label} impossible`, { description: error.message });
          setBusy(false);
        }
        return;
      }

      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: isLovableHosted()
          ? appRedirectUrl()
          : "https://planningagentsucpa.lovable.app",
        extraParams: provider === "google" ? { prompt: "select_account" } : undefined,
      });
      if (result.error) {
        toast.error(`Connexion ${label} impossible`, {
          description: result.error.message ?? "Réessayez plus tard.",
        });
        setBusy(false);
        return;
      }
      if (result.redirected) return;
    } catch (err) {
      if (customDomain && isNetworkError(err)) {
        triggerFallback();
      } else {
        toast.error(`Connexion ${label} impossible`);
      }
      setBusy(false);
    }
  };

  const fallbackLoginUrl = useMemo(() => {
    const current = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/auth";
    return `https://planningagentsucpa.lovable.app${current}`;
  }, []);

  const showFallbackLink = typeof window !== "undefined" && !isLovableHosted() && window.location.hostname !== "localhost";


  const onGoogle = () => onOAuth("google");
  const onMicrosoft = () => onOAuth("microsoft");
  const onApple = () => onOAuth("apple");

  if (recovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/20 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CalendarDays className="size-6" />
            </div>
            <h1 className="mt-3 text-xl font-bold">Nouveau mot de passe</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choisissez un nouveau mot de passe pour votre compte.
            </p>
          </div>
          <form onSubmit={onSetNewPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || newPassword.length < 6}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Enregistrer le mot de passe
            </Button>
          </form>
        </div>
      </div>
    );
  }

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
        <PendingSyncCard />




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

            {mode === "signin" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  disabled={busy}
                  className="text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}

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
        <Button variant="outline" className="mt-2 w-full" onClick={onMicrosoft} disabled={busy}>
          <MicrosoftIcon /> Continuer avec Microsoft
        </Button>
        <Button variant="outline" className="mt-2 w-full" onClick={onApple} disabled={busy}>
          <AppleIcon /> Continuer avec Apple
        </Button>

        {showFallbackLink && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-medium">Connexion bloquée sur ce domaine ?</p>
            <p className="mt-1">
              Si votre réseau professionnel bloque cette adresse, utilisez l'adresse de secours :
            </p>
            <a
              href={fallbackLoginUrl}
              className="mt-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              Ouvrir planningagentsucpa.lovable.app
              <ArrowRight className="size-3" />
            </a>
          </div>
        )}

      </div>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 23 23" aria-hidden="true">
      <rect width="10" height="10" x="1" y="1" fill="#F25022" />
      <rect width="10" height="10" x="12" y="1" fill="#7FBA00" />
      <rect width="10" height="10" x="1" y="12" fill="#00A4EF" />
      <rect width="10" height="10" x="12" y="12" fill="#FFB900" />
    </svg>
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

function AppleIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.06 1.87-2.54 6.98.22 8.13-.57 1.5-1.31 2.99-2.27 4.08zm-5.85-15.1c.07-2.04 1.76-3.79 3.8-3.92.29 2.32-1.92 4.47-3.8 3.92z" />
    </svg>
  );
}
