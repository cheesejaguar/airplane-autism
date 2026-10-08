import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";

/**
 * Hides /admin from everyone but admins with a real 404 (the page and its server actions also
 * check, but a streamed page can't change its status code once rendering starts).
 */
export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const u = session?.user as { email: string; isAnonymous?: boolean | null } | undefined;
  const viewer = u ? { id: "", name: "", email: u.email, image: null, isGuest: !!u.isAnonymous } : null;
  if (!isAdmin(viewer)) return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  return NextResponse.next();
}

export const config = { matcher: "/admin/:path*" };
