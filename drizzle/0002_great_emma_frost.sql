CREATE TABLE `barbershop_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`barbershopId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','client') NOT NULL DEFAULT 'client',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `barbershop_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `barbershops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`address` varchar(500),
	`phone` varchar(20),
	`logoUrl` varchar(500),
	`subscriptionStatus` enum('active','blocked','trial') NOT NULL DEFAULT 'trial',
	`subscriptionExpiresAt` timestamp,
	`ownerId` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `barbershops_id` PRIMARY KEY(`id`),
	CONSTRAINT `barbershops_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','superadmin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `appointments` ADD `barbershopId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `blocked_dates` ADD `barbershopId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `barbershopId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `working_hours` ADD `barbershopId` int NOT NULL;