CREATE TABLE `cook_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text,
	`recipe_title` text NOT NULL,
	`cooked_on` text NOT NULL,
	`meal` text,
	`slot_id` text,
	`rating` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`slot_id`) REFERENCES `meal_slots`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `cook_logs_recipe_idx` ON `cook_logs` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `cook_logs_date_idx` ON `cook_logs` (`cooked_on`);