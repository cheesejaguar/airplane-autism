import { familyImages, getFamily, getImage, label } from "@/lib/catalog";
import { REPORT_REASONS, type ReportReason } from "./types";

/** A report row as stored in the database (subset used for briefs). */
export type ReportRow = {
  id: string;
  familyId: string;
  imageId: string | null;
  reason: string;
  suggestedFamilyId: string | null;
  chosenFamilyId: string | null;
  note: string | null;
  source: string;
  createdAt: Date;
  resolution?: string | null;
};

export type ReportGroup<R extends ReportRow = ReportRow> = {
  key: string;
  familyId: string;
  imageId: string | null;
  reports: R[];
  reasons: Record<string, number>;
  suggestions: Record<string, number>;
};

/** Groups reports by photo (or by aircraft when no photo is attached), most-reported first. */
export function groupReports<R extends ReportRow>(rows: R[]): ReportGroup<R>[] {
  const groups = new Map<string, ReportGroup<R>>();
  for (const r of rows) {
    const key = r.imageId ? `img:${r.imageId}` : `fam:${r.familyId}`;
    const g: ReportGroup<R> = groups.get(key) ?? { key, familyId: r.familyId, imageId: r.imageId, reports: [], reasons: {}, suggestions: {} };
    g.reports.push(r);
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    if (r.suggestedFamilyId) g.suggestions[r.suggestedFamilyId] = (g.suggestions[r.suggestedFamilyId] ?? 0) + 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.reports.length - a.reports.length || a.key.localeCompare(b.key));
}

const reasonLabel = (r: string) => REPORT_REASONS[r as ReportReason]?.label ?? r;
const famName = (id: string) => {
  const f = getFamily(id);
  return f ? `${label(f)} (\`${id}\`)` : `\`${id}\` (not in catalog)`;
};

/**
 * Markdown brief for Claude: everything needed to verify and fix each reported item without
 * opening the app — the photo, its source, the current labels and the reporters' notes.
 */
export function reportsBrief(rows: ReportRow[], opts: { generatedAt?: Date } = {}): string {
  const groups = groupReports(rows);
  const out: string[] = [
    `# Tally — open aircraft reports`,
    ``,
    `${rows.length} report${rows.length === 1 ? "" : "s"} across ${groups.length} item${groups.length === 1 ? "" : "s"} · generated ${(opts.generatedAt ?? new Date()).toISOString()}`,
    ``,
    `Fix these in the Tally repo with the \`/fix-reports\` workflow (see \`.claude/skills/fix-reports/SKILL.md\`).`,
    `For each item: open the photo, decide whether the report is right, apply the fix, then resolve the report ids.`,
    ``,
  ];
  if (!groups.length) out.push("_No open reports._");

  groups.forEach((g, i) => {
    const f = getFamily(g.familyId);
    const img = g.imageId ? getImage(g.imageId) : undefined;
    out.push(`## ${i + 1}. ${famName(g.familyId)}${g.imageId ? ` — photo \`${g.imageId}\`` : " — aircraft data"} · ${g.reports.length} report${g.reports.length === 1 ? "" : "s"}`);
    out.push("");
    out.push(
      `- **Reasons:** ${Object.entries(g.reasons)
        .map(([r, n]) => `${reasonLabel(r)} ×${n}`)
        .join("; ")}`,
    );
    if (Object.keys(g.suggestions).length) {
      out.push(
        `- **Reporters say it's actually:** ${Object.entries(g.suggestions)
          .map(([id, n]) => `${famName(id)} ×${n}`)
          .join("; ")}`,
      );
    }
    if (g.imageId) {
      if (img) {
        out.push(`- **Photo:** ${img.src}`);
        out.push(`- **Commons source:** ${img.sourceUrl} — "${img.title}" by ${img.author} (${img.license})`);
        out.push(`- **Current labels:** family \`${img.familyId}\`, angle \`${img.angle}\`, in flight: ${img.inFlight ? "yes" : "no"}, quality ${img.quality}/5`);
        out.push(`- **Photos left in this family if removed:** ${familyImages(g.familyId).length - 1}`);
      } else {
        out.push(`- **Photo:** \`${g.imageId}\` is no longer in data/images.json (already removed?)`);
      }
    }
    if (f) {
      out.push(`- **Family file:** \`data/families/${f.id}.json\` — cues: ${f.tellTales.map((t) => `"${t}"`).join(", ")}`);
      if (g.reasons["wrong-info"]) {
        out.push(`- **WEFT:** W: ${f.weft.wings.join("; ")} | E: ${f.weft.engines.join("; ")} | F: ${f.weft.fuselage.join("; ")} | T: ${f.weft.tail.join("; ")}`);
      }
    }
    const notes = g.reports.filter((r) => r.note?.trim());
    if (notes.length) {
      out.push(`- **Notes:**`);
      for (const r of notes) out.push(`  - "${r.note!.trim().replace(/\s+/g, " ")}" (${r.source}${r.chosenFamilyId ? `, had answered ${famName(r.chosenFamilyId)}` : ""})`);
    }
    out.push(`- **Report ids:** ${g.reports.map((r) => `\`${r.id}\``).join(" ")}`);
    out.push("");
  });
  return out.join("\n");
}
