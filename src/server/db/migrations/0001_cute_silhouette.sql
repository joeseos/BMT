CREATE TABLE `deal_line_addons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deal_line_id` integer NOT NULL,
	`type` text NOT NULL,
	`reference_id` integer NOT NULL,
	`quantity` integer DEFAULT 1,
	`price_one_time` real DEFAULT 0,
	`price_monthly` real DEFAULT 0,
	`cost_one_time` real DEFAULT 0,
	`cost_monthly` real DEFAULT 0,
	`capex` real DEFAULT 0,
	FOREIGN KEY (`deal_line_id`) REFERENCES `deal_lines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_deal_line_addons_line` ON `deal_line_addons` (`deal_line_id`);--> statement-breakpoint
CREATE TABLE `product_addons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`main_product_id` integer NOT NULL,
	`addon_product_id` integer NOT NULL,
	`is_default` integer DEFAULT false,
	`display_order` integer DEFAULT 0,
	FOREIGN KEY (`main_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addon_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_product_addons_main` ON `product_addons` (`main_product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_addons_addon` ON `product_addons` (`addon_product_id`);--> statement-breakpoint
CREATE TABLE `product_hardware` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`hardware_id` integer NOT NULL,
	`quantity` integer DEFAULT 1,
	`is_default` integer DEFAULT false,
	`is_required` integer DEFAULT false,
	`display_order` integer DEFAULT 0,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hardware_id`) REFERENCES `equipment_costs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_product_hardware_product` ON `product_hardware` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_hardware_hw` ON `product_hardware` (`hardware_id`);