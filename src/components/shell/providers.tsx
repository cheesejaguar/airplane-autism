"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TzCookie } from "./tz-cookie";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={200}>
          <TzCookie />
          {children}
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
