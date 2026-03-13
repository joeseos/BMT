CREATE TABLE `access_breakpoints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`access_type` text NOT NULL,
	`breakpoint_one_time` real NOT NULL,
	`breakpoint_monthly` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `approval_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deal_id` integer,
	`level` text NOT NULL,
	`approver_name` text,
	`action` text NOT NULL,
	`comments` text,
	`timestamp` text,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approval_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` text NOT NULL,
	`display_name` text NOT NULL,
	`max_payback_months` integer,
	`min_contribution_margin` real,
	`max_contract_value_msek` real,
	`display_order` integer,
	`rule_type` text DEFAULT 'existing_customer'
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_name` text NOT NULL,
	`record_id` integer,
	`action` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`user_id` text,
	`timestamp` text
);
--> statement-breakpoint
CREATE TABLE `bandwidth_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cost_type` text NOT NULL,
	`bandwidth_mbit` real NOT NULL,
	`utilization` real,
	`cost_per_mbit_monthly` real,
	`annual_cost` real
);
--> statement-breakpoint
CREATE TABLE `deal_additional_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deal_id` integer,
	`cost_type` text NOT NULL,
	`description` text,
	`year1` real DEFAULT 0,
	`year2` real DEFAULT 0,
	`year3` real DEFAULT 0,
	`year4` real DEFAULT 0,
	`year5` real DEFAULT 0,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deal_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deal_id` integer,
	`klara_id` text,
	`site_id` text,
	`quantity` integer DEFAULT 1,
	`address` text,
	`street_number` text,
	`zip_code` text,
	`city` text,
	`country` text DEFAULT 'SE',
	`x_coord` text,
	`y_coord` text,
	`product_id` integer,
	`service_name` text,
	`capacity` integer,
	`sla_redundancy` text,
	`qos` text,
	`p_network` text,
	`comments` text,
	`contract_term` integer,
	`access_type` text,
	`access_cost_one_time` real DEFAULT 0,
	`access_cost_quarterly` real DEFAULT 0,
	`discount_one_time` real DEFAULT 0,
	`discount_monthly` real DEFAULT 0,
	`recommended_price_one_time` real,
	`recommended_price_monthly` real,
	`final_price_one_time` real,
	`final_price_monthly` real,
	`revenue_one_time` real,
	`revenue_monthly` real,
	`cogs_one_time` real,
	`cogs_monthly` real,
	`network_cost` real,
	`opex` real,
	`capex` real,
	`contribution_margin_1` real,
	`contribution_margin_2` real,
	`payback_months` real,
	`payback_status` text,
	`is_renewal` integer DEFAULT false,
	`zone` text,
	`on_off_net` text,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_deal_lines_deal_id` ON `deal_lines` (`deal_id`);--> statement-breakpoint
CREATE TABLE `deals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text NOT NULL,
	`org_number` text,
	`contract_length_months` integer DEFAULT 36 NOT NULL,
	`version` text,
	`access_request_ref` text,
	`sales_rep_id` text,
	`status` text DEFAULT 'draft',
	`approval_level` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `equipment_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`list_price_usd` real,
	`discount_percent` real,
	`net_price_sek` real NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_costs_code_unique` ON `equipment_costs` (`code`);--> statement-breakpoint
CREATE TABLE `global_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` real NOT NULL,
	`label` text,
	`category` text NOT NULL,
	`notes` text,
	`updated_at` text,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `price_list_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version_code` text NOT NULL,
	`snapshot_json` text,
	`changed_by` text,
	`notes` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `product_families` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`country` text DEFAULT 'SE' NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_families_code_unique` ON `product_families` (`code`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer,
	`country` text NOT NULL,
	`family_code` text NOT NULL,
	`display_name` text NOT NULL,
	`price_tool_code` text NOT NULL,
	`access_type` text,
	`lookup_key` text NOT NULL,
	`zone_type` integer,
	`bandwidth` integer,
	`default_access_one_time` real DEFAULT 0,
	`default_access_monthly` real DEFAULT 0,
	`list_price_one_time` real DEFAULT 0,
	`list_price_monthly` real DEFAULT 0,
	`cogs_one_time` real DEFAULT 0,
	`cogs_annual` real DEFAULT 0,
	`cpe_installation` real DEFAULT 0,
	`cpe_capex` real DEFAULT 0,
	`site_installation` real DEFAULT 0,
	`site_capex` real DEFAULT 0,
	`backbone_cost_annual` real DEFAULT 0,
	`gt_cost_annual` real DEFAULT 0,
	`opex_one_time` real DEFAULT 0,
	`opex_annual` real DEFAULT 0,
	`breakpoint_access_one_time` real DEFAULT 0,
	`breakpoint_access_annual` real DEFAULT 0,
	`marginal_surcharge` real DEFAULT 0,
	`is_addon_service` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`created_at` text,
	`updated_at` text,
	`updated_by` text,
	FOREIGN KEY (`family_id`) REFERENCES `product_families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_lookup_key_unique` ON `products` (`lookup_key`);--> statement-breakpoint
CREATE INDEX `idx_lookup_key` ON `products` (`lookup_key`);--> statement-breakpoint
CREATE INDEX `idx_family_code` ON `products` (`family_code`);--> statement-breakpoint
CREATE INDEX `idx_country_family` ON `products` (`country`,`family_code`);--> statement-breakpoint
CREATE TABLE `sla_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`technology` text NOT NULL,
	`cost_component` text NOT NULL,
	`sla_bas` real DEFAULT 0,
	`sla1` real DEFAULT 0,
	`sla2` real DEFAULT 0,
	`sla3` real DEFAULT 0,
	`sla4` real DEFAULT 0,
	`sla43` real DEFAULT 0,
	`sla48` real DEFAULT 0,
	`sla49` real DEFAULT 0,
	`sla5` real DEFAULT 0,
	`sla5_sek` real DEFAULT 0,
	`sla53` real DEFAULT 0,
	`sla53_sek` real DEFAULT 0,
	`sla6` real DEFAULT 0,
	`sla6_sek` real DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `zone_breakpoints` (
	`zone` text PRIMARY KEY NOT NULL,
	`max_quarterly_access_cost` real NOT NULL,
	`display_order` integer
);
