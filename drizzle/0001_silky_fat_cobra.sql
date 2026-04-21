CREATE TYPE "public"."audit_category" AS ENUM('security', 'data_access', 'webhook', 'queue', 'system');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"category" "audit_category" NOT NULL,
	"action" varchar(120) NOT NULL,
	"actor_type" varchar(64),
	"actor_id" text,
	"resource_type" varchar(64),
	"resource_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_category_created_at_idx" ON "audit_events" USING btree ("category","created_at");