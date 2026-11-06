CREATE TABLE `pantry_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`quantity` real,
	`unit` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`section` text NOT NULL,
	`amount` text DEFAULT '' NOT NULL,
	`to_taste` integer DEFAULT false NOT NULL,
	`sources` text DEFAULT '[]' NOT NULL,
	`cost` real,
	`pantry_note` text,
	`checked` integer DEFAULT false NOT NULL,
	`manual` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `shopping_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shopping_items_list_idx` ON `shopping_items` (`list_id`);--> statement-breakpoint
CREATE TABLE `shopping_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`week_start` text NOT NULL,
	`fingerprint` text NOT NULL,
	`covered` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_lists_week_start_unique` ON `shopping_lists` (`week_start`);