DROP INDEX "review_question_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "review_question_attempt_uq" ON "review" USING btree ("question_id","attempt_no");