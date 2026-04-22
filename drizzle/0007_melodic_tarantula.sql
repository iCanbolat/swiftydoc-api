CREATE TYPE "public"."audit_event_channel" AS ENUM('api', 'portal', 'email', 'sms', 'whatsapp', 'webhook', 'review_panel', 'system');--> statement-breakpoint
CREATE TYPE "public"."reminder_channel" AS ENUM('email', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."reminder_provider" AS ENUM('plivo', 'resend', 'whatsapp_cloud_api');--> statement-breakpoint
CREATE TABLE "organization_branding_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"logo_url" varchar(512),
	"primary_color" varchar(16),
	"secondary_color" varchar(16),
	"email_from_name" varchar(160),
	"email_reply_to" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_email_template_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"template_key" varchar(120) NOT NULL,
	"locale" varchar(16) DEFAULT 'en' NOT NULL,
	"provider" "reminder_provider" DEFAULT 'resend' NOT NULL,
	"branding_setting_id" text,
	"resend_template_id" varchar(120),
	"subject_template" text NOT NULL,
	"body_template" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_reminder_provider_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel" "reminder_channel" NOT NULL,
	"provider" "reminder_provider" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "channel" "audit_event_channel";--> statement-breakpoint
ALTER TABLE "organization_branding_settings" ADD CONSTRAINT "organization_branding_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_email_template_variants" ADD CONSTRAINT "organization_email_template_variants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_email_template_variants" ADD CONSTRAINT "organization_email_template_variants_branding_setting_id_organization_branding_settings_id_fk" FOREIGN KEY ("branding_setting_id") REFERENCES "public"."organization_branding_settings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_reminder_provider_configs" ADD CONSTRAINT "organization_reminder_provider_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_branding_settings_org_key" ON "organization_branding_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_email_tpl_variants_org_key_locale_key" ON "organization_email_template_variants" USING btree ("organization_id","template_key","locale");--> statement-breakpoint
CREATE INDEX "org_email_tpl_variants_org_template_idx" ON "organization_email_template_variants" USING btree ("organization_id","template_key");--> statement-breakpoint
CREATE UNIQUE INDEX "org_reminder_provider_configs_org_channel_key" ON "organization_reminder_provider_configs" USING btree ("organization_id","channel");--> statement-breakpoint
CREATE INDEX "org_reminder_provider_configs_org_enabled_idx" ON "organization_reminder_provider_configs" USING btree ("organization_id","enabled");