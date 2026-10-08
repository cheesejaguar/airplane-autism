export const REPORT_REASONS = {
  "wrong-aircraft": { label: "Photo shows a different aircraft", hint: "The photo is labelled as the wrong type." },
  "bad-photo": { label: "Photo is unusable", hint: "Cockpit, model, too small, mostly hidden, several types in frame…" },
  "wrong-angle": { label: "Wrong viewing angle", hint: "e.g. tagged as a side view but it's head-on." },
  "wrong-info": { label: "Hint or feature text is wrong", hint: "A WEFT feature, cue or look-alike tip is inaccurate." },
  other: { label: "Something else", hint: "Tell us what's off." },
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;
export const REPORT_REASON_KEYS = Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]];
export type ReportStatus = "open" | "fixed" | "dismissed";
export type ReportSource = "drill" | "study";
