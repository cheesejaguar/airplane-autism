import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { mergeGuestProgress } from "@/lib/progress/merge";

const socialProviders = {
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET } }
    : {}),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : {}),
};

export const enabledSocialProviders = Object.keys(socialProviders) as ("github" | "google")[];

const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter(Boolean)
  .map((h) => `https://${h}`);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined),
  trustedOrigins: ["http://localhost:3000", ...vercelOrigins],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
  socialProviders,
  user: { deleteUser: { enabled: true } },
  session: {
    expiresIn: 60 * 60 * 24 * 60, // 60 days — guests keep progress across visits
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [
    anonymous({
      emailDomainName: "guest.tally.local",
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await mergeGuestProgress(anonymousUser.user.id, newUser.user.id);
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
