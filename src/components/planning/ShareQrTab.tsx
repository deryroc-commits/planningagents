import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Download, QrCode, Loader2, Info, RefreshCw, Clock, Link2, RotateCcw, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

import { supabase } from "@/integrations/supabase/client";
import { usePlanning } from "@/lib/planning/store";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import { MONTHS } from "@/lib/planning/calc";
import { getVisibleAgents } from "@/lib/planning/visible-agents";
import { useSelectableYears } from "@/hooks/use-selectable-years";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
type Scope = "year" | "month" | "multi";
type LinkInfo = { token: string; mode: ShareMode; expiresAt: string | null };
type LinkMap = Record<string, LinkInfo>;

function expiresValue(days: number): string | null {
  return days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
}

function fmtExpiry(expiresAt: string | null): {
  text: string;
  remainingText: string;
  expired: boolean;
} {
  if (!expiresAt) {
    return {
      text: "Sans expiration",
      remainingText: "Valide indéfiniment",
      expired: false,
    };
  }
  const d = new Date(expiresAt);
  const expired = d.getTime() < Date.now();
  const remainingDays = Math.max(
    0,
    Math.ceil((d.getTime() - Date.now()) / 86_400_000),
  );
  return {
    text: expired
      ? `Expiré le ${d.toLocaleDateString("fr-FR")}`
      : `Expire le ${d.toLocaleDateString("fr-FR")}`,
    remainingText: expired
      ? "Lien expiré"
      : remainingDays === 0
        ? "Expire aujourd'hui"
        : `${remainingDays} jour${remainingDays > 1 ? "s" : ""} restant${remainingDays > 1 ? "s" : ""}`,
    expired,
  };
}



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

export function ShareQrTab() {
  const { agents: allAgents, year: currentYear, yearRange } = usePlanning();
  const { activeWorkspaceId, canEdit } = useWorkspace();
  const YEARS = useSelectableYears(yearRange);
  const [links, setLinks] = useState<LinkMap>({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth());
  const [scope, setScope] = useState<Scope>("month");
  const [expireDays, setExpireDays] = useState(0);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([
    new Date().getMonth(),
  ]);
  const [preview, setPreview] = useState<{ name: string; dataUrl: string; url: string; expiresAt: string | null } | null>(null);
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
    toast.success("URL des QR codes enregistrée.");
  }, [baseUrlInput, baseUrlValid]);

  const resetBaseUrl = useCallback(() => {
    window.localStorage.removeItem(QR_BASE_URL_KEY);
    const d = getDefaultBaseUrl();
    setBaseUrl(d);
    setBaseUrlInput(d);
    toast.success("URL par défaut rétablie.");
  }, []);
  const agents = useMemo(() => {
    if (scope === "month") {
      return getVisibleAgents(allAgents, {
        scope: { kind: "month", year, month },
      });
    }
    if (scope === "multi") {
      return getVisibleAgents(allAgents, {
        scope: { kind: "months", year, months: selectedMonths },
      });
    }
    return getVisibleAgents(allAgents, { scope: { kind: "year", year } });
  }, [allAgents, scope, year, month, selectedMonths]);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_share_links")
      .select("agent_id, token, mode, expires_at")
      .eq("workspace_id", activeWorkspaceId);
    if (error) {
      console.warn("Chargement des liens impossible", error.message);
    } else {
      const map: LinkMap = {};
      for (const row of data ?? []) {
        map[row.agent_id] = {
          token: row.token,
          mode: row.mode as ShareMode,
          expiresAt: row.expires_at,
        };
      }
      setLinks(map);
    }
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ensureLink = useCallback(
    async (agentId: string): Promise<LinkInfo | null> => {
      const existing = links[agentId];
      if (existing) return existing;
      if (!activeWorkspaceId) return null;
      const token = newToken();
      const expiresAt = expiresValue(expireDays);
      const { error } = await supabase.from("agent_share_links").insert({
        workspace_id: activeWorkspaceId,
        agent_id: agentId,
        token,
        mode: "perso",
        expires_at: expiresAt,
      });
      if (error) {
        toast.error("Impossible de créer le lien.");
        return null;
      }
      const created: LinkInfo = { token, mode: "perso", expiresAt };
      setLinks((prev) => ({ ...prev, [agentId]: created }));
      return created;
    },
    [links, activeWorkspaceId, expireDays],
  );

  const regenerateToken = useCallback(
    async (agentId: string) => {
      if (!activeWorkspaceId) return;
      const token = newToken();
      const expiresAt = expiresValue(expireDays);
      const existing = links[agentId];
      const mode: ShareMode = existing?.mode ?? "perso";
      if (existing) {
        const { error } = await supabase
          .from("agent_share_links")
          .update({ token, expires_at: expiresAt })
          .eq("workspace_id", activeWorkspaceId)
          .eq("agent_id", agentId);
        if (error) {
          toast.error("Régénération impossible.");
          return;
        }
      } else {
        const { error } = await supabase.from("agent_share_links").insert({
          workspace_id: activeWorkspaceId,
          agent_id: agentId,
          token,
          mode,
          expires_at: expiresAt,
        });
        if (error) {
          toast.error("Régénération impossible.");
          return;
        }
      }
      setLinks((prev) => ({ ...prev, [agentId]: { token, mode, expiresAt } }));
      toast.success("Nouveau lien généré — les anciens QR ne fonctionnent plus.");
    },
    [activeWorkspaceId, expireDays, links],
  );

  const regenerateAll = useCallback(async () => {
    if (busyRef.current || !activeWorkspaceId) return;
    busyRef.current = true;
    try {
      for (const a of agents) {
        await regenerateToken(a.id);
      }
      toast.success("Tous les liens ont été régénérés.");
    } finally {
      busyRef.current = false;
    }
  }, [agents, regenerateToken, activeWorkspaceId]);


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

  const activeMonths = useMemo<number[]>(() => {
    if (scope === "year") return Array.from({ length: 12 }, (_, i) => i);
    if (scope === "multi") {
      const list = [...selectedMonths].sort((a, b) => a - b);
      return list.length ? list : [month];
    }
    return [month];
  }, [scope, selectedMonths, month]);

  const periodSlug = useMemo(() => {
    if (activeMonths.length === 12) return "annee";
    if (activeMonths.length === 1) return MONTHS[activeMonths[0]].toLowerCase();
    return `${activeMonths.length}-mois`;
  }, [activeMonths]);

  const monthsLabel = useMemo(() => {
    if (activeMonths.length === 12) return "Toute l'année";
    return activeMonths.map((i) => MONTHS[i]).join(", ");
  }, [activeMonths]);


  const buildUrl = useCallback(
    (token: string) =>
      `${baseUrl}/p/${token}?y=${year}&mo=${activeMonths[0]}&ms=${activeMonths.join(",")}`,
    [baseUrl, year, activeMonths],
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
      return { name, dataUrl, url, expiresAt: link.expiresAt };
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
        `qr-${slug(name)}-${periodSlug}-${year}.png`,
      );
    },
    [makeQr, periodSlug, year],
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
            `qr-${slug(a.name)}-${periodSlug}-${year}.png`,
          );
          await new Promise((r) => setTimeout(r, 250));
        }
      }
      toast.success("QR codes téléchargés.");
    } finally {
      busyRef.current = false;
    }
  }, [agents, makeQr, periodSlug, year]);


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
            Portée
          </label>
          <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Un seul mois</SelectItem>
              <SelectItem value="multi">Plusieurs mois</SelectItem>
              <SelectItem value="year">Année complète</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {scope === "month" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Mois à envoyer
            </label>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
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
        )}
        <Button className="ml-auto" onClick={() => void downloadAll()}>
          <Download /> Télécharger tous les QR
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-64 flex-1">
            <label className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Expiration des liens</span>
              <span className="font-semibold text-foreground">
                {expireDays === 0
                  ? "Jamais"
                  : `${expireDays} jour${expireDays > 1 ? "s" : ""}`}
              </span>
            </label>
            <Slider
              value={[expireDays]}
              min={0}
              max={365}
              step={1}
              onValueChange={(v) => setExpireDays(v[0] ?? 0)}
              className="mt-2"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Durée de validité appliquée aux liens créés ou régénérés
              (0 = sans expiration). Passé ce délai, le QR n'ouvre plus le
              planning.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void regenerateAll()}
          >
            <RefreshCw /> Régénérer tous les QR code
          </Button>
        </div>
      </div>


      {scope === "multi" && (
        <div className="rounded-lg border border-border bg-card p-3">
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Mois à inclure ({selectedMonths.length} sélectionné
            {selectedMonths.length > 1 ? "s" : ""})
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MONTHS.map((m, i) => {
              const on = selectedMonths.includes(i);
              return (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={on ? "default" : "outline"}
                  onClick={() =>
                    setSelectedMonths((prev) =>
                      prev.includes(i)
                        ? prev.filter((x) => x !== i)
                        : [...prev, i],
                    )
                  }
                >
                  {m}
                </Button>
              );
            })}
          </div>
        </div>
      )}


      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
        <span className="font-medium text-foreground">Mois inclus dans les QR :</span>
        <span className="font-semibold text-primary">
          {monthsLabel} — {year}
        </span>
        <span className="text-xs text-muted-foreground">
          ({activeMonths.length} mois)
        </span>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Téléchargez l'image du QR code puis envoyez-la à l'agent par votre
          messagerie ou SMS habituelle. Le QR ouvre la période choisie ci-dessus
          (un mois, plusieurs mois ou l'année complète) ; l'agent peut naviguer
          librement entre ces mois depuis la page.
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
                <th className="px-3 py-2 font-medium">Agents</th>
                <th className="px-3 py-2 font-medium">Contenu du QR</th>
                <th className="px-3 py-2 font-medium">Validité</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const info = links[a.id];
                const mode = info?.mode ?? "perso";
                const expiry = info ? fmtExpiry(info.expiresAt) : null;
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
                      {expiry ? (
                        <div>
                          <span
                            className={
                              expiry.expired
                                ? "text-xs font-medium text-destructive"
                                : "text-xs text-foreground"
                            }
                          >
                            {expiry.text}
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {expiry.remainingText}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">
                          Aucun lien encore
                        </span>
                      )}
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
                          variant="ghost"
                          size="sm"
                          onClick={() => void regenerateToken(a.id)}
                          title="Régénérer le token (invalide l'ancien QR)"
                        >
                          <RefreshCw /> Régénérer
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
                    colSpan={4}
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
              <div className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-center">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Mois autorisés — {year}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">
                  {monthsLabel}
                </p>
              </div>
              {(() => {
                const expiry = fmtExpiry(preview.expiresAt);
                return (
                  <div
                    className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-center ${
                      expiry.expired
                        ? "border-destructive/30 bg-destructive/10"
                        : "border-border bg-muted/40"
                    }`}
                  >
                    <Clock
                      className={`size-4 ${expiry.expired ? "text-destructive" : "text-muted-foreground"}`}
                    />
                    <div>
                      <p
                        className={`text-xs font-semibold ${
                          expiry.expired ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {expiry.text}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {expiry.remainingText}
                      </p>
                    </div>
                  </div>
                );
              })()}
              <p className="break-all text-center text-[11px] text-muted-foreground">
                {preview.url}
              </p>

              <Button
                className="w-full"
                onClick={() =>
                  downloadDataUrl(
                    preview.dataUrl,
                    `qr-${slug(preview.name)}-${periodSlug}-${year}.png`,
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
