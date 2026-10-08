import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type Viewer = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isGuest: boolean;
};

/** Current user from the request cookies, or null. Must be called inside a Suspense boundary. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { isAnonymous?: boolean | null };
  return {
    id: u.id,
    name: u.isAnonymous ? "Guest" : u.name,
    email: u.isAnonymous ? "" : u.email,
    image: u.image ?? null,
    isGuest: !!u.isAnonymous,
  };
}

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new Error("Not signed in");
  return v;
}
