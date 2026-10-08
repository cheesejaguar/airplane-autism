import Link from "next/link";
import { getFamily, label } from "@/lib/catalog";
import { familyRecord } from "@/lib/progress/queries";
import { getViewer } from "@/lib/session";
import { MASTERY_STEP } from "@/lib/progress/mastery-style";
import { cn } from "@/lib/utils";

function relative(d: Date) {
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "due now";
  if (days === 1) return "tomorrow";
  if (days < 30) return `in ${days} days`;
  return `in ${Math.round(days / 30)} months`;
}

/** The viewer's personal history with one aircraft. Streams in behind Suspense. */
export async function FamilyRecordPanel({ familyId }: { familyId: string }) {
  const viewer = await getViewer();
  if (!viewer) return null;
  const r = await familyRecord(viewer.id, familyId);
  if (!r.seen) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">You haven&apos;t been drilled on this aircraft yet.</p>;
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="type-readout text-muted-foreground">Your record</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className={cn("size-3 rounded-[3px]", MASTERY_STEP[r.mastery].className)} />
          {MASTERY_STEP[r.mastery].label}
        </span>
        <span>
          <strong>{Math.round((r.firstTry / r.seen) * 100)}%</strong> first look over {r.seen}
        </span>
        {r.due && <span className="text-muted-foreground">Next review {relative(r.due)}</span>}
      </div>
      {r.confusedWith.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ve mistaken it for{" "}
          {r.confusedWith.map((c, i) => {
            const f = getFamily(c.id);
            return (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/compare/${familyId}/${c.id}`} className="text-foreground underline underline-offset-2">
                  {f ? label(f) : c.id}
                </Link>{" "}
                ×{c.count}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
