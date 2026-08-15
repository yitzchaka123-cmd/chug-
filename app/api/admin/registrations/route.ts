import { requireAdminSession } from "@/lib/admin-auth";
import { ensureCurrentRegistrationConfig } from "@/lib/registration-defaults";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

type RegistrationRow = {
  id: string;
  participant_full_name: string;
  participant_birth_date: string | null;
  father_name: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  status: string;
  review_status: string;
  payment_proof_status: string;
  payment_status: string;
  submitted_at: string | null;
  group_label: string | null;
  agreement_id: string | null;
  proof_file_id: string | null;
  missing_payments: number;
  student_id: string | null;
  student_status: string | null;
  enrollment_id: string | null;
};

function ageFromBirthDate(value: string | null) {
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 0 && age < 100 ? age : null;
}

function birthdayWithinDays(value: string | null, days: number) {
  if (!value) return false;
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let birthday = Date.UTC(now.getUTCFullYear(), Number(match[1]) - 1, Number(match[2]));
  if (birthday < today) birthday = Date.UTC(now.getUTCFullYear() + 1, Number(match[1]) - 1, Number(match[2]));
  return birthday - today <= days * 24 * 60 * 60 * 1000;
}

function statusLabel(row: RegistrationRow) {
  if (row.review_status === "approved") return "Approved";
  if (row.missing_payments > 0) return "Missing payment";
  if (row.payment_proof_status === "uploaded") return "Proof uploaded";
  return "Awaiting approval";
}

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const url = new URL(request.url);
    const settings = await ensureCurrentRegistrationConfig(runtime.DB, url.searchParams.get("yearId"));
    const query = url.searchParams.get("q")?.trim().slice(0, 100) || "";
    const periodKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Jerusalem" }).format(new Date()).slice(0, 7);
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const result = await runtime.DB.prepare(`
      SELECT
        r.id, r.participant_full_name, r.participant_birth_date,
        r.father_name, r.father_phone, r.mother_name, r.mother_phone,
        r.status, r.review_status, r.payment_proof_status, r.payment_status, r.submitted_at,
        e.group_label, e.id AS enrollment_id, s.id AS student_id, s.status AS student_status, sa.id AS agreement_id,
        (SELECT sf.id FROM stored_files sf WHERE sf.registration_id = r.id AND sf.kind = 'payment_proof' AND sf.status = 'active' ORDER BY sf.uploaded_at DESC LIMIT 1) AS proof_file_id,
        (SELECT COUNT(*) FROM payment_items pi WHERE pi.registration_id = r.id AND pi.status NOT IN ('paid','waived') AND pi.period_key = ?) AS missing_payments
      FROM registrations r
      LEFT JOIN enrollments e ON e.registration_id = r.id
      LEFT JOIN students s ON s.created_from_registration_id = r.id
      LEFT JOIN signed_agreements sa ON sa.registration_id = r.id
      WHERE r.school_year_id = ? AND (
        ? = '' OR r.participant_full_name LIKE ? ESCAPE '\\' OR
        COALESCE(r.father_name, '') LIKE ? ESCAPE '\\' OR
        COALESCE(r.mother_name, '') LIKE ? ESCAPE '\\' OR
        COALESCE(r.father_phone, '') LIKE ? ESCAPE '\\' OR
        COALESCE(r.mother_phone, '') LIKE ? ESCAPE '\\'
      )
      ORDER BY COALESCE(r.submitted_at, r.created_at) DESC
      LIMIT 250
    `).bind(periodKey, settings.schoolYearId, query, pattern, pattern, pattern, pattern, pattern).all<RegistrationRow>();

    const students = result.results.map((row) => {
      const parentName = row.mother_name || row.father_name || "Parent not entered";
      const phone = row.mother_phone || row.father_phone || "";
      return {
        id: row.id,
        name: row.participant_full_name,
        initials: row.participant_full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""),
        age: ageFromBirthDate(row.participant_birth_date),
        group: row.group_label || "Not assigned",
        status: statusLabel(row),
        parent: parentName,
        phone,
        submittedAt: row.submitted_at,
        agreementId: row.agreement_id,
        proofFileId: row.proof_file_id,
        studentId: row.student_id,
        enrollmentId: row.enrollment_id,
        studentStatus: row.student_status,
      };
    });

    const metrics = {
      activeStudents: students.filter((student) => student.studentStatus !== "archived").length,
      awaitingApproval: students.filter((student) => student.status === "Awaiting approval" || student.status === "Proof uploaded").length,
      paymentsMissing: students.filter((student) => student.status === "Missing payment").length,
      upcomingBirthdays: result.results.filter((row) => birthdayWithinDays(row.participant_birth_date, 30)).length,
    };
    const birthdays = result.results.filter((row) => birthdayWithinDays(row.participant_birth_date, 30)).map((row) => ({ name: row.participant_full_name, birthDate: row.participant_birth_date, age: ageFromBirthDate(row.participant_birth_date) }));
    return Response.json({ students, metrics, birthdays, year: settings.schoolYearName, yearId: settings.schoolYearId, admin }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Registrations could not be loaded." }, { status: 500 });
  }
}
