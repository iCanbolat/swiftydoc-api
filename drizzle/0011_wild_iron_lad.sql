CREATE TYPE "public"."auth_identity_provider" AS ENUM('password', 'google_oidc', 'microsoft_oidc', 'saml');--> statement-breakpoint
CREATE TYPE "public"."mfa_factor_type" AS ENUM('totp', 'email_otp', 'sms_otp', 'webauthn');--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" "auth_identity_provider" NOT NULL,
	"provider_subject" varchar(255) NOT NULL,
	"password_hash" text,
	"email_verified_at" timestamp with time zone,
	"last_authenticated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"factor_type" "mfa_factor_type" NOT NULL,
	"label" varchar(120),
	"secret_ciphertext" text,
	"verified_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"replaced_by_token_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"active_workspace_id" text,
	"access_token_hash" text NOT NULL,
	"ip_address" varchar(64),
	"user_agent" varchar(500),
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_user_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_active_workspace_id_workspaces_id_fk" FOREIGN KEY ("active_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_subject_key" ON "auth_identities" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_user_provider_key" ON "auth_identities" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_idx" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_factors_user_idx" ON "mfa_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_factors_org_idx" ON "mfa_factors" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_idx" ON "refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_revoked_idx" ON "refresh_tokens" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_access_token_hash_key" ON "user_sessions" USING btree ("access_token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_org_idx" ON "user_sessions" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "user_sessions_org_revoked_idx" ON "user_sessions" USING btree ("organization_id","revoked_at");