"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "tally:local-flag";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** A boolean persisted in localStorage ("on"/"off"), safe for SSR and private browsing. */
export function useLocalFlag(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const read = () => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === "on";
    } catch {
      return fallback;
    }
  };
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const set = useCallback(
    (v: boolean) => {
      try {
        localStorage.setItem(key, v ? "on" : "off");
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
