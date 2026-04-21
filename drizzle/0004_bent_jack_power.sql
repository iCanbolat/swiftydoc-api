CREATE TYPE "public"."file_asset_status" AS ENUM('active', 'deleted');--> statement-breakpoint
CREATE TABLE "file_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"request_id" text,
	"submission_id" text,
	"submission_item_id" text,
	"storage_key" varchar(320) NOT NULL,
	"storage_driver" varchar(16) NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"normalized_file_name" varchar(255) NOT NULL,
	"extension" varchar(16),
	"declared_mime_type" varchar(255),
	"detected_mime_type" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"status" "file_asset_status" DEFAULT 'active' NOT NULL,
	"uploaded_by_type" varchar(32) DEFAULT 'unknown' NOT NULL,
	"uploaded_by_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_submission_item_id_submission_items_id_fk" FOREIGN KEY ("submission_item_id") REFERENCES "public"."submission_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "file_assets_storage_key_key" ON "file_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "file_assets_org_created_idx" ON "file_assets" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "file_assets_submission_item_idx" ON "file_assets" USING btree ("submission_item_id");