CREATE TABLE `meal_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`week_start` text NOT NULL,
	`params` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meal_plans_week_start_unique` ON `meal_plans` (`week_start`);--> statement-breakpoint
CREATE TABLE `meal_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`date` text NOT NULL,
	`meal` text NOT NULL,
	`recipe_id` text,
	`free_text` text,
	`locked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `meal_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meal_slots_unique` ON `meal_slots` (`plan_id`,`date`,`meal`);--> statement-breakpoint
CREATE INDEX `meal_slots_recipe_idx` ON `meal_slots` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `meal_slots_date_idx` ON `meal_slots` (`date`);