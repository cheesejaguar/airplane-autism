"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { resetProgress } from "@/app/settings/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t py-5 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPanel() {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [pending, start] = useTransition();
  const user = data?.user as (NonNullable<typeof data>["user"] & { isAnonymous?: boolean }) | undefined;

  useEffect(() => {
    if (user?.name && !user.isAnonymous) setName(user.name);
  }, [user?.name, user?.isAnonymous]);
  useEffect(() => {
    try {
      setAutoAdvance(localStorage.getItem("tally:auto-advance") !== "off");
    } catch {}
  }, []);

  if (isPending) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="type-condensed mb-4 text-lg">Account</h2>
        {!user || user.isAnonymous ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {user ? "You're training as a guest. Create an account to keep your progress across devices." : "You're not signed in."}
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/sign-up">Create account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-4 sm:max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await authClient.updateUser({ name: name.trim() });
                if (res.error) toast.error(res.error.message ?? "Couldn't save your name.");
                else toast.success("Name saved");
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} disabled />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <Button type="submit" className="w-fit" disabled={pending || !name.trim()}>
              Save name
            </Button>
          </form>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="type-condensed mb-4 text-lg">Training</h2>
        <Row title="Night theme" description="Dark sectional palette. Turn off for the daylight chart.">
          <Switch checked={resolvedTheme !== "light"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} aria-label="Night theme" />
        </Row>
        <Row title="Auto-advance after a correct answer" description="Moves to the next aircraft after a short debrief.">
          <Switch
            checked={autoAdvance}
            onCheckedChange={(v) => {
              setAutoAdvance(v);
              try {
                localStorage.setItem("tally:auto-advance", v ? "on" : "off");
              } catch {}
            }}
            aria-label="Auto-advance"
          />
        </Row>
        <Row title="Reduced motion" description="Tally follows your operating system's reduce-motion setting.">
          <span className="text-sm text-muted-foreground">System</span>
        </Row>
      </section>

      {user && (
        <section className="rounded-xl border border-destructive/40 bg-card p-5 sm:p-6">
          <h2 className="type-condensed mb-4 text-lg">Danger zone</h2>
          <Row title="Reset progress" description="Deletes every answer, schedule and session. Your account stays.">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Reset progress</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all training progress?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your accuracy, streaks and spaced-repetition schedule will be erased. This can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep progress</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      start(async () => {
                        if (await resetProgress()) {
                          toast.success("Progress reset");
                          router.refresh();
                        }
                      })
                    }
                  >
                    Reset progress
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Row>
          {!user.isAnonymous && (
            <Row title="Delete account" description="Removes your account and all training data.">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete account</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your account and every answer you&apos;ve logged will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep account</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        start(async () => {
                          const res = await authClient.deleteUser();
                          if (res.error) toast.error(res.error.message ?? "Couldn't delete the account. Sign in again and retry.");
                          else {
                            router.push("/");
                            router.refresh();
                          }
                        })
                      }
                    >
                      Delete account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Row>
          )}
        </section>
      )}
    </div>
  );
}
