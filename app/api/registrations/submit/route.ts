import { personalizeAgreementSections } from "@/lib/agreement-content";
import { generateSignedAgreementPdf, type SignedAgreementSnapshot } from "@/lib/agreement-pdf";
import { loadChoirDocumentAssets } from "@/lib/document-assets";
import { deliverOutboxEmail } from "@/lib/email";
import { ensureCurrentRegistrationConfig } from "@/lib/registration-defaults";
import { buildPaymentPlan } from "@/lib/payment-plan";
import { createPrivateLinkToken } from "@/lib/private-links";
import { resolveRegistrationOffer } from "@/lib/pricing";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { encryptJson, hashOpaqueToken, randomOpaqueToken, sha256Hex } from "@/lib/security";
import { decodeAndValidateSignatureDataUrl, validatePaymentProofImage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

type RegistrationForm = {
  daughter?: unknown;
  birthdate?: unknown;
  father?: unknown;
  fatherPhone?: unknown;
  mother?: unknown;
  motherPhone?: unknown;
  email?: unknown;
  emergencyName?: unknown;
  emergencyPhone?: unknown;
  emergencyRelation?: unknown;
  allergies?: unknown;
  medical?: unknown;
  medications?: unknown;
  additionalNote?: unknown;
  address?: unknown;
  school?: unknown;
  method?: unknown;
  signer?: unknown;
};

type SubmissionPayload = {
  form?: RegistrationForm;
  approvals?: Array<{ sectionTitle?: unknown; understood?: unknown }>;
  agreementVersion?: unknown;
  securityCheckAccepted?: unknown;
  medicalConsent?: unknown;
  paymentProofAccepted?: unknown;
  guardianAccepted?: unknown;
  privacyAccepted?: unknown;
  electronicSignatureAccepted?: unknown;
  signatureData?: unknown;
  draftToken?: unknown;
  offerToken?: unknown;
};

function text(value: unknown, maximum = 300) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date <= new Date();
}

function calculateAge(birthDate: string) {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function jsonError(error: string, status = 400) {
  // Rejections are otherwise invisible in hosting logs, which makes a parent
  // reporting "it would not submit" impossible to diagnose.
  console.warn(`registration.submit rejected (${status}): ${error}`);
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function sectionKey(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  const storedKeys: string[] = [];
  try {
    const runtime = getRuntimeEnv();
    const formData = await request.formData();
    const rawPayload = formData.get("payload");
    if (typeof rawPayload !== "string" || rawPayload.length > 750_000) return jsonError("The registration form is invalid.");

    let payload: SubmissionPayload;
    try {
      payload = JSON.parse(rawPayload) as SubmissionPayload;
    } catch {
      return jsonError("The registration form is invalid.");
    }

    const offerToken = text(payload.offerToken, 300);
    const offer = offerToken ? await resolveRegistrationOffer(runtime, offerToken) : null;
    if (offerToken && !offer) return jsonError("This custom registration link is invalid, expired, or no longer active.", 409);
    const settings = offer?.settings || await ensureCurrentRegistrationConfig(runtime.DB);
    const effectiveAgreementSections = personalizeAgreementSections(settings.agreementSections, {
      schoolYearName: settings.schoolYearName,
      startsOn: settings.startsOn,
      endsOn: settings.endsOn,
      registrationFeeAgorot: offer?.registrationFeeAgorot ?? settings.registrationFeeAgorot,
      monthlyFeeAgorot: offer?.monthlyFeeAgorot ?? settings.monthlyFeeAgorot,
      juneFeeAgorot: offer?.juneFeeAgorot ?? settings.juneFeeAgorot,
      securityCheckAgorot: offer?.securityCheckAgorot ?? settings.securityCheckAgorot,
      securityCheckMonths: settings.securityCheckMonths,
      paymentDueDay: settings.paymentDueDay,
      monthOverrides: offer?.monthOverrides,
      oneTimeAmountAgorot: offer?.oneTimeAmountAgorot,
      customLabel: offer?.label,
      paymentMethodLabels: offer?.allowedPaymentMethod
        ? settings.paymentMethodRecords.filter((method) => method.code === offer.allowedPaymentMethod || method.label === offer.allowedPaymentMethod).map((method) => method.label)
        : settings.paymentMethods,
      scheduleWeekday: settings.scheduleWeekday,
      scheduleStartTime: settings.scheduleStartTime,
      scheduleEndTime: settings.scheduleEndTime,
      sessionLengthMinutes: settings.sessionLengthMinutes,
      location: settings.location,
    });
    const effectiveApprovalSections = effectiveAgreementSections.filter((section) => section.title !== "Introduction");

    const source = payload.form ?? {};
    const form = {
      daughter: text(source.daughter, 160),
      birthdate: text(source.birthdate, 10),
      father: text(source.father, 120),
      fatherPhone: text(source.fatherPhone, 40),
      mother: text(source.mother, 120),
      motherPhone: text(source.motherPhone, 40),
      email: text(source.email, 254).toLowerCase(),
      emergencyName: text(source.emergencyName, 120),
      emergencyPhone: text(source.emergencyPhone, 40),
      emergencyRelation: text(source.emergencyRelation, 100),
      allergies: text(source.allergies, 2_500),
      medical: text(source.medical, 4_000),
      medications: text(source.medications, 2_500),
      additionalNote: text(source.additionalNote, 2_500),
      address: text(source.address, 300),
      school: text(source.school, 160),
      method: text(source.method, 80),
      signer: text(source.signer, 160),
    };

    if (!form.daughter) return jsonError("Daughter’s full name is required.");
    if (!validDate(form.birthdate)) return jsonError("A valid date of birth is required.");
    if (!form.father && !form.mother) return jsonError("At least one parent’s name is required.");
    if (!form.fatherPhone && !form.motherPhone) return jsonError("At least one parent phone number is required.");
    if (!validEmail(form.email)) return jsonError("A valid parent email address is required.");
    if (!form.emergencyName || !form.emergencyPhone || !form.emergencyRelation) return jsonError("Emergency contact details and relationship are required.");
    const allowedMethods = offer?.allowedPaymentMethod ? [offer.allowedPaymentMethod] : settings.paymentMethods;
    const methodRecord = settings.paymentMethodRecords.find((method) => method.label === form.method || method.code === form.method);
    if (!allowedMethods.includes(form.method) && !settings.paymentMethodRecords.some((method) => method.code === offer?.allowedPaymentMethod && method.label === form.method)) return jsonError("Choose an available payment method.");
    if (!form.signer) return jsonError("The signing parent’s name is required.");
    if (payload.agreementVersion !== settings.agreementVersionCode) return jsonError("The agreement has been updated. Please review it again.", 409);
    if (!payload.medicalConsent || !payload.securityCheckAccepted || !payload.guardianAccepted || !payload.privacyAccepted || !payload.electronicSignatureAccepted) {
      return jsonError("All required confirmations must be accepted.");
    }

    const suppliedApprovals = Array.isArray(payload.approvals) ? payload.approvals : [];
    const approvalsValid = effectiveApprovalSections.every((section, index) => {
      const approval = suppliedApprovals[index];
      return approval?.sectionTitle === section.title && approval.understood === true;
    }) && suppliedApprovals.length === effectiveApprovalSections.length;
    if (!approvalsValid) return jsonError("Every agreement section must be understood before signing.");

    const signatureData = text(payload.signatureData, 600_000);
    const signature = decodeAndValidateSignatureDataUrl(signatureData);
    const proofEntry = formData.get("proof");
    const proofFile = proofEntry instanceof File && proofEntry.size > 0 ? proofEntry : null;
    const isCashMethod = methodRecord?.cashHandling === true;
    if (isCashMethod && proofFile) return jsonError("Cash registrations do not need a payment screenshot.");
    const proofPolicy = offer?.proofPolicy || methodRecord?.proofPolicy || (settings.proofUploadRequired ? "required" : "optional");
    if (proofPolicy === "none" && proofFile) return jsonError("This payment method does not accept a payment screenshot.");
    if (proofPolicy === "required" && !isCashMethod && !proofFile) return jsonError("A payment screenshot is required for this payment method.");
    const proof = proofFile ? await validatePaymentProofImage(proofFile, proofFile.name) : null;

    const registrationId = crypto.randomUUID();
    const studentId = crypto.randomUUID();
    const enrollmentId = crypto.randomUUID();
    const signatureFileId = crypto.randomUUID();
    const proofFileId = proof ? crypto.randomUUID() : null;
    const pdfFileId = crypto.randomUUID();
    const signedAgreementId = crypto.randomUUID();
    const signedAt = new Date().toISOString();
    const registrationFeeAgorot = offer?.registrationFeeAgorot ?? settings.registrationFeeAgorot;
    const monthlyFeeAgorot = offer?.monthlyFeeAgorot ?? settings.monthlyFeeAgorot;
    const juneFeeAgorot = offer?.juneFeeAgorot ?? settings.juneFeeAgorot;
    const securityCheckAgorot = offer?.securityCheckAgorot ?? settings.securityCheckAgorot;
    const scheduleLink = await createPrivateLinkToken(runtime);
    const downloadToken = randomOpaqueToken();
    const downloadTokenHash = await hashOpaqueToken(downloadToken, runtime.CHOIR_TOKEN_SECRET);
    const draftToken = text(payload.draftToken, 300);
    const draftTokenHash = draftToken ? await hashOpaqueToken(draftToken, runtime.CHOIR_TOKEN_SECRET) : null;

    const signatureKey = `registrations/${settings.schoolYearId}/${registrationId}/signature/${signatureFileId}.png`;
    await runtime.BUCKET.put(signatureKey, signature.bytes, { httpMetadata: { contentType: "image/png" } });
    storedKeys.push(signatureKey);

    let proofKey: string | null = null;
    if (proof && proofFileId) {
      proofKey = `registrations/${settings.schoolYearId}/${registrationId}/proof/${proofFileId}.${proof.extension}`;
      await runtime.BUCKET.put(proofKey, proof.bytes, { httpMetadata: { contentType: proof.mimeType }, customMetadata: proof.metadata });
      storedKeys.push(proofKey);
    }

    const age = calculateAge(form.birthdate);
    const snapshot: SignedAgreementSnapshot = {
      registrationId,
      schoolYear: settings.schoolYearName,
      agreementVersion: settings.agreementVersionCode,
      participant: { fullName: form.daughter, birthDate: form.birthdate, age, address: form.address || null, school: form.school || null },
      parents: {
        fatherName: form.father || null,
        fatherPhone: form.fatherPhone || null,
        motherName: form.mother || null,
        motherPhone: form.motherPhone || null,
        email: form.email,
      },
      care: {
        emergencyContactName: form.emergencyName,
        emergencyContactPhone: form.emergencyPhone,
        emergencyContactRelation: form.emergencyRelation,
        allergies: form.allergies || "None provided",
        medicalInformation: form.medical || "None provided",
        medications: form.medications || "None provided",
        additionalNote: form.additionalNote || null,
        consentAccepted: true,
      },
      payment: {
        method: form.method,
        monthlyAmount: monthlyFeeAgorot / 100,
        juneAmount: juneFeeAgorot / 100,
        currency: "ILS",
        securityCheckAmount: securityCheckAgorot / 100,
        securityCheckMonths: settings.securityCheckMonths,
        securityCheckAccepted: true,
        paymentProofReceived: proof ? true : isCashMethod ? undefined : false,
      },
      sections: effectiveAgreementSections.map((section) => ({
        id: sectionKey(section.title),
        title: section.title,
        paragraphs: section.paragraphs.map((paragraph) => ({ id: paragraph.id, text: paragraph.text })),
        acknowledgement: { required: section.title !== "Introduction", accepted: section.title !== "Introduction", acceptedAt: section.title === "Introduction" ? null : signedAt },
      })),
      consents: {
        parentOrGuardianAccepted: true,
        privacyAndTermsAccepted: true,
        electronicSignatureAccepted: true,
      },
      signature: { signerName: form.signer, image: { bytes: signature.bytes, mimeType: "image/png" } },
      signedAt,
    };

    const assets = await loadChoirDocumentAssets(request, runtime);
    const pdf = await generateSignedAgreementPdf(snapshot, assets);
    const pdfKey = `agreements/${settings.schoolYearId}/${registrationId}/${signedAgreementId}.pdf`;
    await runtime.BUCKET.put(pdfKey, pdf, { httpMetadata: { contentType: "application/pdf", contentDisposition: `attachment; filename="choir-chug-agreement.pdf"` } });
    storedKeys.push(pdfKey);

    const [signatureHash, proofHash, pdfHash, documentHash] = await Promise.all([
      sha256Hex(signature.bytes),
      proof ? sha256Hex(proof.bytes) : Promise.resolve(null),
      sha256Hex(pdf),
      sha256Hex(JSON.stringify(snapshot, (_key, value) => value instanceof Uint8Array ? `[${value.byteLength} signature bytes]` : value)),
    ]);
    const encryptedCare = await encryptJson({
      emergencyContactName: form.emergencyName,
      emergencyContactPhone: form.emergencyPhone,
      emergencyContactRelation: form.emergencyRelation,
      allergies: form.allergies,
      medicalInformation: form.medical,
      medications: form.medications,
      additionalNote: form.additionalNote,
    }, runtime.CHOIR_DATA_KEY);
    const careEnvelope = JSON.parse(encryptedCare) as { iv?: string };
    const encryptedSnapshot = await encryptJson({
      ...snapshot,
      signature: {
        signerName: form.signer,
        signatureFileId,
        signatureHash,
      },
    }, runtime.CHOIR_DATA_KEY);
    const pricingSnapshot = JSON.stringify({
      currency: "ILS",
      registrationFeeAgorot,
      monthlyFeeAgorot,
      juneFeeAgorot,
      securityCheckAgorot,
      customRegistrationLinkId: offer?.id || null,
      customOfferLabel: offer?.label || null,
      oneTimeAmountAgorot: offer?.oneTimeAmountAgorot || 0,
      monthOverrides: offer?.monthOverrides || {},
    });
    const safeFormSnapshot = JSON.stringify({
      participant: { fullName: form.daughter, birthDate: form.birthdate, address: form.address, school: form.school },
      parents: { fatherName: form.father, fatherPhone: form.fatherPhone, motherName: form.mother, motherPhone: form.motherPhone, email: form.email },
      care: { emergencyName: form.emergencyName, emergencyPhone: form.emergencyPhone, emergencyRelation: form.emergencyRelation },
      paymentMethod: form.method,
      consents: { medical: true, guardian: true, privacy: true, electronicSignature: true, securityCheck: true, paymentProof: proof ? true : null },
    });
    const offeredGroup = offer?.groupId
      ? await runtime.DB.prepare(`SELECT id, name FROM groups WHERE id = ? AND school_year_id = ? AND status = 'active' LIMIT 1`).bind(offer.groupId, settings.schoolYearId).first<{ id: string; name: string }>()
      : null;

    const statements: D1PreparedStatement[] = [];
    if (draftTokenHash) statements.push(runtime.DB.prepare(`DELETE FROM registrations WHERE status = 'draft' AND draft_token_hash = ?`).bind(draftTokenHash));
    statements.push(runtime.DB.prepare(`
      INSERT INTO registrations (
        id, school_year_id, agreement_version_id, custom_registration_link_id, status, review_status, participant_full_name, participant_birth_date,
        father_name, father_phone, father_email, mother_name, mother_phone, mother_email,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation, medical_information_ciphertext, medical_information_iv,
        payment_method, registration_fee_agorot, monthly_fee_agorot, june_fee_agorot, security_check_agorot,
        payment_proof_status, payment_status, pricing_snapshot_json, form_snapshot_json,
        download_token_hash, submitted_at, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'completed', 'awaiting_review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      registrationId, settings.schoolYearId, settings.agreementVersionId, offer?.id || null, form.daughter, form.birthdate,
      form.father || null, form.fatherPhone || null, form.email, form.mother || null, form.motherPhone || null, form.email,
      form.emergencyName, form.emergencyPhone, form.emergencyRelation, encryptedCare, careEnvelope.iv || null,
      form.method, registrationFeeAgorot, monthlyFeeAgorot, juneFeeAgorot, securityCheckAgorot,
      proof ? "uploaded" : isCashMethod ? "not_required" : "not_provided",
      pricingSnapshot, safeFormSnapshot, downloadTokenHash, signedAt, signedAt, signedAt, signedAt,
    ));

    for (const section of snapshot.sections.filter((item) => item.acknowledgement.required !== false)) {
      statements.push(runtime.DB.prepare(`
        INSERT INTO registration_section_approvals (
          registration_id, agreement_version_id, section_key, section_title, section_hash, approved, approved_at, created_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).bind(registrationId, settings.agreementVersionId, section.id, section.title, await sha256Hex(JSON.stringify(section.paragraphs)), signedAt, signedAt));
    }

    if (proof && proofFileId && proofKey && proofHash) {
      statements.push(runtime.DB.prepare(`
        INSERT INTO stored_files (id, registration_id, kind, storage_key, original_filename, mime_type, byte_size, sha256, status, metadata_json, uploaded_at)
        VALUES (?, ?, 'payment_proof', ?, ?, ?, ?, ?, 'active', ?, ?)
      `).bind(proofFileId, registrationId, proofKey, proof.fileName, proof.mimeType, proof.size, proofHash, JSON.stringify(proof.metadata), signedAt));
    }
    statements.push(runtime.DB.prepare(`
      INSERT INTO stored_files (id, registration_id, kind, storage_key, original_filename, mime_type, byte_size, sha256, status, metadata_json, uploaded_at)
      VALUES (?, ?, 'signature', ?, 'signature.png', 'image/png', ?, ?, 'active', '{}', ?)
    `).bind(signatureFileId, registrationId, signatureKey, signature.size, signatureHash, signedAt));
    statements.push(runtime.DB.prepare(`
      INSERT INTO stored_files (id, registration_id, kind, storage_key, original_filename, mime_type, byte_size, sha256, status, metadata_json, uploaded_at)
      VALUES (?, ?, 'signed_agreement_pdf', ?, 'choir-chug-agreement.pdf', 'application/pdf', ?, ?, 'active', '{}', ?)
    `).bind(pdfFileId, registrationId, pdfKey, pdf.byteLength, pdfHash, signedAt));
    statements.push(runtime.DB.prepare(`
      INSERT INTO signed_agreements (
        id, registration_id, agreement_version_id, pdf_file_id, signature_file_id,
        signer_name, signer_role, signed_at, document_hash, signature_hash, document_snapshot_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'parent_or_guardian', ?, ?, ?, ?, ?)
    `).bind(signedAgreementId, registrationId, settings.agreementVersionId, pdfFileId, signatureFileId, form.signer, signedAt, documentHash, signatureHash, encryptedSnapshot, signedAt));
    statements.push(runtime.DB.prepare(`
      INSERT INTO students (id, created_from_registration_id, full_name, birth_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).bind(studentId, registrationId, form.daughter, form.birthdate, signedAt, signedAt));
    statements.push(runtime.DB.prepare(`
      INSERT INTO enrollments (
        id, student_id, school_year_id, registration_id, group_id, status, group_label, schedule_token_hash, schedule_token_ciphertext, registration_fee_agorot,
        monthly_fee_agorot, june_fee_agorot, security_check_agorot, enrolled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(enrollmentId, studentId, settings.schoolYearId, registrationId, offeredGroup?.id || null, offeredGroup?.name || null, scheduleLink.tokenHash, scheduleLink.tokenCiphertext, registrationFeeAgorot, monthlyFeeAgorot, juneFeeAgorot, securityCheckAgorot, signedAt, signedAt, signedAt));

    const periods = buildPaymentPlan({
      startsOn: settings.startsOn,
      endsOn: settings.endsOn,
      registrationFeeAgorot,
      monthlyFeeAgorot,
      juneFeeAgorot,
      dueDay: settings.paymentDueDay,
      monthOverrides: offer?.monthOverrides,
      oneTimeAmountAgorot: offer?.oneTimeAmountAgorot,
    });
    for (const [periodIndex, period] of periods.entries()) {
      const firstPayment = periodIndex === 0;
      statements.push(runtime.DB.prepare(`
        INSERT INTO payment_items (
          id, enrollment_id, school_year_id, registration_id, proof_file_id,
          period_key, label, due_on, amount_due_agorot, amount_paid_agorot,
          status, method, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), enrollmentId, settings.schoolYearId, registrationId, firstPayment ? proofFileId : null, period.periodKey, period.label, period.dueOn, period.amountDueAgorot, firstPayment && proof ? "proof_uploaded" : "unpaid", form.method, signedAt, signedAt));
    }
    statements.push(runtime.DB.prepare(`
      INSERT INTO audit_log (school_year_id, actor_type, action, entity_type, entity_id, summary, changes_json, created_at)
      VALUES (?, 'parent', 'registration.completed', 'registration', ?, 'Registration completed and agreement signed', ?, ?)
    `).bind(settings.schoolYearId, registrationId, JSON.stringify({ agreementVersion: settings.agreementVersionCode, paymentMethod: form.method, proofUploaded: Boolean(proof), customRegistrationLinkId: offer?.id || null }), signedAt));

    if (offer) statements.push(runtime.DB.prepare(`UPDATE custom_registration_links SET use_count = use_count + 1, updated_at = ? WHERE id = ?`).bind(signedAt, offer.id));

    const downloadUrl = `/api/agreements/${registrationId}/download?token=${encodeURIComponent(downloadToken)}`;
    const scheduleUrl = `/schedule/${encodeURIComponent(scheduleLink.token)}`;
    const origin = new URL(request.url).origin;
    const parentRecipientCiphertext = await encryptJson({ email: form.email }, runtime.CHOIR_DATA_KEY);
    const parentMessageCiphertext = await encryptJson({
      subject: `${settings.schoolYearName} Choir Chug registration received`,
      body: `Thank you. ${form.daughter}'s registration and signed agreement have been saved.`,
      downloadUrl: `${origin}${downloadUrl}`,
      scheduleUrl: `${origin}${scheduleUrl}`,
    }, runtime.CHOIR_DATA_KEY);
    const queuedEmailIds: string[] = [];
    const parentEmailId = crypto.randomUUID();
    queuedEmailIds.push(parentEmailId);
    statements.push(runtime.DB.prepare(`
      INSERT OR IGNORE INTO email_outbox (id, registration_id, recipient_hash, recipient_ciphertext, message_ciphertext, template, dedupe_key, status, attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'parent-registration-copy', ?, 'pending', 0, ?, ?)
    `).bind(parentEmailId, registrationId, await sha256Hex(form.email.toLowerCase()), parentRecipientCiphertext, parentMessageCiphertext, `${registrationId}:parent-registration-copy`, signedAt, signedAt));
    const administrator = await runtime.DB.prepare(`SELECT email FROM admin_users WHERE status = 'active' AND email IS NOT NULL ORDER BY created_at LIMIT 1`).first<{ email: string }>();
    if (administrator?.email) {
      const recipientCiphertext = await encryptJson({ email: administrator.email }, runtime.CHOIR_DATA_KEY);
      const messageCiphertext = await encryptJson({ subject: `New Choir Chug registration: ${form.daughter}`, body: `${form.daughter} completed registration for ${settings.schoolYearName}.`, registrationId }, runtime.CHOIR_DATA_KEY);
      const administratorEmailId = crypto.randomUUID();
      queuedEmailIds.push(administratorEmailId);
      statements.push(runtime.DB.prepare(`INSERT OR IGNORE INTO email_outbox (id, registration_id, recipient_hash, recipient_ciphertext, message_ciphertext, template, dedupe_key, status, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'administrator-registration-notice', ?, 'pending', 0, ?, ?)`).bind(administratorEmailId, registrationId, await sha256Hex(administrator.email.toLowerCase()), recipientCiphertext, messageCiphertext, `${registrationId}:administrator-registration-notice`, signedAt, signedAt));
    }
    await runtime.DB.batch(statements);
    if (runtime.RESEND_API_KEY && runtime.CHOIR_FROM_EMAIL) {
      await Promise.allSettled(queuedEmailIds.map((id) => deliverOutboxEmail(runtime, id)));
    }
    return Response.json({ registrationId, downloadUrl, scheduleUrl }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    try {
      const runtime = getRuntimeEnv();
      await Promise.all(storedKeys.map((key) => runtime.BUCKET.delete(key)));
    } catch {
      // The database remains authoritative; orphan cleanup can be retried safely.
    }
    const message = error instanceof Error ? error.message : "Registration could not be completed.";
    return jsonError(message, message.includes("required") || message.includes("must") || message.includes("invalid") ? 400 : 500);
  }
}
