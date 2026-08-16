import { useState } from "react";
import {
  Bluetooth,
  Info,
  Network,
  Plus,
  Printer,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bluetoothSupported,
  pairBluetoothPrinter,
  printTicket,
  usePrinters,
  type PrinterConfig,
  type PrinterKind,
} from "@/lib/printing/printers";

const KIND_ICON: Record<PrinterKind, typeof Printer> = {
  system: Printer,
  bluetooth: Bluetooth,
  network: Network,
};

const KIND_LABEL: Record<PrinterKind, string> = {
  system: "Système (navigateur)",
  bluetooth: "Bluetooth",
  network: "Réseau IP",
};

/**
 * Printer manager: system (browser dialog), Bluetooth label printers
 * (ESC/POS or TSPL over Web Bluetooth) and network printers.
 */
export function PrintersCard() {
  const {
    printers,
    addPrinter,
    updatePrinter,
    removePrinter,
    setDefault,
  } = usePrinters();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PrinterKind>("bluetooth");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<"escpos" | "tspl">("escpos");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("9100");
  const [transport, setTransport] = useState<"raw" | "http">("raw");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setKind("bluetooth");
    setName("");
    setLanguage("escpos");
    setHost("");
    setPort("9100");
    setTransport("raw");
  };

  const pair = async () => {
    setBusy(true);
    try {
      const found = await pairBluetoothPrinter();
      setName((n) => n || found);
      toast.success(`Appairé : ${found}`);
    } catch (e) {
      toast.error("Appairage impossible", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (kind === "network" && !host.trim()) {
      toast.error("Renseignez l'adresse IP de l'imprimante.");
      return;
    }
    addPrinter({
      name:
        name.trim() ||
        (kind === "network" ? `Imprimante ${host}` : "Imprimante Bluetooth"),
      kind,
      language,
      host: kind === "network" ? host.trim() : undefined,
      port: kind === "network" ? Number(port) || 9100 : undefined,
      transport: kind === "network" ? transport : undefined,
    });
    toast.success("Imprimante ajoutée");
    reset();
    setOpen(false);
  };

  const test = async (p: PrinterConfig) => {
    if (p.kind === "system") {
      window.print();
      return;
    }
    try {
      await printTicket(p, "PLANNING AGENTS", [
        "Test d'impression",
        new Date().toLocaleString("fr-FR"),
        p.name,
      ]);
      toast.success("Test envoyé");
    } catch (e) {
      toast.error("Échec du test", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Printer className="size-4 text-primary" /> Imprimantes
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choisissez l'imprimante utilisée pour le planning (A4/A3) et pour les
        tickets ou étiquettes d'agents.
      </p>

      <div className="mt-4 flex gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="space-y-1.5">
          <p>
            <strong className="text-foreground">Système (navigateur)</strong> :
            ouvre le PDF du planning et lance la boîte de dialogue d'impression —
            fonctionne partout.
          </p>
          <p>
            <strong className="text-foreground">Bluetooth</strong> : envoi direct
            de commandes ESC/POS ou TSPL vers une imprimante d'étiquettes via Web
            Bluetooth (Chrome / Edge, HTTPS requis).
          </p>
          <p>
            <strong className="text-foreground">Réseau IP</strong> : le navigateur
            ne peut pas ouvrir un port TCP 9100 ; renseignez l'IP et relayez via
            un agent local, ou choisissez le transport HTTP si l'imprimante expose
            un service web.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setKind("bluetooth");
            setOpen(true);
          }}
        >
          <Bluetooth /> Bluetooth
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setKind("network");
            setOpen(true);
          }}
        >
          <Network /> Réseau IP
        </Button>
        <Button onClick={() => setOpen(true)}>
          <Plus /> Ajouter une imprimante
        </Button>
      </div>

      <ul className="mt-4 space-y-3">
        {printers.map((p) => {
          const Icon = KIND_ICON[p.kind];
          return (
            <li
              key={p.id}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <Input
                  value={p.name}
                  onChange={(e) => updatePrinter(p.id, { name: e.target.value })}
                  disabled={p.kind === "system"}
                  aria-label="Nom de l'imprimante"
                />
              </div>
              <p className="mt-1.5 pl-12 text-xs text-muted-foreground">
                {KIND_LABEL[p.kind]}
                {p.kind === "network" && ` — ${p.host}:${p.port} (${p.transport === "http" ? "HTTP" : "TCP brut"})`}
                {p.kind !== "system" && ` — ${p.language === "tspl" ? "TSPL" : "ESC/POS"}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 pl-12">
                <Button
                  size="sm"
                  variant={p.isDefault ? "secondary" : "ghost"}
                  onClick={() => setDefault(p.id, "isDefault")}
                >
                  <Star className={p.isDefault ? "fill-current" : ""} /> Par défaut
                </Button>
                <Button
                  size="sm"
                  variant={p.isLabelDefault ? "secondary" : "ghost"}
                  onClick={() => setDefault(p.id, "isLabelDefault")}
                >
                  <Tag /> Étiquettes par défaut
                </Button>
                <Button size="sm" variant="outline" onClick={() => void test(p)}>
                  <Printer /> {p.kind === "system" ? "Test impression" : "Test étiquette"}
                </Button>
                {p.kind !== "system" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removePrinter(p.id)}
                  >
                    <Trash2 /> Supprimer
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une imprimante</DialogTitle>
            <DialogDescription>
              Les imprimantes sont mémorisées dans ce navigateur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Type de connexion</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as PrinterKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bluetooth">Bluetooth</SelectItem>
                  <SelectItem value="network">Réseau IP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prt-name">Nom</Label>
              <Input
                id="prt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Imprimante étiquettes accueil"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Langage</Label>
              <Select
                value={language}
                onValueChange={(v) => setLanguage(v as "escpos" | "tspl")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="escpos">ESC/POS (tickets)</SelectItem>
                  <SelectItem value="tspl">TSPL (étiquettes)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {kind === "bluetooth" && (
              <Button
                variant="outline"
                className="w-full"
                disabled={busy || !bluetoothSupported()}
                onClick={() => void pair()}
              >
                <Bluetooth />
                {bluetoothSupported()
                  ? busy
                    ? "Appairage…"
                    : "Appairer"
                  : "Web Bluetooth indisponible"}
              </Button>
            )}

            {kind === "network" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prt-host">Adresse IP</Label>
                  <Input
                    id="prt-host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="192.168.1.50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prt-port">Port</Label>
                  <Input
                    id="prt-port"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Transport</Label>
                  <Select
                    value={transport}
                    onValueChange={(v) => setTransport(v as "raw" | "http")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw">TCP brut 9100 (agent local)</SelectItem>
                      <SelectItem value="http">HTTP (service web imprimante)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submit}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
