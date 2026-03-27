CREATE TABLE "background_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_type" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"phase" text DEFAULT 'Idle',
	"progress" jsonb DEFAULT '{"processed":0,"total":0}'::jsonb,
	"stats" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"start_time" timestamp,
	"end_time" timestamp,
	"last_success_time" timestamp,
	"history" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "background_tasks_task_type_unique" UNIQUE("task_type")
);
