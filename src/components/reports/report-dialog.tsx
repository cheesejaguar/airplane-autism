"use client";

import { useState, useTransition } from "react";
import { Check, ChevronsUpDown, Flag } from "lucide-react";
import { toast } from "sonner";
import familyIndex from "@/generated/family-index.json";
import { submitReport, type SubmitReportInput } from "@/app/reports/actions";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ensureSession } from "@/lib/auth-client";
import { REPORT_REASONS, type ReportReason } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

type Target = Omit<SubmitReportInput, "reason" | "suggestedFamilyId" | "note">;

const FAMILIES = familyIndex as { id: string; label: string; name: string }[];

export function ReportDialog({
  target,
  subject,
  photo = true,
  trigger,
}: {
  target: Target;
  /** What's being reported, e.g. "this photo of the F-16" */
  subject: string;
  /** Whether a specific photo is attached (enables photo-specific reasons) */
  photo?: boolean;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const reasons = (Object.keys(REPORT_REASONS) as ReportReason[]).filter(
    (r) => photo || !["wrong-aircraft", "bad-photo", "wrong-angle"].includes(r),
  );
  const suggestedLabel = FAMILIES.find((f) => f.id === suggested)?.label;

  const reset = () => {
    setReason(null);
    setSuggested(null);
    setNote("");
  };

  const submit = () =>
    start(async () => {
      if (!reason) return;
      await ensureSession();
      const res = await submitReport({ ...target, reason, suggestedFamilyId: suggested ?? undefined, note: note || undefined });
      if (res.ok) {
        toast.success("Report sent — thanks for keeping the deck accurate.");
        setOpen(false);
        reset();
      } else toast.error(res.error);
    });

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || reset())}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Flag /> Report a problem
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>About {subject}. Reports are reviewed and fixed in the next catalog update.</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="What's wrong?" className="grid gap-2">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                reason === r ? "border-primary bg-primary/10" : "hover:border-foreground/30",
              )}
            >
              <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", reason === r && "border-primary bg-primary")}>
                {reason === r && <span className="size-1.5 rounded-full bg-primary-foreground" />}
              </span>
              <span>
                <span className="block text-sm font-medium">{REPORT_REASONS[r].label}</span>
                <span className="block text-xs text-muted-foreground">{REPORT_REASONS[r].hint}</span>
              </span>
            </button>
          ))}
        </div>

        {reason === "wrong-aircraft" && (
          <div className="grid gap-1.5">
            <Label>What is it actually? (optional)</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-between font-normal">
                  {suggestedLabel ?? "Pick the correct aircraft"}
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search aircraft…" />
                  <CommandList>
                    <CommandEmpty>Not in the catalog — describe it in the note.</CommandEmpty>
                    <CommandGroup>
                      {FAMILIES.map((f) => (
                        <CommandItem
                          key={f.id}
                          value={`${f.label} ${f.name}`}
                          onSelect={() => {
                            setSuggested(f.id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check className={cn("size-4", suggested === f.id ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{f.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="report-note">Details {reason === "other" || reason === "wrong-info" ? "" : "(optional)"}</Label>
          <Textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={reason === "wrong-info" ? "Which feature or cue is wrong, and what's correct?" : "Anything that helps us fix it"}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!reason || pending || ((reason === "other" || reason === "wrong-info") && !note.trim())}>
            {pending ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
