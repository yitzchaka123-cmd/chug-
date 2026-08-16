import { ensureCurrentRegistrationConfig } from "@/lib/registration-defaults";
import { deliverOutboxEmail } from "@/lib/email";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { resolveRegistrationOffer } from "@/lib/pricing";
import { decryptJson, encryptJson, hashOpaqueToken, randomOpaqueToken, sha256Hex } from "@/lib/security";
import { validatePaymentProofImage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

type DraftBody = { token?: unknown; data?: unknown };
type DraftRow = { id: string; form_snapshot_json: string };

function stringField(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    // Saving progress may carry the registration-fee screenshot, so the parent
    // does not have to find the photo again when they come back.
    let body: DraftBody;
    let proofFile: Blob | null = null;
    if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawPayload = formData.get("payload");
      if (typeof rawPayload !== "string" || rawPayload.length > 750_000) return Response.json({ error: "Draft data is required." }, { status: 400 });
      try { body = JSON.parse(rawPayload) as DraftBody; } catch { return Response.json({ error: "Draft data is required." }, { status: 400 }); }
      const entry = formData.get("proof");
      proofFile = entry && typeof entry !== "string" && entry.size > 0 ? entry : null;
    } else {
      body = await request.json() as DraftBody;
    }
    if (!body.data || typeof body.data !== "object") return Response.json({ error: "Draft data is required." }, { status: 400 });
    const data = body.data as Record<string, unknown>;
    const form = data.form && typeof data.form === "object" ? data.form as Record<string, unknown> : {};
    const offerToken = stringField(data.offerToken, 300);
    const offer = offerToken ? await resolveRegistrationOffer(runtime, offerToken) : null;
    if (offerToken && !offer) return Response.json({ error: "This custom registration link is invalid, expired, or no longer active." }, { status: 409 });
    const settings = offer?.settings || await ensureCurrentRegistrationConfig(runtime.DB);
    const existingToken = stringField(body.token, 300);
    const token = existingToken || randomOpaqueToken();
    const tokenHash = await hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET);
    const encryptedDraft = await encryptJson(data, runtime.CHOIR_DATA_KEY);
    const encryptedCare = await encryptJson({ allergies: form.allergies, medical: form.medical, medications: form.medications, additionalNote: form.additionalNote, emergencyName: form.emergencyName, emergencyPhone: form.emergencyPhone, emergencyRelation: form.emergencyRelation }, runtime.CHOIR_DATA_KEY);
    const careIv = (JSON.parse(encryptedCare) as { iv?: string }).iv || null;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const registrationFeeAgorot = offer?.registrationFeeAgorot ?? settings.registrationFeeAgorot;
    const monthlyFeeAgorot = offer?.monthlyFeeAgorot ?? settings.monthlyFeeAgorot;
    const juneFeeAgorot = offer?.juneFeeAgorot ?? settings.juneFeeAgorot;
    const securityCheckAgorot = offer?.securityCheckAgorot ?? settings.securityCheckAgorot;
    const existing = existingToken
      ? await runtime.DB.prepare(`SELECT id, form_snapshot_json FROM registrations WHERE draft_token_hash = ? AND status = 'draft' LIMIT 1`).bind(tokenHash).first<DraftRow>()
      : null;

    let registrationId: string;
    if (existing) {
      registrationId = existing.id;
      await runtime.DB.prepare(`
        UPDATE registrations SET custom_registration_link_id = ?, participant_full_name = ?, participant_birth_date = ?, father_name = ?, father_phone = ?, father_email = ?, mother_name = ?, mother_phone = ?, mother_email = ?, emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relation = ?, medical_information_ciphertext = ?, medical_information_iv = ?, payment_method = ?, registration_fee_agorot = ?, monthly_fee_agorot = ?, june_fee_agorot = ?, security_check_agorot = ?, pricing_snapshot_json = ?, form_snapshot_json = ?, draft_expires_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'
      `).bind(
        offer?.id || null, stringField(form.daughter, 160) || "Registration draft", stringField(form.birthdate, 10) || null,
        stringField(form.father, 120) || null, stringField(form.fatherPhone, 40) || null, stringField(form.email, 254) || null,
        stringField(form.mother, 120) || null, stringField(form.motherPhone, 40) || null, stringField(form.email, 254) || null,
        stringField(form.emergencyName, 120) || null, stringField(form.emergencyPhone, 40) || null, stringField(form.emergencyRelation, 100) || null,
        encryptedCare, careIv, stringField(form.method, 80) || null, registrationFeeAgorot, monthlyFeeAgorot, juneFeeAgorot, securityCheckAgorot,
        JSON.stringify({ currency: "ILS", registrationFeeAgorot, monthlyFeeAgorot, juneFeeAgorot, securityCheckAgorot, customRegistrationLinkId: offer?.id || null, monthOverrides: offer?.monthOverrides || {}, oneTimeAmountAgorot: offer?.oneTimeAmountAgorot || 0 }),
        encryptedDraft, expiresAt, now, registrationId,
      ).run();
    } else {
      registrationId = crypto.randomUUID();
      await runtime.DB.prepare(`
        INSERT INTO registrations (
          id, school_year_id, agreement_version_id, custom_registration_link_id, status, participant_full_name, participant_birth_date,
          father_name, father_phone, father_email, mother_name, mother_phone, mother_email,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation, medical_information_ciphertext, medical_information_iv,
          payment_method, registration_fee_agorot, monthly_fee_agorot, june_fee_agorot, security_check_agorot,
          payment_proof_status, payment_status, pricing_snapshot_json, form_snapshot_json, draft_token_hash, draft_expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_required', 'pending', ?, ?, ?, ?, ?, ?)
      `).bind(
        registrationId, settings.schoolYearId, settings.agreementVersionId, offer?.id || null,
        stringField(form.daughter, 160) || "Registration draft", stringField(form.birthdate, 10) || null,
        stringField(form.father, 120) || null, stringField(form.fatherPhone, 40) || null, stringField(form.email, 254) || null,
        stringField(form.mother, 120) || null, stringField(form.motherPhone, 40) || null, stringField(form.email, 254) || null,
        stringField(form.emergencyName, 120) || null, stringField(form.emergencyPhone, 40) || null, stringField(form.emergencyRelation, 100) || null,
        encryptedCare, careIv, stringField(form.method, 80) || null,
        registrationFeeAgorot, monthlyFeeAgorot, juneFeeAgorot, securityCheckAgorot,
        JSON.stringify({ currency: "ILS", registrationFeeAgorot, monthlyFeeAgorot, juneFeeAgorot, securityCheckAgorot, customRegistrationLinkId: offer?.id || null, monthOverrides: offer?.monthOverrides || {}, oneTimeAmountAgorot: offer?.oneTimeAmountAgorot || 0 }),
        encryptedDraft, tokenHash, expiresAt, now, now,
      ).run();
    }

    let savedProof: { fileId: string; fileName: string; byteSize: number } | null = null;
    const existingProof = await runtime.DB.prepare(`SELECT id, storage_key, original_filename, byte_size FROM stored_files WHERE registration_id = ? AND kind = 'payment_proof' AND status = 'active' ORDER BY uploaded_at DESC LIMIT 1`).bind(registrationId).first<{ id: string; storage_key: string; original_filename: string | null; byte_size: number }>();
    if (proofFile) {
      const proof = await validatePaymentProofImage(proofFile, "name" in proofFile ? String(proofFile.name) : "screenshot");
      const proofFileId = crypto.randomUUID();
      const proofKey = `registrations/${settings.schoolYearId}/${registrationId}/proof/${proofFileId}.${proof.extension}`;
      await runtime.BUCKET.put(proofKey, proof.bytes, { httpMetadata: { contentType: proof.mimeType }, customMetadata: proof.metadata });
      const statements: D1PreparedStatement[] = [];
      if (existingProof) statements.push(runtime.DB.prepare(`DELETE FROM stored_files WHERE id = ?`).bind(existingProof.id));
      statements.push(runtime.DB.prepare(`
        INSERT INTO stored_files (id, registration_id, kind, storage_key, original_filename, mime_type, byte_size, sha256, status, metadata_json, uploaded_at)
        VALUES (?, ?, 'payment_proof', ?, ?, ?, ?, ?, 'active', ?, ?)
      `).bind(proofFileId, registrationId, proofKey, proof.fileName, proof.mimeType, proof.size, await sha256Hex(proof.bytes), JSON.stringify(proof.metadata), now));
      await runtime.DB.batch(statements);
      if (existingProof) await runtime.BUCKET.delete(existingProof.storage_key).catch(() => undefined);
      savedProof = { fileId: proofFileId, fileName: proof.fileName, byteSize: proof.size };
    } else if (existingProof) {
      savedProof = { fileId: existingProof.id, fileName: existingProof.original_filename || "screenshot", byteSize: existingProof.byte_size };
    }

    const parentEmail = stringField(form.email, 254).toLowerCase();
    const resumeUrl = `/register?resume=${encodeURIComponent(token)}${offerToken ? `&offer=${encodeURIComponent(offerToken)}` : ""}`;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      const recipientCiphertext = await encryptJson({ email: parentEmail }, runtime.CHOIR_DATA_KEY);
      const messageCiphertext = await encryptJson({ subject: "Continue your Choir Chug registration", body: "Your private return link is ready. It expires in 30 days.", resumeUrl: `${new URL(request.url).origin}${resumeUrl}` }, runtime.CHOIR_DATA_KEY);
      const emailId = crypto.randomUUID();
      const dedupeKey = `${registrationId}:registration-resume`;
      await runtime.DB.prepare(`INSERT INTO email_outbox (id, registration_id, recipient_hash, recipient_ciphertext, message_ciphertext, template, dedupe_key, status, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'registration-resume', ?, 'pending', 0, ?, ?) ON CONFLICT(dedupe_key) DO UPDATE SET recipient_hash = excluded.recipient_hash, recipient_ciphertext = excluded.recipient_ciphertext, message_ciphertext = excluded.message_ciphertext, status = 'pending', last_error = NULL, updated_at = excluded.updated_at`).bind(emailId, registrationId, await sha256Hex(parentEmail), recipientCiphertext, messageCiphertext, dedupeKey, now, now).run();
      if (runtime.RESEND_API_KEY && runtime.CHOIR_FROM_EMAIL) {
        const queued = await runtime.DB.prepare(`SELECT id FROM email_outbox WHERE dedupe_key = ? LIMIT 1`).bind(dedupeKey).first<{ id: string }>();
        if (queued) await deliverOutboxEmail(runtime, queued.id);
      }
    }

    return Response.json({ registrationId, token, resumeUrl, agreementVersion: settings.agreementVersionCode, expiresAt, proof: savedProof }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Progress could not be saved." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const token = new URL(request.url).searchParams.get("token") || "";
    if (!token || token.length > 300) return Response.json({ error: "Return link is invalid." }, { status: 404 });
    const tokenHash = await hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET);
    const row = await runtime.DB.prepare(`SELECT id, form_snapshot_json FROM registrations WHERE draft_token_hash = ? AND status = 'draft' AND (draft_expires_at IS NULL OR draft_expires_at > ?) LIMIT 1`).bind(tokenHash, new Date().toISOString()).first<DraftRow>();
    if (!row) return Response.json({ error: "Saved registration was not found." }, { status: 404 });
    const data = await decryptJson<Record<string, unknown>>(row.form_snapshot_json, runtime.CHOIR_DATA_KEY);
    const proofRow = await runtime.DB.prepare(`SELECT id, original_filename, byte_size FROM stored_files WHERE registration_id = ? AND kind = 'payment_proof' AND status = 'active' ORDER BY uploaded_at DESC LIMIT 1`).bind(row.id).first<{ id: string; original_filename: string | null; byte_size: number }>();
    return Response.json({
      registrationId: row.id, token, data,
      proof: proofRow ? { fileId: proofRow.id, fileName: proofRow.original_filename || "screenshot", byteSize: proofRow.byte_size } : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Saved progress could not be loaded." }, { status: 500 });
  }
}
