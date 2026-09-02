/**
 * Configuration OAuth multi-environnements.
 *
 * Détecte automatiquement l'environnement courant (développement, preview,
 * production) et en déduit l'origine autorisée ainsi que l'URL de retour à
 * utiliser pour les connexions sociales. L'URI de redirection déclarée chez le
 * fournisseur (Google / Microsoft / Apple) reste toujours la même : c'est le
 * point de retour du service d'authentification, jamais l'origine de l'app.
 */

export type AppEnvironment = "development" | "preview" | "production";

const LOVABLE_PREVIEW = /(^|\.)id-preview--|-dev\.lovable\.app$/i;

export function detectEnvironment(hostname = getHostname()): AppEnvironment {
  const host = hostname.toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return "development";
  }
  if (LOVABLE_PREVIEW.test(host)) return "preview";
  if (host.endsWith(".vercel.app") && host.split(".")[0]?.includes("-git-")) return "preview";
  if (/-[a-z0-9]{9,}\.vercel\.app$/i.test(host)) return "preview";
  return "production";
}

function getHostname(): string {
  return typeof window === "undefined" ? "" : window.location.hostname;
}

/** Origine courante, sans slash final (chaîne vide côté serveur). */
export function currentOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/\/+$/, "");
}

/** True si l'app tourne sur un domaine Lovable (broker /~oauth disponible). */
export function isLovableHosted(hostname = getHostname()): boolean {
  return hostname.toLowerCase().endsWith(".lovable.app");
}

/** URL de retour dans l'application après authentification. */
export function appRedirectUrl(path = "/"): string {
  const origin = currentOrigin();
  return origin ? `${origin}${path}` : path;
}

/**
 * URI de redirection à déclarer **à l'identique** dans Google Auth Platform
 * (et Microsoft / Apple) : c'est le callback du service d'authentification,
 * identique pour tous les environnements.
 */
export function providerCallbackUrl(): string {
  const base = (import.meta.env['VITE_SUPABASE_URL'] as string | undefined) ?? "";
  return base ? `${base.replace(/\/+$/, "")}/auth/v1/callback` : "";
}

/** Origines JavaScript à autoriser côté fournisseur pour cet environnement. */
export function authorizedOrigins(): string[] {
  const origin = currentOrigin();
  return origin ? [origin] : [];
}

export function environmentLabel(env: AppEnvironment = detectEnvironment()): string {
  return env === "development" ? "Développement" : env === "preview" ? "Préversion" : "Production";
}
