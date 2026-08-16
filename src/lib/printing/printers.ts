import { useCallback, useEffect, useState } from "react";

export type PrinterKind = "system" | "bluetooth" | "network";
export type PrinterLanguage = "escpos" | "tspl";
export type NetworkTransport = "raw" | "http";

export interface PrinterConfig {
  id: string;
  name: string;
  kind: PrinterKind;
  /** Bluetooth / network label printers */
  language?: PrinterLanguage;
  /** Network printers */
  host?: string;
  port?: number;
  transport?: NetworkTransport;
  /** Default printer for documents (planning A4) */
  isDefault?: boolean;
  /** Default printer for labels / tickets */
  isLabelDefault?: boolean;
}

const KEY = "printing:printers:v1";

const SYSTEM_PRINTER: PrinterConfig = {
  id: "system",
  name: "Imprimante système (navigateur)",
  kind: "system",
  isDefault: true,
};

function read(): PrinterConfig[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [SYSTEM_PRINTER];
    const parsed = JSON.parse(raw) as PrinterConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [SYSTEM_PRINTER];
    return parsed.some((p) => p.kind === "system")
      ? parsed
      : [SYSTEM_PRINTER, ...parsed];
  } catch {
    return [SYSTEM_PRINTER];
  }
}

function write(list: PrinterConfig[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new CustomEvent("printers-changed"));
}

/** Printer list persisted in the browser, shared across tabs of the app. */
export function usePrinters() {
  const [printers, setPrinters] = useState<PrinterConfig[]>([SYSTEM_PRINTER]);

  useEffect(() => {
    const sync = () => setPrinters(read());
    sync();
    window.addEventListener("printers-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("printers-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((list: PrinterConfig[]) => {
    write(list);
    setPrinters(list);
  }, []);

  const addPrinter = useCallback(
    (p: Omit<PrinterConfig, "id">) => {
      const next = [...read(), { ...p, id: crypto.randomUUID() }];
      save(next);
    },
    [save],
  );

  const updatePrinter = useCallback(
    (id: string, patch: Partial<PrinterConfig>) => {
      save(read().map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [save],
  );

  const removePrinter = useCallback(
    (id: string) => {
      if (id === "system") return;
      save(read().filter((p) => p.id !== id));
    },
    [save],
  );

  const setDefault = useCallback(
    (id: string, field: "isDefault" | "isLabelDefault") => {
      save(read().map((p) => ({ ...p, [field]: p.id === id })));
    },
    [save],
  );

  const defaultPrinter =
    printers.find((p) => p.isDefault) ?? printers[0] ?? SYSTEM_PRINTER;
  const labelPrinter = printers.find((p) => p.isLabelDefault) ?? defaultPrinter;

  return {
    printers,
    addPrinter,
    updatePrinter,
    removePrinter,
    setDefault,
    defaultPrinter,
    labelPrinter,
  };
}

/* ------------------------------------------------------------------ */
/* Ticket / label rendering                                            */
/* ------------------------------------------------------------------ */

const ESC = "\x1b";
const GS = "\x1d";

/** Build raw ESC/POS bytes for a simple text ticket. */
export function escposTicket(title: string, lines: string[]): Uint8Array {
  let out = `${ESC}@`; // init
  out += `${ESC}a\x01${ESC}!\x30${title}\n${ESC}!\x00${ESC}a\x00`;
  out += "--------------------------------\n";
  for (const l of lines) out += `${l}\n`;
  out += "\n\n\n";
  out += `${GS}V\x00`; // cut
  return new TextEncoder().encode(out);
}

/** Build a TSPL label program for a simple text label. */
export function tsplLabel(title: string, lines: string[]): Uint8Array {
  let out = "SIZE 50 mm,30 mm\nGAP 2 mm,0\nCLS\n";
  out += `TEXT 20,20,"3",0,1,1,"${title.replace(/"/g, "'")}"\n`;
  lines.slice(0, 5).forEach((l, i) => {
    out += `TEXT 20,${60 + i * 28},"2",0,1,1,"${l.replace(/"/g, "'")}"\n`;
  });
  out += "PRINT 1,1\n";
  return new TextEncoder().encode(out);
}

export function buildPayload(
  printer: PrinterConfig,
  title: string,
  lines: string[],
): Uint8Array {
  return printer.language === "tspl"
    ? tsplLabel(title, lines)
    : escposTicket(title, lines);
}

/* ------------------------------------------------------------------ */
/* Transports                                                          */
/* ------------------------------------------------------------------ */

const SERIAL_SERVICE = 0x18f0; // common BLE serial service on label printers

type BluetoothLike = {
  requestDevice: (opts: unknown) => Promise<{
    name?: string | null;
    gatt?: {
      connect: () => Promise<{
        getPrimaryServices: () => Promise<
          { getCharacteristics: () => Promise<BtChar[]> }[]
        >;
        disconnect: () => void;
      }>;
    };
  }>;
};

type BtChar = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue: (v: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (v: BufferSource) => Promise<void>;
};

function bt(): BluetoothLike | null {
  const nav = navigator as unknown as { bluetooth?: BluetoothLike };
  return nav.bluetooth ?? null;
}

export function bluetoothSupported() {
  return typeof navigator !== "undefined" && Boolean(bt());
}

/** Ask the user to pair a Bluetooth printer; returns the device name. */
export async function pairBluetoothPrinter(): Promise<string> {
  const api = bt();
  if (!api) throw new Error("Web Bluetooth n'est pas disponible sur ce navigateur.");
  const device = await api.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SERIAL_SERVICE, "000018f0-0000-1000-8000-00805f9b34fb"],
  });
  return device.name ?? "Imprimante Bluetooth";
}

/** Pair (or re-pair) then send raw bytes over Web Bluetooth. */
export async function sendBluetooth(data: Uint8Array): Promise<void> {
  const api = bt();
  if (!api) throw new Error("Web Bluetooth n'est pas disponible sur ce navigateur.");
  const device = await api.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SERIAL_SERVICE, "000018f0-0000-1000-8000-00805f9b34fb"],
  });
  const server = await device.gatt?.connect();
  if (!server) throw new Error("Connexion GATT impossible.");
  const services = await server.getPrimaryServices();
  let target: BtChar | null = null;
  for (const s of services) {
    const chars = await s.getCharacteristics();
    const c = chars.find(
      (ch) => ch.properties.write || ch.properties.writeWithoutResponse,
    );
    if (c) {
      target = c;
      break;
    }
  }
  if (!target) throw new Error("Aucune caractéristique d'écriture trouvée.");
  const chunk = 180;
  for (let i = 0; i < data.length; i += chunk) {
    const slice = data.slice(i, i + chunk) as unknown as BufferSource;
    if (target.properties.writeWithoutResponse && target.writeValueWithoutResponse) {
      await target.writeValueWithoutResponse(slice);
    } else {
      await target.writeValue(slice);
    }
  }
  server.disconnect();
}

/** Send bytes to a network printer exposing an HTTP endpoint. */
export async function sendNetwork(
  printer: PrinterConfig,
  data: Uint8Array,
): Promise<void> {
  if (printer.transport !== "http") {
    throw new Error(
      "Le navigateur ne peut pas ouvrir un port TCP brut (9100). Choisissez le transport HTTP ou passez par un agent local.",
    );
  }
  const url = `http://${printer.host}:${printer.port ?? 80}/`;
  const body = new Blob([data as unknown as BlobPart], {
    type: "application/octet-stream",
  });
  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) throw new Error(`Réponse imprimante : ${res.status}`);
}

/** Print a ticket/label on any non-system printer. */
export async function printTicket(
  printer: PrinterConfig,
  title: string,
  lines: string[],
): Promise<void> {
  const payload = buildPayload(printer, title, lines);
  if (printer.kind === "bluetooth") return sendBluetooth(payload);
  if (printer.kind === "network") return sendNetwork(printer, payload);
  throw new Error("Cette imprimante utilise la boîte de dialogue du navigateur.");
}
