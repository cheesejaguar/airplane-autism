import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import type { DeckConfig } from "@/lib/deck/config";

/** FSRS scheduling state per user per aircraft family. */
export const cardState = pgTable(
  "card_state",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    familyId: text("family_id").notNull(),
    due: timestamp("due", { withTimezone: true }).notNull(),
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    elapsedDays: real("elapsed_days").notNull().default(0),
    scheduledDays: real("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: smallint("state").notNull().default(0),
    lastReview: timestamp("last_review", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.familyId] }), index("card_state_user_due_idx").on(t.userId, t.due)],
);

/** Training session envelope; all counts are derived from `review`. */
export const trainingSession = pgTable(
  "training_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    deckConfig: jsonb("deck_config").$type<DeckConfig>().notNull(),
    targetCount: integer("target_count").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("training_session_user_idx").on(t.userId, t.startedAt)],
);

/** Append-only: one row per answer attempt. Every statistic is derived from this table. */
export const review = pgTable(
  "review",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => trainingSession.id, { onDelete: "set null" }),
    questionId: text("question_id").notNull(),
    familyId: text("family_id").notNull(),
    imageId: text("image_id").notNull(),
    angle: text("angle").notNull(),
    exposure: text("exposure").notNull(),
    conditions: text("conditions").notNull(),
    chosenFamilyId: text("chosen_family_id").notNull(),
    attemptNo: smallint("attempt_no").notNull(),
    correct: boolean("correct").notNull(),
    hintShown: boolean("hint_shown").notNull().default(false),
    latencyMs: integer("latency_ms").notNull(),
    /** FSRS rating applied on the final attempt of a question (1–4), null otherwise */
    rating: smallint("rating"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("review_user_created_idx").on(t.userId, t.createdAt),
    index("review_user_family_idx").on(t.userId, t.familyId),
    uniqueIndex("review_question_attempt_uq").on(t.questionId, t.attemptNo),
  ],
);

export const deckPreset = pgTable(
  "deck_preset",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    config: jsonb("config").$type<DeckConfig>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deck_preset_user_idx").on(t.userId)],
);

export type UserPrefsData = {
  deck?: DeckConfig;
  reducedMotion?: "system" | "on" | "off";
  sound?: boolean;
};

export const userPrefs = pgTable("user_prefs", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<UserPrefsData>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const reviewRelations = relations(review, ({ one }) => ({
  user: one(user, { fields: [review.userId], references: [user.id] }),
  session: one(trainingSession, { fields: [review.sessionId], references: [trainingSession.id] }),
}));
