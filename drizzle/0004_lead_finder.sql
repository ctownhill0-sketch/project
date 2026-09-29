CREATE TYPE "public"."company_source" AS ENUM('csv', 'finder', 'manual');--> statement-breakpoint
CREATE TYPE "public"."api_outcome" AS ENUM('sent', 'failed', 'blocked_cap');--> statement-breakpoint
CREATE TYPE "public"."api_sku" AS ENUM('text_search_enterprise', 'text_search_ids', 'place_details_atmosphere');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."dedupe_status" AS ENUM('new', 'duplicate', 'possible_duplicate', 'dnc');--> statement-breakpoint
CREATE TYPE "public"."dnc_kind" AS ENUM('place_id', 'domain', 'phone');--> statement-breakpoint
CREATE TYPE "public"."enrichment_run_status" AS ENUM('done', 'failed', 'blocked_robots', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."enrichment_status" AS ENUM('none', 'queued', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('software', 'size_units', 'listing_count', 'phone', 'email', 'name', 'service_type');--> statement-breakpoint
CREATE TYPE "public"."exclusion_kind" AS ENUM('chain', 'not_a_fit');--> statement-breakpoint
CREATE TYPE "public"."exclusion_match" AS ENUM('name', 'domain', 'type');--> statement-breakpoint
CREATE TYPE "public"."fit_status" AS ENUM('ok', 'excluded', 'not_a_fit');--> statement-breakpoint
CREATE TYPE "public"."search_query_status" AS ENUM('pending', 'done', 'failed', 'skipped_cap');--> statement-breakpoint
CREATE TYPE "public"."search_run_status" AS ENUM('planned', 'running', 'done', 'stopped_cap', 'stopped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."triage_decision_kind" AS ENUM('add', 'skip', 'not_a_fit', 'dnc');--> statement-breakpoint
CREATE TYPE "public"."triage_status" AS ENUM('pending', 'added', 'skipped', 'not_a_fit', 'dnc');--> statement-breakpoint
ALTER TYPE "public"."software_kind" ADD VALUE 'propertyware' BEFORE 'none';--> statement-breakpoint
ALTER TYPE "public"."software_kind" ADD VALUE 'rentvine' BEFORE 'none';--> statement-breakpoint
ALTER TYPE "public"."software_kind" ADD VALUE 'tenantcloud' BEFORE 'none';--> statement-breakpoint
ALTER TYPE "public"."software_kind" ADD VALUE 'other' BEFORE 'none';--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sku" "api_sku" NOT NULL,
	"outcome" "api_outcome" NOT NULL,
	"http_status" integer,
	"search_run_id" uuid,
	"company_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dnc_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "dnc_kind" NOT NULL,
	"value" text NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrichment_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrichment_run_id" uuid NOT NULL,
	"place_result_id" uuid,
	"company_id" uuid,
	"kind" "evidence_kind" NOT NULL,
	"value" text NOT NULL,
	"confidence" "confidence" NOT NULL,
	"source_url" text NOT NULL,
	"quote" text
);
--> statement-breakpoint
CREATE TABLE "enrichment_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"place_result_id" uuid,
	"company_id" uuid,
	"url" text NOT NULL,
	"status" "enrichment_run_status" NOT NULL,
	"pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exclusion_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "exclusion_kind" NOT NULL,
	"category" text,
	"match" "exclusion_match" NOT NULL,
	"pattern" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"place_id" text NOT NULL,
	"first_run_id" uuid,
	"last_run_id" uuid,
	"town" text,
	"state" text,
	"display_name" text,
	"formatted_address" text,
	"types" jsonb,
	"business_status" text,
	"website_uri" text,
	"national_phone" text,
	"user_rating_count" integer,
	"google_maps_uri" text,
	"google_fetched_at" timestamp with time zone,
	"google_expires_at" timestamp with time zone,
	"website_name" text,
	"normalized_domain" text,
	"normalized_phone" text,
	"fit_status" "fit_status" DEFAULT 'ok' NOT NULL,
	"fit_reason" text,
	"fit_rule_id" uuid,
	"fit_overridden" boolean DEFAULT false NOT NULL,
	"dedupe_status" "dedupe_status" DEFAULT 'new' NOT NULL,
	"dedupe_company_id" uuid,
	"dedupe_reason" text,
	"triage_status" "triage_status" DEFAULT 'pending' NOT NULL,
	"company_id" uuid,
	"score" integer DEFAULT 0 NOT NULL,
	"score_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"why" text,
	"enrichment_status" "enrichment_status" DEFAULT 'none' NOT NULL,
	"review_flag_count" integer
);
--> statement-breakpoint
CREATE TABLE "saved_search" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"towns" jsonb NOT NULL,
	"keywords" jsonb NOT NULL,
	"territory_id" uuid
);
--> statement-breakpoint
CREATE TABLE "search_query" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_run_id" uuid NOT NULL,
	"town" text NOT NULL,
	"state" text NOT NULL,
	"keyword" text NOT NULL,
	"position" integer NOT NULL,
	"status" "search_query_status" DEFAULT 'pending' NOT NULL,
	"pages" integer DEFAULT 0 NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "search_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"saved_search_id" uuid,
	"territory_id" uuid,
	"towns" jsonb NOT NULL,
	"keywords" jsonb NOT NULL,
	"status" "search_run_status" DEFAULT 'planned' NOT NULL,
	"planned_queries" integer DEFAULT 0 NOT NULL,
	"estimated_requests" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(10, 2) DEFAULT '0' NOT NULL,
	"requests_used" integer DEFAULT 0 NOT NULL,
	"results_found" integer DEFAULT 0 NOT NULL,
	"new_found" integer DEFAULT 0 NOT NULL,
	"error" text,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "territory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territory_town" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"territory_id" uuid NOT NULL,
	"town" text NOT NULL,
	"state" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"last_searched_at" timestamp with time zone,
	"results_found" integer DEFAULT 0 NOT NULL,
	"leads_added" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triage_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"place_result_id" uuid NOT NULL,
	"decision" "triage_decision_kind" NOT NULL,
	"previous_status" "triage_status" NOT NULL,
	"company_id" uuid,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "source" "company_source" DEFAULT 'csv' NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "field_sources" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "google_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "business_email" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "service_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "review_flag_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "fit_status" text DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "fit_reason" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "size_quote" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "software_confidence" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "needs_software_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "author_name" text;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "author_uri" text;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_search_run_id_search_run_id_fk" FOREIGN KEY ("search_run_id") REFERENCES "public"."search_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dnc_entry" ADD CONSTRAINT "dnc_entry_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dnc_entry" ADD CONSTRAINT "dnc_entry_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_evidence" ADD CONSTRAINT "enrichment_evidence_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_evidence" ADD CONSTRAINT "enrichment_evidence_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_evidence" ADD CONSTRAINT "enrichment_evidence_enrichment_run_id_enrichment_run_id_fk" FOREIGN KEY ("enrichment_run_id") REFERENCES "public"."enrichment_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_evidence" ADD CONSTRAINT "enrichment_evidence_place_result_id_place_result_id_fk" FOREIGN KEY ("place_result_id") REFERENCES "public"."place_result"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_evidence" ADD CONSTRAINT "enrichment_evidence_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_run" ADD CONSTRAINT "enrichment_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_run" ADD CONSTRAINT "enrichment_run_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_run" ADD CONSTRAINT "enrichment_run_place_result_id_place_result_id_fk" FOREIGN KEY ("place_result_id") REFERENCES "public"."place_result"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_run" ADD CONSTRAINT "enrichment_run_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exclusion_rule" ADD CONSTRAINT "exclusion_rule_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exclusion_rule" ADD CONSTRAINT "exclusion_rule_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_result" ADD CONSTRAINT "place_result_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_result" ADD CONSTRAINT "place_result_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_result" ADD CONSTRAINT "place_result_first_run_id_search_run_id_fk" FOREIGN KEY ("first_run_id") REFERENCES "public"."search_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_result" ADD CONSTRAINT "place_result_last_run_id_search_run_id_fk" FOREIGN KEY ("last_run_id") REFERENCES "public"."search_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_result" ADD CONSTRAINT "place_result_dedupe_company_id_company_id_fk" FOREIGN KEY ("dedupe_company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_result" ADD CONSTRAINT "place_result_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_territory_id_territory_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_query" ADD CONSTRAINT "search_query_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_query" ADD CONSTRAINT "search_query_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_query" ADD CONSTRAINT "search_query_search_run_id_search_run_id_fk" FOREIGN KEY ("search_run_id") REFERENCES "public"."search_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_run" ADD CONSTRAINT "search_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_run" ADD CONSTRAINT "search_run_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_run" ADD CONSTRAINT "search_run_saved_search_id_saved_search_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_search"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_run" ADD CONSTRAINT "search_run_territory_id_territory_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory" ADD CONSTRAINT "territory_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory" ADD CONSTRAINT "territory_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_town" ADD CONSTRAINT "territory_town_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_town" ADD CONSTRAINT "territory_town_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_town" ADD CONSTRAINT "territory_town_territory_id_territory_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_decision" ADD CONSTRAINT "triage_decision_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_decision" ADD CONSTRAINT "triage_decision_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_decision" ADD CONSTRAINT "triage_decision_place_result_id_place_result_id_fk" FOREIGN KEY ("place_result_id") REFERENCES "public"."place_result"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_decision" ADD CONSTRAINT "triage_decision_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_usage_workspace_time_idx" ON "api_usage" USING btree ("workspace_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dnc_entry_uq" ON "dnc_entry" USING btree ("workspace_id","kind","value");--> statement-breakpoint
CREATE INDEX "enrichment_evidence_place_idx" ON "enrichment_evidence" USING btree ("place_result_id");--> statement-breakpoint
CREATE INDEX "enrichment_evidence_company_idx" ON "enrichment_evidence" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "enrichment_run_place_idx" ON "enrichment_run" USING btree ("place_result_id");--> statement-breakpoint
CREATE UNIQUE INDEX "place_result_workspace_place_uq" ON "place_result" USING btree ("workspace_id","place_id");--> statement-breakpoint
CREATE INDEX "place_result_run_idx" ON "place_result" USING btree ("last_run_id");--> statement-breakpoint
CREATE INDEX "search_query_run_idx" ON "search_query" USING btree ("search_run_id","position");--> statement-breakpoint
CREATE INDEX "search_run_workspace_idx" ON "search_run" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "territory_workspace_name_uq" ON "territory" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "territory_town_uq" ON "territory_town" USING btree ("territory_id","town","state");--> statement-breakpoint
CREATE INDEX "triage_decision_created_idx" ON "triage_decision" USING btree ("workspace_id","created_at");