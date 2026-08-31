import { useState } from "react";
import { KeyRound, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChangePasswordCard() {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = password.length >= 6 && password === confirm && !busy;

  const onSubmit = async () => {
    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      toast.success("Mot de passe modifié", {
        description: "Utilisez-le dès votre prochaine connexion.",
      });
    } catch (err) {
      toast.error("Échec de la modification", {
        description: err instanceof Error ? err.message : "Réessayez plus tard.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-primary" />
        <h3 className="text-base font-semibold">Mon mot de passe</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Compte connecté : <span className="font-medium text-foreground">{user?.email}</span>.
        Choisissez un nouveau mot de passe (6 caractères minimum). Si le compte a été créé avec
        Google, ce mot de passe permettra aussi de se connecter par e-mail.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nouveau mot de passe"
          className="min-w-52 flex-1"
          autoComplete="new-password"
          minLength={6}
        />
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canSubmit && onSubmit()}
          placeholder="Confirmer le mot de passe"
          className="min-w-52 flex-1"
          autoComplete="new-password"
          minLength={6}
        />
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />}
          {busy ? "Enregistrement…" : "Modifier"}
        </Button>
      </div>
      {confirm.length > 0 && password !== confirm && (
        <p className="text-xs text-destructive">Les deux mots de passe ne correspondent pas.</p>
      )}
    </div>
  );
}
