"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BarChart3, BookOpen, Crosshair, LogOut, Menu, Settings, UserRound } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/train", label: "Train", icon: Crosshair },
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/stats", label: "Stats", icon: BarChart3 },
] as const;

function AccountControl() {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  if (isPending) return <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />;
  const user = data?.user as (NonNullable<typeof data>["user"] & { isAnonymous?: boolean | null }) | undefined;
  if (!user || user.isAnonymous) {
    return (
      <div className="flex items-center gap-1">
        {user?.isAnonymous && (
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="/sign-up">Save progress</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="ghost">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-primary text-[0.7rem] font-bold text-primary-foreground">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{user.name || user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname.startsWith("/train/session")) return null; // the drill is full-screen
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="mr-4 rounded-md" aria-label="Tally home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-3 -bottom-[13px] h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <AccountControl />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="px-4 pt-4">
                <Wordmark />
              </SheetTitle>
              <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
                {NAV.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-base",
                      pathname.startsWith(href) ? "bg-accent text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" /> {label}
                  </Link>
                ))}
                <Link href="/settings" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-base text-muted-foreground">
                  <UserRound className="size-4" /> Account
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
