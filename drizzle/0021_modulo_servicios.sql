CREATE TABLE "service" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"duration_minutes" integer,
	"deposit_cents" integer,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_price_nonneg" CHECK ("service"."price_cents" >= 0),
	CONSTRAINT "service_deposit_range" CHECK ("service"."deposit_cents" IS NULL OR ("service"."deposit_cents" >= 0 AND "service"."deposit_cents" <= "service"."price_cents")),
	CONSTRAINT "service_duration_pos" CHECK ("service"."duration_minutes" IS NULL OR "service"."duration_minutes" > 0)
);
--> statement-breakpoint
ALTER TABLE "service" ADD CONSTRAINT "service_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_org_idx" ON "service" USING btree ("organization_id","position");