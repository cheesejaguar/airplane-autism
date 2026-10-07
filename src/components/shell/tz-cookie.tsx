"use client";

import { useEffect } from "react";

/** Stores the viewer's IANA timezone so server-side stats bucket days correctly. */
export function TzCookie() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && !document.cookie.includes(`tz=${encodeURIComponent(tz)}`)) {
        document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      }
    } catch {}
  }, []);
  return null;
}
