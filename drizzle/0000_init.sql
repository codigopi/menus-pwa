CREATE TABLE `recipe_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`group_label` text,
	`quantity` real,
	`unit` text,
	`name` text NOT NULL,
	`note` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredients_recipe_idx` ON `recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`servings` integer DEFAULT 2 NOT NULL,
	`prep_minutes` integer,
	`cook_minutes` integer,
	`steps` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`photo` text,
	`source_url` text,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`rating` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recipes_updated_idx` ON `recipes` (`updated_at`);