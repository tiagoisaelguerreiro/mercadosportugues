CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" bigserial NOT NULL,
	"product_market_id" bigint NOT NULL,
	"price_regular" numeric(10, 2) NOT NULL,
	"price_promo" numeric(10, 2),
	"has_promo" boolean DEFAULT false NOT NULL,
	"price_per_unit" numeric(10, 4),
	"price_per_unit_uom" varchar(8),
	"captured_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products_global" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name_global" varchar(255) NOT NULL,
	"brand" varchar(120),
	"ean_code" varchar(14),
	"category_id" integer,
	"image_url" text,
	"quantity_value" numeric(10, 3),
	"quantity_unit" varchar(8),
	"base_unit" varchar(4),
	"base_quantity" numeric(12, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_global_ean_code_unique" UNIQUE("ean_code")
);
--> statement-breakpoint
CREATE TABLE "products_market" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_global_id" bigint,
	"supermarket_id" smallint NOT NULL,
	"market_sku" varchar(64) NOT NULL,
	"name_market" varchar(255) NOT NULL,
	"product_url" text,
	"image_url" text,
	"raw_ean" varchar(14),
	"match_status" varchar(16) DEFAULT 'pending' NOT NULL,
	"match_confidence" real,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"supermarket_id" smallint NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"products_received" integer DEFAULT 0 NOT NULL,
	"new_market_products" integer DEFAULT 0 NOT NULL,
	"price_points" integer DEFAULT 0 NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"orphan_count" integer DEFAULT 0 NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "supermarkets" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"slug" varchar(40) NOT NULL,
	"name" varchar(80) NOT NULL,
	"logo_url" text,
	"base_url" text NOT NULL,
	"color_hex" varchar(7),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supermarkets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_market_id_products_market_id_fk" FOREIGN KEY ("product_market_id") REFERENCES "public"."products_market"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products_global" ADD CONSTRAINT "products_global_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products_market" ADD CONSTRAINT "products_market_product_global_id_products_global_id_fk" FOREIGN KEY ("product_global_id") REFERENCES "public"."products_global"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products_market" ADD CONSTRAINT "products_market_supermarket_id_supermarkets_id_fk" FOREIGN KEY ("supermarket_id") REFERENCES "public"."supermarkets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_runs" ADD CONSTRAINT "scrape_runs_supermarket_id_supermarkets_id_fk" FOREIGN KEY ("supermarket_id") REFERENCES "public"."supermarkets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_price_per_day" ON "price_history" USING btree ("product_market_id","captured_at");--> statement-breakpoint
CREATE INDEX "idx_price_history_pm" ON "price_history" USING btree ("product_market_id","captured_at");--> statement-breakpoint
CREATE INDEX "idx_products_global_ean" ON "products_global" USING btree ("ean_code");--> statement-breakpoint
CREATE INDEX "idx_products_global_category" ON "products_global" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pm_sku" ON "products_market" USING btree ("supermarket_id","market_sku");--> statement-breakpoint
CREATE INDEX "idx_pm_global" ON "products_market" USING btree ("product_global_id");--> statement-breakpoint
CREATE INDEX "idx_pm_status" ON "products_market" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX "idx_pm_market" ON "products_market" USING btree ("supermarket_id");--> statement-breakpoint
CREATE INDEX "idx_scrape_runs_started" ON "scrape_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_scrape_runs_market" ON "scrape_runs" USING btree ("supermarket_id","started_at");