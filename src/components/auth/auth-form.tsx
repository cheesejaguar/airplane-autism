"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.5-1.66 4.4-5.35 4.4a5.98 5.98 0 0 1 0-11.96c1.84 0 3.07.78 3.78 1.46l2.58-2.49C16.73 3.95 14.6 3 12 3a9 9 0 1 0 0 18c5.2 0 8.65-3.65 8.65-8.8 0-.6-.07-1.05-.15-1.5Z" />
    </svg>
  );
}

export function AuthForm({ mode, providers }: { mode: "sign-in" | "sign-up"; providers: ("github" | "google")[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/stats";
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { data } = authClient.useSession();
  const isGuest = !!(data?.user as { isAnonymous?: boolean } | undefined)?.isAnonymous;

  const submit = (form: FormData) =>
    start(async () => {
      setError(null);
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      const res =
        mode === "sign-up"
          ? await authClient.signUp.email({ email, password, name: String(form.get("name") ?? "").trim() || email.split("@")[0] })
          : await authClient.signIn.email({ email, password });
      if (res.error) {
        setError(
          res.error.code === "USER_ALREADY_EXISTS" || res.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "An account with this email already exists. Sign in instead."
            : res.error.code === "INVALID_EMAIL_OR_PASSWORD"
              ? "That email and password don't match. Check them and try again."
              : (res.error.message ?? "Something went wrong. Try again."),
        );
        return;
      }
      router.push(next);
      router.refresh();
    });

  return (
    <div className="w-full max-w-sm">
      <p className="type-readout text-muted-foreground">{mode === "sign-up" ? "Create account" : "Welcome back"}</p>
      <h1 className="type-display mt-2 text-4xl">{mode === "sign-up" ? "Save your progress" : "Sign in"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "sign-up"
          ? isGuest
            ? "Your guest training history moves into the new account automatically."
            : "Track accuracy, streaks and mastery across devices."
          : isGuest
            ? "Your guest history will be merged into your account."
            : "Pick up where you left off."}
      </p>

      {providers.length > 0 && (
        <>
          <div className="mt-6 grid gap-2">
            {providers.map((p) => (
              <Button
                key={p}
                variant="outline"
                onClick={() => authClient.signIn.social({ provider: p, callbackURL: next })}
                disabled={pending}
              >
                {p === "github" ? <GithubMark /> : <GoogleMark />} Continue with {p === "github" ? "GitHub" : "Google"}
              </Button>
            ))}
          </div>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form action={submit} className={providers.length ? "grid gap-4" : "mt-6 grid gap-4"}>
        {mode === "sign-up" && (
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" placeholder="Callsign or name" />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} />
          {mode === "sign-up" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Working…" : mode === "sign-up" ? "Create account" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {mode === "sign-up" ? "Already have an account? " : "New to Tally? "}
        <Link href={mode === "sign-up" ? "/sign-in" : "/sign-up"} className="text-foreground underline underline-offset-4">
          {mode === "sign-up" ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
