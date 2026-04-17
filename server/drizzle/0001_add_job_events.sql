CREATE TABLE `job_events` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`job_type` text NOT NULL,
	`payload` text NOT NULL,
	`user_id` text NOT NULL,
	`installation_id` text NOT NULL,
	`assigned_at` text NOT NULL,
	`responded_at` text,
	`result_status` text NOT NULL,
	`response_ms` integer,
	`result_data` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_job_events_job_id` ON `job_events` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_job_events_user_id` ON `job_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_job_events_status` ON `job_events` (`result_status`);--> statement-breakpoint
CREATE INDEX `idx_job_events_created_at` ON `job_events` (`created_at`);
