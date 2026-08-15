import { requireAdminSession } from "@/lib/admin-auth";
import { ensureCurrentRegistrationConfig } from "@/lib/registration-defaults";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { buildPaymentPlan } from "@/lib/payment-plan";
import { createPrivateLinkToken } from "@/lib/private-links";

export const dynamic = "force-dynamic";

function value(input: unknown, maximum = 160) {
  return typeof input === "string" ? input.trim().slice(0, maximum) : "";
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as { name?: unknown; birthDate?: unknown; group?: unknown; groupId?: unknown; phone?: unknown; yearId?: unknown };
    const name = value(body.name);
    const birthDate = value(body.birthDate, 10);
    const group = value(body.group, 80) || "Not assigned";
    const phone = value(body.phone, 40);
    if (!name) return Response.json({ error: "Student name is required." }, { status: 400 });
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return Response.json({ error: "Birth date is invalid." }, { status: 400 });
    const settings = await ensureCurrentRegistrationConfig(runtime.DB, value(body.yearId, 80) || null);
    const groupId = value(body.groupId, 80);
    const selectedGroup = groupId ? await runtime.DB.prepare(`SELECT id, name FROM groups WHERE id = ? AND school_year_id = ? AND status = 'active' LIMIT 1`).bind(groupId, settings.schoolYearId).first<{ id: string; name: string }>() : null;
    if (groupId && !selectedGroup) return Response.json({ error: "Selected group was not found." }, { status: 400 });
    const scheduleLink = await createPrivateLinkToken(runtime);
    const now = new Date().toISOString();
    const registrationId = crypto.randomUUID();
    const studentId = crypto.randomUUID();
    const enrollmentId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [
      runtime.DB.prepare(`
        INSERT INTO registrations (
          id, school_year_id, agreement_version_id, status, participant_full_name, participant_birth_date,
          father_phone, registration_fee_agorot, monthly_fee_agorot, june_fee_agorot, security_check_agorot,
          payment_proof_status, payment_status, pricing_snapshot_json, form_snapshot_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, 'not_required', 'pending', ?, ?, ?, ?)
      `).bind(registrationId, settings.schoolYearId, settings.agreementVersionId, name, birthDate || null, phone || null, settings.registrationFeeAgorot, settings.monthlyFeeAgorot, settings.juneFeeAgorot, settings.securityCheckAgorot, JSON.stringify({ currency: "ILS", registrationFeeAgorot: settings.registrationFeeAgorot, monthlyFeeAgorot: settings.monthlyFeeAgorot, juneFeeAgorot: settings.juneFeeAgorot, securityCheckAgorot: settings.securityCheckAgorot }), JSON.stringify({ source: "manual", phone }), now, now),
      runtime.DB.prepare(`INSERT INTO students (id, created_from_registration_id, full_name, birth_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`).bind(studentId, registrationId, name, birthDate || null, now, now),
      runtime.DB.prepare(`
        INSERT INTO enrollments (id, student_id, school_year_id, registration_id, group_id, status, group_label, schedule_token_hash, schedule_token_ciphertext, registration_fee_agorot, monthly_fee_agorot, june_fee_agorot, security_check_agorot, enrolled_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(enrollmentId, studentId, settings.schoolYearId, registrationId, selectedGroup?.id || null, selectedGroup?.name || (group === "Not assigned" ? null : group), scheduleLink.tokenHash, scheduleLink.tokenCiphertext, settings.registrationFeeAgorot, settings.monthlyFeeAgorot, settings.juneFeeAgorot, settings.securityCheckAgorot, now, now, now),
    ];
    const periods = buildPaymentPlan({ startsOn: settings.startsOn, endsOn: settings.endsOn, registrationFeeAgorot: settings.registrationFeeAgorot, monthlyFeeAgorot: settings.monthlyFeeAgorot, juneFeeAgorot: settings.juneFeeAgorot, dueDay: settings.paymentDueDay });
    for (const period of periods) {
      statements.push(runtime.DB.prepare(`INSERT INTO payment_items (id, enrollment_id, school_year_id, registration_id, period_key, label, due_on, amount_due_agorot, amount_paid_agorot, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, ?)`).bind(crypto.randomUUID(), enrollmentId, settings.schoolYearId, registrationId, period.periodKey, period.label, period.dueOn, period.amountDueAgorot, now, now));
    }
    statements.push(runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'student.created_manual', 'registration', ?, 'Student added manually', ?, ?)`).bind(settings.schoolYearId, admin.id, registrationId, JSON.stringify({ group, phoneProvided: Boolean(phone) }), now));
    await runtime.DB.batch(statements);
    return Response.json({ registrationId, scheduleUrl: `${new URL(request.url).origin}/schedule/${encodeURIComponent(scheduleLink.token)}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Student could not be added." }, { status: 500 });
  }
}
