ALTER TABLE "review" ALTER COLUMN "company_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "place_result_id" uuid;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_place_result_id_place_result_id_fk" FOREIGN KEY ("place_result_id") REFERENCES "public"."place_result"("id") ON DELETE no action ON UPDATE no action;