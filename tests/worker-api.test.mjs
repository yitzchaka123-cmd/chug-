import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Miniflare } from "miniflare";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = join(projectRoot, "public");
const migrations = ["0000_fat_wilson_fisk.sql", "0001_calm_scarecrow.sql", "0002_sharp_skaar.sql", "0003_crazy_cammi.sql", "0004_flippant_major_mapleleaf.sql"];
const mimeTypes = new Map([[".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".ttf", "font/ttf"], [".svg", "image/svg+xml"]]);

async function staticAsset(request) {
  try {
    const pathname = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, "");
    if (!pathname || pathname.includes("..")) return new Response("Not found", { status: 404 });
    return new Response(await readFile(join(publicRoot, pathname)), { headers: { "Content-Type": mimeTypes.get(extname(pathname).toLowerCase()) || "application/octet-stream" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function workerModules(root, relative = "") {
  const entries = await readdir(join(root, relative), { withFileTypes: true });
  const modules = [];
  for (const entry of entries) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) modules.push(...await workerModules(root, path));
    else if (entry.isFile() && entry.name.endsWith(".js")) modules.push({ type: "ESModule", path });
  }
  return modules;
}

async function json(response) {
  const body = await response.json();
  assert.ok(response.ok, `${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function requestPath(value) {
  if (!value.startsWith("http://") && !value.startsWith("https://")) return value;
  const parsed = new URL(value);
  return `${parsed.pathname}${parsed.search}`;
}

test("registration, custom pricing, schedules, PDFs, admin data and backups work together", async () => {
  const builtServerRoot = join(projectRoot, "dist/server");
  const discoveredModules = await workerModules(builtServerRoot);
  discoveredModules.sort((left, right) => left.path === "index.js" ? -1 : right.path === "index.js" ? 1 : left.path.localeCompare(right.path));
  const mf = new Miniflare({
    modules: discoveredModules,
    modulesRoot: builtServerRoot,
    rootPath: builtServerRoot,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: { DB: "choir-test-db" },
    r2Buckets: ["BUCKET"],
    serviceBindings: { ASSETS: staticAsset },
    bindings: {
      CHOIR_DATA_KEY: "v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      CHOIR_TOKEN_SECRET: "isolated-worker-test-token-secret-with-enough-entropy",
      CHOIR_ADMIN_PASSCODE: "0331",
    },
  });

  try {
    const db = await mf.getD1Database("DB");
    for (const migration of migrations) {
      const source = await readFile(join(projectRoot, "drizzle", migration), "utf8");
      for (const statement of source.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) await db.prepare(statement).run();
    }

    const request = (path, init) => mf.dispatchFetch(`http://choir.test${path}`, init);
    const standard = await json(await request("/api/registration-config"));
    assert.equal(standard.year, "2026–2027");
    assert.equal(standard.amounts.monthly, 200);
    const sectionTitles = standard.agreementSections.map((section) => section.title);
    assert.ok(standard.agreementSections.length >= 6, `unexpected agreement shape: ${sectionTitles.join(", ")}`);
    assert.ok(sectionTitles.includes("Schedule"), "the schedule section is named Schedule");
    assert.ok(sectionTitles.includes("General Information"), "the merged general section is present");
    assert.ok(!sectionTitles.includes("Cancellations & Absences"));
    const cashMethod = standard.paymentMethodRecords.find((method) => method.code === "cash");
    assert.equal(cashMethod?.cashHandling, true, "the seeded cash method must carry the cash-handling flag");

    const login = await request("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: "0331" }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie?.startsWith("choir_admin_session="));
    const adminHeaders = { Cookie: cookie, "Content-Type": "application/json" };
    const years = await json(await request("/api/admin/years", { headers: adminHeaders }));
    const yearId = years.years.find((year) => year.status === "active").id;

    const group = await json(await request("/api/admin/groups", { method: "POST", headers: adminHeaders, body: JSON.stringify({ yearId, name: "Test Group", startTime: "17:00", endTime: "17:50", location: "Test Studio", ageMin: 7, ageMax: 11 }) }));
    assert.ok(group.id);

    const offer = await json(await request("/api/admin/custom-links", { method: "POST", headers: adminHeaders, body: JSON.stringify({ yearId, groupId: group.id, label: "Test discount", registrationFee: 150, monthlyFee: 150, juneFee: 50, securityCheck: 1200, allowedPaymentMethod: "cash", proofPolicy: "none", monthOverrides: { "2026-10": 100 } }) }));
    const offerToken = new URL(offer.url).searchParams.get("offer");
    assert.ok(offerToken);
    const customConfig = await json(await request(`/api/registration-config?offer=${encodeURIComponent(offerToken)}`));
    assert.equal(customConfig.amounts.monthly, 150);
    assert.deepEqual(customConfig.paymentMethods, ["Cash"]);
    const customAgreementText = customConfig.agreementSections.flatMap((section) => section.paragraphs).map((paragraph) => paragraph.text).join("\n");
    assert.match(customAgreementText, /Test discount/);
    assert.match(customAgreementText, /Monthly cost: 150₪/);
    assert.doesNotMatch(customAgreementText, /Monthly cost: 200₪/);

    const blankLink = await json(await request("/api/admin/custom-links", { method: "POST", headers: adminHeaders, body: JSON.stringify({ yearId, label: "Blank fees keep standard pricing", registrationFee: null, monthlyFee: null, juneFee: null, securityCheck: null, oneTimeAmount: null }) }));
    const blankToken = new URL(blankLink.url).searchParams.get("offer");
    const blankConfig = await json(await request(`/api/registration-config?offer=${encodeURIComponent(blankToken)}`));
    assert.equal(blankConfig.amounts.monthly, standard.amounts.monthly, "blank custom-link fees must fall back to the standard year pricing, not ₪0");
    assert.equal(blankConfig.amounts.registration, standard.amounts.registration);
    assert.equal(blankConfig.amounts.june, standard.amounts.june);

    const settingsDenied = await request("/api/admin/settings", { method: "PATCH", headers: adminHeaders, body: JSON.stringify({ proofUploadRequired: true, administratorEmail: "admin@example.invalid" }) });
    assert.equal(settingsDenied.status, 403, "changing the administrator email must require the current passcode");
    const settingsSaved = await json(await request("/api/admin/settings", { method: "PATCH", headers: adminHeaders, body: JSON.stringify({ proofUploadRequired: true, administratorEmail: "admin@example.invalid", currentPasscode: "0331" }) }));
    assert.equal(settingsSaved.saved, true);

    const fakeForm = { daughter: "Test Student", birthdate: "2017-03-12", father: "Test Parent", fatherPhone: "0500000000", mother: "", motherPhone: "", email: "test-parent@example.invalid", emergencyName: "Test Contact", emergencyPhone: "0500000001", emergencyRelation: "Relative", allergies: "None", medical: "None", medications: "None", additionalNote: "", address: "", school: "", method: "Cash", signer: "Test Parent" };
    const draft = await json(await request("/api/registrations/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { form: fakeForm, step: 1, approvals: [], offerToken } }) }));
    assert.ok(draft.token);
    const resumed = await json(await request(`/api/registrations/draft?token=${encodeURIComponent(draft.token)}`));
    assert.equal(resumed.data.form.daughter, "Test Student");

    // A screenshot attached while saving progress must survive the round trip.
    const pngBytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XzmF+wAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
    const proofDraftBody = new FormData();
    proofDraftBody.set("payload", JSON.stringify({ token: draft.token, data: { form: fakeForm, step: 3, approvals: [], offerToken } }));
    proofDraftBody.set("proof", new Blob([pngBytes], { type: "image/png" }), "transfer.png");
    const encodedProofDraft = new Response(proofDraftBody);
    const draftWithProof = await json(await request("/api/registrations/draft", {
      method: "POST",
      headers: { "Content-Type": encodedProofDraft.headers.get("content-type") },
      body: await encodedProofDraft.arrayBuffer(),
    }));
    assert.ok(draftWithProof.proof, "saving progress must keep the screenshot");
    assert.equal(draftWithProof.proof.fileName, "transfer.png");
    const resumedWithProof = await json(await request(`/api/registrations/draft?token=${encodeURIComponent(draft.token)}`));
    assert.ok(resumedWithProof.proof, "resuming must report the screenshot already held");
    assert.equal(resumedWithProof.proof.fileName, "transfer.png");

    const signatureData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XzmF+wAAAABJRU5ErkJggg==";
    const formData = new FormData();
    formData.set("payload", JSON.stringify({
      form: fakeForm,
      approvals: customConfig.agreementSections.filter((section) => section.title !== "Introduction").map((section) => ({ sectionTitle: section.title, understood: true })),
      agreementVersion: customConfig.agreementVersion,
      offerToken,
      securityCheckAccepted: true,
      medicalConsent: true,
      paymentProofAccepted: false,
      guardianAccepted: true,
      privacyAccepted: true,
      electronicSignatureAccepted: true,
      signatureData,
      draftToken: draft.token,
    }));
    const encodedForm = new Response(formData);
    const submitted = await json(await request("/api/registrations/submit", {
      method: "POST",
      headers: { "Content-Type": encodedForm.headers.get("content-type") },
      body: await encodedForm.arrayBuffer(),
    }));
    assert.ok(submitted.registrationId && submitted.downloadUrl && submitted.scheduleUrl);
    const submittedDetail = await json(await request(`/api/admin/registrations/${encodeURIComponent(submitted.registrationId)}`, { headers: adminHeaders }));
    assert.equal(submittedDetail.registration.proofStatus, "not_required", "this registration pays cash, so a screenshot left on the draft is ignored rather than blocking it");

    const agreement = await request(requestPath(submitted.downloadUrl));
    assert.equal(agreement.status, 200);
    assert.equal(agreement.headers.get("content-type"), "application/pdf");
    assert.equal(new TextDecoder().decode((await agreement.arrayBuffer()).slice(0, 5)), "%PDF-");

    const parentSchedulePath = requestPath(submitted.scheduleUrl).replace(/^\/schedule\//, "/api/schedule/");
    const parentSchedule = await json(await request(parentSchedulePath));
    assert.equal(parentSchedule.group.name, "Test Group");

    const plan = await json(await request("/api/admin/schedule", { method: "POST", headers: adminHeaders, body: JSON.stringify({ action: "apply-plan", yearId, groupId: group.id, dates: ["2026-09-02", "2026-09-09", "2026-09-16"] }) }));
    assert.equal(plan.count, 3);
    const planEvents = await json(await request(`/api/admin/schedule?yearId=${encodeURIComponent(yearId)}`, { headers: adminHeaders }));
    assert.equal(planEvents.events.filter((event) => event.source === "planned").length, 3, "the calendar plan must create planned sessions for the chosen dates");

    await json(await request("/api/admin/groups", { method: "PATCH", headers: adminHeaders, body: JSON.stringify({ id: group.id, announcementTitle: "This week", announcementBody: "The session ends 10 minutes early." }) }));
    const parentAfterUpdate = await json(await request(parentSchedulePath));
    assert.equal(parentAfterUpdate.announcement.body, "The session ends 10 minutes early.");
    assert.equal(parentAfterUpdate.announcementHistory.length, 1, "published updates must be recorded in the history");
    const parentYearView = await json(await request(`${parentSchedulePath}?scope=year`));
    assert.ok(parentYearView.year.startsOn, "the year scope must expose the school-year range for printing");
    assert.ok(parentYearView.events.length >= 3, "the year scope must return the planned sessions");

    const generated = await json(await request("/api/admin/schedule", { method: "POST", headers: adminHeaders, body: JSON.stringify({ action: "generate", yearId }) }));
    assert.ok(generated.generated > 20);
    const savedVersions = await json(await request(`/api/admin/schedule?yearId=${encodeURIComponent(yearId)}`, { headers: adminHeaders }));
    assert.ok(savedVersions.versions.length >= 1, "saving a plan must keep a restorable version");
    const restorable = JSON.parse(savedVersions.versions[0].scope_json || "{}");
    assert.equal(restorable.groupId, group.id);
    assert.equal(restorable.dates.length, 3, "the saved version keeps the exact dates that were applied");
    const schedulePdf = await request(`/api/admin/documents?kind=schedule&yearId=${encodeURIComponent(yearId)}&groupId=${encodeURIComponent(group.id)}`, { headers: { Cookie: cookie } });
    assert.equal(schedulePdf.status, 200);
    assert.equal(schedulePdf.headers.get("content-type"), "application/pdf");

    const registrations = await json(await request(`/api/admin/registrations?yearId=${encodeURIComponent(yearId)}`, { headers: adminHeaders }));
    const testStudent = registrations.students.find((student) => student.name === "Test Student");
    assert.ok(testStudent, "the submitted registration must appear in the student list");
    assert.equal(typeof testStudent.missingPayment, "boolean");
    const detail = await json(await request(`/api/admin/registrations/${encodeURIComponent(testStudent.id)}`, { headers: adminHeaders }));
    assert.equal(detail.registration.proofStatus, "not_required", "cash registrations must not require payment proof");
    assert.equal(detail.registration.care?.allergies, "None", "decrypted medical details must reach the administrator");

    const registrationItem = detail.payments.find((payment) => payment.periodKey.endsWith("-registration"));
    assert.ok(registrationItem, "the payment ledger must carry a separate registration-fee item");
    assert.equal(registrationItem.label, "Registration fee");
    assert.equal(registrationItem.amountDue, 150, "the custom link's registration fee applies");
    const september = detail.payments.find((payment) => payment.periodKey === "2026-09");
    assert.ok(september, "September must still be charged as a normal month");
    assert.equal(september.amountDue, 150, "the registration fee must not replace September's monthly fee");

    const searchHit = await json(await request(`/api/admin/registrations?yearId=${encodeURIComponent(yearId)}&q=Test%20Stu`, { headers: adminHeaders }));
    assert.equal(searchHit.students.some((student) => student.name === "Test Student"), true);
    const searchMiss = await json(await request(`/api/admin/registrations?yearId=${encodeURIComponent(yearId)}&q=No%20Such%20Name`, { headers: adminHeaders }));
    assert.equal(searchMiss.students.length, 0);

    const groupDeleteBlocked = await request(`/api/admin/groups?id=${encodeURIComponent(group.id)}`, { method: "DELETE", headers: adminHeaders });
    assert.equal(groupDeleteBlocked.status, 409, "groups with assigned students must not be deletable");
    const usedLinkDeleteBlocked = await request(`/api/admin/custom-links?id=${encodeURIComponent(offer.id)}`, { method: "DELETE", headers: adminHeaders });
    assert.equal(usedLinkDeleteBlocked.status, 409, "custom links used by registrations must not be deletable");
    const blankLinkDeleted = await json(await request(`/api/admin/custom-links?id=${encodeURIComponent(blankLink.id)}`, { method: "DELETE", headers: adminHeaders }));
    assert.equal(blankLinkDeleted.deleted, true);
    const versions = await json(await request(`/api/admin/agreement-versions?yearId=${encodeURIComponent(yearId)}`, { headers: adminHeaders }));
    assert.equal(versions.versions[0].active, true);
    const prompt = await json(await request("/api/admin/prompts", { method: "POST", headers: adminHeaders, body: JSON.stringify({ yearId, kind: "detail-sheet", style: "warm editorial", save: true, facts: { brandName: "The Choir Chug", schoolYear: "2026–2027", schedule: "Wednesdays", fees: "150₪", customBrief: "Test-only" } }) }));
    assert.match(prompt.prompt, /FILES TO ATTACH BEFORE GENERATING/i);

    const backup = await json(await request("/api/admin/backups", { method: "POST", headers: adminHeaders, body: JSON.stringify({ reason: "manual" }) }));
    assert.ok(backup.id);
    const backupList = await json(await request("/api/admin/backups", { headers: adminHeaders }));
    assert.equal(backupList.backups.some((item) => item.id === backup.id && item.status === "ready"), true);

    const agreementList = await json(await request(`/api/admin/agreement-versions?yearId=${encodeURIComponent(yearId)}`, { headers: adminHeaders }));
    const baseVersion = agreementList.versions.find((item) => item.active);
    const duplicated = await json(await request("/api/admin/agreement-versions", { method: "PATCH", headers: adminHeaders, body: JSON.stringify({ id: baseVersion.id, action: "duplicate" }) }));
    assert.equal(duplicated.activated, false, "duplicating into a year with versions must not activate automatically");
    await json(await request("/api/admin/agreement-versions", { method: "PATCH", headers: adminHeaders, body: JSON.stringify({ id: duplicated.id, action: "activate" }) }));
    const configAfterActivate = await json(await request("/api/registration-config"));
    assert.match(configAfterActivate.agreementVersion, new RegExp(`-v${duplicated.version}$`), "activating a version must switch new registrations to it");
    const usedVersionDelete = await request(`/api/admin/agreement-versions?id=${encodeURIComponent(baseVersion.id)}`, { method: "DELETE", headers: adminHeaders });
    assert.equal(usedVersionDelete.status, 409, "versions referenced by signed registrations must not be deletable");
    const spare = await json(await request("/api/admin/agreement-versions", { method: "PATCH", headers: adminHeaders, body: JSON.stringify({ id: baseVersion.id, action: "duplicate" }) }));
    const spareDelete = await json(await request(`/api/admin/agreement-versions?id=${encodeURIComponent(spare.id)}`, { method: "DELETE", headers: adminHeaders }));
    assert.equal(spareDelete.deleted, true, "unused inactive versions must be deletable");
  } finally {
    await mf.dispose();
  }
});
