"use client";

import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({ plugins: [anonymousClient()] });

/** Ensures there is a session; creates a guest (anonymous) session if needed. */
export async function ensureSession(): Promise<boolean> {
  const { data } = await authClient.getSession();
  if (data?.session) return true;
  const res = await authClient.signIn.anonymous();
  return !res.error;
}
