DROP INDEX `meal_slots_unique`;--> statement-breakpoint
ALTER TABLE `meal_slots` ADD `course` text DEFAULT 'unico' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `meal_slots_unique_course` ON `meal_slots` (`plan_id`,`date`,`meal`,`course`);--> statement-breakpoint
ALTER TABLE `meal_plans` ADD `single_course_days` text DEFAULT '[]' NOT NULL;