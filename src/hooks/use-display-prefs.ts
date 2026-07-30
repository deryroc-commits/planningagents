import { useCallback, useEffect, useState } from "react";

const HIDE_HEADER_KEY = "display:hide-header";

/**
 * Display preferences: hide the app header banner (persisted in the browser)
 * and toggle the browser fullscreen mode (not persisted).
 */
export function useDisplayPrefs() {
  const [hideHeader, setHideHeaderState] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    try {
      setHideHeaderState(window.localStorage.getItem(HIDE_HEADER_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const setHideHeader = useCallback((value: boolean) => {
    setHideHeaderState(value);
    try {
      window.localStorage.setItem(HIDE_HEADER_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleHeader = useCallback(
    () => setHideHeader(!hideHeader),
    [hideHeader, setHideHeader],
  );

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* fullscreen refused by the browser */
    }
  }, []);

  return { hideHeader, setHideHeader, toggleHeader, isFullscreen, toggleFullscreen };
}
