"use client";

import Link from "next/link";
import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { agreementSections, approvalAgreementSections, agreementVersion, type AgreementSection } from "../agreement-2026-2027";
import { choirConfig } from "../site-config";

const steps = ["Details", "Care", "Agreement", "Payment", "Review & sign"];

export default function RegistrationPreview() {
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftToken, setDraftToken] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [complete, setComplete] = useState(false);
  const [scheduleUrl, setScheduleUrl] = useState("");
  const [offerToken, setOfferToken] = useState("");
  const [customOfferLabel, setCustomOfferLabel] = useState("");
  const [registrationYear, setRegistrationYear] = useState<string>(choirConfig.currentYear.label);
  const [activeAgreementVersion, setActiveAgreementVersion] = useState(agreementVersion);
  const [activeAgreementSections, setActiveAgreementSections] = useState<AgreementSection[]>(agreementSections.map((section) => ({ title: section.title, paragraphs: section.paragraphs.map((paragraph) => ({ ...paragraph })) })));
  const [scheduleInfo, setScheduleInfo] = useState<{ sessionLength: string; location: string; day: string }>({ sessionLength: choirConfig.currentYear.sessionLength, location: choirConfig.currentYear.location, day: choirConfig.currentYear.day });
  const [homeAddressEnabled, setHomeAddressEnabled] = useState(false);
  const [schoolEnabled, setSchoolEnabled] = useState(false);
  const [cashReminderOpen, setCashReminderOpen] = useState(false);
  const [proofName, setProofName] = useState("");
  const [proofPreview, setProofPreview] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploadRequired, setProofUploadRequired] = useState(choirConfig.currentYear.payment.proofUpload === "required");
  const [paymentMethods, setPaymentMethods] = useState<readonly string[]>(choirConfig.currentYear.payment.methods);
  const [paymentMethodRecords, setPaymentMethodRecords] = useState<Array<{ label: string; instructions: string; proofPolicy: "required" | "optional" | "none"; cashHandling: boolean }>>([]);
  const [paymentAmounts, setPaymentAmounts] = useState<{ registration: number; monthly: number; june: number; securityCheck: number; securityCheckMonths: string }>({
    registration: choirConfig.currentYear.payment.registrationFeeAmount,
    monthly: choirConfig.currentYear.payment.monthlyAmount,
    june: choirConfig.currentYear.payment.juneAmount,
    securityCheck: choirConfig.currentYear.payment.securityCheckAmount,
    securityCheckMonths: choirConfig.currentYear.payment.securityCheckMonths,
  });
  const [cashReminderText, setCashReminderText] = useState("Please be responsible for making sure that you pay the monthly amount on time by sending it with your daughter. Please don’t make us run after you for the monthly payment.");
  const [signatureData, setSignatureData] = useState("");
  const [approvals, setApprovals] = useState<boolean[]>(approvalAgreementSections.map(() => false));
  const [securityCheckAccepted, setSecurityCheckAccepted] = useState(false);
  const [guardianAccepted, setGuardianAccepted] = useState(false);
  const [medicalConsent, setMedicalConsent] = useState(false);
  const [paymentProofAccepted, setPaymentProofAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [electronicSignatureAccepted, setElectronicSignatureAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [form, setForm] = useState({
    daughter: "",
    birthdate: "",
    father: "",
    fatherPhone: "",
    mother: "",
    motherPhone: "",
    email: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    allergies: "",
    medical: "",
    medications: "",
    additionalNote: "",
    address: "",
    school: "",
    method: "Bank transfer",
    signer: "",
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const urlOffer = params.get("offer")?.trim() || "";
    const resumeToken = params.get("resume")?.trim() || "";

    async function loadConfig(offer: string) {
      const response = await fetch(`/api/registration-config${offer ? `?offer=${encodeURIComponent(offer)}` : ""}`, { cache: "no-store" });
      const settings = await response.json() as { error?: string; year?: string; agreementVersion?: string; agreementSections?: AgreementSection[]; proofUploadRequired?: boolean; cashReminderText?: string; paymentMethods?: string[]; paymentMethodRecords?: Array<{ label: string; instructions: string; proofPolicy: "required" | "optional" | "none"; cashHandling?: boolean }>; securityCheckMonths?: string; customOffer?: { label?: string }; homeAddressEnabled?: boolean; schoolEnabled?: boolean; schedule?: { weekday?: number; sessionLengthMinutes?: number; location?: string }; amounts?: { registration?: number; monthly?: number; june?: number; securityCheck?: number } };
      if (!response.ok) throw new Error(settings.error || "Registration settings could not be loaded.");
      if (!active) return;
      if (settings.year) setRegistrationYear(settings.year);
      if (settings.agreementVersion) setActiveAgreementVersion(settings.agreementVersion);
      if (Array.isArray(settings.agreementSections) && settings.agreementSections.length) {
        setActiveAgreementSections(settings.agreementSections);
        const approvalCount = settings.agreementSections.filter((section) => section.title !== "Introduction").length;
        setApprovals((current) => Array.from({ length: approvalCount }, (_, index) => current[index] || false));
      }
      if (settings.customOffer?.label) setCustomOfferLabel(settings.customOffer.label);
      setHomeAddressEnabled(settings.homeAddressEnabled === true);
      setSchoolEnabled(settings.schoolEnabled === true);
      if (settings.schedule) setScheduleInfo({ sessionLength: `${settings.schedule.sessionLengthMinutes || 50} minutes`, location: settings.schedule.location || choirConfig.currentYear.location, day: ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"][settings.schedule.weekday ?? 3] || "Wednesdays" });
      if (typeof settings.proofUploadRequired === "boolean") setProofUploadRequired(settings.proofUploadRequired);
      if (settings.cashReminderText) setCashReminderText(settings.cashReminderText);
      if (Array.isArray(settings.paymentMethodRecords)) setPaymentMethodRecords(settings.paymentMethodRecords.map((record) => ({ ...record, cashHandling: record.cashHandling === true })));
      if (Array.isArray(settings.paymentMethods) && settings.paymentMethods.length) {
        setPaymentMethods(settings.paymentMethods);
        setForm((current) => settings.paymentMethods!.includes(current.method) ? current : { ...current, method: settings.paymentMethods![0] });
      }
      if (settings.amounts) setPaymentAmounts((current) => ({
        registration: typeof settings.amounts?.registration === "number" ? settings.amounts.registration : current.registration,
        monthly: typeof settings.amounts?.monthly === "number" ? settings.amounts.monthly : current.monthly,
        june: typeof settings.amounts?.june === "number" ? settings.amounts.june : current.june,
        securityCheck: typeof settings.amounts?.securityCheck === "number" ? settings.amounts.securityCheck : current.securityCheck,
        securityCheckMonths: settings.securityCheckMonths || current.securityCheckMonths,
      }));
    }

    async function boot() {
      let offer = urlOffer;
      let draft: { token: string; data: Record<string, unknown> } | null = null;
      if (resumeToken) {
        try {
          const response = await fetch(`/api/registrations/draft?token=${encodeURIComponent(resumeToken)}`, { cache: "no-store" });
          const result = await response.json() as { data?: Record<string, unknown>; error?: string; token?: string };
          if (!response.ok || !result.data) throw new Error(result.error || "Saved progress could not be loaded.");
          draft = { token: result.token || resumeToken, data: result.data };
          const draftOffer = typeof result.data.offerToken === "string" ? result.data.offerToken.trim() : "";
          if (draftOffer) offer = draftOffer;
        } catch (error) {
          if (active) setSubmissionError(error instanceof Error ? error.message : "Saved progress could not be loaded.");
        }
      }
      try {
        await loadConfig(offer);
      } catch (error) {
        if (active) setSubmissionError(error instanceof Error ? error.message : "Registration settings could not be loaded.");
        return;
      }
      if (!active) return;
      setOfferToken(offer);
      if (draft) {
        const data = draft.data;
        if (data.form && typeof data.form === "object") setForm((current) => ({ ...current, ...(data.form as Partial<typeof current>) }));
        if (typeof data.step === "number") setStep(Math.min(4, Math.max(0, Math.floor(data.step))));
        if (Array.isArray(data.approvals)) setApprovals(data.approvals.map(Boolean));
        if (typeof data.securityCheckAccepted === "boolean") setSecurityCheckAccepted(data.securityCheckAccepted);
        if (typeof data.medicalConsent === "boolean") setMedicalConsent(data.medicalConsent);
        if (typeof data.guardianAccepted === "boolean") setGuardianAccepted(data.guardianAccepted);
        if (typeof data.privacyAccepted === "boolean") setPrivacyAccepted(data.privacyAccepted);
        if (typeof data.electronicSignatureAccepted === "boolean") setElectronicSignatureAccepted(data.electronicSignatureAccepted);
        setDraftToken(draft.token);
        setResumeUrl(`${window.location.origin}/register?resume=${encodeURIComponent(draft.token)}${offer ? `&offer=${encodeURIComponent(offer)}` : ""}`);
        setSaved("Saved progress restored");
        window.history.replaceState({}, "", `/register${offer ? `?offer=${encodeURIComponent(offer)}` : ""}`);
      }
    }

    void boot();
    return () => { active = false; };
  }, []);

  const age = useMemo(() => {
    if (!form.birthdate) return null;
    const birth = new Date(form.birthdate);
    const today = new Date();
    let value = today.getFullYear() - birth.getFullYear();
    const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
    if (beforeBirthday) value -= 1;
    return Number.isFinite(value) && value >= 0 ? value : null;
  }, [form.birthdate]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  }

  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d")!;
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
  }

  function draw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d")!;
    const current = point(event);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#5f1830";
    context.lineTo(current.x, current.y);
    context.stroke();
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
  }

  function useTypedSignature() {
    const name = form.signer.trim();
    if (!name) { setSubmissionError("Enter the signing parent’s name before using a typed signature."); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#5f1830";
    context.font = "italic 54px Georgia, serif";
    context.textBaseline = "middle";
    context.fillText(name, 28, canvas.height / 2, canvas.width - 56);
    setSignatureData(canvas.toDataURL("image/png"));
    setSubmissionError("");
  }

  function finishDrawing() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setSignatureData(canvas.toDataURL("image/png"));
  }

  const payment = {
    ...choirConfig.currentYear.payment,
    registrationFeeAmount: paymentAmounts.registration,
    monthlyAmount: paymentAmounts.monthly,
    juneAmount: paymentAmounts.june,
    securityCheckAmount: paymentAmounts.securityCheck,
    securityCheckMonths: paymentAmounts.securityCheckMonths,
  };
  const activeApprovalSections = activeAgreementSections.filter((section) => section.title !== "Introduction");
  const selectedMethod = paymentMethodRecords.find((method) => method.label === form.method);
  const isCashMethod = selectedMethod ? selectedMethod.cashHandling : form.method === "Cash";
  const paymentRequiresProof = !isCashMethod && (selectedMethod ? selectedMethod.proofPolicy === "required" : proofUploadRequired);
  const paymentAllowsProof = !isCashMethod && selectedMethod?.proofPolicy !== "none";
  const detailsComplete = Boolean(
    form.daughter.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.birthdate) &&
    (form.father.trim() || form.mother.trim()) &&
    (form.fatherPhone.trim() || form.motherPhone.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
  );
  const careComplete = Boolean(form.emergencyName.trim() && form.emergencyPhone.trim() && form.emergencyRelation.trim() && medicalConsent);
  const canContinue =
    (step !== 0 || detailsComplete) &&
    (step !== 1 || careComplete) &&
    (step !== 2 || approvals.every(Boolean)) &&
    (step !== 3 || (securityCheckAccepted && (!paymentRequiresProof || Boolean(proofName)) && (!proofName || paymentProofAccepted)));
  const canComplete = Boolean(signatureData) && form.signer.trim().length > 1 && guardianAccepted && privacyAccepted && electronicSignatureAccepted;
  const wideStep = step === 2 || step === 4;
  const signingDate = useMemo(() => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem" }).format(new Date()), []);

  function chooseProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file && file.size > 2_500_000) {
      event.target.value = "";
      setProofFile(null);
      setProofName("");
      setProofPreview("");
      setSubmissionError("Please choose a payment screenshot smaller than 2.5 MB.");
      return;
    }
    setProofFile(file ?? null);
    setProofName(file?.name ?? "");
    setProofPreview("");
    setPaymentProofAccepted(false);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProofPreview(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  function goForward() {
    if (!canContinue) return;
    if (step === 3 && isCashMethod) {
      setCashReminderOpen(true);
      return;
    }
    setStep((current) => current + 1);
  }

  async function submitRegistration() {
    if (!canComplete || submitting) return;
    setSubmitting(true);
    setSubmissionError("");

    try {
      const body = new FormData();
      body.set("payload", JSON.stringify({
        form,
        approvals: activeApprovalSections.map((section, index) => ({ sectionTitle: section.title, understood: approvals[index] })),
        agreementVersion: activeAgreementVersion,
        offerToken: offerToken || undefined,
        securityCheckAccepted,
        medicalConsent,
        paymentProofAccepted,
        guardianAccepted,
        privacyAccepted,
        electronicSignatureAccepted,
        signatureData,
        draftToken: draftToken || undefined,
      }));
      if (proofFile) body.set("proof", proofFile, proofFile.name);

      const response = await fetch("/api/registrations/submit", { method: "POST", body });
      const result = await response.json() as { downloadUrl?: string; scheduleUrl?: string; error?: string };
      if (!response.ok || !result.downloadUrl) throw new Error(result.error || "Registration could not be completed.");

      setDownloadUrl(result.downloadUrl);
      setScheduleUrl(result.scheduleUrl || "");
      setComplete(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Registration could not be completed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveProgress() {
    if (savingDraft) return;
    setSavingDraft(true);
    setSubmissionError("");
    try {
      const response = await fetch("/api/registrations/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: draftToken || undefined,
          data: { form, step, approvals, securityCheckAccepted, medicalConsent, guardianAccepted, privacyAccepted, electronicSignatureAccepted, offerToken: offerToken || null },
        }),
      });
      const result = await response.json() as { token?: string; resumeUrl?: string; error?: string };
      if (!response.ok || !result.token || !result.resumeUrl) throw new Error(result.error || "Progress could not be saved.");
      setDraftToken(result.token);
      setResumeUrl(`${window.location.origin}${result.resumeUrl}`);
      setSaved("Progress saved");
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Progress could not be saved.");
    } finally {
      setSavingDraft(false);
    }
  }

  const registrationSummary = (
    <aside className={wideStep ? "form-summary form-summary-inline" : "form-summary"}>
      <p className="eyebrow">Registration summary</p>
      <h2>{form.daughter || "Your daughter"}</h2>
      <dl><div><dt>Year</dt><dd>{registrationYear}</dd></div><div><dt>Day</dt><dd>{scheduleInfo.day}</dd></div><div><dt>Session</dt><dd>{scheduleInfo.sessionLength}</dd></div><div><dt>Location</dt><dd>{scheduleInfo.location}</dd></div></dl>
      <div className="summary-help"><span>?</span><p>Questions? Call Nechama<br /><a href="tel:+972535906149">{choirConfig.brand.phone}</a></p></div>
    </aside>
  );

  if (complete) {
    return (
      <main className="registration-shell registration-complete">
        <section className="success-card">
          <span className="success-icon">✓</span>
          <p className="eyebrow">Registration received</p>
          <h1>Thank you, {form.mother || form.father || "Parent"}.</h1>
          <p>{form.daughter || "Your daughter"}’s registration and signed agreement have been saved.</p>
          <div className="success-actions"><a className="button" href={downloadUrl} download>Download agreement</a>{scheduleUrl && <a className="secondary-button" href={scheduleUrl}>Open parent schedule</a>}<Link className="text-link" href="/">Return home</Link></div>
          {scheduleUrl && <p>Your private schedule link is ready. Save it now; it will update automatically when group details and sessions are finalized.</p>}
          <small>Please download a copy for your records.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-shell">
      <header className="form-header">
        <Link href="/" className="form-logo"><img src={choirConfig.brand.logo} alt="The Choir Chug" /></Link>
        <button className="save-button" type="button" disabled={savingDraft} onClick={saveProgress}>{savingDraft ? "Saving…" : "Save & continue later"}</button>
      </header>

      <section className="form-intro">
        <p className="eyebrow">{registrationYear}</p>
        <h1>Registration</h1>
        <p>{customOfferLabel ? `Private registration arrangement: ${customOfferLabel}. ` : ""}You’ll review the complete agreement before signing.</p>
      </section>

      <ol className="form-stepper" aria-label="Registration progress">
        {steps.map((label, index) => (
          <li className={index === step ? "active" : index < step ? "done" : ""} key={label}>
            <button type="button" onClick={() => index <= step && setStep(index)}><span>{index < step ? "✓" : index + 1}</span>{label}</button>
          </li>
        ))}
      </ol>

      <div className={wideStep ? "form-layout form-layout-wide" : "form-layout"}>
        {wideStep && registrationSummary}
        <section className="form-panel">
          {step === 0 && (
            <div className="form-section">
              <div className="form-section-title"><span>01</span><div><h2>Participant information</h2><p>Tell us who is joining the choir.</p></div></div>
              <aside className="collection-notice"><strong>Before you enter personal information</strong><p>Providing information is voluntary, but fields marked as required will be needed to process registration, contact a parent, form groups, administer payment and prepare the agreement. The Choir Chug, operated by Nechama Abergil in Beit Shemesh, will use it for those purposes and authorized service providers may process it for hosting, storage and delivery. <Link href="/privacy" target="_blank">Read the full Privacy Policy and your access and correction rights.</Link></p></aside>
              <div className="field-grid">
                <label className="field field-wide"><span>Daughter’s full name</span><input required value={form.daughter} onChange={(event) => update("daughter", event.target.value)} placeholder="Full name" /></label>
                <label className="field"><span>Date of birth</span><input required type="date" value={form.birthdate} onInput={(event) => update("birthdate", event.currentTarget.value)} /></label>
                <div className="field calculated-field"><span>Age</span><strong>{age ?? "—"}</strong></div>
                <label className="field"><span>Father’s name</span><input value={form.father} onChange={(event) => update("father", event.target.value)} /></label>
                <label className="field"><span>Father’s phone</span><input inputMode="tel" value={form.fatherPhone} onChange={(event) => update("fatherPhone", event.target.value)} /></label>
                <label className="field"><span>Mother’s name</span><input value={form.mother} onChange={(event) => update("mother", event.target.value)} /></label>
                <label className="field"><span>Mother’s phone</span><input inputMode="tel" value={form.motherPhone} onChange={(event) => update("motherPhone", event.target.value)} /></label>
                <label className="field field-wide"><span>Email for your agreement copy</span><input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="parent@example.com" /></label>
                {homeAddressEnabled && <label className="field field-wide"><span>Home address</span><input value={form.address} onChange={(event) => update("address", event.target.value)} /></label>}
                {schoolEnabled && <label className="field field-wide"><span>School</span><input value={form.school} onChange={(event) => update("school", event.target.value)} /></label>}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="form-section">
              <div className="form-section-title"><span>02</span><div><h2>Emergency & medical information</h2><p>Private information to help us care for her properly.</p></div></div>
              <div className="field-grid">
                <label className="field"><span>Emergency contact</span><input required value={form.emergencyName} onChange={(event) => update("emergencyName", event.target.value)} /></label>
                <label className="field"><span>Emergency phone</span><input required inputMode="tel" value={form.emergencyPhone} onChange={(event) => update("emergencyPhone", event.target.value)} /></label>
                <label className="field field-wide"><span>Relationship to child</span><input required value={form.emergencyRelation} onChange={(event) => update("emergencyRelation", event.target.value)} /></label>
                <label className="field field-wide"><span>Allergies</span><textarea value={form.allergies} onChange={(event) => update("allergies", event.target.value)} placeholder="Write ‘None’ if there are no known allergies." /></label>
                <label className="field field-wide"><span>Medical information or special assistance</span><textarea value={form.medical} onChange={(event) => update("medical", event.target.value)} placeholder="Write ‘None’ if there is nothing we need to know." /></label>
                <label className="field field-wide"><span>Medication or regular assistance</span><textarea value={form.medications} onChange={(event) => update("medications", event.target.value)} placeholder="Write ‘None’ if there is nothing we need to know." /></label>
                <label className="field field-wide"><span>Additional private note</span><textarea value={form.additionalNote} onChange={(event) => update("additionalNote", event.target.value)} placeholder="Optional" /></label>
              </div>
              <label className="standalone-consent"><input type="checkbox" checked={medicalConsent} onChange={(event) => setMedicalConsent(event.target.checked)} /><span>I agree that necessary allergy, medical and assistance information may be used by authorized Choir Chug staff for safe participation and emergencies. I understand I should provide only relevant information.</span></label>
            </div>
          )}

          {step === 2 && (
            <div className="form-section">
              <div className="form-section-title"><span>03</span><div><h2>Full Registration Agreement</h2><p>Read each section and confirm your understanding. This exact wording will appear in the document you sign.</p></div></div>
              <div className="agreement-progress"><span style={{ width: `${(approvals.filter(Boolean).length / approvals.length) * 100}%` }} /></div>
              <p className="agreement-count">{approvals.filter(Boolean).length} of {approvals.length} sections confirmed · Agreement version {activeAgreementVersion}</p>
              <div className="agreement-list full-agreement-list">
                {activeAgreementSections.map((section) => {
                  const approvalIndex = activeApprovalSections.findIndex((candidate) => candidate.title === section.title);
                  const approved = approvalIndex < 0 || approvals[approvalIndex];
                  return <section className={approved ? "agreement-section approved" : "agreement-section"} key={section.title}>
                    {section.title !== "Introduction" && <h3>{section.title}</h3>}
                    <div className="agreement-section-copy">{section.paragraphs.map((item) => <p key={item.id}>{item.text}</p>)}</div>
                    {approvalIndex >= 0 && <label className="agreement-section-approval"><input type="checkbox" checked={approvals[approvalIndex]} onChange={(event) => setApprovals((current) => current.map((value, itemIndex) => itemIndex === approvalIndex ? event.target.checked : value))} /><span>I understand</span></label>}
                  </section>;
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-section">
              <div className="form-section-title"><span>04</span><div><h2>Payment information</h2><p>Choose a method and add payment proof where applicable.</p></div></div>
              <div className="payment-total monthly-payment"><span>Monthly choir payment</span><strong><bdi dir="ltr">₪{payment.monthlyAmount.toLocaleString("en-US")}</bdi><em>/month</em></strong><small>* June is <bdi dir="ltr">₪{payment.juneAmount.toLocaleString("en-US")}</bdi>{payment.registrationFeeAmount > 0 && <> · One-time registration fee <bdi dir="ltr">₪{payment.registrationFeeAmount.toLocaleString("en-US")}</bdi></>}</small></div>
              <div className="payment-methods">
                {paymentMethods.map((method) => <label className={form.method === method ? "selected" : ""} key={method}><input type="radio" name="payment" value={method} checked={form.method === method} onChange={(event) => { update("method", event.target.value); setProofName(""); setProofPreview(""); setProofFile(null); setPaymentProofAccepted(false); }} /><span>{method}</span></label>)}
              </div>
              {selectedMethod?.instructions && <p className="payment-method-note"><strong>{selectedMethod.label}:</strong> {selectedMethod.instructions}</p>}
              {paymentAllowsProof && (
                <>
                  <div className="upload-title"><span>Payment proof</span><small>{paymentRequiresProof ? "Required" : "Optional"} for {form.method}</small></div>
                  <label className={proofPreview ? "upload-box has-preview" : "upload-box"}><input type="file" accept="image/*" onChange={chooseProof} />{proofPreview ? <img className="upload-preview" src={proofPreview} alt="Selected payment screenshot preview" /> : <span className="upload-icon">↑</span>}<strong>{proofName || "Upload payment screenshot"}</strong><small>{proofPreview ? "Tap to replace this image" : "Choose a photo or take one with your phone"}</small></label>
                  <p className="upload-privacy">Before uploading, crop or cover balances, unrelated transactions, identity numbers and other unnecessary details. A transaction reference, date and amount will be offered as an alternative in the working system.</p>
                  {proofName && <label className="standalone-consent"><input type="checkbox" checked={paymentProofAccepted} onChange={(event) => setPaymentProofAccepted(event.target.checked)} /><span>I confirm that I removed unrelated sensitive details and agree to this payment proof being used to verify and record the payment.</span></label>}
                </>
              )}
              <div className="security-check-card">
                <div><span>Security check needed</span><strong>{payment.securityCheckMonths}</strong></div>
                <p>Please bring a security check for the remaining balance after the registration payment.</p>
                <small>Security check total for {registrationYear}: <bdi dir="ltr">₪{payment.securityCheckAmount.toLocaleString("en-US")}</bdi></small>
                <label><input type="checkbox" checked={securityCheckAccepted} onChange={(event) => setSecurityCheckAccepted(event.target.checked)} /><span>I understand</span></label>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="form-section">
              <div className="form-section-title"><span>05</span><div><h2>Review & sign</h2><p>Review the exact agreement you approved, then add the parent’s signature.</p></div></div>
              <div className="document-toolbar"><span>A4 agreement preview · {activeAgreementVersion}</span><button type="button" onClick={() => setStep(2)}>← Return to agreement approvals</button></div>
              <div className="document-preview a4-contract">
                <header className="contract-header"><img src={choirConfig.brand.logo} alt="The Choir Chug" /><h3>Registration & Agreement Form</h3><p>{registrationYear}</p></header>
                <div className="contract-introduction">
                  {activeAgreementSections.find((section) => section.title === "Introduction")?.paragraphs.map((paragraph) => <p key={paragraph.id}>{paragraph.text}</p>)}
                </div>
                <section className="contract-participant">
                  <h4>Participant Information</h4>
                  <dl>
                    <div><dt>Daughter’s full name</dt><dd>{form.daughter || "Not entered"}</dd></div>
                    <div><dt>Date of birth / Age</dt><dd>{form.birthdate || "Not entered"} · {age ?? "—"}</dd></div>
                    <div><dt>Father</dt><dd>{form.father || "Not entered"} · {form.fatherPhone || "No phone"}</dd></div>
                    <div><dt>Mother</dt><dd>{form.mother || "Not entered"} · {form.motherPhone || "No phone"}</dd></div>
                    <div><dt>Parent email</dt><dd>{form.email || "Not entered"}</dd></div>
                    <div><dt>Payment method</dt><dd>{form.method}</dd></div>
                  </dl>
                </section>
                <section className="contract-care">
                  <h4>Emergency & Medical Information</h4>
                  <dl>
                    <div><dt>Emergency contact</dt><dd>{form.emergencyName || "Not entered"} · {form.emergencyPhone || "No phone"} · {form.emergencyRelation || "Relationship not entered"}</dd></div>
                    <div><dt>Allergies</dt><dd>{form.allergies || "Not entered"}</dd></div>
                    <div><dt>Medical information or special assistance</dt><dd>{form.medical || "Not entered"}</dd></div>
                    <div><dt>Medication or regular assistance</dt><dd>{form.medications || "Not entered"}</dd></div>
                    <div><dt>Additional private note</dt><dd>{form.additionalNote || "None"}</dd></div>
                  </dl>
                </section>
                <div className="contract-agreement">
                  {activeAgreementSections.filter((section) => section.title !== "Introduction").map((section) => {
                    const approvalIndex = activeApprovalSections.findIndex((candidate) => candidate.title === section.title);
                    const approved = approvalIndex >= 0 && approvals[approvalIndex];
                    return (
                      <section key={section.title}>
                        <h4>{section.title}</h4>
                        {section.paragraphs.map((paragraph) => <div className="contract-paragraph" key={paragraph.id}><p>{paragraph.text}</p></div>)}
                        <small className="contract-section-approval">{approved ? "✓ I understand" : "Not yet confirmed"}</small>
                      </section>
                    );
                  })}
                </div>
                <section className="contract-confirmation">
                  <h4>Confirmation</h4>
                  <div><span>Singer’s name</span><strong>{form.daughter || "Not entered"}</strong></div>
                  <div><span>Parent signing</span><strong>{form.signer || "To be completed below"}</strong></div>
                  <div><span>Date</span><strong>{signingDate}</strong></div>
                  <div className="contract-signature-line"><span>Parent’s signature</span>{signatureData ? <img className="document-signature" src={signatureData} alt="Parent’s electronic signature" /> : <strong>Sign below to add signature</strong>}</div>
                  <p>Looking forward to a wonderful year of music and growth together! 🎶</p>
                </section>
              </div>
              <label className="field"><span>Parent signing</span><input value={form.signer} onChange={(event) => update("signer", event.target.value)} placeholder="Full name" /></label>
              <div className="signature-label"><span>Signature</span><span><button type="button" onClick={useTypedSignature}>Use typed signature</button><button type="button" onClick={clearSignature}>Clear</button></span></div>
              <canvas className="signature-canvas" width="760" height="190" ref={canvasRef} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} />
              <p className="signature-help">Sign using your finger, stylus, mouse or trackpad, or use the accessible typed-signature option.</p>
              {signatureData && <div className="signature-float-preview" role="status"><img src={signatureData} alt="" /><span>Signature added to the agreement</span></div>}
              <div className="legal-confirmations">
                <label><input type="checkbox" checked={guardianAccepted} onChange={(event) => setGuardianAccepted(event.target.checked)} /><span>I confirm that I am the participant’s parent or legal guardian and that I am authorized to provide the child’s and emergency contacts’ information.</span></label>
                <label><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} /><span>I have read the <Link href="/privacy" target="_blank">Privacy Policy</Link> and <Link href="/terms" target="_blank">Terms of Use</Link> and understand how the registration information will be used.</span></label>
                <label><input type="checkbox" checked={electronicSignatureAccepted} onChange={(event) => setElectronicSignatureAccepted(event.target.checked)} /><span>I agree to sign and receive this agreement electronically.</span></label>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => step > 0 ? setStep(step - 1) : window.location.href = "/"}>{step > 0 ? "Back" : "Return home"}</button>
            {step < steps.length - 1 ? <button className="button" type="button" disabled={!canContinue} onClick={goForward}>Continue <span>→</span></button> : <button className="button" type="button" disabled={!canComplete || submitting} onClick={submitRegistration}>{submitting ? "Saving…" : "Sign & complete"} <span>→</span></button>}
          </div>
          {submissionError && <p className="submission-error" role="alert">{submissionError}</p>}
        </section>

        {!wideStep && registrationSummary}
      </div>

      {saved && <div className="toast" role="status"><strong>{saved}</strong><span>{resumeUrl ? "Your private return link is ready." : "You can continue from where you stopped."}</span><div className="toast-actions">{resumeUrl && <button onClick={() => { void navigator.clipboard.writeText(resumeUrl); setSaved("Return link copied"); }}>Copy</button>}<button onClick={() => setSaved("")} aria-label="Dismiss">×</button></div></div>}
      {cashReminderOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCashReminderOpen(false)}>
          <section className="cash-reminder-modal" role="dialog" aria-modal="true" aria-labelledby="cash-reminder-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="cash-reminder-icon">₪</span>
            <p className="eyebrow">Cash payment reminder</p>
            <h2 id="cash-reminder-title">Please send each payment on time.</h2>
            <p>{cashReminderText}</p>
            <div><button className="secondary-button" type="button" onClick={() => setCashReminderOpen(false)}>Go back</button><button className="button" type="button" onClick={() => { setCashReminderOpen(false); setStep(4); }}>I understand—continue</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
