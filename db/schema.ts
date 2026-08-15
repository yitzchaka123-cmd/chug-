import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => text(name).notNull().default(sql`CURRENT_TIMESTAMP`);

export const schoolYears = sqliteTable(
  "school_years",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    currency: text("currency").notNull().default("ILS"),
    registrationFeeAgorot: integer("registration_fee_agorot").notNull().default(0),
    monthlyFeeAgorot: integer("monthly_fee_agorot").notNull().default(0),
    juneFeeAgorot: integer("june_fee_agorot").notNull().default(0),
    securityCheckRequired: integer("security_check_required", { mode: "boolean" }).notNull().default(true),
    scheduleMode: text("schedule_mode").notNull().default("school_calendar"),
    scheduleWeekday: integer("schedule_weekday").notNull().default(3),
    scheduleStartTime: text("schedule_start_time"),
    scheduleEndTime: text("schedule_end_time"),
    paymentProofRequired: integer("payment_proof_required", { mode: "boolean" }).notNull().default(true),
    settingsJson: text("settings_json").notNull().default("{}"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("school_years_slug_unique").on(table.slug),
    index("school_years_status_idx").on(table.status),
    index("school_years_dates_idx").on(table.startsOn, table.endsOn),
  ],
);

export const agreementVersions = sqliteTable(
  "agreement_versions",
  {
    id: text("id").primaryKey(),
    schoolYearId: text("school_year_id")
      .notNull()
      .references(() => schoolYears.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    sectionsJson: text("sections_json").notNull(),
    contentHash: text("content_hash").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
    effectiveAt: text("effective_at"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("agreement_versions_year_version_unique").on(table.schoolYearId, table.version),
    index("agreement_versions_year_active_idx").on(table.schoolYearId, table.isActive),
    index("agreement_versions_content_hash_idx").on(table.contentHash),
  ],
);

export const registrations = sqliteTable(
  "registrations",
  {
    id: text("id").primaryKey(),
    schoolYearId: text("school_year_id")
      .notNull()
      .references(() => schoolYears.id, { onDelete: "restrict" }),
    agreementVersionId: text("agreement_version_id")
      .notNull()
      .references(() => agreementVersions.id, { onDelete: "restrict" }),
    customRegistrationLinkId: text("custom_registration_link_id"),
    status: text("status").notNull().default("draft"),
    reviewStatus: text("review_status").notNull().default("awaiting_review"),
    approvedAt: text("approved_at"),
    approvedBy: text("approved_by"),
    participantFullName: text("participant_full_name").notNull(),
    participantBirthDate: text("participant_birth_date"),
    fatherName: text("father_name"),
    fatherPhone: text("father_phone"),
    fatherEmail: text("father_email"),
    motherName: text("mother_name"),
    motherPhone: text("mother_phone"),
    motherEmail: text("mother_email"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    emergencyContactRelation: text("emergency_contact_relation"),
    medicalInformationCiphertext: text("medical_information_ciphertext"),
    medicalInformationIv: text("medical_information_iv"),
    paymentMethod: text("payment_method"),
    registrationFeeAgorot: integer("registration_fee_agorot").notNull().default(0),
    monthlyFeeAgorot: integer("monthly_fee_agorot").notNull().default(0),
    juneFeeAgorot: integer("june_fee_agorot").notNull().default(0),
    securityCheckAgorot: integer("security_check_agorot").notNull().default(0),
    paymentProofStatus: text("payment_proof_status").notNull().default("not_required"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    pricingSnapshotJson: text("pricing_snapshot_json").notNull().default("{}"),
    formSnapshotJson: text("form_snapshot_json").notNull().default("{}"),
    draftTokenHash: text("draft_token_hash"),
    draftExpiresAt: text("draft_expires_at"),
    downloadTokenHash: text("download_token_hash"),
    submittedAt: text("submitted_at"),
    completedAt: text("completed_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("registrations_year_status_idx").on(table.schoolYearId, table.status),
    index("registrations_year_review_idx").on(table.schoolYearId, table.reviewStatus),
    index("registrations_custom_link_idx").on(table.customRegistrationLinkId),
    index("registrations_participant_name_idx").on(table.participantFullName),
    index("registrations_submitted_at_idx").on(table.submittedAt),
    uniqueIndex("registrations_draft_token_hash_unique").on(table.draftTokenHash),
    index("registrations_draft_expiry_idx").on(table.status, table.draftExpiresAt),
    uniqueIndex("registrations_download_token_hash_unique").on(table.downloadTokenHash),
  ],
);

export const registrationSectionApprovals = sqliteTable(
  "registration_section_approvals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    registrationId: text("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    agreementVersionId: text("agreement_version_id")
      .notNull()
      .references(() => agreementVersions.id, { onDelete: "restrict" }),
    sectionKey: text("section_key").notNull(),
    sectionTitle: text("section_title").notNull(),
    sectionHash: text("section_hash").notNull(),
    approved: integer("approved", { mode: "boolean" }).notNull().default(false),
    approvedAt: text("approved_at"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("registration_section_approvals_registration_section_unique").on(
      table.registrationId,
      table.sectionKey,
    ),
    index("registration_section_approvals_agreement_idx").on(table.agreementVersionId),
  ],
);

export const storedFiles = sqliteTable(
  "stored_files",
  {
    id: text("id").primaryKey(),
    registrationId: text("registration_id").references(() => registrations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    status: text("status").notNull().default("active"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    uploadedAt: timestamp("uploaded_at"),
  },
  (table) => [
    uniqueIndex("stored_files_storage_key_unique").on(table.storageKey),
    index("stored_files_registration_kind_idx").on(table.registrationId, table.kind),
    index("stored_files_sha256_idx").on(table.sha256),
  ],
);

export const signedAgreements = sqliteTable(
  "signed_agreements",
  {
    id: text("id").primaryKey(),
    registrationId: text("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    agreementVersionId: text("agreement_version_id")
      .notNull()
      .references(() => agreementVersions.id, { onDelete: "restrict" }),
    pdfFileId: text("pdf_file_id")
      .notNull()
      .references(() => storedFiles.id, { onDelete: "restrict" }),
    signatureFileId: text("signature_file_id")
      .notNull()
      .references(() => storedFiles.id, { onDelete: "restrict" }),
    signerName: text("signer_name").notNull(),
    signerRole: text("signer_role").notNull().default("parent_or_guardian"),
    signedAt: text("signed_at").notNull(),
    documentHash: text("document_hash").notNull(),
    signatureHash: text("signature_hash").notNull(),
    documentSnapshotJson: text("document_snapshot_json").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("signed_agreements_registration_unique").on(table.registrationId),
    uniqueIndex("signed_agreements_pdf_file_unique").on(table.pdfFileId),
    uniqueIndex("signed_agreements_signature_file_unique").on(table.signatureFileId),
    index("signed_agreements_version_signed_idx").on(table.agreementVersionId, table.signedAt),
  ],
);

export const students = sqliteTable(
  "students",
  {
    id: text("id").primaryKey(),
    createdFromRegistrationId: text("created_from_registration_id").references(() => registrations.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    birthDate: text("birth_date"),
    status: text("status").notNull().default("active"),
    privateNotesCiphertext: text("private_notes_ciphertext"),
    privateNotesIv: text("private_notes_iv"),
    archivedAt: text("archived_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("students_created_from_registration_unique").on(table.createdFromRegistrationId),
    index("students_status_name_idx").on(table.status, table.fullName),
    index("students_birth_date_idx").on(table.birthDate),
  ],
);

export const groups = sqliteTable(
  "groups",
  {
    id: text("id").primaryKey(),
    schoolYearId: text("school_year_id")
      .notNull()
      .references(() => schoolYears.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ageMin: integer("age_min"),
    ageMax: integer("age_max"),
    weekday: integer("weekday").notNull().default(3),
    startTime: text("start_time"),
    endTime: text("end_time"),
    sessionLengthMinutes: integer("session_length_minutes").notNull().default(50),
    location: text("location"),
    status: text("status").notNull().default("draft"),
    announcementTitle: text("announcement_title"),
    announcementBody: text("announcement_body"),
    announcementUpdatedAt: text("announcement_updated_at"),
    shareTokenHash: text("share_token_hash"),
    shareTokenCiphertext: text("share_token_ciphertext"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("groups_year_name_unique").on(table.schoolYearId, table.name),
    uniqueIndex("groups_share_token_hash_unique").on(table.shareTokenHash),
    index("groups_year_status_idx").on(table.schoolYearId, table.status),
  ],
);

export const enrollments = sqliteTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    schoolYearId: text("school_year_id")
      .notNull()
      .references(() => schoolYears.id, { onDelete: "restrict" }),
    registrationId: text("registration_id").references(() => registrations.id, { onDelete: "set null" }),
    groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"),
    groupLabel: text("group_label"),
    scheduleTokenHash: text("schedule_token_hash"),
    scheduleTokenCiphertext: text("schedule_token_ciphertext"),
    registrationFeeAgorot: integer("registration_fee_agorot").notNull().default(0),
    monthlyFeeAgorot: integer("monthly_fee_agorot").notNull().default(0),
    juneFeeAgorot: integer("june_fee_agorot").notNull().default(0),
    securityCheckAgorot: integer("security_check_agorot").notNull().default(0),
    enrolledAt: text("enrolled_at").notNull(),
    leftAt: text("left_at"),
    archiveReason: text("archive_reason"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("enrollments_student_year_unique").on(table.studentId, table.schoolYearId),
    uniqueIndex("enrollments_registration_unique").on(table.registrationId),
    uniqueIndex("enrollments_schedule_token_hash_unique").on(table.scheduleTokenHash),
    index("enrollments_year_status_idx").on(table.schoolYearId, table.status),
    index("enrollments_group_status_idx").on(table.groupId, table.status),
    index("enrollments_year_group_idx").on(table.schoolYearId, table.groupLabel),
  ],
);

export const paymentMethods = sqliteTable(
  "payment_methods",
  {
    id: text("id").primaryKey(),
    schoolYearId: text("school_year_id")
      .notNull()
      .references(() => schoolYears.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    instructions: text("instructions").notNull().default(""),
    proofPolicy: text("proof_policy").notNull().default("optional"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("payment_methods_year_code_unique").on(table.schoolYearId, table.code),
    index("payment_methods_year_enabled_sort_idx").on(table.schoolYearId, table.enabled, table.sortOrder),
  ],
);

export const customRegistrationLinks = sqliteTable(
  "custom_registration_links",
  {
    id: text("id").primaryKey(),
    schoolYearId: text("school_year_id")
      .notNull()
      .references(() => schoolYears.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenCiphertext: text("token_ciphertext").notNull(),
    registrationFeeAgorot: integer("registration_fee_agorot"),
    monthlyFeeAgorot: integer("monthly_fee_agorot"),
    juneFeeAgorot: integer("june_fee_agorot"),
    securityCheckAgorot: integer("security_check_agorot"),
    oneTimeAmountAgorot: integer("one_time_amount_agorot"),
    monthOverridesJson: text("month_overrides_json").notNull().default("{}"),
    allowedPaymentMethod: text("allowed_payment_method"),
    proofPolicy: text("proof_policy"),
    privateNoteCiphertext: text("private_note_ciphertext"),
    status: text("status").notNull().default("active"),
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),
    expiresAt: text("expires_at"),
    disabledAt: text("disabled_at"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("custom_registration_links_token_hash_unique").on(table.tokenHash),
    index("custom_registration_links_year_status_idx").on(table.schoolYearId, table.status),
    index("custom_registration_links_group_idx").on(table.groupId),
  ],
);

export const scheduleEvents = sqliteTable(
  "schedule_events",
  {
    id: text("id").primaryKey(),
    schoolYearId: text("school_year_id")
      .notNull()
      .references(() => schoolYears.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => groups.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("session"),
    titleEn: text("title_en").notNull().default("Choir session"),
    titleHe: text("title_he"),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at"),
    location: text("location"),
    note: text("note"),
    status: text("status").notNull().default("scheduled"),
    source: text("source").notNull().default("manual"),
    sourceKey: text("source_key"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("schedule_events_group_source_key_unique").on(table.groupId, table.sourceKey),
    index("schedule_events_year_start_idx").on(table.schoolYearId, table.startsAt),
    index("schedule_events_group_start_idx").on(table.groupId, table.startsAt),
    index("schedule_events_group_status_idx").on(table.groupId, table.status),
  ],
);

export const scheduleVersions = sqliteTable(
  "schedule_versions",
  {
    id: text("id").primaryKey(),
    schoolYearId: text("school_year_id")
      .notNull()
      .references(() => schoolYears.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    scopeJson: text("scope_json").notNull().default("{}"),
    snapshotJson: text("snapshot_json").notNull(),
    status: text("status").notNull().default("finalized"),
    finalizedBy: text("finalized_by"),
    finalizedAt: text("finalized_at").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("schedule_versions_year_version_unique").on(table.schoolYearId, table.version),
    index("schedule_versions_year_finalized_idx").on(table.schoolYearId, table.finalizedAt),
  ],
);

export const paymentItems = sqliteTable(
  "payment_items",
  {
    id: text("id").primaryKey(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    schoolYearId: text("school_year_id")
      .notNull()
      .references(() => schoolYears.id, { onDelete: "restrict" }),
    registrationId: text("registration_id").references(() => registrations.id, { onDelete: "set null" }),
    proofFileId: text("proof_file_id").references(() => storedFiles.id, { onDelete: "set null" }),
    periodKey: text("period_key").notNull(),
    label: text("label").notNull(),
    dueOn: text("due_on"),
    amountDueAgorot: integer("amount_due_agorot").notNull(),
    amountPaidAgorot: integer("amount_paid_agorot").notNull().default(0),
    status: text("status").notNull().default("unpaid"),
    method: text("method"),
    markedPaidAt: text("marked_paid_at"),
    markedPaidBy: text("marked_paid_by"),
    notes: text("notes"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("payment_items_enrollment_period_unique").on(table.enrollmentId, table.periodKey),
    index("payment_items_year_status_due_idx").on(table.schoolYearId, table.status, table.dueOn),
    index("payment_items_registration_idx").on(table.registrationId),
  ],
);

export const adminUsers = sqliteTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    displayName: text("display_name").notNull().default("Administrator"),
    passcodeHash: text("passcode_hash").notNull(),
    passcodeSalt: text("passcode_salt").notNull(),
    passcodeUpdatedAt: text("passcode_updated_at").notNull(),
    recoveryEmail: text("recovery_email"),
    recoveryEmailVerified: integer("recovery_email_verified", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("admin_users_email_unique").on(table.email),
    index("admin_users_status_idx").on(table.status),
  ],
);

export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    lastSeenAt: text("last_seen_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("admin_sessions_token_hash_unique").on(table.tokenHash),
    index("admin_sessions_user_expires_idx").on(table.adminUserId, table.expiresAt),
    index("admin_sessions_expires_revoked_idx").on(table.expiresAt, table.revokedAt),
  ],
);

export const authAttempts = sqliteTable(
  "auth_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identifierHash: text("identifier_hash").notNull(),
    failures: integer("failures").notNull().default(0),
    firstFailureAt: text("first_failure_at"),
    lastFailureAt: text("last_failure_at"),
    blockedUntil: text("blocked_until"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("auth_attempts_identifier_hash_unique").on(table.identifierHash),
    index("auth_attempts_blocked_until_idx").on(table.blockedUntil),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    schoolYearId: text("school_year_id").references(() => schoolYears.id, { onDelete: "set null" }),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    summary: text("summary"),
    changesJson: text("changes_json").notNull().default("{}"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("audit_log_entity_created_idx").on(table.entityType, table.entityId, table.createdAt),
    index("audit_log_actor_created_idx").on(table.actorType, table.actorId, table.createdAt),
    index("audit_log_year_created_idx").on(table.schoolYearId, table.createdAt),
  ],
);

export const savedDocuments = sqliteTable(
  "saved_documents",
  {
    id: text("id").primaryKey(),
    schoolYearId: text("school_year_id").references(() => schoolYears.id, { onDelete: "set null" }),
    groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    pageSize: text("page_size").notNull().default("A4"),
    contentJson: text("content_json").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("saved_documents_year_kind_idx").on(table.schoolYearId, table.kind),
    index("saved_documents_group_kind_idx").on(table.groupId, table.kind),
  ],
);

export const brandAssets = sqliteTable(
  "brand_assets",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull().default("logo"),
    name: text("name").notNull(),
    storedFileId: text("stored_file_id").notNull().references(() => storedFiles.id, { onDelete: "restrict" }),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("brand_assets_kind_current_idx").on(table.kind, table.isCurrent, table.status),
  ],
);

export const creativePrompts = sqliteTable(
  "creative_prompts",
  {
    id: text("id").primaryKey(),
    schoolYearId: text("school_year_id").references(() => schoolYears.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    style: text("style"),
    factsJson: text("facts_json").notNull().default("{}"),
    promptText: text("prompt_text").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("creative_prompts_year_kind_idx").on(table.schoolYearId, table.kind),
    index("creative_prompts_updated_idx").on(table.updatedAt),
  ],
);

export const backupSnapshots = sqliteTable(
  "backup_snapshots",
  {
    id: text("id").primaryKey(),
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256").notNull(),
    byteSize: integer("byte_size").notNull(),
    reason: text("reason").notNull().default("automatic"),
    status: text("status").notNull().default("ready"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("backup_snapshots_storage_key_unique").on(table.storageKey),
    index("backup_snapshots_created_idx").on(table.createdAt),
  ],
);

export const emailOutbox = sqliteTable(
  "email_outbox",
  {
    id: text("id").primaryKey(),
    registrationId: text("registration_id").references(() => registrations.id, { onDelete: "set null" }),
    recipientHash: text("recipient_hash").notNull(),
    recipientCiphertext: text("recipient_ciphertext").notNull(),
    messageCiphertext: text("message_ciphertext").notNull(),
    template: text("template").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    sentAt: text("sent_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("email_outbox_dedupe_key_unique").on(table.dedupeKey),
    index("email_outbox_status_created_idx").on(table.status, table.createdAt),
    index("email_outbox_registration_idx").on(table.registrationId),
    index("email_outbox_recipient_created_idx").on(table.recipientHash, table.createdAt),
  ],
);

export const adminRecoveryTokens = sqliteTable(
  "admin_recovery_tokens",
  {
    id: text("id").primaryKey(),
    adminUserId: text("admin_user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose").notNull().default("passcode_reset"),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("admin_recovery_tokens_hash_unique").on(table.tokenHash),
    index("admin_recovery_tokens_user_expiry_idx").on(table.adminUserId, table.expiresAt),
    index("admin_recovery_tokens_expiry_consumed_idx").on(table.expiresAt, table.consumedAt),
  ],
);
