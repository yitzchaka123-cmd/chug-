import { requireAdminSession } from "@/lib/admin-auth";
import { createExcelWorkbook } from "@/lib/excel";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const url = new URL(request.url);
    const yearId = url.searchParams.get("yearId")?.trim().slice(0, 80) || "";
    const registrations = await runtime.DB.prepare(`SELECT r.id, sy.name AS school_year, r.participant_full_name, r.participant_birth_date, r.father_name, r.father_phone, r.mother_name, r.mother_phone, r.mother_email, r.status, r.review_status, r.payment_method, r.payment_proof_status, r.submitted_at, e.group_label FROM registrations r JOIN school_years sy ON sy.id = r.school_year_id LEFT JOIN enrollments e ON e.registration_id = r.id WHERE (? = '' OR r.school_year_id = ?) ORDER BY sy.starts_on DESC, r.participant_full_name`).bind(yearId, yearId).all<Record<string, unknown>>();
    const groups = await runtime.DB.prepare(`SELECT sy.name AS school_year, g.name, g.age_min, g.age_max, g.start_time, g.end_time, g.location, g.status, (SELECT COUNT(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') AS students FROM groups g JOIN school_years sy ON sy.id = g.school_year_id WHERE (? = '' OR g.school_year_id = ?) ORDER BY sy.starts_on DESC, g.start_time, g.name`).bind(yearId, yearId).all<Record<string, unknown>>();
    const payments = await runtime.DB.prepare(`SELECT sy.name AS school_year, s.full_name AS student, pi.period_key, pi.label, pi.due_on, pi.amount_due_agorot / 100.0 AS amount_due, pi.amount_paid_agorot / 100.0 AS amount_paid, pi.status, pi.method, pi.marked_paid_at FROM payment_items pi JOIN school_years sy ON sy.id = pi.school_year_id JOIN enrollments e ON e.id = pi.enrollment_id JOIN students s ON s.id = e.student_id WHERE (? = '' OR pi.school_year_id = ?) ORDER BY sy.starts_on DESC, s.full_name, pi.period_key`).bind(yearId, yearId).all<Record<string, unknown>>();
    const toRows = (records: Record<string, unknown>[]) => records.length ? [Object.keys(records[0]), ...records.map((row) => Object.values(row).map((cell) => cell as string | number | boolean | null))] : [["No records"]];
    const workbook = createExcelWorkbook([
      { name: "Registrations", rows: toRows(registrations.results) },
      { name: "Groups", rows: toRows(groups.results) },
      { name: "Payments", rows: toRows(payments.results) },
    ]);
    return new Response(workbook, { headers: { "Content-Type": "application/vnd.ms-excel; charset=utf-8", "Content-Disposition": `attachment; filename="choir-chug-${yearId || "all-years"}.xls"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Excel export could not be created." }, { status: 500 });
  }
}

