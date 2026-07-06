import { useState } from "react";
import { Loader2, LogIn, Plus, Users, LogOut } from "lucide-react";
import { toast } from "sonner";

import { useWorkspace } from "@/lib/workspace/workspace-context";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WorkspaceOnboarding() {
  const { createWorkspace, joinWorkspace } = useWorkspace();
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("create");
    try {
      await createWorkspace(name);
      toast.success("Équipe créée");
    } catch (err) {
      toast.error("Impossible de créer l'équipe", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("join");
    try {
      await joinWorkspace(code.trim());
      toast.success("Vous avez rejoint l'équipe");
    } catch (err) {
      toast.error("Code invalide", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-4 py-10">
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Users className="size-6" />
        </div>
        <h1 className="mt-3 text-2xl font-bold">Bienvenue{user?.email ? `, ${user.email}` : ""}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez une équipe ou rejoignez-en une avec un code d'invitation.
        </p>
      </div>

      <form onSubmit={onCreate} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Plus className="size-4 text-primary" /> Créer une équipe
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vous en devenez le propriétaire et obtenez un code à partager.
        </p>
        <div className="mt-3 space-y-2">
          <Label htmlFor="ws-name">Nom de l'équipe</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cuisine centrale UCPA"
          />
        </div>
        <Button type="submit" className="mt-4 w-full" disabled={busy !== null}>
          {busy === "create" && <Loader2 className="mr-2 size-4 animate-spin" />}
          Créer l'équipe
        </Button>
      </form>

      <form onSubmit={onJoin} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <LogIn className="size-4 text-primary" /> Rejoindre un workspace
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Entrez un code à 6 chiffres.</p>
        <div className="mt-3 flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            className="text-center text-lg font-bold tracking-[0.4em]"
          />
          <Button type="submit" disabled={busy !== null || code.length !== 6}>
            {busy === "join" && <Loader2 className="mr-2 size-4 animate-spin" />}
            Rejoindre
          </Button>
        </div>
      </form>

      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          <LogOut className="mr-1.5 size-4" /> Se déconnecter
        </Button>
      </div>
    </div>
  );
}
