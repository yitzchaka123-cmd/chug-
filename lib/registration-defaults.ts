import { agreementSections, agreementVersion } from "@/app/agreement-2026-2027";
import { choirConfig } from "@/app/site-config";
import { parseAgreementSections } from "@/lib/agreement-content";
import { sha256Hex } from "@/lib/security";

export const CURRENT_SCHOOL_YEAR_ID = "school-year-2026-2027";
export const CURRENT_AGREEMENT_ID = "agreement-2026-2027-v3";
const PREVIOUS_DEFAULT_AGREEMENT_ID = "agreement-2026-2027-v2";

const CASH_REMINDER_TEXT = "Please be responsible for making sure that you pay the monthly amount on time by sending it with your daughter. Please don’t make us run after you for the monthly payment.";

export type PaymentMethodSetting = {
  id: string;
  code: string;
  label: string;
  instructions: string;
  proofPolicy: "required" | "optional" | "none";
  cashHandling: boolean;
  isDefault: boolean;
};

export type RegistrationSettings = {
  schoolYearId: string;
  schoolYearName: string;
  schoolYearSlug: string;
  startsOn: string;
  endsOn: string;
  agreementVersionId: string;
  agreementVersionCode: string;
  agreementContentHash: string;
  agreementSections: ReturnType<typeof parseAgreementSections>;
  proofUploadRequired: boolean;
  cashReminderText: string;
  paymentMethods: readonly string[];
  paymentMethodRecords: PaymentMethodSetting[];
  registrationFeeAgorot: number;
  monthlyFeeAgorot: number;
  juneFeeAgorot: number;
  securityCheckAgorot: number;
  securityCheckMonths: string;
  scheduleMode: string;
  scheduleWeekday: number;
  scheduleStartTime: string;
  scheduleEndTime: string;
  sessionLengthMinutes: number;
  location: string;
  paymentDueDay: number;
  homeAddressEnabled: boolean;
  schoolEnabled: boolean;
};

type SchoolYearRow = {
  id: string;
  slug: string;
  name: string;
  starts_on: string;
  ends_on: string;
  registration_fee_agorot: number;
  monthly_fee_agorot: number;
  june_fee_agorot: number;
  payment_proof_required: number;
  schedule_mode: string;
  schedule_weekday: number;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  settings_json: string;
};

type AgreementRow = { id: string; version: number; content_hash: string; sections_json: string };

function defaultSettingsJson() {
  return JSON.stringify({
    agreementVersionCode: agreementVersion,
    cashReminderText: CASH_REMINDER_TEXT,
    securityCheckAgorot: choirConfig.currentYear.payment.securityCheckAmount * 100,
    securityCheckMonths: choirConfig.currentYear.payment.securityCheckMonths,
    timeWindow: choirConfig.currentYear.timeWindow,
    location: choirConfig.currentYear.location,
    sessionLengthMinutes: 50,
    paymentDueDay: 20,
    homeAddressEnabled: false,
    schoolEnabled: false,
  });
}

const defaultMethods = [
  { code: "bank-transfer", label: "Bank transfer", instructions: "Mercantile Bank (17), Branch 725, Account 92582127, Nechama Abergil", proof: "required", order: 10, preferred: 1 },
  { code: "bit", label: "Bit", instructions: "Complete the Bit transfer and keep the confirmation for your records.", proof: "required", order: 20, preferred: 0 },
  { code: "standing-order", label: "Standing order", instructions: "Set the standing order for the configured monthly due date.", proof: "optional", order: 30, preferred: 0 },
  { code: "checks", label: "Checks", instructions: "Provide checks according to the annual payment schedule.", proof: "optional", order: 40, preferred: 0 },
  { code: "cash", label: "Cash", instructions: "Send the monthly payment on time with your daughter.", proof: "none", order: 50, preferred: 0, cash: 1 },
] as const;

export async function ensureSystemSeed(db: D1Database) {
  const sectionsJson = JSON.stringify(agreementSections);
  const contentHash = await sha256Hex(sectionsJson);
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db.prepare(`
      INSERT OR IGNORE INTO school_years (
        id, slug, name, status, starts_on, ends_on, currency,
        registration_fee_agorot, monthly_fee_agorot, june_fee_agorot,
        security_check_required, schedule_mode, schedule_weekday,
        schedule_start_time, schedule_end_time, payment_proof_required,
        settings_json, created_at, updated_at
      ) VALUES (?, ?, ?, 'active', ?, ?, 'ILS', ?, ?, ?, 1, 'school_calendar', 3, ?, ?, ?, ?, ?, ?)
    `).bind(
      CURRENT_SCHOOL_YEAR_ID, "2026-2027", choirConfig.currentYear.label,
      "2026-09-01", "2027-06-15",
      choirConfig.currentYear.payment.registrationFeeAmount * 100,
      choirConfig.currentYear.payment.monthlyAmount * 100,
      choirConfig.currentYear.payment.juneAmount * 100,
      "17:00", "19:00",
      choirConfig.currentYear.payment.proofUpload === "required" ? 1 : 0,
      defaultSettingsJson(), now, now,
    ),
    db.prepare(`
      INSERT OR IGNORE INTO agreement_versions (
        id, school_year_id, version, title, sections_json,
        content_hash, is_active, effective_at, created_at
      ) VALUES (?, ?, 3, ?, ?, ?, 1, ?, ?)
    `).bind(
      CURRENT_AGREEMENT_ID, CURRENT_SCHOOL_YEAR_ID,
      `Choir Chug Registration Agreement ${choirConfig.currentYear.label}`,
      sectionsJson, contentHash, now, now,
    ),
    // Retire the old seeded default only while the new default is also active
    // (the state right after an upgrade); an administrator who deliberately
    // re-activates the old version through the Agreements tab is respected.
    db.prepare(`UPDATE agreement_versions SET is_active = 0 WHERE id = ? AND is_active = 1 AND (SELECT is_active FROM agreement_versions WHERE id = ?) = 1`).bind(PREVIOUS_DEFAULT_AGREEMENT_ID, CURRENT_AGREEMENT_ID),
  ];
  for (const method of defaultMethods) {
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO payment_methods (
        id, school_year_id, code, label, instructions, proof_policy, cash_handling, enabled, is_default, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).bind(`payment-method-${CURRENT_SCHOOL_YEAR_ID}-${method.code}`, CURRENT_SCHOOL_YEAR_ID, method.code, method.label, method.instructions, method.proof, "cash" in method ? method.cash : 0, method.preferred, method.order, now, now));
  }
  await db.batch(statements);
  return contentHash;
}

export async function ensureCurrentRegistrationConfig(db: D1Database, requestedYearId?: string | null): Promise<RegistrationSettings> {
  await ensureSystemSeed(db);
  const year = requestedYearId
    ? await db.prepare(`SELECT * FROM school_years WHERE id = ? AND status != 'archived' LIMIT 1`).bind(requestedYearId).first<SchoolYearRow>()
    : await db.prepare(`SELECT * FROM school_years WHERE status = 'active' ORDER BY starts_on DESC LIMIT 1`).first<SchoolYearRow>();
  if (!year) throw new Error("Registration settings are unavailable.");

  const agreement = await db.prepare(`
    SELECT id, version, content_hash, sections_json FROM agreement_versions
    WHERE school_year_id = ? AND is_active = 1
    ORDER BY version DESC LIMIT 1
  `).bind(year.id).first<AgreementRow>();
  if (!agreement) throw new Error("The active agreement is unavailable for this school year.");
  if (agreement.content_hash !== await sha256Hex(agreement.sections_json)) {
    throw new Error("The published agreement text changed without a new agreement version.");
  }
  const activeAgreementSections = parseAgreementSections(JSON.parse(agreement.sections_json));

  let settings: Record<string, unknown> = {};
  try { settings = JSON.parse(year.settings_json) as Record<string, unknown>; } catch { settings = {}; }

  const methodRows = await db.prepare(`
    SELECT id, code, label, instructions, proof_policy, cash_handling, is_default
    FROM payment_methods WHERE school_year_id = ? AND enabled = 1
    ORDER BY sort_order, label
  `).bind(year.id).all<{ id: string; code: string; label: string; instructions: string; proof_policy: string; cash_handling: number; is_default: number }>();
  const paymentMethodRecords = methodRows.results.map((method) => ({
    id: method.id,
    code: method.code,
    label: method.label,
    instructions: method.instructions,
    proofPolicy: (["required", "optional", "none"].includes(method.proof_policy) ? method.proof_policy : "optional") as PaymentMethodSetting["proofPolicy"],
    cashHandling: Boolean(method.cash_handling),
    isDefault: Boolean(method.is_default),
  }));

  const securityCheckAgorot = typeof settings.securityCheckAgorot === "number"
    ? Math.max(0, Math.round(settings.securityCheckAgorot))
    : Math.max(0, year.monthly_fee_agorot * 8 + year.june_fee_agorot);
  return {
    schoolYearId: year.id,
    schoolYearName: year.name,
    schoolYearSlug: year.slug,
    startsOn: year.starts_on,
    endsOn: year.ends_on,
    agreementVersionId: agreement.id,
    agreementVersionCode: `${year.slug}-v${agreement.version}`,
    agreementContentHash: agreement.content_hash,
    agreementSections: activeAgreementSections,
    proofUploadRequired: Boolean(year.payment_proof_required),
    cashReminderText: typeof settings.cashReminderText === "string" ? settings.cashReminderText : CASH_REMINDER_TEXT,
    paymentMethods: paymentMethodRecords.map((method) => method.label),
    paymentMethodRecords,
    registrationFeeAgorot: year.registration_fee_agorot,
    monthlyFeeAgorot: year.monthly_fee_agorot,
    juneFeeAgorot: year.june_fee_agorot,
    securityCheckAgorot,
    securityCheckMonths: typeof settings.securityCheckMonths === "string" ? settings.securityCheckMonths : "October–June",
    scheduleMode: year.schedule_mode,
    scheduleWeekday: year.schedule_weekday,
    scheduleStartTime: year.schedule_start_time || "17:00",
    scheduleEndTime: year.schedule_end_time || "19:00",
    sessionLengthMinutes: typeof settings.sessionLengthMinutes === "number" ? Math.max(15, Math.round(settings.sessionLengthMinutes)) : 50,
    location: typeof settings.location === "string" ? settings.location : choirConfig.currentYear.location,
    paymentDueDay: typeof settings.paymentDueDay === "number" ? Math.min(28, Math.max(1, Math.round(settings.paymentDueDay))) : 20,
    homeAddressEnabled: settings.homeAddressEnabled === true,
    schoolEnabled: settings.schoolEnabled === true,
  };
}
