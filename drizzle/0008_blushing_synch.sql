CREATE TYPE "public"."integration_auth_type" AS ENUM('none', 'api_key', 'bearer_token', 'basic_auth', 'oauth2');--> statement-breakpoint
CREATE TYPE "public"."integration_connection_status" AS ENUM('pending', 'connected', 'degraded', 'paused', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."integration_provider_key" AS ENUM('whatsapp_cloud_api', 'plivo', 'resend', 'zoho_books', 'odoo', 'google_drive', 'onedrive_sharepoint');--> statement-breakpoint
CREATE TYPE "public"."sync_job_status" AS ENUM('queued', 'running', 'succeeded', 'partial_success', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sync_job_type" AS ENUM('manual_sync', 'connection_test');--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"workspace_id" text,
	"provider_key" "integration_provider_key" NOT NULL,
	"auth_type" "integration_auth_type" NOT NULL,
	"credentials_ref" varchar(255),
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "integration_connection_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"last_tested_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"job_type" "sync_job_type" NOT NULL,
	"target_resource_type" varchar(120),
	"target_resource_id" text,
	"status" "sync_job_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" varchar(120),
	"last_error_message" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_connections_org_provider_idx" ON "integration_connections" USING btree ("organization_id","provider_key");--> statement-breakpoint
CREATE INDEX "integration_connections_workspace_idx" ON "integration_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_org_status_idx" ON "sync_jobs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "sync_jobs_connection_queued_idx" ON "sync_jobs" USING btree ("connection_id","queued_at");