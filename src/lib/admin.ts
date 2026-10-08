import "server-only";
import type { Viewer } from "@/lib/session";

/** Admins are signed-in (non-guest) users whose email is listed in ADMIN_EMAILS (comma-separated). */
export function isAdmin(viewer: Viewer | null): boolean {
  if (!viewer || viewer.isGuest || !viewer.email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(viewer.email.toLowerCase());
}
