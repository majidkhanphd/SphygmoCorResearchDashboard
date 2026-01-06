CREATE TABLE "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" varchar NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pmid" varchar,
	"title" text NOT NULL,
	"authors" text NOT NULL,
	"journal" text NOT NULL,
	"publication_date" timestamp NOT NULL,
	"abstract" text,
	"doi" varchar,
	"keywords" json DEFAULT '[]'::json,
	"categories" json DEFAULT '[]'::json,
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
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "publications_pmid_unique" UNIQUE("pmid")
);
