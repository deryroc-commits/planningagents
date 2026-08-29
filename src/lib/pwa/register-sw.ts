// Guarded service worker registration wrapper.
// Follows the Lovable PWA skill: only register in production on the real
// deployed origin, never in Lovable preview / iframe / dev, and honor
// ?sw=off as a kill switch.

const SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;

  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const host = window.location.hostname;
  if (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  ) {
    return true;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;

  return false;
}

async function unregisterMatching(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_PATH);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    // ignore
  }
}

const RECOVERY_FLAG = "planning-sw-recovery";

/**
 * A stale cached HTML document can reference build assets that no longer
 * exist, which renders a blank page. When a module/chunk fails to load we
 * purge every cache + service worker once and reload on the fresh build.
 */
async function recoverFromStaleCache(): Promise<void> {
  try {
    if (window.sessionStorage.getItem(RECOVERY_FLAG)) return;
    window.sessionStorage.setItem(RECOVERY_FLAG, "1");
  } catch {
    return;
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  await unregisterMatching();
  const url = new URL(window.location.href);
  url.searchParams.set("_reload", String(Date.now()));
  window.location.replace(url.toString());
}

function installStaleCacheGuard(): void {
  const looksLikeChunkError = (message: string) =>
    /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|ChunkLoadError|Unexpected token '<'/i.test(
      message,
    );

  window.addEventListener("error", (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "SCRIPT" || target.tagName === "LINK")) {
      void recoverFromStaleCache();
      return;
    }
    if (event.message && looksLikeChunkError(event.message)) {
      void recoverFromStaleCache();
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason === "string" ? reason : reason?.message ? String(reason.message) : "";
    if (looksLikeChunkError(message)) void recoverFromStaleCache();
  });
}

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  installStaleCacheGuard();

  if (isRefusedContext()) {
    void unregisterMatching();
    return;
  }


  const register = () => {
    navigator.serviceWorker.register(SW_PATH, { scope: "/" }).catch(() => {
      // ignore registration errors
    });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
