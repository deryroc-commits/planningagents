import { useEffect, useState } from "react";
import { Check, Copy, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  appRedirectUrl,
  authorizedOrigins,
  detectEnvironment,
  environmentLabel,
  providerCallbackUrl,
} from "@/lib/auth/oauth-config";

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-md bg-muted px-2 py-1 text-xs">{value}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Copier ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copié");
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

/**
 * Récapitulatif des URI OAuth de l'environnement courant, à recopier tels quels
 * chez le fournisseur d'identité pour éviter l'erreur redirect_uri_mismatch.
 */
export function OAuthEnvironmentCard() {
  const [open, setOpen] = useState(false);
  // Le nom d'hôte n'est connu qu'après hydratation (rendu serveur sans `window`).
  const [env, setEnv] = useState(() => detectEnvironment(""));

  useEffect(() => {
    setEnv(detectEnvironment());
  }, []);

  return (
    <div className="rounded-lg border bg-card p-3 text-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 font-medium">
          <Settings2 className="h-4 w-4" />
          Configuration OAuth — {environmentLabel(env)}
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Masquer" : "Afficher"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <CopyRow label="Origine JavaScript autorisée" value={authorizedOrigins()[0] ?? ""} />
          <CopyRow label="Retour dans l'application" value={appRedirectUrl()} />
          <CopyRow label="URI de redirection autorisé (à coller chez Google)" value={providerCallbackUrl()} />
          <p className="text-xs text-muted-foreground">
            Chez Google Auth Platform, l'URI de redirection doit être <strong>exactement</strong> la
            dernière valeur ci-dessus, identique pour le développement, la préversion et la
            production. Seule l'origine JavaScript change selon l'environnement : ajoutez celle de
            chaque domaine que vous utilisez.
          </p>
        </div>
      )}
    </div>
  );
}
