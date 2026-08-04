import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, Image as ImageIcon, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function QrScannerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
    if (code?.data) {
      setResult(code.data);
      stop();
      return;
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  }, [stop]);

  const start = useCallback(async () => {
    setError(null);
    setResult(null);
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("no-camera-api");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
      }
      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg === "no-camera-api"
          ? "Ce navigateur ne permet pas l'accès à la caméra. Utilisez l'import d'une image du QR code."
          : "Accès à la caméra refusé ou indisponible. Autorisez la caméra, ou importez une image du QR code.",
      );
    } finally {
      setStarting(false);
    }
  }, [scanLoop]);

  useEffect(() => {
    if (open) void start();
    return () => stop();
  }, [open, start, stop]);

  const onFile = async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, canvas.width, canvas.height);
      if (code?.data) {
        stop();
        setResult(code.data);
      } else {
        toast.error("Aucun QR code détecté dans cette image.");
      }
    } catch {
      toast.error("Impossible de lire cette image.");
    }
  };

  const openResult = () => {
    if (!result) return;
    if (/^https?:\/\//i.test(result)) {
      window.open(result, "_blank", "noopener,noreferrer");
    } else {
      void navigator.clipboard?.writeText(result);
      toast.success("Contenu copié");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) stop();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lecteur de QR code</DialogTitle>
          <DialogDescription>
            Pointez la caméra vers un QR code, ou importez une image de QR code
            si l'appareil n'a pas de lecteur.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
          <video
            ref={videoRef}
            className="size-full object-cover"
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />
          {!result && !error && (
            <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/70" />
          )}
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
              {error}
            </div>
          )}
        </div>

        {result && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="break-all text-xs text-muted-foreground">{result}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={openResult}>
                <ExternalLink /> Ouvrir le planning
              </Button>
              <Button size="sm" variant="outline" onClick={() => void start()}>
                <RefreshCw /> Scanner à nouveau
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!result && (
            <Button variant="outline" onClick={() => void start()}>
              <Camera /> Relancer la caméra
            </Button>
          )}
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <ImageIcon /> Importer une image
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onFile(f);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
