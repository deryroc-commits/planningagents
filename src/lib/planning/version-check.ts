import { useEffect, useRef, useState } from "react";

/**
 * Extract the set of hashed asset URLs referenced by an HTML document.
 * These change on every new build, so comparing them detects a new deploy.
 */
function extractAssets(html: string): string {
  const urls = new Set<string>();
  const re = /(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    urls.add(m[1]);
  }
  return [...urls].sort().join("|");
}

/** Fetch the current index HTML (bypassing cache) and return its asset fingerprint. */
async function fetchFingerprint(): Promise<string | null> {
  try {
    const res = await fetch(`/?_v=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) return null;
    return extractAssets(await res.text());
  } catch {
    return null;
  }
}

/**
 * Hook that polls for a new deployed version of the app.
 * Returns `true` once the served build differs from the one initially loaded.
 */
export function useNewVersionAvailable(intervalMs = 60_000): boolean {
  const [available, setAvailable] = useState(false);
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const check = async () => {
      const fp = await fetchFingerprint();
      if (cancelled || !fp) return;
      if (baseline.current === null) {
        baseline.current = fp;
        return;
      }
      if (fp !== baseline.current) setAvailable(true);
    };

    // Establish the baseline, then poll and re-check on tab focus.
    void check();
    const id = window.setInterval(check, intervalMs);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs]);

  return available;
}

/**
 * Fully reload the app, clearing every cache and service worker so the
 * newest build is guaranteed to load.
 */
export async function hardReload(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
  // Cache-busting query param forces a fresh document fetch.
  const url = new URL(window.location.href);
  url.searchParams.set("_reload", String(Date.now()));
  window.location.replace(url.toString());
}
