CREATE TYPE "public"."notify_mode" AS ENUM('once', 'persistent', 'insist');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('pending', 'done', 'snoozed', 'archived');--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reminder_id" uuid NOT NULL,
	"subscription_id" uuid,
	"attempt" integer DEFAULT 1 NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"detail" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_label" text DEFAULT 'Dispositivo' NOT NULL,
	"expired_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"due_at" timestamp with time zone,
	"notify_at" timestamp with time zone,
	"notify_mode" "notify_mode" DEFAULT 'once' NOT NULL,
	"insist_interval_minutes" integer DEFAULT 60 NOT NULL,
	"max_repeats" integer DEFAULT 5 NOT NULL,
	"status" "reminder_status" DEFAULT 'pending' NOT NULL,
	"snoozed_until" timestamp with time zone,
	"recurrence_interval_days" integer,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"timezone" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	"quiet_start_minutes" smallint DEFAULT 1380 NOT NULL,
	"quiet_end_minutes" smallint DEFAULT 480 NOT NULL,
	"default_insist_interval_minutes" integer DEFAULT 60 NOT NULL,
	"default_max_repeats" integer DEFAULT 5 NOT NULL,
	"review_on_open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_log_reminder_idx" ON "notification_log" USING btree ("reminder_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "reminders_user_status_idx" ON "reminders" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("status","notify_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");