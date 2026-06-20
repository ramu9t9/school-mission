CREATE TYPE "public"."board_status" AS ENUM('todo', 'doing', 'done');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'paid', 'partial', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('none', 'scheduled', 'sent', 'failed', 'snoozed');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'confirmed', 'auto_confirmed', 'rejected', 'merged');--> statement-breakpoint
CREATE TYPE "public"."task_source" AS ENUM('ai', 'manual', 'imported');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('homework', 'test', 'timetable', 'competition', 'event', 'fee', 'notice', 'other');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"kid_id" integer NOT NULL,
	"type" "task_type" NOT NULL,
	"subject" text,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"due_time" time,
	"priority" "priority" DEFAULT 'low' NOT NULL,
	"review_status" "review_status" DEFAULT 'pending' NOT NULL,
	"board_status" "board_status" DEFAULT 'todo' NOT NULL,
	"source" "task_source" DEFAULT 'manual' NOT NULL,
	"amount_due" numeric(10, 2),
	"currency" text DEFAULT 'INR' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'not_applicable' NOT NULL,
	"payment_due_date" date,
	"reminder_at" timestamp with time zone,
	"reminder_status" "reminder_status" DEFAULT 'none' NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	"confirmed_by" integer,
	"confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;