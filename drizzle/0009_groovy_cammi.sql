CREATE TABLE "integration_external_references" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"provider_key" "integration_provider_key" NOT NULL,
	"local_resource_type" varchar(120) NOT NULL,
	"local_resource_id" text NOT NULL,
	"external_object_type" varchar(120) NOT NULL,
	"external_id" text NOT NULL,
	"external_reference_key" varchar(120),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_external_references" ADD CONSTRAINT "integration_external_references_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_external_references" ADD CONSTRAINT "integration_external_references_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_external_refs_connection_local_obj_key" ON "integration_external_references" USING btree ("connection_id","local_resource_type","local_resource_id","external_object_type");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_external_refs_connection_external_obj_key" ON "integration_external_references" USING btree ("connection_id","external_object_type","external_id");--> statement-breakpoint
CREATE INDEX "integration_external_refs_org_provider_idx" ON "integration_external_references" USING btree ("organization_id","provider_key");