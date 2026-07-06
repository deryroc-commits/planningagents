import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Download, QrCode, Loader2, Info } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePlanning } from "@/lib/planning/store";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import { MONTHS, selectableYears } from "@/lib/planning/calc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ShareMode = "perso" | "general";
type LinkMap = Record<string, { token: string; mode: ShareMode }>;

const YEARS = selectableYears();

function newToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    Math.random().toString(36).slice(2, 8)
  );
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function ShareQrTab() {
  const { agents, year: currentYear } = usePlanning();
  const { activeWorkspaceId, canEdit } = useWorkspace();
  const [links, setLinks] = useState<LinkMap>({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth());
  const [preview, setPreview] = useState<{ name: string; dataUrl: string; url: string } | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_share_links")
      .select("agent_id, token, mode")
      .eq("workspace_id", activeWorkspaceId);
    if (error) {
      console.warn("Chargement des liens impossible", error.message);
    } else {
      const map: LinkMap = {};
      for (const row of data ?? []) {
        map[row.agent_id] = { token: row.token, mode: row.mode as ShareMode };
      }
      setLinks(map);
    }
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ensureLink = useCallback(
    async (agentId: string): Promise<{ token: string; mode: ShareMode } | null> => {
      const existing = links[agentId];
      if (existing) return existing;
      if (!activeWorkspaceId) return null;
      const token = newToken();
      const { error } = await supabase.from("agent_share_links").insert({
        workspace_id: activeWorkspaceId,
        agent_id: agentId,
        token,
        mode: "perso",
      });
      if (error) {
        toast.error("Impossible de créer le lien.");
        return null;
      }
      const created = { token, mode: "perso" as ShareMode };
      setLinks((prev) => ({ ...prev, [agentId]: created }));
      return created;
    },
    [links, activeWorkspaceId],
  );

  const setMode = useCallback(
    async (agentId: string, mode: ShareMode) => {
      const link = await ensureLink(agentId);
      if (!link) return;
      setLinks((prev) => ({ ...prev, [agentId]: { ...prev[agentId], mode } }));
      const { error } = await supabase
        .from("agent_share_links")
        .update({ mode })
        .eq("workspace_id", activeWorkspaceId!)
        .eq("agent_id", agentId);
      if (error) toast.error("Réglage non enregistré.");
    },
    [ensureLink, activeWorkspaceId],
  );

  const buildUrl = useCallback(
    (token: string) =>
      `${window.location.origin}/p/${token}?y=${year}&mo=${month}`,
    [year, month],
  );

  const copyLink = useCallback(
    async (agentId: string) => {
      const link = await ensureLink(agentId);
      if (!link) return;
      await navigator.clipboard.writeText(buildUrl(link.token));
      toast.success("Lien copié.");
    },
    [ensureLink, buildUrl],
  );

  const makeQr = useCallback(
    async (agentId: string, name: string) => {
      const link = await ensureLink(agentId);
      if (!link) return null;
      const url = buildUrl(link.token);
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      return { name, dataUrl, url };
    },
    [ensureLink, buildUrl],
  );

  const showQr = useCallback(
    async (agentId: string, name: string) => {
      const qr = await makeQr(agentId, name);
      if (qr) setPreview(qr);
    },
    [makeQr],
  );

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadOne = useCallback(
    async (agentId: string, name: string) => {
      const qr = await makeQr(agentId, name);
      if (!qr) return;
      downloadDataUrl(
        qr.dataUrl,
        `qr-${slug(name)}-${MONTHS[month].toLowerCase()}-${year}.png`,
      );
    },
    [makeQr, month, year],
  );

  const downloadAll = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      for (const a of agents) {
        const qr = await makeQr(a.id, a.name);
        if (qr) {
          downloadDataUrl(
            qr.dataUrl,
            `qr-${slug(a.name)}-${MONTHS[month].toLowerCase()}-${year}.png`,
          );
          await new Promise((r) => setTimeout(r, 250));
        }
      }
      toast.success("QR codes téléchargés.");
    } finally {
      busyRef.current = false;
    }
  }, [agents, makeQr, month, year]);

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Seuls le propriétaire et les éditeurs peuvent gérer les QR codes de
        partage.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">QR codes & partage</h2>
        <p className="text-sm text-muted-foreground">
          Générez un QR code par agent. En le scannant, l'agent ouvre son
          planning — au choix, son planning personnel ou le planning général du
          mois — sans avoir besoin de compte.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Année
          </label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((yy) => (
                <SelectItem key={yy} value={String(yy)}>
                  {yy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Mois à envoyer
          </label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>
                  {m} {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="ml-auto" onClick={() => void downloadAll()}>
          <Download /> Télécharger tous les QR
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Téléchargez l'image du QR code puis envoyez-la à l'agent par votre
          messagerie ou SMS habituelle. Le mois affiché correspond au mois
          sélectionné ci-dessus ; l'agent peut aussi naviguer entre les mois
          depuis la page.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left">
                <th className="px-3 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">Contenu du QR</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const mode = links[a.id]?.mode ?? "perso";
                return (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className="px-3 py-2">
                      <Select
                        value={mode}
                        onValueChange={(v) => void setMode(a.id, v as ShareMode)}
                      >
                        <SelectTrigger className="h-8 w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="perso">Planning personnel</SelectItem>
                          <SelectItem value="general">Planning général</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void copyLink(a.id)}
                        >
                          <Copy /> Lien
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void showQr(a.id, a.name)}
                        >
                          <QrCode /> Voir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void downloadOne(a.id, a.name)}
                        >
                          <Download /> PNG
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {agents.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    Ajoutez des agents dans « Base agents » pour générer leurs QR
                    codes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={preview.dataUrl}
                alt={`QR code ${preview.name}`}
                className="size-56 rounded-lg border border-border"
              />
              <p className="break-all text-center text-[11px] text-muted-foreground">
                {preview.url}
              </p>
              <Button
                className="w-full"
                onClick={() =>
                  downloadDataUrl(
                    preview.dataUrl,
                    `qr-${slug(preview.name)}-${MONTHS[month].toLowerCase()}-${year}.png`,
                  )
                }
              >
                <Download /> Télécharger le PNG
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
