import { describe, expect, it } from "vitest";
import { groupReports, reportsBrief, type ReportRow } from "@/lib/reports/brief";

const row = (over: Partial<ReportRow>): ReportRow => ({
  id: Math.random().toString(36).slice(2),
  familyId: "x",
  imageId: null,
  reason: "wrong-aircraft",
  suggestedFamilyId: null,
  chosenFamilyId: null,
  note: null,
  source: "drill",
  createdAt: new Date("2026-10-07T12:00:00Z"),
  ...over,
});

describe("report grouping", () => {
  it("groups by photo, then by family, most-reported first", () => {
    const groups = groupReports([
      row({ imageId: "a", reason: "wrong-angle" }),
      row({ imageId: "b", suggestedFamilyId: "y" }),
      row({ imageId: "b", suggestedFamilyId: "y", note: "it's a Y" }),
      row({ imageId: null, reason: "wrong-info" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["img:b", "fam:x", "img:a"]);
    expect(groups[0].reasons).toEqual({ "wrong-aircraft": 2 });
    expect(groups[0].suggestions).toEqual({ y: 2 });
  });

  it("brief includes report ids, notes and an empty-state line", () => {
    const r = row({ imageId: "b", note: "clearly   a Y" });
    const md = reportsBrief([r]);
    expect(md).toContain(r.id);
    expect(md).toContain('"clearly a Y"');
    expect(reportsBrief([])).toContain("No open reports");
  });
});
