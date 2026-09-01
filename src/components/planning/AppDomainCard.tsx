import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  Link2,
  RotateCcw,
  Check,
  AlertCircle,
  Lock,
  LockOpen,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { verifyDomainAdmin } from "@/lib/domain-lock.functions";

const QR_BASE_URL_KEY = "qr_base_url";
const CANONICAL_BASE_URL = "https://planningdesagents.duvalericlabs.com";

function getDefaultBaseUrl(): string {
  // Priorité au domaine actuellement utilisé (ex. https://planningagentsucpa.lovable.app)
  if (typeof window !== "undefined" && /^https?:$/.test(window.location.protocol)) {
    return window.location.origin.replace(/\/+$/, "");
  }
  const env = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_PUBLIC_APP_URL;
  if (env && /^https?:\/\//i.test(env)) return env.replace(/\/+$/, "");
  return CANONICAL_BASE_URL;
}

function readStoredBaseUrl(): string {
  if (typeof window === "undefined") return getDefaultBaseUrl();
  const v = window.localStorage.getItem(QR_BASE_URL_KEY);
  return v && /^https?:\/\//i.test(v) ? v.replace(/\/+$/, "") : getDefaultBaseUrl();
}

function isValidHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function AppDomainCard() {
  const [baseUrl, setBaseUrl] = useState<string>(() => readStoredBaseUrl());
  const [baseUrlInput, setBaseUrlInput] = useState<string>(() => readStoredBaseUrl());
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const verify = useServerFn(verifyDomainAdmin);

  const baseUrlValid = isValidHttpUrl(baseUrlInput);
  const defaultBaseUrl = getDefaultBaseUrl();

  const handleUnlock = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await verify({ data: { email, password } });
      if (res.ok) {
        setUnlocked(true);
        setPassword("");
        toast.success("Session autorisée — modification du domaine possible.");
      } else {
        toast.error(res.error ?? "Identifiants non autorisés");
      }
    } catch {
      toast.error("Vérification impossible. Réessayez.");
    } finally {
      setChecking(false);
    }
  }, [checking, email, password, verify]);

  const handleLock = useCallback(() => {
    setUnlocked(false);
    setEmail("");
    setPassword("");
    const stored = readStoredBaseUrl();
    setBaseUrl(stored);
    setBaseUrlInput(stored);
  }, []);

  const saveBaseUrl = useCallback(() => {
    if (!unlocked) {
      toast.error("Déverrouillez d'abord avec le compte autorisé.");
      return;
    }
    if (!baseUrlValid) return;
    const cleaned = baseUrlInput.replace(/\/+$/, "");
    window.localStorage.setItem(QR_BASE_URL_KEY, cleaned);
    setBaseUrl(cleaned);
    setBaseUrlInput(cleaned);
    toast.success("Domaine de l'application enregistré.");
  }, [baseUrlInput, baseUrlValid, unlocked]);

  const resetBaseUrl = useCallback(() => {
    if (!unlocked) {
      toast.error("Déverrouillez d'abord avec le compte autorisé.");
      return;
    }
    window.localStorage.removeItem(QR_BASE_URL_KEY);
    const d = getDefaultBaseUrl();
    setBaseUrl(d);
    setBaseUrlInput(d);
    toast.success("URL par défaut rétablie.");
  }, [unlocked]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-primary" />
        <h3 className="text-base font-semibold">Domaine de l'application</h3>
        {unlocked ? (
          <LockOpen className="size-4 text-primary" aria-label="Déverrouillé" />
        ) : (
          <Lock className="size-4 text-muted-foreground" aria-label="Verrouillé" />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Domaine utilisé par l'application (Lovable ou domaine personnalisé). Il sert notamment
        aux liens partagés et aux QR codes générés ensuite. Valeur stockée localement, prioritaire
        sur <code className="rounded bg-muted px-1">VITE_PUBLIC_APP_URL</code> puis sur le domaine canonique.
      </p>

      {!unlocked ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Lock className="size-3.5 text-muted-foreground" /> Accès protégé
          </div>
          <p className="text-xs text-muted-foreground">
            Seul le compte autorisé peut modifier le domaine.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="E-mail"
              className="min-w-52 flex-1"
              autoComplete="username"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Mot de passe"
              className="min-w-52 flex-1"
              autoComplete="current-password"
            />
            <Button onClick={handleUnlock} disabled={checking || !email || !password}>
              {checking ? <Loader2 className="animate-spin" /> : <LockOpen />}
              {checking ? "Vérification…" : "Déverrouiller"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <ShieldCheck className="size-4 text-primary" />
            Session autorisée — modification du domaine possible
          </div>
          <Button variant="outline" size="sm" onClick={handleLock}>
            <Lock /> Verrouiller
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={baseUrlInput}
          onChange={(e) => setBaseUrlInput(e.target.value)}
          placeholder="https://mon-domaine.com"
          className="min-w-64 flex-1"
          aria-invalid={!baseUrlValid}
          disabled={!unlocked}
          readOnly={!unlocked}
        />
        <Button
          onClick={saveBaseUrl}
          disabled={!unlocked || !baseUrlValid || baseUrlInput.replace(/\/+$/, "") === baseUrl}
        >
          <Check /> Enregistrer
        </Button>
        <Button
          variant="outline"
          onClick={resetBaseUrl}
          disabled={!unlocked}
          title={`Par défaut : ${defaultBaseUrl}`}
        >
          <RotateCcw /> Réinitialiser
        </Button>
      </div>
      {!baseUrlValid ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="size-3.5" /> URL invalide (doit commencer par http:// ou https://).
        </div>
      ) : (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
          <span className="text-muted-foreground">Aperçu : </span>
          <span className="font-mono text-foreground break-all">{baseUrl}/p/&lt;token&gt;</span>
        </div>
      )}
    </div>
  );
}
