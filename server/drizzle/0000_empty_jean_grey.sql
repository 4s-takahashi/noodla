CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`installation_id` text NOT NULL,
	`device_name` text NOT NULL,
	`os` text NOT NULL,
	`os_version` text NOT NULL,
	`app_version` text NOT NULL,
	`os_device_id` text,
	`push_token` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_seen_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_devices_user_id` ON `devices` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_devices_user_install` ON `devices` (`user_id`,`installation_id`);--> statement-breakpoint
CREATE TABLE `node_participation_states` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`wifi_connected` integer DEFAULT false NOT NULL,
	`wifi_strength` text DEFAULT 'fair',
	`wifi_name` text,
	`is_charging` integer DEFAULT false NOT NULL,
	`battery_level` integer DEFAULT 100 NOT NULL,
	`cpu_usage` real DEFAULT 0 NOT NULL,
	`memory_usage` real DEFAULT 0 NOT NULL,
	`current_job_id` text,
	`session_start_at` text,
	`total_uptime_minutes` integer DEFAULT 0 NOT NULL,
	`today_uptime_minutes` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_nps_device_id` ON `node_participation_states` (`device_id`);--> statement-breakpoint
CREATE INDEX `idx_nps_user_id` ON `node_participation_states` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_nps_status` ON `node_participation_states` (`status`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notif_user_id` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notif_user_unread` ON `notifications` (`user_id`,`is_read`);--> statement-breakpoint
CREATE TABLE `points_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`description` text NOT NULL,
	`related_job_id` text,
	`related_device_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_points_user_id` ON `points_ledger` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_points_created_at` ON `points_ledger` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_points_user_type` ON `points_ledger` (`user_id`,`type`);--> statement-breakpoint
CREATE TABLE `rank_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`rank` text DEFAULT 'Bronze' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`next_rank_score` integer DEFAULT 1000 NOT NULL,
	`avg_processing_speed` real DEFAULT 0 NOT NULL,
	`connection_stability` real DEFAULT 0 NOT NULL,
	`avg_participation_hours` real DEFAULT 0 NOT NULL,
	`task_adoption_rate` real DEFAULT 0 NOT NULL,
	`wifi_quality_score` real DEFAULT 0 NOT NULL,
	`consecutive_days` integer DEFAULT 0 NOT NULL,
	`total_days_active` integer DEFAULT 0 NOT NULL,
	`rank_changed_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rank_ledger_user_id_unique` ON `rank_ledger` (`user_id`);--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`device_id` text,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rt_user_id` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_rt_token_hash` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`rank` text DEFAULT 'Bronze' NOT NULL,
	`is_supporter` integer DEFAULT false NOT NULL,
	`supporter_since` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);