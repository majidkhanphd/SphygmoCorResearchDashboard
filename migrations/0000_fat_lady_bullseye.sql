CREATE TABLE "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" varchar NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "database_backups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"record_count" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pmid" varchar,
	"pmc_id" varchar,
	"title" text NOT NULL,
	"authors" text NOT NULL,
	"journal" text NOT NULL,
	"publication_date" timestamp NOT NULL,
	"abstract" text,
	"doi" varchar,
	"keywords" json DEFAULT '[]'::json,
	"research_area" text,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"citation_count" integer DEFAULT 0,
	"is_featured" integer DEFAULT 0,
	"pubmed_url" text,
	"journal_impact_factor" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"suggested_categories" json,
	"category_review_status" text,
	"category_reviewed_by" varchar,
	"category_reviewed_at" timestamp,
	"categories_last_updated_by" varchar,
	"sync_source" text DEFAULT 'unknown',
	"keyword_evidence" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "publications_pmid_unique" UNIQUE("pmid")
);
