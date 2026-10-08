import type { Angle, Category, Family, Role, Sector } from "@/lib/catalog/schema";
import type { Conditions } from "@/lib/deck/config";
import type { RatingValue } from "./grading";

export type ClientQuestion = {
  token: string;
  image: { src: string; srcSmall: string; width: number; height: number };
  options: { id: string; label: string }[];
  exposureMs: number | null;
  conditions: Conditions;
  isNew: boolean;
};

export type PhotoCredit = { author: string; license: string; licenseUrl?: string; sourceUrl: string; title: string };

export type FamilyReveal = {
  id: string;
  name: string;
  label: string;
  manufacturer: string;
  summary: string;
  category: Category;
  sector: Sector;
  roles: Role[];
  weft: Family["weft"];
  tellTales: string[];
  angle: Angle;
  credit: PhotoCredit;
};

export type PickedSummary = { id: string; name: string; label: string; tellTales: string[]; howToTell?: string };

export type AnswerResult =
  | { status: "correct"; attemptNo: number; rating: RatingValue; reveal: FamilyReveal }
  | { status: "retry"; eliminated: string; hint: { lookFor: string; picked: PickedSummary } }
  | { status: "revealed"; rating: RatingValue; reveal: FamilyReveal; picked: PickedSummary; requeue: ClientQuestion | null };

export type SessionStart =
  | { ok: true; sessionId: string; questions: ClientQuestion[]; poolSize: number }
  | { ok: false; error: "no-session" | "empty-deck" };

export type SessionSummary = {
  total: number;
  firstTry: number;
  afterHint: number;
  missed: { id: string; name: string; label: string }[];
  avgLatencyMs: number;
  newLearned: number;
};
