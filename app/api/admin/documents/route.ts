import { agreementSections } from "@/app/agreement-2026-2027";
import { requireAdminSession } from "@/lib/admin-auth";
import { dateLabels } from "@/lib/calendar";
import { generateLyricsPdf, generateRowsPdf, generateSimpleAgreementPdf, mergePdfFiles } from "@/lib/choir-documents";
import { loadChoirDocumentAssets } from "@/lib/document-assets";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

function value(input: unknown, max = 20000) { return typeof input === "string" ? input.trim().slice(0, max) : ""; }
function pdfResponse(bytes: Uint8Array, filename: string, headers: Record<string, string> = {}) {
  return new Response(bytes as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "-")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const url = new URL(request.url);
    const kind = value(url.searchParams.get("kind"), 40);
    const yearId = value(url.searchParams.get("yearId"), 80);
    const groupId = value(url.searchParams.get("groupId"), 80);
    const pdfAssets = await loadChoirDocumentAssets(request, runtime);
    if (kind === "bulk-agreements") {
      const rows = await runtime.DB.prepare(`SELECT sf.storage_key FROM signed_agreements sa JOIN registrations r ON r.id = sa.registration_id JOIN stored_files sf ON sf.id = sa.pdf_file_id LEFT JOIN enrollments e ON e.registration_id = r.id WHERE (? = '' OR r.school_year_id = ?) AND (? = '' OR e.group_id = ?) ORDER BY r.participant_full_name LIMIT 250`).bind(yearId, yearId, groupId, groupId).all<{ storage_key: string }>();
      if (!rows.results.length) return Response.json({ error: "No signed agreements match this selection." }, { status: 404 });
      const files: Uint8Array[] = [];
      for (const row of rows.results) {
        const object = await runtime.BUCKET.get(row.storage_key);
        if (object) files.push(new Uint8Array(await object.arrayBuffer()));
      }
      return pdfResponse(await mergePdfFiles(files), `choir-chug-signed-agreements-${yearId || "all"}.pdf`);
    }
    if (kind === "blank-agreement") {
      const year = yearId ? await runtime.DB.prepare(`SELECT name FROM school_years WHERE id = ? LIMIT 1`).bind(yearId).first<{ name: string }>() : null;
      const activeAgreement = yearId ? await runtime.DB.prepare(`SELECT sections_json FROM agreement_versions WHERE school_year_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1`).bind(yearId).first<{ sections_json: string }>() : null;
      const sections = activeAgreement ? JSON.parse(activeAgreement.sections_json) as typeof agreementSections : agreementSections;
      const bytes = await generateSimpleAgreementPdf({ title: "Registration & Agreement Form", schoolYear: year?.name || "Choir Chug", sections: sections.filter((section) => section.title !== "Introduction").map((section) => ({ title: section.title, paragraphs: section.paragraphs.map((paragraph) => paragraph.text) })) }, pdfAssets);
      return pdfResponse(bytes, `choir-chug-blank-agreement-${year?.name || "current"}.pdf`);
    }
    if (kind === "class-list") {
      const group = groupId ? await runtime.DB.prepare(`SELECT name FROM groups WHERE id = ? LIMIT 1`).bind(groupId).first<{ name: string }>() : null;
      const rows = await runtime.DB.prepare(`SELECT s.full_name, s.birth_date, e.group_label, r.mother_name, r.mother_phone, r.father_name, r.father_phone FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN registrations r ON r.id = e.registration_id WHERE e.school_year_id = ? AND (? = '' OR e.group_id = ?) AND e.status = 'active' ORDER BY s.full_name`).bind(yearId, groupId, groupId).all<{ full_name: string; birth_date: string | null; group_label: string | null; mother_name: string | null; mother_phone: string | null; father_name: string | null; father_phone: string | null }>();
      const bytes = await generateRowsPdf({ title: group ? `${group.name} Class List` : "Choir Chug Class List", subtitle: `${rows.results.length} students`, rows: rows.results.map((row, index) => ({ date: String(index + 1), title: row.full_name, details: [row.birth_date, row.group_label, row.mother_name || row.father_name, row.mother_phone || row.father_phone].filter(Boolean).join(" · ") })) }, pdfAssets);
      return pdfResponse(bytes, `choir-chug-class-list-${group?.name || yearId}.pdf`);
    }
    if (kind === "schedule") {
      const year = await runtime.DB.prepare(`SELECT name FROM school_years WHERE id = ? LIMIT 1`).bind(yearId).first<{ name: string }>();
      const group = groupId ? await runtime.DB.prepare(`SELECT name FROM groups WHERE id = ? LIMIT 1`).bind(groupId).first<{ name: string }>() : null;
      const rows = await runtime.DB.prepare(`SELECT se.title_en, se.title_he, se.starts_at, se.ends_at, se.location, se.note, se.kind, se.status, g.name AS group_name FROM schedule_events se LEFT JOIN groups g ON g.id = se.group_id WHERE se.school_year_id = ? AND (? = '' OR se.group_id = ?) ORDER BY se.starts_at, g.name`).bind(yearId, groupId, groupId).all<{ title_en: string; title_he: string | null; starts_at: string; ends_at: string | null; location: string | null; note: string | null; kind: string; status: string; group_name: string | null }>();
      const bytes = await generateRowsPdf({ title: group ? `${group.name} Schedule` : "Choir Chug Schedule", subtitle: year?.name || "", rows: rows.results.map((row) => { const date = row.starts_at.slice(0, 10); return { date: dateLabels(date).gregorianEn, hebrewDate: dateLabels(date).hebrewEn, title: `${row.status === "cancelled" ? "Cancelled — " : ""}${row.title_en}${row.title_he ? ` · ${row.title_he}` : ""}`, details: [row.group_name, `${row.starts_at.slice(11, 16)}${row.ends_at ? `–${row.ends_at.slice(11, 16)}` : ""}`, row.location, row.kind].filter(Boolean).join(" · "), note: row.note || undefined }; }) }, pdfAssets);
      return pdfResponse(bytes, `choir-chug-schedule-${group?.name || yearId}.pdf`);
    }
    return Response.json({ error: "Choose a document type." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Document could not be created." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    if (body.kind !== "lyrics") return Response.json({ error: "Choose a document type." }, { status: 400 });
    const title = value(body.title, 160);
    const lyrics = value(body.lyrics, 80_000);
    const pageSize = body.pageSize === "A5" ? "A5" : "A4";
    if (!title || !lyrics) return Response.json({ error: "Song title and lyrics are required." }, { status: 400 });
    const result = await generateLyricsPdf({ title, subtitle: value(body.subtitle, 200), lyrics, pageSize }, await loadChoirDocumentAssets(request, runtime));
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare(`INSERT INTO saved_documents (id, school_year_id, group_id, kind, title, subtitle, page_size, content_json, created_by, created_at, updated_at) VALUES (?, ?, ?, 'lyrics', ?, ?, ?, ?, ?, ?, ?)`).bind(id, value(body.yearId, 80) || null, value(body.groupId, 80) || null, title, value(body.subtitle, 200) || null, pageSize, JSON.stringify({ lyrics, onePage: result.onePage, fontSize: result.fontSize, pageCount: result.pageCount }), admin.id, now, now),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'document.lyrics_created', 'saved_document', ?, 'Lyrics document created', ?, ?)`).bind(value(body.yearId, 80) || null, admin.id, id, JSON.stringify({ title, pageSize, onePage: result.onePage, pageCount: result.pageCount }), now),
    ]);
    return pdfResponse(result.bytes, `${title}-${pageSize}.pdf`, { "X-Choir-Document-Id": id, "X-Choir-One-Page": result.onePage ? "true" : "false", "X-Choir-Page-Count": String(result.pageCount) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Lyrics document could not be created." }, { status: 500 });
  }
}
