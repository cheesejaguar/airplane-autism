CREATE TABLE "report" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"family_id" text NOT NULL,
	"image_id" text,
	"reason" text NOT NULL,
	"suggested_family_id" text,
	"chosen_family_id" text,
	"note" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_status_idx" ON "report" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "report_image_idx" ON "report" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "report_user_idx" ON "report" USING btree ("user_id");