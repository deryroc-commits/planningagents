import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Link2, RotateCcw, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const QR_BASE_URL_KEY = "qr_base_url";
const CANONICAL_BASE_URL = "https://duvalericlabs.com";

function getDefaultBaseUrl(): string {
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
  const baseUrlValid = isValidHttpUrl(baseUrlInput);
  const defaultBaseUrl = getDefaultBaseUrl();

  const saveBaseUrl = useCallback(() => {
    if (!baseUrlValid) return;
    const cleaned = baseUrlInput.replace(/\/+$/, "");
    window.localStorage.setItem(QR_BASE_URL_KEY, cleaned);
    setBaseUrl(cleaned);
    setBaseUrlInput(cleaned);
    toast.success("Domaine de l'application enregistré.");
  }, [baseUrlInput, baseUrlValid]);

  const resetBaseUrl = useCallback(() => {
    window.localStorage.removeItem(QR_BASE_URL_KEY);
    const d = getDefaultBaseUrl();
    setBaseUrl(d);
    setBaseUrlInput(d);
    toast.success("URL par défaut rétablie.");
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-primary" />
        <h3 className="text-base font-semibold">Domaine de l'application</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Domaine utilisé par l'application (Lovable ou domaine personnalisé). Il sert notamment
        aux liens partagés et aux QR codes générés ensuite. Valeur stockée localement, prioritaire
        sur <code className="rounded bg-muted px-1">VITE_PUBLIC_APP_URL</code> puis sur le domaine canonique.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={baseUrlInput}
          onChange={(e) => setBaseUrlInput(e.target.value)}
          placeholder="https://mon-domaine.com"
          className="min-w-64 flex-1"
          aria-invalid={!baseUrlValid}
        />
        <Button onClick={saveBaseUrl} disabled={!baseUrlValid || baseUrlInput.replace(/\/+$/, "") === baseUrl}>
          <Check /> Enregistrer
        </Button>
        <Button variant="outline" onClick={resetBaseUrl} title={`Par défaut : ${defaultBaseUrl}`}>
          <RotateCcw /> Par défaut
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
