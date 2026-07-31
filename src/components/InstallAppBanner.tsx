import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pwa:install-banner-dismissed";
const APP_NAME = "Planning des agents";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Banner offering to install the app: uses the native install prompt when the
 * browser provides one (Chrome/Edge/Android), and falls back to the iOS
 * "Partager → Sur l'écran d'accueil" instructions. Never shown inside the
 * Lovable preview iframe or when already installed.
 */
export function InstallAppBanner() {
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (inIframe() || isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    // Fallback: browsers without beforeinstallprompt (iOS, Firefox) get the
    // manual instructions after a short delay.
    const timer = window.setTimeout(() => {
      setVisible((v) => {
        if (v) return v;
        setIosHint(true);
        return true;
      });
    }, 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setVisible(false);
  };

  const manual = !deferred;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 print:hidden">
      <div className="mx-auto flex max-w-3xl items-start gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg">
        <Download className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Installer {APP_NAME}</p>
          {manual ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {isIos() || iosHint ? (
                <>
                  Sur iPhone/iPad : appuyez sur{" "}
                  <Share className="inline size-3.5 align-text-bottom" aria-hidden /> Partager, puis
                  « Sur l'écran d'accueil ».
                </>
              ) : (
                <>
                  Utilisez le menu de votre navigateur puis « Installer l'application » / « Ajouter
                  à l'écran d'accueil ».
                </>
              )}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Ajoutez l'application à votre écran d'accueil pour un accès plein écran, même hors
              ligne.
            </p>
          )}
          {!manual && (
            <Button size="sm" className="mt-2" onClick={install}>
              Installer
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={dismiss}
          aria-label="Masquer la proposition d'installation"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
