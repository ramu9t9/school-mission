CREATE TABLE "kids" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"grade" text,
	"section" text,
	"school_name" text,
	"avatar_color" text DEFAULT '#2563EB' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watched_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"kid_id" integer NOT NULL,
	"group_id" text,
	"group_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watched_groups_kid_name_unique" UNIQUE("kid_id","group_name")
);
--> statement-breakpoint
ALTER TABLE "watched_groups" ADD CONSTRAINT "watched_groups_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE cascade ON UPDATE no action;