import { requireAdminSession } from "@/lib/admin-auth";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { decryptJson, encryptJson } from "@/lib/security";

export const dynamic = "force-dynamic";

type RegistrationDetailRow = {
  id: string;
  participant_full_name: string;
  participant_birth_date: string | null;
  father_name: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  mother_email: string | null;
  payment_method: string | null;
  medical_information_ciphertext: string | null;
  review_status: string;
  payment_proof_status: string;
  student_id: string | null;
  student_status: string | null;
  private_notes_ciphertext: string | null;
  enrollment_id: string | null;
  group_id: string | null;
  group_label: string | null;
};

type PaymentRow = {
  id: string;
  period_key: string;
  label: string;
  due_on: string | null;
  amount_due_agorot: number;
  amount_paid_agorot: number;
  status: string;
  method: string | null;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const { id } = await context.params;
    const registration = await runtime.DB.prepare(`
      SELECT r.id, r.participant_full_name, r.participant_birth_date, r.father_name, r.father_phone,
        r.mother_name, r.mother_phone, r.mother_email, r.payment_method, r.medical_information_ciphertext,
        r.review_status, r.payment_proof_status, s.id AS student_id, s.status AS student_status,
        s.private_notes_ciphertext, e.id AS enrollment_id, e.group_id, e.group_label
      FROM registrations r
      LEFT JOIN students s ON s.created_from_registration_id = r.id
      LEFT JOIN enrollments e ON e.registration_id = r.id
      WHERE r.id = ? LIMIT 1
    `).bind(id).first<RegistrationDetailRow>();
    if (!registration) return Response.json({ error: "Registration not found." }, { status: 404 });
    const paymentResult = await runtime.DB.prepare(`
      SELECT id, period_key, label, due_on, amount_due_agorot, amount_paid_agorot, status, method
      FROM payment_items WHERE registration_id = ? ORDER BY period_key
    `).bind(id).all<PaymentRow>();
    let care: Record<string, unknown> | null = null;
    if (registration.medical_information_ciphertext) {
      care = await decryptJson<Record<string, unknown>>(registration.medical_information_ciphertext, runtime.CHOIR_DATA_KEY);
    }
    let privateNotes = "";
    if (registration.private_notes_ciphertext) {
      const decrypted = await decryptJson<{ note?: unknown }>(registration.private_notes_ciphertext, runtime.CHOIR_DATA_KEY);
      if (typeof decrypted.note === "string") privateNotes = decrypted.note;
    }
    const history = await runtime.DB.prepare(`SELECT id, action, summary, changes_json, created_at FROM audit_log WHERE (entity_type = 'registration' AND entity_id = ?) OR (entity_type = 'enrollment' AND entity_id = ?) OR (entity_type = 'student' AND entity_id = ?) ORDER BY created_at DESC LIMIT 100`).bind(id, registration.enrollment_id || "", registration.student_id || "").all<{ id: number; action: string; summary: string | null; changes_json: string; created_at: string }>();
    return Response.json({
      registration: {
        id: registration.id,
        name: registration.participant_full_name,
        birthDate: registration.participant_birth_date,
        parents: {
          fatherName: registration.father_name,
          fatherPhone: registration.father_phone,
          motherName: registration.mother_name,
          motherPhone: registration.mother_phone,
          email: registration.mother_email,
        },
        paymentMethod: registration.payment_method,
        reviewStatus: registration.review_status,
        proofStatus: registration.payment_proof_status,
        studentId: registration.student_id,
        studentStatus: registration.student_status,
        enrollmentId: registration.enrollment_id,
        groupId: registration.group_id,
        groupLabel: registration.group_label,
        privateNotes,
        care,
      },
      payments: paymentResult.results.map((payment) => ({
        id: payment.id,
        periodKey: payment.period_key,
        label: payment.label,
        dueOn: payment.due_on,
        amountDue: payment.amount_due_agorot / 100,
        amountPaid: payment.amount_paid_agorot / 100,
        status: payment.status,
        paid: payment.status === "paid",
        method: payment.method,
      })),
      history: history.results.map((item) => ({ ...item, changes: JSON.parse(item.changes_json || "{}") })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Registration could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const registration = await runtime.DB.prepare(`
      SELECT r.id, r.school_year_id, r.review_status, s.id AS student_id, s.status AS student_status
      FROM registrations r LEFT JOIN students s ON s.created_from_registration_id = r.id
      WHERE r.id = ? LIMIT 1
    `).bind(id).first<{ id: string; school_year_id: string; review_status: string; student_id: string | null; student_status: string | null }>();
    if (!registration) return Response.json({ error: "Registration not found." }, { status: 404 });
    const action = typeof body.action === "string" ? body.action : "";
    const now = new Date().toISOString();
    if (action === "approve" || action === "reopen") {
      const reviewStatus = action === "approve" ? "approved" : "awaiting_review";
      await runtime.DB.batch([
        runtime.DB.prepare(`UPDATE registrations SET review_status = ?, approved_at = ?, approved_by = ?, updated_at = ? WHERE id = ?`).bind(reviewStatus, action === "approve" ? now : null, action === "approve" ? admin.id : null, now, id),
        runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, ?, 'registration', ?, ?, ?, ?)`).bind(registration.school_year_id, admin.id, `registration.${reviewStatus}`, id, action === "approve" ? "Registration approved" : "Registration returned to review", JSON.stringify({ from: registration.review_status, to: reviewStatus }), now),
      ]);
      return Response.json({ saved: true, reviewStatus }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "notes") {
      if (!registration.student_id) return Response.json({ error: "Student record not found." }, { status: 404 });
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 8000) : "";
      const encrypted = note ? await encryptJson({ note }, runtime.CHOIR_DATA_KEY) : null;
      await runtime.DB.batch([
        runtime.DB.prepare(`UPDATE students SET private_notes_ciphertext = ?, private_notes_iv = NULL, updated_at = ? WHERE id = ?`).bind(encrypted, now, registration.student_id),
        runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'student.notes_updated', 'student', ?, 'Private notes updated', ?, ?)`).bind(registration.school_year_id, admin.id, registration.student_id, JSON.stringify({ hasNote: Boolean(note) }), now),
      ]);
      return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "archive" || action === "restore") {
      if (!registration.student_id) return Response.json({ error: "Student record not found." }, { status: 404 });
      const archived = action === "archive";
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
      await runtime.DB.batch([
        runtime.DB.prepare(`UPDATE students SET status = ?, archived_at = ?, updated_at = ? WHERE id = ?`).bind(archived ? "archived" : "active", archived ? now : null, now, registration.student_id),
        runtime.DB.prepare(`UPDATE enrollments SET status = ?, left_at = ?, archive_reason = ?, updated_at = ? WHERE student_id = ? AND school_year_id = ?`).bind(archived ? "archived" : "active", archived ? now : null, archived ? reason || null : null, now, registration.student_id, registration.school_year_id),
        runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, ?, 'student', ?, ?, ?, ?)`).bind(registration.school_year_id, admin.id, `student.${archived ? "archived" : "restored"}`, registration.student_id, archived ? "Student archived" : "Student restored", JSON.stringify({ reason }), now),
      ]);
      return Response.json({ saved: true, status: archived ? "archived" : "active" }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Choose a valid registration action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Registration could not be changed." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.confirmation !== "string" || body.confirmation.trim().toUpperCase() !== "DELETE") {
      return Response.json({ error: "Type DELETE to remove this student permanently." }, { status: 400 });
    }
    const registration = await runtime.DB.prepare(`
      SELECT r.id, r.school_year_id, r.participant_full_name, s.id AS student_id
      FROM registrations r LEFT JOIN students s ON s.created_from_registration_id = r.id
      WHERE r.id = ? LIMIT 1
    `).bind(id).first<{ id: string; school_year_id: string; participant_full_name: string; student_id: string | null }>();
    if (!registration) return Response.json({ error: "Registration not found." }, { status: 404 });
    const studentId = registration.student_id;
    const enrollments = await runtime.DB.prepare(`SELECT id FROM enrollments WHERE registration_id = ?${studentId ? " OR student_id = ?" : ""}`)
      .bind(...(studentId ? [id, studentId] : [id])).all<{ id: string }>();
    const files = await runtime.DB.prepare(`SELECT storage_key FROM stored_files WHERE registration_id = ?`).bind(id).all<{ storage_key: string }>();
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    for (const enrollment of enrollments.results) {
      statements.push(runtime.DB.prepare(`DELETE FROM payment_items WHERE enrollment_id = ?`).bind(enrollment.id));
    }
    statements.push(
      runtime.DB.prepare(`DELETE FROM payment_items WHERE registration_id = ?`).bind(id),
      runtime.DB.prepare(`DELETE FROM signed_agreements WHERE registration_id = ?`).bind(id),
      runtime.DB.prepare(`DELETE FROM registration_section_approvals WHERE registration_id = ?`).bind(id),
      runtime.DB.prepare(`DELETE FROM email_outbox WHERE registration_id = ?`).bind(id),
      runtime.DB.prepare(`DELETE FROM stored_files WHERE registration_id = ?`).bind(id),
      runtime.DB.prepare(`DELETE FROM enrollments WHERE registration_id = ?`).bind(id),
    );
    if (studentId) {
      statements.push(
        runtime.DB.prepare(`DELETE FROM enrollments WHERE student_id = ?`).bind(studentId),
        runtime.DB.prepare(`DELETE FROM students WHERE id = ?`).bind(studentId),
      );
    }
    statements.push(
      runtime.DB.prepare(`DELETE FROM registrations WHERE id = ?`).bind(id),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'student.deleted', 'registration', ?, ?, ?, ?)`)
        .bind(registration.school_year_id, admin.id, id, `${registration.participant_full_name} deleted permanently`, JSON.stringify({ name: registration.participant_full_name, enrollments: enrollments.results.length, files: files.results.length }), now),
    );
    await runtime.DB.batch(statements);
    for (const file of files.results) {
      await runtime.BUCKET.delete(file.storage_key).catch(() => undefined);
    }
    return Response.json({ deleted: true, name: registration.participant_full_name }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Student could not be deleted." }, { status: 500 });
  }
}
