CREATE TABLE `finding_events` (
  `id` VARCHAR(191) NOT NULL,
  `finding_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NULL,
  `event_type` VARCHAR(191) NOT NULL,
  `comment` TEXT NULL,
  `old_value` TEXT NULL,
  `new_value` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `finding_events_finding_id_created_at_idx` (`finding_id`, `created_at`),
  INDEX `finding_events_user_id_idx` (`user_id`),
  CONSTRAINT `finding_events_finding_id_fkey` FOREIGN KEY (`finding_id`) REFERENCES `findings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `finding_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `uploaded_assets` MODIFY `id` VARCHAR(191) NOT NULL;

CREATE TABLE `organization_invites` (
  `id` VARCHAR(191) NOT NULL,
  `organization_id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'member',
  `token_hash` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `invited_by` VARCHAR(191) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `accepted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `organization_invites_token_hash_key` (`token_hash`),
  INDEX `organization_invites_org_status_idx` (`organization_id`, `status`, `created_at`),
  INDEX `organization_invites_email_status_idx` (`email`, `status`),
  CONSTRAINT `organization_invites_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `organization_invites_invited_by_fkey` FOREIGN KEY (`invited_by`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `scanner_policies` (
  `id` VARCHAR(191) NOT NULL,
  `organization_id` VARCHAR(191) NULL,
  `project_id` VARCHAR(191) NULL,
  `enabled_engines` TEXT NOT NULL,
  `severity_threshold` VARCHAR(191) NOT NULL DEFAULT 'Info',
  `rule_overrides` TEXT NULL,
  `ai_triage_enabled` BOOLEAN NOT NULL DEFAULT true,
  `secret_verification_enabled` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `scanner_policies_organization_id_key` (`organization_id`),
  UNIQUE INDEX `scanner_policies_project_id_key` (`project_id`),
  CONSTRAINT `scanner_policies_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `scanner_policies_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
