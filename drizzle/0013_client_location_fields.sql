CREATE TYPE "public"."audit_auth_surface" AS ENUM('internal', 'portal', 'public', 'system');--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "auth_surface" "audit_auth_surface" DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "active_workspace_id" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "impersonator_actor_id" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "impersonator_session_id" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "province" varchar(120);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "district" varchar(120);--> statement-breakpoint
CREATE INDEX "audit_events_auth_surface_created_at_idx" ON "audit_events" USING btree ("auth_surface","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_session_created_at_idx" ON "audit_events" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_workspace_created_at_idx" ON "audit_events" USING btree ("active_workspace_id","created_at");