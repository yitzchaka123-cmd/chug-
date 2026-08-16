ALTER TABLE `payment_methods` ADD `cash_handling` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `payment_methods` SET `cash_handling` = 1 WHERE `code` = 'cash';
