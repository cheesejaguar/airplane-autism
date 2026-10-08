"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Download, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { openReportsBrief, setReportStatus } from "@/app/reports/actions";
import { Button } from "@/components/ui/button";

export function CopyBriefButton() {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const brief = await openReportsBrief();
            await navigator.clipboard.writeText(brief);
            toast.success("Brief copied — paste it into a Claude Code session in the Tally repo.");
          })
        }
      >
        <ClipboardCopy /> Copy for Claude
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const brief = await openReportsBrief();
            const url = URL.createObjectURL(new Blob([brief], { type: "text/markdown" }));
            const a = Object.assign(document.createElement("a"), { href: url, download: `tally-reports-${new Date().toISOString().slice(0, 10)}.md` });
            a.click();
            URL.revokeObjectURL(url);
          })
        }
      >
        <Download /> Download .md
      </Button>
    </div>
  );
}

export function ResolveButtons({ ids, status }: { ids: string[]; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const act = (next: "fixed" | "dismissed" | "open") =>
    start(async () => {
      const n = await setReportStatus(ids, next, note);
      toast.success(`${n} report${n === 1 ? "" : "s"} marked ${next}`);
      router.refresh();
    });
  if (status !== "open") {
    return (
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("open")}>
        <RotateCcw /> Reopen
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Resolution note (optional)"
        aria-label="Resolution note"
        className="h-8 min-w-48 flex-1 rounded-md border bg-transparent px-2 text-sm"
      />
      <Button size="sm" disabled={pending} onClick={() => act("fixed")}>
        <Check /> Fixed
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => act("dismissed")}>
        <X /> Dismiss
      </Button>
    </div>
  );
}
