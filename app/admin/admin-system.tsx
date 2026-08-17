"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { holidaysForHebrewDate, recurringDates } from "@/lib/calendar";
import { choirConfig } from "@/app/site-config";

type Tab = "dashboard" | "students" | "groups" | "calendar" | "payments" | "years" | "agreements" | "documents" | "creative" | "history" | "settings";
type Year = { id: string; name: string; status: string; startsOn: string; endsOn: string; registrationFee: number; monthlyFee: number; juneFee: number; securityCheckRequired: boolean; scheduleMode: string; weekday: number; startTime: string; endTime: string; proofRequired: boolean; settings: Record<string, unknown> };
type Student = { id: string; name: string; initials: string; age: number | null; group: string; status: string; missingPayment: boolean; parent: string; phone: string; submittedAt: string | null; agreementId: string | null; proofFileId: string | null; studentId?: string | null; enrollmentId?: string | null; studentStatus?: string | null };
type Group = { id: string; name: string; ageMin: number | null; ageMax: number | null; weekday: number; startTime: string; endTime: string; sessionLengthMinutes: number; location: string; status: string; memberCount: number; announcementTitle: string; announcementBody: string; scheduleUrl: string };
type Unassigned = { enrollmentId: string; name: string; birthDate: string | null };
type PaymentMethod = { id: string; code: string; label: string; instructions: string; proofPolicy: "required" | "optional" | "none"; cashHandling: boolean; enabled: boolean; isDefault: boolean; sortOrder: number };
type CustomLink = { id: string; label: string; groupName: string | null; monthlyFee: number | null; registrationFee: number | null; juneFee: number | null; oneTimeAmount: number | null; status: string; useCount: number; maxUses: number | null; expiresAt: string | null; url: string };
type ScheduleEvent = { id: string; group_id: string | null; group_name?: string | null; title_en: string; title_he?: string | null; starts_at: string; ends_at?: string | null; location?: string | null; note?: string | null; status: string; kind: string; source?: string };
type ScheduleVersion = { id: string; version: number; name: string; status: string; scope_json: string; finalized_at: string };
type CareDetail = { emergencyContactName?: string; emergencyContactPhone?: string; emergencyContactRelation?: string; allergies?: string; medicalInformation?: string; medications?: string; additionalNote?: string | null; emergencyName?: string; emergencyPhone?: string; emergencyRelation?: string; medical?: string };
type Detail = { registration: { id: string; name: string; parents: { fatherName?: string; fatherPhone?: string; motherName?: string; motherPhone?: string; email?: string }; paymentMethod?: string; reviewStatus: string; proofStatus: string; studentStatus?: string; enrollmentId?: string; groupId?: string; privateNotes: string; care?: CareDetail | null }; payments: Array<{ id: string; periodKey: string; label: string; amountDue: number; amountPaid: number; status: string; paid: boolean; method?: string }>; history: Array<{ id: number; summary?: string; action: string; created_at: string }> };
type HistoryItem = { id: number; summary: string | null; action: string; entityType: string; createdAt: string };
type Backup = { id: string; reason: string; status: string; byteSize: number; createdAt: string };
type AgreementSectionEditor = { title: string; paragraphs: Array<{ id: string; text: string }> };

const navigation: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" }, { id: "students", label: "Students", icon: "♡" },
  { id: "groups", label: "Groups", icon: "◌" }, { id: "calendar", label: "Calendar", icon: "□" },
  { id: "payments", label: "Payments", icon: "₪" }, { id: "years", label: "School years", icon: "↻" },
  { id: "agreements", label: "Agreements", icon: "✓" }, { id: "documents", label: "Documents", icon: "▤" }, { id: "creative", label: "Creative studio", icon: "✦" },
  { id: "history", label: "History", icon: "⌁" }, { id: "settings", label: "Settings", icon: "⚙" },
];

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { body = {}; }
  if (response.status === 401) { window.location.href = "/"; throw new Error("Administrator session ended."); }
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The request could not be completed.");
  return body as T;
}

function money(value: number | null | undefined) { return value === null || value === undefined ? "Standard" : `₪${value.toLocaleString("en-IL")}`; }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function whatsappUrl(phone: string, text: string) { const digits = phone.replace(/\D/g, ""); const target = digits.startsWith("0") ? `972${digits.slice(1)}` : digits; return target ? `https://wa.me/${target}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`; }
type WhatsAppTemplate = { id: string; label: string; text: string };

export default function AdminSystem() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [years, setYears] = useState<Year[]>([]);
  const [yearId, setYearId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [metrics, setMetrics] = useState({ activeStudents: 0, awaitingApproval: 0, paymentsMissing: 0, upcomingBirthdays: 0 });
  const [birthdays, setBirthdays] = useState<Array<{ name: string; birthDate: string; age: number | null }>>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [unassigned, setUnassigned] = useState<Unassigned[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [manualStudent, setManualStudent] = useState({ name: "", birthDate: "", groupId: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [confirmPayment, setConfirmPayment] = useState<{ id: string; label: string } | null>(null);
  const lastBackup = useRef(0);

  const activeYear = useMemo(() => years.find((year) => year.id === yearId) || years[0], [years, yearId]);
  const filteredStudents = useMemo(() => { const query = search.trim().toLowerCase(); if (!query) return students; return students.filter((student) => [student.name, student.parent, student.phone, student.group, student.status].some((item) => item.toLowerCase().includes(query))); }, [students, search]);
  const createSafetyBackup = useCallback(() => { if (Date.now() - lastBackup.current < 5 * 60 * 1000) return; lastBackup.current = Date.now(); void fetch("/api/admin/backups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "significant-change" }) }); }, []);
  const mutate = useCallback(async <T,>(url: string, body: Record<string, unknown>, method = "POST") => { const result = await readJson<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); createSafetyBackup(); return result; }, [createSafetyBackup]);

  const loadYear = useCallback(async (selectedYearId: string) => {
    if (!selectedYearId) return; setLoading(true);
    try {
      const [registrationData, groupData, scheduleData, methodData, linkData, historyData] = await Promise.all([
        readJson<{ students: Student[]; metrics: typeof metrics; birthdays: typeof birthdays }>(`/api/admin/registrations?yearId=${encodeURIComponent(selectedYearId)}`),
        readJson<{ groups: Group[]; unassigned: Unassigned[] }>(`/api/admin/groups?yearId=${encodeURIComponent(selectedYearId)}`),
        readJson<{ events: ScheduleEvent[]; versions: ScheduleVersion[] }>(`/api/admin/schedule?yearId=${encodeURIComponent(selectedYearId)}`),
        readJson<{ methods: PaymentMethod[] }>(`/api/admin/payment-methods?yearId=${encodeURIComponent(selectedYearId)}`),
        readJson<{ links: CustomLink[] }>(`/api/admin/custom-links?yearId=${encodeURIComponent(selectedYearId)}`),
        readJson<{ history: HistoryItem[] }>(`/api/admin/history?yearId=${encodeURIComponent(selectedYearId)}`),
      ]);
      setStudents(registrationData.students); setMetrics(registrationData.metrics); setBirthdays(registrationData.birthdays);
      setGroups(groupData.groups); setUnassigned(groupData.unassigned); setEvents(scheduleData.events); setVersions(scheduleData.versions);
      setMethods(methodData.methods); setCustomLinks(linkData.links); setHistory(historyData.history);
    } catch (error) { setToast(error instanceof Error ? error.message : "Administrator records could not be loaded."); } finally { setLoading(false); }
  }, []);
  const refreshYears = useCallback(async () => { const data = await readJson<{ years: Year[] }>("/api/admin/years"); setYears(data.years); return data.years; }, []);

  useEffect(() => { let active = true; Promise.all([readJson<{ years: Year[] }>("/api/admin/years"), readJson<{ backups: Backup[] }>("/api/admin/backups")]).then(([yearData, backupData]) => { if (!active) return; const loadedYears = yearData.years; const selectedYear = loadedYears.find((year) => year.status === "active") || loadedYears[0]; setYears(loadedYears); setBackups(backupData.backups); if (selectedYear) setYearId(selectedYear.id); }).catch((error) => active && setToast(error instanceof Error ? error.message : "Administrator data could not be loaded.")); return () => { active = false; }; }, []);
  useEffect(() => { if (!yearId) return; const timer = window.setTimeout(() => void loadYear(yearId), 0); return () => window.clearTimeout(timer); }, [yearId, loadYear]);
  const searchInitialized = useRef(false);
  useEffect(() => {
    if (!yearId) return;
    if (!searchInitialized.current) { searchInitialized.current = true; return; }
    const timer = window.setTimeout(async () => {
      try {
        const data = await readJson<{ students: Student[]; metrics: typeof metrics; birthdays: typeof birthdays }>(`/api/admin/registrations?yearId=${encodeURIComponent(yearId)}&q=${encodeURIComponent(search.trim())}`);
        setStudents(data.students);
        if (!search.trim()) { setMetrics(data.metrics); setBirthdays(data.birthdays); }
      } catch { /* keep the currently shown list if the search request fails */ }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, yearId]);
  useEffect(() => { if (!selected) return; let active = true; readJson<Detail>(`/api/admin/registrations/${selected.id}`).then((data) => { if (!active) return; setDetail(data); setNotes(data.registration.privateNotes || ""); }).catch((error) => active && setToast(error instanceof Error ? error.message : "Student details could not be loaded.")); return () => { active = false; }; }, [selected]);

  async function reload(message?: string) { await loadYear(yearId); if (message) setToast(message); }
  async function addStudent() { try { const result = await mutate<{ scheduleUrl: string }>("/api/admin/students", { ...manualStudent, yearId }); setAddOpen(false); setManualStudent({ name: "", birthDate: "", groupId: "", phone: "" }); await reload("Student added. The private choir schedule link is ready to copy."); if (result.scheduleUrl) await navigator.clipboard.writeText(result.scheduleUrl).catch(() => undefined); } catch (error) { setToast(error instanceof Error ? error.message : "Student could not be added."); } }
  async function setPaymentStatus(id: string, paid: boolean) { try { await mutate(`/api/admin/payment-items/${id}`, { paid }, "PATCH"); if (selected) setSelected({ ...selected }); setConfirmPayment(null); await reload(paid ? "Payment marked paid." : "Paid status removed and recorded in history."); } catch (error) { setToast(error instanceof Error ? error.message : "Payment could not be updated."); } }
  async function registrationAction(action: "approve" | "reopen" | "archive" | "restore" | "notes") { if (!selected) return; try { await mutate(`/api/admin/registrations/${selected.id}`, { action, note: notes }, "PATCH"); setSelected({ ...selected }); await reload(action === "notes" ? "Private notes saved." : "Student record updated."); } catch (error) { setToast(error instanceof Error ? error.message : "Student record could not be updated."); } }
  async function signOut() { await fetch("/api/admin/session", { method: "DELETE" }); window.location.href = "/"; }

  return <main className="admin-shell admin-system">
    <aside className="admin-sidebar"><Link href="/" className="admin-logo"><img src={choirConfig.brand.logo} alt="The Choir Chug" /></Link><nav aria-label="Administrator navigation">{navigation.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav><div className="sidebar-bottom"><div className="admin-avatar">NA</div><span><strong>Nechama</strong><small>Administrator</small></span><button className="sidebar-logout" onClick={signOut}>Log out</button></div></aside>
    <section className="admin-main admin-workspace"><header className="admin-header"><div><div className="admin-title-line"><h1>{navigation.find((item) => item.id === tab)?.label}</h1><span>Live system</span></div><p>{loading ? "Loading the latest records…" : `${activeYear?.name || "School year"} · changes are saved to the private database`}</p></div><div className="admin-header-actions"><select aria-label="School year" value={yearId} onChange={(event) => setYearId(event.target.value)}>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.status === "active" ? " · current" : ""}</option>)}</select><button className="admin-primary" onClick={() => setAddOpen(true)}>＋ Add student</button></div></header>
      {tab === "dashboard" && <Dashboard metrics={metrics} birthdays={birthdays} setTab={setTab} year={activeYear} />}
      {tab === "students" && <StudentsPanel students={filteredStudents} search={search} setSearch={setSearch} selected={selected} setSelected={setSelected} yearId={yearId} setAddOpen={setAddOpen} />}
      {tab === "groups" && <GroupsPanel groups={groups} unassigned={unassigned} yearId={yearId} mutate={mutate} reload={reload} toast={setToast} />}
      {tab === "calendar" && <CalendarPanel events={events} versions={versions} groups={groups} yearId={yearId} year={activeYear} mutate={mutate} reload={reload} toast={setToast} />}
      {tab === "payments" && <PaymentsPanel methods={methods} links={customLinks} groups={groups} yearId={yearId} year={activeYear} mutate={mutate} reload={reload} toast={setToast} />}
      {tab === "years" && <YearsPanel key={activeYear?.id || "year"} years={years} activeYear={activeYear} setYearId={setYearId} refreshYears={refreshYears} mutate={mutate} toast={setToast} />}
      {tab === "agreements" && <AgreementsPanel yearId={yearId} year={activeYear} years={years} mutate={mutate} toast={setToast} />}
      {tab === "documents" && <DocumentsPanel yearId={yearId} groups={groups} toast={setToast} />}
      {tab === "creative" && <CreativePanel year={activeYear} yearId={yearId} toast={setToast} />}
      {tab === "history" && <HistoryPanel history={history} />}
      {tab === "settings" && <SettingsPanel year={activeYear} yearId={yearId} backups={backups} reloadBackups={async () => { const data = await readJson<{ backups: Backup[] }>("/api/admin/backups"); setBackups(data.backups); }} signOut={signOut} toast={setToast} />}
    </section>
    {selected && <StudentDrawer selected={selected} detail={detail} notes={notes} setNotes={setNotes} close={() => { setSelected(null); setDetail(null); }} action={registrationAction} setPaymentStatus={setPaymentStatus} confirmPayment={setConfirmPayment} groups={groups} yearName={activeYear?.name || "the current year"} mutate={mutate} reload={reload} toast={setToast} />}
    {addOpen && <Modal close={() => setAddOpen(false)}><p className="eyebrow">Manual student</p><h2>Add a student</h2><div className="field-grid"><label className="field field-wide"><span>Student’s full name</span><input value={manualStudent.name} onChange={(event) => setManualStudent((current) => ({ ...current, name: event.target.value }))} /></label><label className="field"><span>Date of birth</span><input type="date" value={manualStudent.birthDate} onChange={(event) => setManualStudent((current) => ({ ...current, birthDate: event.target.value }))} /></label><label className="field"><span>Group</span><select value={manualStudent.groupId} onChange={(event) => setManualStudent((current) => ({ ...current, groupId: event.target.value }))}><option value="">Not assigned</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label className="field field-wide"><span>Parent phone</span><input value={manualStudent.phone} onChange={(event) => setManualStudent((current) => ({ ...current, phone: event.target.value }))} /></label></div><button className="button button-full" onClick={addStudent}>Add student</button></Modal>}
    {confirmPayment && <div className="modal-backdrop"><section className="confirm-modal"><span className="warning-icon">!</span><h2>Remove paid status?</h2><p>This will mark {confirmPayment.label} as unpaid and record the change in activity history.</p><div><button className="secondary-button" onClick={() => setConfirmPayment(null)}>Keep payment</button><button className="danger-button" onClick={() => void setPaymentStatus(confirmPayment.id, false)}>Mark unpaid</button></div></section></div>}
    {toast && <div className="toast" role="status"><strong>{toast}</strong><button aria-label="Dismiss" onClick={() => setToast("")}>×</button></div>}
  </main>;
}

function Dashboard({ metrics, birthdays, setTab, year }: { metrics: { activeStudents: number; awaitingApproval: number; paymentsMissing: number; upcomingBirthdays: number }; birthdays: Array<{ name: string; birthDate: string; age: number | null }>; setTab: (tab: Tab) => void; year?: Year }) {
  return <><div className="metric-grid"><article><div className="metric-icon wine">♡</div><span>Active students</span><strong>{metrics.activeStudents}</strong><small>Current enrollment</small></article><article><div className="metric-icon gold">⌛</div><span>Awaiting approval</span><strong>{metrics.awaitingApproval}</strong><small className="attention">Needs review</small></article><article><div className="metric-icon rose">₪</div><span>Payments missing</span><strong>{metrics.paymentsMissing}</strong><small>This month</small></article><article><div className="metric-icon teal">✦</div><span>Upcoming birthdays</span><strong>{metrics.upcomingBirthdays}</strong><small>Next 30 days</small></article></div><div className="admin-dashboard-grid"><section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Today</p><h2>What needs attention</h2></div></div><div className="attention-list"><button onClick={() => setTab("students")}><strong>{metrics.awaitingApproval}</strong><span>registrations awaiting approval</span><b>Review →</b></button><button onClick={() => setTab("payments")}><strong>{metrics.paymentsMissing}</strong><span>payments missing this month</span><b>Open →</b></button><button onClick={() => setTab("calendar")}><strong>{year?.scheduleMode === "manual" ? "Manual" : "Weekly"}</strong><span>schedule mode for {year?.name}</span><b>Manage →</b></button></div></section><section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Next 30 days</p><h2>Birthdays</h2></div></div>{birthdays.length ? <ul className="birthday-list">{birthdays.map((birthday) => <li key={`${birthday.name}-${birthday.birthDate}`}><span>{birthday.name}</span><strong>{new Date(`${birthday.birthDate}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</strong></li>)}</ul> : <p className="admin-muted">No upcoming birthdays.</p>}</section></div></>;
}

function StudentsPanel({ students, search, setSearch, selected, setSelected, yearId, setAddOpen }: { students: Student[]; search: string; setSearch: (value: string) => void; selected: Student | null; setSelected: (value: Student) => void; yearId: string; setAddOpen: (value: boolean) => void }) {
  return <section className="students-section admin-section-card"><div className="students-header"><div><h2>Student records</h2><p>{students.length} students shown</p></div><div className="student-tools"><label className="admin-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students, parents, groups" /></label><a className="secondary-button admin-link-button" href={`/api/admin/exports/excel?yearId=${encodeURIComponent(yearId)}`} download>Export Excel</a><button className="admin-primary" onClick={() => setAddOpen(true)}>Add student</button></div></div><div className="student-grid">{students.map((student, index) => <button className={selected?.id === student.id ? "student-tile selected" : "student-tile"} key={student.id} onClick={() => setSelected(student)}><div className={`student-avatar avatar-${index % 4}`}>{student.initials}</div><div className="student-name"><strong>{student.name}</strong><span>{student.age === null ? "Age not entered" : `Age ${student.age}`} · {student.group}</span></div><span className={`status-chip status-${student.status.toLowerCase().replaceAll(" ", "-")}`}>{student.status}</span>{student.missingPayment && <span className="status-chip status-missing-payment">Missing payment</span>}<span className="tile-arrow">›</span></button>)}{students.length === 0 && <div className="admin-empty-state"><strong>No student records found</strong><p>New registrations and manually added students will appear here.</p></div>}</div></section>;
}

function StudentDrawer({ selected, detail, notes, setNotes, close, action, setPaymentStatus, confirmPayment, groups, yearName, mutate, reload, toast }: { selected: Student; detail: Detail | null; notes: string; setNotes: (value: string) => void; close: () => void; action: (action: "approve" | "reopen" | "archive" | "restore" | "notes") => Promise<void>; setPaymentStatus: (id: string, paid: boolean) => Promise<void>; confirmPayment: (value: { id: string; label: string }) => void; groups: Group[]; yearName: string; mutate: <T>(url: string, body: Record<string, unknown>, method?: string) => Promise<T>; reload: (message?: string) => Promise<void>; toast: (message: string) => void }) {
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  async function deleteStudent() {
    if (deleteConfirmation.trim().toUpperCase() !== "DELETE") { toast("Type DELETE to confirm."); return; }
    setDeleting(true);
    try {
      const name = selected.name;
      await mutate(`/api/admin/registrations/${selected.id}`, { confirmation: "DELETE" }, "DELETE");
      setDeleteOpen(false);
      close();
      await reload(`${name} was deleted permanently.`);
    } catch (error) { toast(error instanceof Error ? error.message : "Student could not be deleted."); }
    finally { setDeleting(false); }
  }
  async function changeGroup(groupId: string) { if (!detail?.registration.enrollmentId) return; await mutate("/api/admin/groups", { action: "assign", enrollmentId: detail.registration.enrollmentId, groupId }, "PATCH"); await reload("Group assignment updated. Her private choir schedule link now follows this group."); }
  const care = detail?.registration.care;
  const careRows = care ? [
    { label: "Emergency contact", value: [care.emergencyContactName || care.emergencyName, care.emergencyContactPhone || care.emergencyPhone, care.emergencyContactRelation || care.emergencyRelation].filter(Boolean).join(" · ") },
    { label: "Allergies", value: care.allergies || "" },
    { label: "Medical information", value: care.medicalInformation || care.medical || "" },
    { label: "Medication or assistance", value: care.medications || "" },
    { label: "Additional note", value: care.additionalNote || "" },
  ].filter((row) => row.value) : [];
  const assignedGroup = groups.find((group) => group.id === detail?.registration.groupId);
  const firstUnpaid = detail?.payments.find((payment) => !payment.paid);
  const lastPaid = detail ? [...detail.payments].filter((payment) => payment.paid).slice(-1)[0] : undefined;
  const whatsAppTemplates: WhatsAppTemplate[] = [
    { id: "registration-received", label: "Registration received", text: `Hello ${selected.parent}, thank you for registering ${selected.name} for the ${yearName} Choir Chug. Her signed agreement has been saved, and we will confirm her group and schedule soon.` },
    { id: "missing-information", label: "Missing registration information", text: `Hello ${selected.parent}, we are completing ${selected.name}’s Choir Chug registration and one detail is still missing. Could you please send it so we can finish her record? Thank you!` },
    { id: "missing-proof", label: "Missing payment proof", text: `Hello ${selected.parent}, we have not yet received the payment confirmation for ${selected.name}’s Choir Chug registration. Could you please send the transfer screenshot or reference when convenient? Thank you!` },
    { id: "payment-reminder", label: "Payment reminder", text: `Hello ${selected.parent}, a friendly reminder that the ${firstUnpaid ? `${firstUnpaid.label} payment of ${money(firstUnpaid.amountDue)}` : "current monthly payment"} for ${selected.name} is still open. Thank you!` },
    { id: "payment-confirmed", label: "Payment confirmed", text: `Hello ${selected.parent}, we received ${lastPaid ? `the ${lastPaid.label} payment` : "your payment"} for ${selected.name}. Thank you very much!` },
    { id: "group-assignment", label: "Group assignment & schedule link", text: `Hello ${selected.parent}, ${selected.name} has been placed in ${assignedGroup ? assignedGroup.name : "her group"}${assignedGroup?.startTime ? ` (${weekdayNames[assignedGroup.weekday] || "Wednesday"}s ${assignedGroup.startTime}${assignedGroup.endTime ? `–${assignedGroup.endTime}` : ""})` : ""}.${assignedGroup?.scheduleUrl ? ` Her private live schedule: ${assignedGroup.scheduleUrl}` : ""}` },
  ];
  return <aside className="student-drawer"><div className="drawer-head"><button onClick={close} aria-label="Close student details">×</button><span>Student profile</span><span /></div><div className="drawer-student"><div className="student-avatar avatar-1">{selected.initials}</div><div><h2>{selected.name}</h2><p>{selected.age === null ? "Age not entered" : `Age ${selected.age}`} · {selected.group}</p></div></div><div className="drawer-actions"><button onClick={() => setWhatsAppOpen(true)}>WhatsApp message</button>{selected.agreementId ? <a href={`/api/admin/agreements/${selected.id}`} download>Download agreement</a> : <button disabled>Agreement pending</button>}</div>{!detail ? <p className="drawer-loading">Loading private record…</p> : <><section className="drawer-section"><div className="drawer-section-title"><h3>Registration</h3><span className={`status-chip status-${selected.status.toLowerCase().replaceAll(" ", "-")}`}>{selected.status}</span></div><dl className="mini-details"><div><dt>Parent</dt><dd>{selected.parent}</dd></div><div><dt>Phone</dt><dd>{selected.phone || "—"}</dd></div><div><dt>Payment method</dt><dd>{detail.registration.paymentMethod || "—"}</dd></div><div><dt>Payment proof</dt><dd>{detail.registration.proofStatus === "uploaded" ? "Uploaded — not yet verified" : detail.registration.proofStatus === "not_required" ? "Not required" : "Not provided"}</dd></div></dl><div className="drawer-button-row">{detail.registration.reviewStatus === "approved" ? <button className="secondary-button" onClick={() => void action("reopen")}>Return to review</button> : <button className="admin-primary" onClick={() => void action("approve")}>Approve registration</button>}<button className="secondary-button" onClick={() => void action(detail.registration.studentStatus === "archived" ? "restore" : "archive")}>{detail.registration.studentStatus === "archived" ? "Restore" : "Archive"}</button></div></section><section className="drawer-section"><div className="drawer-section-title"><h3>Group & choir schedule</h3></div><select className="drawer-select" value={detail.registration.groupId || ""} onChange={(event) => void changeGroup(event.target.value)}><option value="">Not assigned</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><p className="admin-muted">The same private choir schedule link updates automatically after assignment.</p></section><section className="drawer-section"><div className="drawer-section-title"><h3>Emergency & medical</h3></div>{careRows.length ? <dl className="mini-details">{careRows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl> : <p className="admin-muted">No emergency or medical details were provided.</p>}<p className="admin-muted">Private information — use it only for safe participation and emergencies.</p></section><section className="drawer-section"><div className="drawer-section-title"><h3>Payments</h3></div><div className="payment-ledger">{detail.payments.map((payment) => <button key={payment.id} className={payment.paid ? "paid" : ""} onClick={() => payment.paid ? confirmPayment({ id: payment.id, label: payment.label }) : void setPaymentStatus(payment.id, true)}><span>{payment.paid ? "✓" : ""}</span><strong>{payment.label}</strong><small>{money(payment.amountDue)}</small></button>)}</div>{selected.proofFileId && <div className="proof-preview"><div className="proof-thumbnail"><img src={`/api/admin/files/${selected.proofFileId}`} alt="Payment proof" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /></div><span><strong>Proof submitted</strong><small>Not the same as verified paid</small></span><a href={`/api/admin/files/${selected.proofFileId}`} target="_blank" rel="noreferrer">View</a></div>}</section><section className="drawer-section"><div className="drawer-section-title"><h3>Private notes</h3><button onClick={() => void action("notes")}>Save</button></div><textarea className="admin-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Private administrator notes" /></section><section className="drawer-section"><div className="drawer-section-title"><h3>Recent activity</h3></div><ul className="activity-list">{detail.history.map((item) => <li key={item.id}><span />{item.summary || item.action}<small>{new Date(item.created_at).toLocaleString("en-GB")}</small></li>)}</ul></section><section className="drawer-section drawer-danger"><div className="drawer-section-title"><h3>Remove student</h3></div><p className="admin-muted">Archive her instead if she may come back - archiving keeps the record and stops her appearing as active. Deleting erases everything: registration, signed agreement, payment ledger, the uploaded registration fee screenshot and the private choir schedule link.</p><button className="danger-button" onClick={() => { setDeleteConfirmation(""); setDeleteOpen(true); }}>Delete student permanently</button></section></>}{whatsAppOpen && <WhatsAppModal title={`Message ${selected.parent}`} phone={selected.phone} templates={whatsAppTemplates} close={() => setWhatsAppOpen(false)} toast={toast} />}{deleteOpen && <div className="modal-backdrop"><section className="confirm-modal"><span className="warning-icon">!</span><h2>Delete {selected.name}?</h2><p>Everything on her record is erased permanently. Restoring an earlier protected backup is the only way to get it back.</p><label className="delete-confirm-field"><span>Type DELETE to confirm</span><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="DELETE" autoFocus /></label><div><button className="secondary-button" onClick={() => setDeleteOpen(false)}>Keep student</button><button className="danger-button" disabled={deleting || deleteConfirmation.trim().toUpperCase() !== "DELETE"} onClick={() => void deleteStudent()}>{deleting ? "Deleting…" : "Delete permanently"}</button></div></section></div>}</aside>;
}

function GroupsPanel({ groups, unassigned, yearId, mutate, reload, toast }: { groups: Group[]; unassigned: Unassigned[]; yearId: string; mutate: <T>(url: string, body: Record<string, unknown>, method?: string) => Promise<T>; reload: (message?: string) => Promise<void>; toast: (message: string) => void }) {
  const [form, setForm] = useState({ name: "", weekday: "3", startTime: "17:00", endTime: "17:50", location: "", ageMin: "", ageMax: "" });
  const [whatsAppGroup, setWhatsAppGroup] = useState<Group | null>(null);
  async function create() { try { await mutate("/api/admin/groups", { ...form, yearId, weekday: Number(form.weekday), ageMin: form.ageMin || null, ageMax: form.ageMax || null }); setForm({ name: "", weekday: "3", startTime: "17:00", endTime: "17:50", location: "", ageMin: "", ageMax: "" }); await reload("Group created with a private choir schedule link."); } catch (error) { toast(error instanceof Error ? error.message : "Group could not be created."); } }
  async function updateAnnouncement(group: Group) { const title = window.prompt("Live update heading", group.announcementTitle || "Next session update"); if (title === null) return; const body = window.prompt("Update shown to parents", group.announcementBody || ""); if (body === null) return; try { await mutate("/api/admin/groups", { id: group.id, announcementTitle: title, announcementBody: body }, "PATCH"); await reload("Live parent update published."); } catch (error) { toast(error instanceof Error ? error.message : "Update could not be published."); } }
  async function removeGroup(group: Group) { if (!window.confirm(`Delete ${group.name}? Its private choir schedule link will stop working. Groups with assigned students cannot be deleted.`)) return; try { await readJson(`/api/admin/groups?id=${encodeURIComponent(group.id)}`, { method: "DELETE" }); await reload(`${group.name} deleted.`); } catch (error) { toast(error instanceof Error ? error.message : "Group could not be deleted."); } }
  function groupTemplates(group: Group): WhatsAppTemplate[] {
    const time = group.startTime ? `${weekdayNames[group.weekday] || "Wednesday"} ${group.startTime}${group.endTime ? `–${group.endTime}` : ""}` : weekdayNames[group.weekday] || "Wednesday";
    return [
      { id: "session-update", label: "Session update", text: `Hello parents, an update for ${group.name}: this week’s session (${time}${group.location ? `, ${group.location}` : ""}) — . The live schedule always shows the latest details: ${group.scheduleUrl}` },
      { id: "session-cancelled", label: "Session cancellation", text: `Hello parents, this week’s ${group.name} session (${time}) is cancelled. The live schedule is already updated: ${group.scheduleUrl}` },
    ];
  }
  return <div className="admin-page-stack"><section className="admin-card admin-form-card"><div className="admin-card-head"><div><p className="eyebrow">Groups</p><h2>Create a group</h2></div><p>Each group receives its own private live schedule link.</p></div><div className="compact-form-grid"><label><span>Group name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span>Day</span><select value={form.weekday} onChange={(event) => setForm({ ...form, weekday: event.target.value })}>{weekdayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label><span>Start</span><input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label><span>End</span><input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label><label><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label><span>Min age</span><input type="number" value={form.ageMin} onChange={(event) => setForm({ ...form, ageMin: event.target.value })} /></label><label><span>Max age</span><input type="number" value={form.ageMax} onChange={(event) => setForm({ ...form, ageMax: event.target.value })} /></label><button className="admin-primary" onClick={() => void create()}>Create group</button></div></section><section className="admin-grid-cards">{groups.map((group) => <article className="admin-card group-card" key={group.id}><div className="group-card-title"><div><span className="status-dot" /> <strong>{group.name}</strong><small>{group.memberCount} students</small></div><span className="status-chip status-approved">{group.status}</span></div><dl className="card-details"><div><dt>Time</dt><dd>{weekdayNames[group.weekday] || "Wednesday"} {group.startTime || "TBD"}{group.endTime ? `–${group.endTime}` : ""}</dd></div><div><dt>Length</dt><dd>{group.sessionLengthMinutes} minutes</dd></div><div><dt>Location</dt><dd>{group.location || "To be set"}</dd></div><div><dt>Ages</dt><dd>{group.ageMin || "—"}–{group.ageMax || "—"}</dd></div></dl>{group.announcementBody && <div className="live-update-card"><strong>{group.announcementTitle}</strong><p>{group.announcementBody}</p></div>}<div className="card-actions"><button onClick={() => void updateAnnouncement(group)}>Live update</button><button onClick={() => setWhatsAppGroup(group)}>WhatsApp update</button><button onClick={() => { void navigator.clipboard.writeText(group.scheduleUrl); toast("Private schedule link copied."); }}>Copy schedule link</button><a href={group.scheduleUrl} target="_blank" rel="noreferrer">Open</a><button onClick={async () => { if (!window.confirm("Reset this private link? The old link will stop working.")) return; try { const result = await mutate<{ scheduleUrl: string }>("/api/admin/groups", { id: group.id, action: "rotate-link" }, "PATCH"); await navigator.clipboard.writeText(result.scheduleUrl); await reload("Private link reset and copied."); } catch (error) { toast(error instanceof Error ? error.message : "Link could not be reset."); } }}>Reset link</button><button onClick={() => void removeGroup(group)}>Delete</button></div></article>)}{groups.length === 0 && <div className="admin-empty-state"><strong>No groups yet</strong><p>Create groups once you know how registrations should be arranged.</p></div>}</section>{unassigned.length > 0 && <section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Placement</p><h2>Unassigned students</h2></div></div><div className="assignment-list">{unassigned.map((student) => <div key={student.enrollmentId}><span><strong>{student.name}</strong><small>{student.birthDate || "Birth date not entered"}</small></span><select defaultValue="" onChange={async (event) => { if (!event.target.value) return; try { await mutate("/api/admin/groups", { action: "assign", enrollmentId: student.enrollmentId, groupId: event.target.value }, "PATCH"); await reload(`${student.name} assigned.`); } catch (error) { toast(error instanceof Error ? error.message : "Assignment failed."); } }}><option value="">Assign to…</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>)}</div></section>}{whatsAppGroup && <WhatsAppModal title={`${whatsAppGroup.name} parents`} phone="" templates={groupTemplates(whatsAppGroup)} close={() => setWhatsAppGroup(null)} toast={toast} />}</div>;
}

function CalendarPanel({ events, versions, groups, yearId, year, mutate, reload, toast }: { events: ScheduleEvent[]; versions: ScheduleVersion[]; groups: Group[]; yearId: string; year?: Year; mutate: <T>(url: string, body: Record<string, unknown>, method?: string) => Promise<T>; reload: (message?: string) => Promise<void>; toast: (message: string) => void }) {
  const [form, setForm] = useState({ groupId: "", date: "", startTime: "17:00", endTime: "17:50", titleEn: "Choir session", titleHe: "", location: "", note: "" });
  const [planGroupId, setPlanGroupId] = useState("");
  const [planWeekday, setPlanWeekday] = useState(3);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [showHolidaysEn, setShowHolidaysEn] = useState(true);
  const [showHolidaysHe, setShowHolidaysHe] = useState(true);
  const [showHolidaysIl, setShowHolidaysIl] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [update, setUpdate] = useState({ title: "", body: "" });
  const [notify, setNotify] = useState<{ title: string; body: string } | null>(null);
  const [notifying, setNotifying] = useState(false);
  const initializedFor = useRef("");

  const effectivePlanGroupId = planGroupId || groups[0]?.id || "";
  const planGroup = groups.find((group) => group.id === effectivePlanGroupId);

  const monthGrids = useMemo(() => {
    if (!year) return [];
    const partsFormatter = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", timeZone: "Asia/Jerusalem" });
    const hebrewFormatter = new Intl.DateTimeFormat("he-u-ca-hebrew", { day: "numeric", month: "long", timeZone: "Asia/Jerusalem" });
    return scheduleMonths(year.startsOn, year.endsOn).map((month) => {
      const first = new Date(`${month.key}-01T12:00:00Z`);
      const dayCount = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      const days = [];
      for (let dayNumber = 1; dayNumber <= dayCount; dayNumber += 1) {
        const date = `${month.key}-${String(dayNumber).padStart(2, "0")}`;
        const moment = new Date(`${date}T12:00:00+03:00`);
        const parts = partsFormatter.formatToParts(moment);
        const hebrewDay = Number(parts.find((part) => part.type === "day")?.value || 0);
        const hebrewMonth = parts.find((part) => part.type === "month")?.value || "";
        days.push({ date, day: dayNumber, hebrew: hebrewFormatter.format(moment), ...holidaysForHebrewDate(hebrewDay, hebrewMonth) });
      }
      return { key: month.key, label: month.label, lead: first.getUTCDay(), days };
    });
  }, [year]);
  const dayLookup = useMemo(() => new Map(monthGrids.flatMap((month) => month.days.map((day) => [day.date, day] as const))), [monthGrids]);
  const seedDates = useMemo(() => new Set(year ? recurringDates(year.startsOn, year.endsOn, planWeekday) : []), [year, planWeekday]);
  const orderedDates = useMemo(() => [...selectedDates].sort(), [selectedDates]);
  const today = new Date().toISOString().slice(0, 10);
  const yearHasStarted = useMemo(() => events.some((event) => event.starts_at.slice(0, 10) <= today), [events, today]);
  function longDate(date: string) {
    return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  }
  function askToNotify(title: string, body: string) {
    if (!yearHasStarted) return;
    setNotify({ title, body });
  }
  async function restoreVersion(version: ScheduleVersion) {
    let scope: { groupId?: string; groupName?: string; dates?: string[] } = {};
    try { scope = JSON.parse(version.scope_json || "{}"); } catch { scope = {}; }
    if (!scope.groupId || !Array.isArray(scope.dates)) { toast("This saved version cannot be restored."); return; }
    if (!window.confirm(`Restore ${scope.groupName || "this group"}'s saved version with ${scope.dates.length} sessions? The parent calendar updates immediately.`)) return;
    try {
      await mutate("/api/admin/schedule", { action: "apply-plan", yearId, groupId: scope.groupId, dates: scope.dates });
      setPlanGroupId(scope.groupId);
      initializedFor.current = "";
      await reload(`Restored ${scope.dates.length} sessions.`);
    } catch (error) { toast(error instanceof Error ? error.message : "The saved version could not be restored."); }
  }
  async function sendNotice() {
    if (!notify || !effectivePlanGroupId || notifying) return;
    setNotifying(true);
    try {
      await mutate("/api/admin/groups", { id: effectivePlanGroupId, announcementTitle: notify.title, announcementBody: notify.body }, "PATCH");
      setUpdate({ title: notify.title, body: notify.body });
      setNotify(null);
      await reload("Parents updated. The notice is at the top of their schedule page.");
    } catch (error) { toast(error instanceof Error ? error.message : "The update could not be published."); } finally { setNotifying(false); }
  }

  useEffect(() => {
    if (!effectivePlanGroupId || !year || initializedFor.current === effectivePlanGroupId) return;
    initializedFor.current = effectivePlanGroupId;
    const group = groups.find((item) => item.id === effectivePlanGroupId);
    const weekday = group?.weekday ?? 3;
    setPlanWeekday(weekday);
    const saved = events.filter((event) => event.group_id === effectivePlanGroupId && (event.source === "planned" || event.source === "recurring")).map((event) => event.starts_at.slice(0, 10));
    setSelectedDates(new Set(saved.length ? saved : recurringDates(year.startsOn, year.endsOn, weekday)));
    setUpdate({ title: group?.announcementTitle || "", body: group?.announcementBody || "" });
  }, [effectivePlanGroupId, groups, events, year]);

  function reseed(weekday: number) {
    setPlanWeekday(weekday);
    if (year) setSelectedDates(new Set(recurringDates(year.startsOn, year.endsOn, weekday)));
  }
  function toggleDate(date: string) {
    setSelectedDates((current) => { const next = new Set(current); if (next.has(date)) next.delete(date); else next.add(date); return next; });
  }
  function holidayText(label: { en: string; he: string }) {
    return [showHolidaysEn ? label.en : null, showHolidaysHe ? label.he : null].filter(Boolean).join(" · ");
  }
  function previewHoliday(date: string) {
    const info = dayLookup.get(date);
    return [info?.jewish?.en, showHolidaysIl ? info?.israeli?.en : null].filter(Boolean).join(" / ");
  }

  async function savePlan() {
    if (!effectivePlanGroupId || savingPlan) return;
    setSavingPlan(true);
    try {
      const previousDates = new Set(events.filter((event) => event.group_id === effectivePlanGroupId && (event.source === "planned" || event.source === "recurring")).map((event) => event.starts_at.slice(0, 10)));
      const added = orderedDates.filter((date) => !previousDates.has(date));
      const removed = [...previousDates].filter((date) => !selectedDates.has(date)).sort();
      const result = await mutate<{ count: number }>("/api/admin/schedule", { action: "apply-plan", yearId, groupId: effectivePlanGroupId, dates: orderedDates });
      setPreviewOpen(false);
      if (added.length || removed.length) {
        askToNotify("Schedule update", [
          removed.length ? `There is no choir on ${removed.map(longDate).join(", ")}.` : "",
          added.length ? `We have added ${added.map(longDate).join(", ")}.` : "",
          "The full updated calendar is on this page.",
        ].filter(Boolean).join(" "));
      }
      await reload(`${result.count} sessions saved. ${planGroup?.name || "The group"}'s parent calendar is updated live.`);
    } catch (error) { toast(error instanceof Error ? error.message : "The calendar plan could not be saved."); } finally { setSavingPlan(false); }
  }
  function exportCsv() {
    const rows = [["Session", "Date", "Weekday", "Hebrew date", "Holiday", "Start", "End", "Group"]];
    orderedDates.forEach((date, index) => {
      const info = dayLookup.get(date);
      rows.push([String(index + 1), date, weekdayNames[new Date(`${date}T12:00:00Z`).getUTCDay()] || "", info?.hebrew || "", previewHoliday(date), planGroup?.startTime || "", planGroup?.endTime || "", planGroup?.name || ""]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    downloadBlob(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }), `${(planGroup?.name || "choir").replaceAll(/[^\p{L}\p{N}]+/gu, "-")}-schedule.csv`);
  }
  function printPlan() {
    const win = window.open("", "_blank");
    if (!win) { toast("Allow pop-ups to print the plan."); return; }
    const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const rows = orderedDates.map((date, index) => {
      const info = dayLookup.get(date);
      return `<tr><td>${index + 1}</td><td>${date}</td><td>${escapeHtml(weekdayNames[new Date(`${date}T12:00:00Z`).getUTCDay()] || "")}</td><td>${escapeHtml(info?.hebrew || "")}</td><td>${escapeHtml(previewHoliday(date))}</td><td>${escapeHtml(planGroup?.startTime || "")}${planGroup?.endTime ? `–${escapeHtml(planGroup.endTime)}` : ""}</td></tr>`;
    }).join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(planGroup?.name || "Choir")} schedule</title><style>body{font-family:Georgia,serif;margin:32px}h1{font-size:1.3rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 8px;font-size:.85rem;text-align:left}th{background:#f6ecee}</style></head><body><h1>${escapeHtml(planGroup?.name || "Choir")} · ${escapeHtml(year?.name || "")} · ${orderedDates.length} sessions</h1><table><thead><tr><th>#</th><th>Date</th><th>Day</th><th>Hebrew date</th><th>Holiday</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }
  async function publishUpdate(clear = false) {
    if (!effectivePlanGroupId) return;
    try {
      await mutate("/api/admin/groups", { id: effectivePlanGroupId, announcementTitle: clear ? "" : update.title, announcementBody: clear ? "" : update.body }, "PATCH");
      if (clear) setUpdate({ title: "", body: "" });
      await reload(clear ? "Special update removed from the parent page." : "Special update published. Parents see it immediately.");
    } catch (error) { toast(error instanceof Error ? error.message : "The update could not be published."); }
  }
  async function addEvent() { try { await mutate("/api/admin/schedule", { ...form, yearId }); setForm({ ...form, date: "", note: "" }); await reload("Calendar event added and visible to the selected group."); } catch (error) { toast(error instanceof Error ? error.message : "Event could not be added."); } }
  async function setEventStatus(event: ScheduleEvent, status: "cancelled" | "scheduled") { if (status === "cancelled" && !window.confirm(`Mark "${event.title_en}" as cancelled? Parents will see it as cancelled on their live schedule.`)) return; try { await mutate("/api/admin/schedule", { id: event.id, status }, "PATCH"); await reload(status === "cancelled" ? "Session cancelled. The choir schedule shows it live." : "Session restored to the schedule."); } catch (error) { toast(error instanceof Error ? error.message : "Session status could not be changed."); } }
  async function removeEvent(event: ScheduleEvent) {
    if (!window.confirm(`Delete "${event.title_en}" from the calendar? This removes it from the choir schedule entirely — cancelling keeps a visible record instead.`)) return;
    try {
      await readJson(`/api/admin/schedule?id=${encodeURIComponent(event.id)}`, { method: "DELETE" });
      askToNotify("Schedule change", `${longDate(event.starts_at.slice(0, 10))} has been removed from the schedule. Please check the calendar for the updated dates.`);
      await reload("Calendar entry deleted.");
    } catch (error) { toast(error instanceof Error ? error.message : "Calendar entry could not be deleted."); }
  }

  return <div className="admin-page-stack">
    <section className="admin-card schedule-toolbar">
      <div><p className="eyebrow">Schedule builder</p><h2>Plan the whole year on the calendar</h2><p>Pick a group and its weekday — every matching date turns green. Tap any day to remove it (it shows red) or to add an extra date, then preview, print, export and save.</p></div>
      <div><button className="admin-primary" disabled={!effectivePlanGroupId} onClick={() => setPreviewOpen(true)}>Preview & save · {orderedDates.length} dates</button><a className="secondary-button admin-link-button" href={`/api/admin/documents?kind=schedule&yearId=${encodeURIComponent(yearId)}${effectivePlanGroupId ? `&groupId=${encodeURIComponent(effectivePlanGroupId)}` : ""}`} download>Print saved schedule</a></div>
    </section>
    <section className="admin-card plan-builder">
      <div className="plan-controls">
        <label><span>Group</span><select value={effectivePlanGroupId} onChange={(event) => setPlanGroupId(event.target.value)}>{groups.length === 0 && <option value="">Create a group first</option>}{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label><span>Weekday</span><select value={planWeekday} onChange={(event) => reseed(Number(event.target.value))}>{weekdayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
        <button className="secondary-button" onClick={() => reseed(planWeekday)}>Reset to every {weekdayNames[planWeekday]}</button>
        <button className="secondary-button" onClick={async () => { if (!effectivePlanGroupId || !window.confirm(`Delete every planned session for ${planGroup?.name || "this group"}? Manually added or edited entries are kept, and the parent calendar updates immediately.`)) return; try { await mutate("/api/admin/schedule", { action: "apply-plan", yearId, groupId: effectivePlanGroupId, dates: [] }); setSelectedDates(new Set()); await reload("All planned sessions deleted from the live calendar."); } catch (error) { toast(error instanceof Error ? error.message : "The planned sessions could not be deleted."); } }}>Delete all planned sessions</button>
      </div>
      <div className="plan-toggles">
        <label><input type="checkbox" checked={showHolidaysEn} onChange={(event) => setShowHolidaysEn(event.target.checked)} /><span>English holiday names</span></label>
        <label><input type="checkbox" checked={showHolidaysHe} onChange={(event) => setShowHolidaysHe(event.target.checked)} /><span>Hebrew holiday names</span></label>
        <label><input type="checkbox" checked={showHolidaysIl} onChange={(event) => setShowHolidaysIl(event.target.checked)} /><span>Israeli national holidays</span></label>
      </div>
      <div className="plan-legend"><span className="legend-on">Scheduled session</span><span className="legend-off">Skipped {weekdayNames[planWeekday]}</span><span className="legend-holiday">Holiday</span></div>
      <div className="plan-months">{monthGrids.map((month) => <article className="plan-month" key={month.key}>
        <h3>{month.label}</h3>
        <div className="plan-grid">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span className="plan-grid-head" key={`${month.key}-head-${index}`}>{day}</span>)}
          {Array.from({ length: month.lead }, (_, index) => <span className="plan-blank" key={`${month.key}-blank-${index}`} />)}
          {month.days.map((day) => {
            const on = selectedDates.has(day.date);
            const off = !on && seedDates.has(day.date);
            const labels = [day.jewish ? holidayText(day.jewish) : "", showHolidaysIl && day.israeli ? holidayText(day.israeli) : ""].filter(Boolean);
            return <button type="button" key={day.date} className={`plan-day${on ? " plan-on" : ""}${off ? " plan-off" : ""}`} aria-pressed={on} onClick={() => toggleDate(day.date)}>
              <strong>{day.day}</strong>
              <small className="plan-hebrew">{day.hebrew}</small>
              {labels.map((label, index) => <small className="plan-holiday" key={`${day.date}-holiday-${index}`}>{label}</small>)}
            </button>;
          })}
        </div>
      </article>)}</div>
      {monthGrids.length === 0 && <p className="admin-muted">Select a school year with start and end dates to plan the calendar.</p>}
    </section>
    {planGroup && <section className="admin-card admin-form-card">
      <div className="admin-card-head"><div><p className="eyebrow">Parent page</p><h2>Special update for {planGroup.name}</h2></div><p>Shown at the top of the group’s private schedule page the moment you publish it.</p></div>
      <div className="compact-form-grid">
        <label><span>Heading</span><input value={update.title} onChange={(event) => setUpdate({ ...update, title: event.target.value })} placeholder="Schedule update" /></label>
        <label className="wide"><span>Message parents see</span><textarea value={update.body} onChange={(event) => setUpdate({ ...update, body: event.target.value })} placeholder="For example: this Wednesday’s session ends 10 minutes early." /></label>
        <button className="admin-primary" onClick={() => void publishUpdate(false)}>Publish update</button>
        {(planGroup.announcementTitle || planGroup.announcementBody) && <button className="secondary-button" onClick={() => void publishUpdate(true)}>Remove current update</button>}
      </div>
    </section>}
    <section className="admin-card admin-form-card"><div className="admin-card-head"><div><p className="eyebrow">One-off update</p><h2>Add a session or note</h2></div></div><div className="compact-form-grid calendar-form"><label><span>Group</span><select value={form.groupId} onChange={(event) => setForm({ ...form, groupId: event.target.value })}><option value="">All groups</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><label><span>Date</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label><span>Start</span><input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label><span>End</span><input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label><label><span>English title</span><input value={form.titleEn} onChange={(event) => setForm({ ...form, titleEn: event.target.value })} /></label><label><span>Hebrew title</span><input dir="rtl" value={form.titleHe} onChange={(event) => setForm({ ...form, titleHe: event.target.value })} /></label><label className="wide"><span>Note shown on the calendar day</span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label><button className="admin-primary" onClick={() => void addEvent()}>Add to calendar</button></div></section>
    <section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Live calendar</p><h2>{events.length} scheduled entries</h2></div>{versions[0] && <span className="status-chip status-approved">Saved v{versions[0].version}</span>}</div><div className="schedule-event-list">{events.slice(0, 120).map((event) => <article key={event.id}><time>{new Date(event.starts_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}<small>{event.starts_at.slice(11, 16)}</small></time><div><strong>{event.title_en}{event.title_he ? ` · ${event.title_he}` : ""}</strong><span>{[event.group_name, event.location, event.status === "cancelled" ? "Cancelled" : event.status].filter(Boolean).join(" · ")}</span>{event.note && <p>{event.note}</p>}</div><button onClick={async () => { const note = window.prompt("Edit the note shown to parents", event.note || ""); if (note === null) return; try { await mutate("/api/admin/schedule", { id: event.id, note }, "PATCH"); await reload("Calendar note updated live."); } catch (error) { toast(error instanceof Error ? error.message : "Note could not be updated."); } }}>Edit note</button>{event.status === "cancelled" ? <button onClick={() => void setEventStatus(event, "scheduled")}>Restore</button> : <button onClick={() => void setEventStatus(event, "cancelled")}>Cancel session</button>}<button onClick={() => void removeEvent(event)}>Delete</button></article>)}{events.length === 0 && <div className="admin-empty-state"><strong>No schedule entries yet</strong><p>Plan the year above, or add an event manually.</p></div>}</div></section>
    {versions.length > 0 && <section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">History</p><h2>Saved calendar versions</h2></div><p>Every save keeps a copy. Restore one to put those dates back on the parent calendar.</p></div><div className="history-table">{versions.map((version) => <article key={version.id}><span className="history-dot" /><div><strong>{version.name}</strong><small>Saved {new Date(version.finalized_at).toLocaleString("en-GB")}</small></div><button className="text-link" onClick={() => void restoreVersion(version)}>Restore</button><time>v{version.version}</time></article>)}</div></section>}
    {previewOpen && <Modal close={() => setPreviewOpen(false)}>
      <p className="eyebrow">Calendar plan</p>
      <h2>{planGroup?.name || "Group"} · {orderedDates.length} sessions</h2>
      <div className="plan-preview-list">{orderedDates.map((date, index) => {
        const info = dayLookup.get(date);
        const holiday = previewHoliday(date);
        return <div key={date}><span>{index + 1}</span><div><strong>{weekdayNames[new Date(`${date}T12:00:00Z`).getUTCDay()]} {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</strong><small>{info?.hebrew}{holiday ? ` · ${holiday}` : ""}</small></div></div>;
      })}{orderedDates.length === 0 && <p className="admin-muted">No dates are selected yet.</p>}</div>
      <div className="card-actions"><button className="secondary-button" onClick={printPlan}>Print</button><button className="secondary-button" onClick={exportCsv}>Export to Excel</button><button className="admin-primary" disabled={savingPlan || orderedDates.length === 0} onClick={() => void savePlan()}>{savingPlan ? "Saving…" : "Save to live calendar"}</button></div>
      <p className="admin-muted">Saving replaces {planGroup?.name || "the group"}’s planned sessions with these dates. Manually added or edited entries are kept, and the parent page updates immediately.</p>
    </Modal>}
    {notify && <Modal close={() => setNotify(null)}>
      <p className="eyebrow">The choir year has started</p>
      <h2>Tell the parents about this change?</h2>
      <p className="admin-muted">The calendar is already updated either way. This only decides whether a notice appears at the top of {planGroup?.name || "the group"}’s schedule page.</p>
      <div className="field-grid">
        <label className="field field-wide"><span>Heading</span><input value={notify.title} onChange={(event) => setNotify({ ...notify, title: event.target.value })} /></label>
        <label className="field field-wide"><span>Message parents will read</span><textarea className="admin-textarea" rows={5} value={notify.body} onChange={(event) => setNotify({ ...notify, body: event.target.value })} /></label>
      </div>
      <div className="card-actions">
        <button className="admin-primary" disabled={notifying} onClick={() => void sendNotice()}>{notifying ? "Publishing…" : "Yes, tell the parents"}</button>
        <button className="secondary-button" onClick={() => setNotify(null)}>No, just change it</button>
      </div>
    </Modal>}
  </div>;
}

function scheduleMonths(startsOn?: string, endsOn?: string) {
  if (!startsOn || !endsOn) return [] as Array<{ key: string; label: string }>;
  const months: Array<{ key: string; label: string }> = [];
  const cursor = new Date(`${startsOn.slice(0, 7)}-01T12:00:00Z`);
  const end = new Date(`${endsOn.slice(0, 7)}-01T12:00:00Z`);
  while (cursor <= end && months.length < 14) {
    months.push({ key: cursor.toISOString().slice(0, 7), label: cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

const emptyLinkForm = { label: "", groupId: "", registrationFee: "", monthlyFee: "", juneFee: "", securityCheck: "", oneTimeAmount: "", allowedPaymentMethod: "", proofPolicy: "", maxUses: "", expiresAt: "", privateNote: "" };

function PaymentsPanel({ methods, links, groups, yearId, year, mutate, reload, toast }: { methods: PaymentMethod[]; links: CustomLink[]; groups: Group[]; yearId: string; year?: Year; mutate: <T>(url: string, body: Record<string, unknown>, method?: string) => Promise<T>; reload: (message?: string) => Promise<void>; toast: (message: string) => void }) {
  const [methodForm, setMethodForm] = useState({ label: "", instructions: "", proofPolicy: "optional", cashHandling: false });
  const [linkForm, setLinkForm] = useState({ ...emptyLinkForm });
  const [monthOverrides, setMonthOverrides] = useState<Record<string, string>>({});
  const months = scheduleMonths(year?.startsOn, year?.endsOn);
  async function addMethod() { try { await mutate("/api/admin/payment-methods", { ...methodForm, yearId }); setMethodForm({ label: "", instructions: "", proofPolicy: "optional", cashHandling: false }); await reload("Payment method added."); } catch (error) { toast(error instanceof Error ? error.message : "Payment method could not be added."); } }
  async function editMethod(method: PaymentMethod) { const label = window.prompt("Payment method name shown to parents", method.label); if (label === null) return; const instructions = window.prompt("Instructions shown to parents", method.instructions); if (instructions === null) return; try { await mutate("/api/admin/payment-methods", { id: method.id, label: label.trim() || method.label, instructions }, "PATCH"); await reload("Payment method updated."); } catch (error) { toast(error instanceof Error ? error.message : "Payment method could not be updated."); } }
  async function removeMethod(method: PaymentMethod) { if (!window.confirm(`Delete the ${method.label} payment method? Methods already used by registrations cannot be deleted.`)) return; try { await readJson(`/api/admin/payment-methods?id=${encodeURIComponent(method.id)}`, { method: "DELETE" }); await reload(`${method.label} deleted.`); } catch (error) { toast(error instanceof Error ? error.message : "Payment method could not be deleted."); } }
  async function createLink() {
    try {
      const overrides = Object.fromEntries(Object.entries(monthOverrides).filter(([, amount]) => amount !== "" && Number.isFinite(Number(amount))).map(([key, amount]) => [key, Number(amount)]));
      const body = { ...Object.fromEntries(Object.entries({ ...linkForm, yearId }).map(([key, value]) => [key, value === "" ? null : value])), monthOverrides: overrides };
      const result = await mutate<{ url: string }>("/api/admin/custom-links", body);
      await navigator.clipboard.writeText(result.url);
      setLinkForm({ ...emptyLinkForm }); setMonthOverrides({});
      await reload("Custom registration link created and copied.");
    } catch (error) { toast(error instanceof Error ? error.message : "Custom link could not be created."); }
  }
  async function rotateLink(link: CustomLink) { if (!window.confirm("Reset this private link? The old link will stop working immediately.")) return; try { const result = await mutate<{ url: string }>("/api/admin/custom-links", { id: link.id, action: "rotate" }, "PATCH"); await navigator.clipboard.writeText(result.url); await reload("Custom link reset and the new address copied."); } catch (error) { toast(error instanceof Error ? error.message : "Link could not be reset."); } }
  async function removeLink(link: CustomLink) { if (!window.confirm(`Delete the "${link.label}" link? Links already used by registrations are kept for the records and can only be disabled.`)) return; try { await readJson(`/api/admin/custom-links?id=${encodeURIComponent(link.id)}`, { method: "DELETE" }); await reload("Custom link deleted."); } catch (error) { toast(error instanceof Error ? error.message : "Custom link could not be deleted."); } }
  return <div className="admin-page-stack"><section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Payment methods</p><h2>Methods available to parents</h2></div></div><div className="method-list">{methods.map((method) => <article key={method.id} className={!method.enabled ? "disabled" : ""}><div><strong>{method.label}</strong><p>{method.instructions || "No instructions added."}</p><div className="card-actions"><button onClick={() => void editMethod(method)}>Edit</button><button onClick={() => void removeMethod(method)}>Delete</button></div></div><label><span>Proof</span><select value={method.proofPolicy} onChange={async (event) => { try { await mutate("/api/admin/payment-methods", { id: method.id, proofPolicy: event.target.value }, "PATCH"); await reload("Payment-proof rule updated."); } catch (error) { toast(error instanceof Error ? error.message : "Method could not be changed."); } }}><option value="required">Required</option><option value="optional">Optional</option><option value="none">Not applicable</option></select></label><label><span>Cash handling</span><button className={method.cashHandling ? "setting-toggle on" : "setting-toggle"} role="switch" aria-checked={method.cashHandling} title="Show the cash-responsibility reminder and skip the payment screenshot for this method" onClick={async () => { try { await mutate("/api/admin/payment-methods", { id: method.id, cashHandling: !method.cashHandling }, "PATCH"); await reload("Cash-handling rule updated."); } catch (error) { toast(error instanceof Error ? error.message : "Method could not be changed."); } }}><span /></button></label><button className={method.enabled ? "setting-toggle on" : "setting-toggle"} role="switch" aria-checked={method.enabled} onClick={async () => { try { await mutate("/api/admin/payment-methods", { id: method.id, enabled: !method.enabled }, "PATCH"); await reload("Payment method availability updated."); } catch (error) { toast(error instanceof Error ? error.message : "Method could not be changed."); } }}><span /></button></article>)}</div><div className="inline-add-form"><input placeholder="New method name" value={methodForm.label} onChange={(event) => setMethodForm({ ...methodForm, label: event.target.value })} /><input placeholder="Instructions shown to parents" value={methodForm.instructions} onChange={(event) => setMethodForm({ ...methodForm, instructions: event.target.value })} /><select value={methodForm.proofPolicy} onChange={(event) => setMethodForm({ ...methodForm, proofPolicy: event.target.value })}><option value="required">Proof required</option><option value="optional">Proof optional</option><option value="none">No proof</option></select><label className="switch-field"><span>Cash handling</span><button className={methodForm.cashHandling ? "setting-toggle on" : "setting-toggle"} role="switch" aria-checked={methodForm.cashHandling} onClick={() => setMethodForm({ ...methodForm, cashHandling: !methodForm.cashHandling })}><span /></button></label><button className="admin-primary" onClick={() => void addMethod()}>Add method</button></div></section><section className="admin-card admin-form-card"><div className="admin-card-head"><div><p className="eyebrow">Discounts & custom arrangements</p><h2>Create a custom registration link</h2></div><p>Leave any amount empty to use the standard year value. Exact pricing is frozen when the parent registers.</p></div><div className="compact-form-grid custom-link-form"><label><span>Link name</span><input value={linkForm.label} onChange={(event) => setLinkForm({ ...linkForm, label: event.target.value })} /></label><label><span>Group, optional</span><select value={linkForm.groupId} onChange={(event) => setLinkForm({ ...linkForm, groupId: event.target.value })}><option value="">Any / unassigned</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label><span>Registration fee ₪</span><input type="number" placeholder="Standard" value={linkForm.registrationFee} onChange={(event) => setLinkForm({ ...linkForm, registrationFee: event.target.value })} /><small>One time. Enter 0 to waive it.</small></label><label><span>Monthly amount ₪</span><input type="number" value={linkForm.monthlyFee} onChange={(event) => setLinkForm({ ...linkForm, monthlyFee: event.target.value })} /></label><label><span>June amount ₪</span><input type="number" value={linkForm.juneFee} onChange={(event) => setLinkForm({ ...linkForm, juneFee: event.target.value })} /></label><label><span>Security check ₪</span><input type="number" value={linkForm.securityCheck} onChange={(event) => setLinkForm({ ...linkForm, securityCheck: event.target.value })} /></label><label><span>One-time amount ₪</span><input type="number" value={linkForm.oneTimeAmount} onChange={(event) => setLinkForm({ ...linkForm, oneTimeAmount: event.target.value })} /></label><label><span>Only payment method</span><select value={linkForm.allowedPaymentMethod} onChange={(event) => setLinkForm({ ...linkForm, allowedPaymentMethod: event.target.value })}><option value="">Any enabled method</option>{methods.filter((method) => method.enabled).map((method) => <option key={method.code} value={method.code}>{method.label}</option>)}</select></label><label><span>Maximum uses</span><input type="number" value={linkForm.maxUses} onChange={(event) => setLinkForm({ ...linkForm, maxUses: event.target.value })} /></label><label><span>Expires (Israel time)</span><input type="datetime-local" value={linkForm.expiresAt} onChange={(event) => setLinkForm({ ...linkForm, expiresAt: event.target.value })} /></label><label className="wide"><span>Private note, visible to administrators only</span><textarea value={linkForm.privateNote} onChange={(event) => setLinkForm({ ...linkForm, privateNote: event.target.value })} /></label>{months.length > 0 && <details className="wide"><summary>Per-month price overrides, optional</summary><div className="compact-form-grid">{months.map((month) => <label key={month.key}><span>{month.label} ₪</span><input type="number" placeholder="Standard" value={monthOverrides[month.key] || ""} onChange={(event) => setMonthOverrides((current) => ({ ...current, [month.key]: event.target.value }))} /></label>)}</div></details>}<button className="admin-primary" onClick={() => void createLink()}>Create & copy link</button></div></section><section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Private links</p><h2>Custom registration links</h2></div></div><div className="custom-link-list">{links.map((link) => <article key={link.id}><div><strong>{link.label}</strong><span>{link.groupName || "Any group"} · {link.useCount}{link.maxUses ? `/${link.maxUses}` : ""} uses</span></div><div><b>{money(link.monthlyFee)}/month</b><small>{link.oneTimeAmount !== null ? `${money(link.oneTimeAmount)} one-time` : "standard remaining fees"}</small></div><span className={`status-chip ${link.status === "active" ? "status-approved" : "status-missing-payment"}`}>{link.status}</span><button onClick={() => { void navigator.clipboard.writeText(link.url); toast("Custom registration link copied."); }}>Copy</button><button onClick={async () => { try { await mutate("/api/admin/custom-links", { id: link.id, action: link.status === "active" ? "disable" : "enable" }, "PATCH"); await reload("Custom link status updated."); } catch (error) { toast(error instanceof Error ? error.message : "Link could not be changed."); } }}>{link.status === "active" ? "Disable" : "Enable"}</button><button onClick={() => void rotateLink(link)}>Reset link</button><button onClick={() => void removeLink(link)}>Delete</button></article>)}{links.length === 0 && <p className="admin-muted">No custom registration links yet.</p>}</div></section></div>;
}

function YearsPanel({ years, activeYear, setYearId, refreshYears, mutate, toast }: { years: Year[]; activeYear?: Year; setYearId: (value: string) => void; refreshYears: () => Promise<Year[]>; mutate: <T>(url: string, body: Record<string, unknown>, method?: string) => Promise<T>; toast: (message: string) => void }) {
  const [form, setForm] = useState({ name: "", startsOn: "", endsOn: "", copyFromYearId: activeYear?.id || "", registrationFee: "", monthlyFee: "", juneFee: "" });
  const [edit, setEdit] = useState<Year | undefined>(activeYear);
  const [securityCheck, setSecurityCheck] = useState(() => typeof activeYear?.settings.securityCheckAgorot === "number" ? String((activeYear.settings.securityCheckAgorot as number) / 100) : "");
  async function create() { try { const result = await mutate<{ yearId: string }>("/api/admin/years", Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? undefined : value]))); const next = await refreshYears(); setYearId(result.yearId); setForm({ name: "", startsOn: "", endsOn: "", copyFromYearId: next[0]?.id || "", registrationFee: "", monthlyFee: "", juneFee: "" }); toast("New school year prepared while all past records remain available."); } catch (error) { toast(error instanceof Error ? error.message : "School year could not be created."); } }
  async function saveYear() { if (!edit) return; try { await mutate("/api/admin/years", { id: edit.id, name: edit.name, startsOn: edit.startsOn, endsOn: edit.endsOn, registrationFee: edit.registrationFee, monthlyFee: edit.monthlyFee, juneFee: edit.juneFee, ...(securityCheck === "" ? {} : { securityCheck: Number(securityCheck) }), proofRequired: edit.proofRequired, scheduleMode: edit.scheduleMode, weekday: edit.weekday, startTime: edit.startTime, endTime: edit.endTime, sessionLengthMinutes: edit.settings.sessionLengthMinutes || 50, location: edit.settings.location || "" }, "PATCH"); await refreshYears(); toast("School-year settings saved."); } catch (error) { toast(error instanceof Error ? error.message : "School year could not be saved."); } }
  return <div className="admin-page-stack"><section className="admin-grid-cards year-card-grid">{years.map((year) => <article className={`admin-card year-card ${year.id === activeYear?.id ? "selected" : ""}`} key={year.id} onClick={() => setYearId(year.id)}><span className={`status-chip ${year.status === "active" ? "status-approved" : "status-proof-uploaded"}`}>{year.status}</span><h2>{year.name}</h2><p>{year.startsOn} → {year.endsOn}</p><dl className="card-details"><div><dt>Registration</dt><dd>{money(year.registrationFee)}</dd></div><div><dt>Monthly</dt><dd>{money(year.monthlyFee)}</dd></div><div><dt>June</dt><dd>{money(year.juneFee)}</dd></div><div><dt>Schedule</dt><dd>{year.scheduleMode}</dd></div></dl>{year.status !== "active" && <button className="secondary-button" onClick={async (event) => { event.stopPropagation(); try { await mutate("/api/admin/years", { id: year.id, action: "activate" }, "PATCH"); await refreshYears(); toast(`${year.name} is now the active registration year.`); } catch (error) { toast(error instanceof Error ? error.message : "Year could not be activated."); } }}>Make current</button>}</article>)}</section>{edit && <section className="admin-card admin-form-card"><div className="admin-card-head"><div><p className="eyebrow">Selected year</p><h2>Edit {edit.name}</h2></div><p>Fees, proof rules and schedule setup are stored per year. Changing them affects new registrations only - signed registrations keep the pricing they signed.</p></div><div className="compact-form-grid year-edit-form"><label><span>Name</span><input value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} /></label><label><span>Starts</span><input type="date" value={edit.startsOn} onChange={(event) => setEdit({ ...edit, startsOn: event.target.value })} /></label><label><span>Ends</span><input type="date" value={edit.endsOn} onChange={(event) => setEdit({ ...edit, endsOn: event.target.value })} /></label><label><span>Registration fee ₪</span><input type="number" value={edit.registrationFee} onChange={(event) => setEdit({ ...edit, registrationFee: Number(event.target.value) })} /><small>One time, charged at registration in addition to every monthly fee. Set 0 for no registration fee.</small></label><label><span>Monthly fee ₪</span><input type="number" value={edit.monthlyFee} onChange={(event) => setEdit({ ...edit, monthlyFee: Number(event.target.value) })} /></label><label><span>June fee ₪</span><input type="number" value={edit.juneFee} onChange={(event) => setEdit({ ...edit, juneFee: Number(event.target.value) })} /></label><label><span>Security check ₪</span><input type="number" value={securityCheck} onChange={(event) => setSecurityCheck(event.target.value)} /></label><label><span>Schedule setup</span><select value={edit.scheduleMode} onChange={(event) => setEdit({ ...edit, scheduleMode: event.target.value })}><option value="recurring">School-year recurring</option><option value="manual">Manual schedule</option></select></label><label><span>Window starts</span><input type="time" value={edit.startTime} onChange={(event) => setEdit({ ...edit, startTime: event.target.value })} /></label><label><span>Window ends</span><input type="time" value={edit.endTime} onChange={(event) => setEdit({ ...edit, endTime: event.target.value })} /></label><label className="switch-field"><span>Default proof required</span><button className={edit.proofRequired ? "setting-toggle on" : "setting-toggle"} onClick={() => setEdit({ ...edit, proofRequired: !edit.proofRequired })}><span /></button></label><button className="admin-primary" onClick={() => void saveYear()}>Save year</button></div></section>}<section className="admin-card admin-form-card"><div className="admin-card-head"><div><p className="eyebrow">Future-proofing</p><h2>Prepare the next school year</h2></div><p>Copy the current setup, then edit it without affecting ongoing or past records.</p></div><div className="compact-form-grid"><label><span>Year name</span><input placeholder="2027–2028" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span>Starts</span><input type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} /></label><label><span>Ends</span><input type="date" value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} /></label><label><span>Copy setup from</span><select value={form.copyFromYearId} onChange={(event) => setForm({ ...form, copyFromYearId: event.target.value })}>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label><button className="admin-primary" onClick={() => void create()}>Create prepared year</button></div></section></div>;
}

type AgreementVersionItem = { id: string; version: number; active: boolean; createdAt: string; contentHash: string; sections: AgreementSectionEditor[] };

function AgreementsPanel({ yearId, year, years, mutate, toast }: { yearId: string; year?: Year; years: Year[]; mutate: <T>(url: string, body: Record<string, unknown>, method?: string) => Promise<T>; toast: (message: string) => void }) {
  const [sections, setSections] = useState<AgreementSectionEditor[]>([]);
  const [versions, setVersions] = useState<AgreementVersionItem[]>([]);
  const [loadedVersionId, setLoadedVersionId] = useState("");
  const [duplicateYearId, setDuplicateYearId] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const result = await readJson<{ versions: AgreementVersionItem[] }>(`/api/admin/agreement-versions?yearId=${encodeURIComponent(yearId)}`);
      setVersions(result.versions);
      const initial = result.versions.find((version) => version.active) || result.versions[0];
      setLoadedVersionId(initial?.id || "");
      setSections(initial ? structuredClone(initial.sections) : []);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Agreement versions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [toast, yearId]);

  function loadVersion(version: AgreementVersionItem) {
    setLoadedVersionId(version.id);
    setSections(structuredClone(version.sections));
    toast(`Version ${version.version} loaded into the editor. Publishing saves your edits as a new version.`);
  }
  async function activateVersion(version: AgreementVersionItem) {
    if (!window.confirm(`Use version ${version.version} for all new ${year?.name || ""} registrations? Already-signed agreements are never changed.`)) return;
    try { await mutate("/api/admin/agreement-versions", { id: version.id, action: "activate" }, "PATCH"); await load(); toast(`Version ${version.version} is now the active agreement.`); } catch (error) { toast(error instanceof Error ? error.message : "The version could not be activated."); }
  }
  async function duplicateVersion(version: AgreementVersionItem) {
    const targetYearId = duplicateYearId || yearId;
    const targetYear = years.find((item) => item.id === targetYearId);
    try {
      const result = await mutate<{ version: number; activated: boolean }>("/api/admin/agreement-versions", { id: version.id, action: "duplicate", targetYearId }, "PATCH");
      await load();
      toast(`Copied to ${targetYear?.name || "the selected year"} as version ${result.version}${result.activated ? " and set active" : ""}.`);
    } catch (error) { toast(error instanceof Error ? error.message : "The version could not be duplicated."); }
  }
  async function removeVersion(version: AgreementVersionItem) {
    if (!window.confirm(`Delete version ${version.version}? Only unused, inactive versions can be deleted.`)) return;
    try { await readJson(`/api/admin/agreement-versions?id=${encodeURIComponent(version.id)}`, { method: "DELETE" }); await load(); toast(`Version ${version.version} deleted.`); } catch (error) { toast(error instanceof Error ? error.message : "The version could not be deleted."); }
  }

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  function updateSection(index: number, update: Partial<AgreementSectionEditor>) {
    setSections((current) => current.map((section, itemIndex) => itemIndex === index ? { ...section, ...update } : section));
  }

  function updateParagraph(sectionIndex: number, paragraphIndex: number, text: string) {
    setSections((current) => current.map((section, itemIndex) => itemIndex !== sectionIndex ? section : {
      ...section,
      paragraphs: section.paragraphs.map((paragraph, index) => index === paragraphIndex ? { ...paragraph, text } : paragraph),
    }));
  }

  async function publish() {
    if (!window.confirm("Publish this as a new immutable agreement version? Existing signed agreements will remain unchanged.")) return;
    setPublishing(true);
    try {
      const result = await mutate<{ version: number }>("/api/admin/agreement-versions", { yearId, sections });
      await load();
      toast(`Agreement version ${result.version} published. New registrations now use it.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Agreement version could not be published.");
    } finally {
      setPublishing(false);
    }
  }

  return <div className="admin-page-stack">
    <section className="admin-card">
      <div className="admin-card-head"><div><p className="eyebrow">Version controlled</p><h2>{year?.name || "School year"} agreement</h2></div><button className="admin-primary" disabled={loading || publishing || !sections.length} onClick={() => void publish()}>{publishing ? "Publishing…" : "Publish new version"}</button></div>
      <p className="admin-muted">Edit the complete wording below. Publishing creates a new immutable version; it never changes documents that parents already signed. Custom fee links automatically place their exact pricing into the payment section.</p>
      <div className="agreement-version-manager">
        <label className="agreement-duplicate-target"><span>Duplicate into</span><select value={duplicateYearId || yearId} onChange={(event) => setDuplicateYearId(event.target.value)}>{years.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {versions.map((version) => <div className="agreement-version-row" key={version.id}>
          <span className={version.active ? "status-chip status-approved" : "status-chip"}>v{version.version}{version.active ? " · active" : ""} · {new Date(version.createdAt).toLocaleDateString("en-GB")}</span>
          <div className="card-actions">
            <button onClick={() => loadVersion(version)} disabled={loadedVersionId === version.id}>{loadedVersionId === version.id ? "In the editor" : "Open in editor"}</button>
            {!version.active && <button onClick={() => void activateVersion(version)}>Use for this year</button>}
            <button onClick={() => void duplicateVersion(version)}>Duplicate</button>
            {!version.active && <button onClick={() => void removeVersion(version)}>Delete</button>}
          </div>
        </div>)}
      </div>
    </section>
    {loading ? <section className="admin-card"><p>Loading agreement…</p></section> : sections.map((section, sectionIndex) => <section className="admin-card admin-form-card" key={`${section.title}-${sectionIndex}`}>
      <label className="field"><span>Section heading</span><input value={section.title} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} /></label>
      <div className="agreement-editor-paragraphs">{section.paragraphs.map((paragraph, paragraphIndex) => <label className="field" key={paragraph.id}><span>Paragraph {paragraphIndex + 1}</span><textarea value={paragraph.text} onChange={(event) => updateParagraph(sectionIndex, paragraphIndex, event.target.value)} /><button type="button" className="text-link" onClick={() => updateSection(sectionIndex, { paragraphs: section.paragraphs.filter((_, index) => index !== paragraphIndex) })}>Remove paragraph</button></label>)}</div>
      <div className="card-actions"><button type="button" onClick={() => updateSection(sectionIndex, { paragraphs: [...section.paragraphs, { id: `custom-${crypto.randomUUID()}`, text: "" }] })}>Add paragraph</button>{section.title !== "Introduction" && <button type="button" onClick={() => setSections((current) => current.filter((_, index) => index !== sectionIndex))}>Remove section</button>}</div>
    </section>)}
    {!loading && <section className="admin-card"><div className="card-actions"><button onClick={() => setSections((current) => [...current, { title: "New section", paragraphs: [{ id: `custom-${crypto.randomUUID()}`, text: "New agreement paragraph" }] }])}>Add agreement section</button><button className="admin-primary" disabled={publishing || !sections.length} onClick={() => void publish()}>{publishing ? "Publishing…" : "Publish new version"}</button></div></section>}
  </div>;
}

function DocumentsPanel({ yearId, groups, toast }: { yearId: string; groups: Group[]; toast: (message: string) => void }) {
  const [groupId, setGroupId] = useState(""); const [lyrics, setLyrics] = useState({ title: "", subtitle: "", lyrics: "", pageSize: "A4" }); const [logo, setLogo] = useState<File | null>(null); const query = `yearId=${encodeURIComponent(yearId)}&groupId=${encodeURIComponent(groupId)}`;
  const [logoInfo, setLogoInfo] = useState<{ bundled?: boolean; name?: string; fileName?: string | null; byteSize?: number; updatedAt?: string } | null>(null);
  const reloadLogo = useCallback(() => { readJson<{ logo: typeof logoInfo }>("/api/admin/brand").then((data) => setLogoInfo(data.logo)).catch(() => setLogoInfo(null)); }, []);
  useEffect(() => { reloadLogo(); }, [reloadLogo]);
  async function lyricsPdf() { try { const response = await fetch("/api/admin/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "lyrics", yearId, groupId, ...lyrics }) }); if (!response.ok) { const body = await response.json() as { error?: string }; throw new Error(body.error || "Lyrics PDF could not be created."); } downloadBlob(await response.blob(), `${lyrics.title || "lyrics"}-${lyrics.pageSize}.pdf`); toast(response.headers.get("X-Choir-One-Page") === "true" ? "Lyrics PDF downloaded and fitted to one page." : `Lyrics PDF downloaded in ${response.headers.get("X-Choir-Page-Count") || "multiple"} pages.`); } catch (error) { toast(error instanceof Error ? error.message : "Lyrics PDF could not be created."); } }
  async function uploadLogo() { if (!logo) return; try { const data = new FormData(); data.set("logo", logo); const response = await fetch("/api/admin/brand", { method: "POST", body: data }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Logo could not be uploaded."); setLogo(null); reloadLogo(); toast("Official transparent logo updated for future documents."); } catch (error) { toast(error instanceof Error ? error.message : "Logo could not be uploaded."); } }
  return <div className="admin-page-stack"><section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Professional PDFs</p><h2>Print and download</h2></div><label className="group-filter"><span>Group</span><select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">All groups</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div><div className="document-action-grid"><a href={`/api/admin/documents?kind=schedule&${query}`} download><span>□</span><strong>Beautiful schedule</strong><small>Final dates, Hebrew/Gregorian labels and notes</small></a><a href={`/api/admin/documents?kind=class-list&${query}`} download><span>♡</span><strong>Printable class list</strong><small>Selected year or group</small></a><a href={`/api/admin/documents?kind=blank-agreement&yearId=${encodeURIComponent(yearId)}`} download><span>✎</span><strong>Blank A4 agreement</strong><small>Current year and agreement version</small></a><a href={`/api/admin/documents?kind=bulk-agreements&${query}`} download><span>▤</span><strong>All signed agreements</strong><small>One merged PDF</small></a><a href={`/api/admin/exports/excel?yearId=${encodeURIComponent(yearId)}`} download><span>↧</span><strong>Export Excel</strong><small>Students, payments and records</small></a><a href="/api/admin/backups?download=1" download><span>{"{}"}</span><strong>Download JSON backup</strong><small>Manual protected export</small></a></div></section><section className="admin-card admin-form-card"><div className="admin-card-head"><div><p className="eyebrow">Song sheets</p><h2>Lyrics formatter</h2></div><p>Paste lyrics, select A4 or A5, and the logo and typography are applied automatically.</p></div><div className="lyrics-layout"><div className="compact-form-grid"><label><span>Song title</span><input value={lyrics.title} onChange={(event) => setLyrics({ ...lyrics, title: event.target.value })} /></label><label><span>Subtitle, optional</span><input value={lyrics.subtitle} onChange={(event) => setLyrics({ ...lyrics, subtitle: event.target.value })} /></label><label><span>Page size</span><select value={lyrics.pageSize} onChange={(event) => setLyrics({ ...lyrics, pageSize: event.target.value })}><option>A4</option><option>A5</option></select></label></div><label className="lyrics-input"><span>Lyrics</span><textarea value={lyrics.lyrics} onChange={(event) => setLyrics({ ...lyrics, lyrics: event.target.value })} placeholder="Paste the full lyrics here…" /></label><button className="admin-primary" onClick={() => void lyricsPdf()}>Format & download PDF</button></div></section><section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Brand asset</p><h2>Official document logo</h2></div><p>Upload a transparent PNG. It will be used for schedules, class lists, lyrics and agreements.</p></div>{logoInfo && <p className="admin-muted">{logoInfo.bundled ? "Currently using the bundled Choir Chug logo." : `Current logo: ${logoInfo.fileName || logoInfo.name}${logoInfo.byteSize ? ` · ${(logoInfo.byteSize / 1024).toFixed(1)} KB` : ""}${logoInfo.updatedAt ? ` · updated ${new Date(logoInfo.updatedAt).toLocaleDateString("en-GB")}` : ""}`}</p>}<div className="logo-upload-row"><input type="file" accept="image/png" onChange={(event) => setLogo(event.target.files?.[0] || null)} /><button className="admin-primary" disabled={!logo} onClick={() => void uploadLogo()}>Upload logo</button></div></section></div>;
}

function CreativePanel({ year, yearId, toast }: { year?: Year; yearId: string; toast: (message: string) => void }) {
  const [kind, setKind] = useState("detail-sheet"); const [style, setStyle] = useState("Elegant, polished, warm studio editorial"); const [customBrief, setCustomBrief] = useState(""); const [prompt, setPrompt] = useState(""); const [variation, setVariation] = useState(0);
  const [history, setHistory] = useState<Array<{ id: string; name: string; kind: string; prompt: string; createdAt: string }>>([]);
  const reloadHistory = useCallback(() => { readJson<{ prompts: typeof history }>(`/api/admin/prompts?yearId=${encodeURIComponent(yearId)}`).then((data) => setHistory(data.prompts)).catch(() => setHistory([])); }, [yearId]);
  useEffect(() => { reloadHistory(); }, [reloadHistory]);
  async function generate(refresh = false) { try { const nextVariation = refresh ? variation + 1 : variation; const result = await readJson<{ prompt: string; variation: number }>("/api/admin/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, yearId, style, variation: nextVariation, save: true, facts: { brandName: "The Choir Chug", descriptor: "Professional Girl’s Choir", schoolYear: year?.name || "Current school year", phone: "053-590-6149", schedule: `Wednesdays, ${year?.startTime || "17:00"}–${year?.endTime || "19:00"}; final group time shared after registration`, fees: `${money(year?.monthlyFee)} monthly; ${money(year?.juneFee)} in June`, location: String(year?.settings.location || "Mishkafayim or RBSA"), benefits: "Professional vocal technique, real studio recordings, confidence and friendship", recording: "End-of-year video", callToAction: "Register now", customBrief } }) }); setPrompt(result.prompt); setVariation(result.variation); reloadHistory(); toast(refresh ? "A new style variation is ready." : "Prompt created and saved."); } catch (error) { toast(error instanceof Error ? error.message : "Prompt could not be created."); } }
  return <div className="admin-page-stack"><section className="admin-card admin-form-card"><div className="admin-card-head"><div><p className="eyebrow">Creative prompt studio</p><h2>Flyers, detail sheets and custom pieces</h2></div><p>Every prompt starts by telling you to attach the official logo, approved photos and optional QR code.</p></div><div className="creative-controls"><label><span>Output</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="detail-sheet">Detail sheet — information first</option><option value="flyer">Flyer — promotional</option><option value="custom">Custom piece</option></select></label><label><span>Style direction</span><input value={style} onChange={(event) => setStyle(event.target.value)} /></label>{kind === "custom" && <label className="wide"><span>Custom purpose</span><textarea value={customBrief} onChange={(event) => setCustomBrief(event.target.value)} /></label>}<div><button className="admin-primary" onClick={() => void generate(false)}>Create prompt</button><button className="secondary-button" onClick={() => void generate(true)}>↻ Refresh style</button></div></div></section>{prompt && <section className="admin-card prompt-result"><div className="admin-card-head"><div><p className="eyebrow">Ready to paste</p><h2>Generator prompt</h2></div><button className="admin-primary" onClick={async () => { await navigator.clipboard.writeText(prompt); toast("Full prompt copied."); }}>Copy full prompt</button></div><div className="prompt-attachments"><strong>Add these to the image generator:</strong><span>1. Official transparent logo</span><span>2. Approved choir photos, if used</span><span>3. Finished QR code, if needed</span></div><textarea className="prompt-text" readOnly value={prompt} /></section>}{history.length > 0 && <section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Saved prompts</p><h2>Prompt history</h2></div></div><div className="history-table">{history.slice(0, 12).map((item) => <article key={item.id}><span className="history-dot" /><div><strong>{item.name}</strong><small>{item.kind}</small></div><button className="text-link" onClick={async () => { setPrompt(item.prompt); await navigator.clipboard.writeText(item.prompt).catch(() => undefined); toast("Saved prompt loaded and copied."); }}>Reuse</button><time>{new Date(item.createdAt).toLocaleDateString("en-GB")}</time></article>)}</div></section>}</div>;
}

function HistoryPanel({ history }: { history: HistoryItem[] }) { return <section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Accountability</p><h2>Activity history</h2></div><p>Important registration, payment, group, schedule and setting changes.</p></div><div className="history-table">{history.map((item) => <article key={item.id}><span className="history-dot" /><div><strong>{item.summary || item.action}</strong><small>{item.entityType} · {item.action}</small></div><time>{new Date(item.createdAt).toLocaleString("en-GB")}</time></article>)}{history.length === 0 && <p className="admin-muted">No activity recorded for this year yet.</p>}</div></section>; }

function SettingsPanel({ year, yearId, backups, reloadBackups, signOut, toast }: { year?: Year; yearId: string; backups: Backup[]; reloadBackups: () => Promise<void>; signOut: () => Promise<void>; toast: (message: string) => void }) {
  const [proofRequired, setProofRequired] = useState(year?.proofRequired ?? true); const [cashReminderText, setCashReminderText] = useState(""); const [newPasscode, setNewPasscode] = useState(""); const [currentPasscode, setCurrentPasscode] = useState("");
  useEffect(() => { readJson<{ proofUploadRequired: boolean; cashReminderText: string }>(`/api/admin/settings?yearId=${encodeURIComponent(yearId)}`).then((data) => { setProofRequired(data.proofUploadRequired); setCashReminderText(data.cashReminderText); }).catch((error) => toast(error instanceof Error ? error.message : "Settings could not be loaded.")); }, [toast, yearId]);
  const needsCurrentPasscode = Boolean(newPasscode);
  async function save() { try { if (needsCurrentPasscode && !currentPasscode) { toast("Enter the current passcode to change it."); return; } await readJson("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yearId, proofUploadRequired: proofRequired, cashReminderText, newPasscode, currentPasscode }) }); setNewPasscode(""); setCurrentPasscode(""); toast("Settings saved."); } catch (error) { toast(error instanceof Error ? error.message : "Settings could not be saved."); } }
  async function backup() { try { await readJson("/api/admin/backups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "manual" }) }); await reloadBackups(); toast("Encrypted server backup created."); } catch (error) { toast(error instanceof Error ? error.message : "Backup could not be created."); } }
  async function restore(item: Backup) { const confirmation = window.prompt(`Restore the protected backup from ${new Date(item.createdAt).toLocaleString("en-GB")}? A fresh safety backup will be created first. Type RESTORE to continue.`); if (confirmation !== "RESTORE") return; try { await readJson("/api/admin/backups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, confirmation }) }); await reloadBackups(); toast("Backup restored. Reloading the administrator system…"); window.setTimeout(() => window.location.reload(), 900); } catch (error) { toast(error instanceof Error ? error.message : "Backup could not be restored."); } }
  return <div className="admin-page-stack"><section className="admin-card admin-form-card"><div className="admin-card-head"><div><p className="eyebrow">Administrator</p><h2>Access</h2></div><p>Sessions log out after inactivity. The hidden corner only opens sign-in; the passcode protects access. Keep the passcode somewhere safe - it cannot be reset from inside the app.</p></div><div className="compact-form-grid settings-form"><label><span>New passcode</span><input type="password" minLength={4} value={newPasscode} onChange={(event) => setNewPasscode(event.target.value)} placeholder="Leave blank to keep it" /><small>Four characters minimum. A longer private code is strongly recommended.</small></label>{needsCurrentPasscode && <label><span>Current passcode</span><input type="password" value={currentPasscode} onChange={(event) => setCurrentPasscode(event.target.value)} placeholder="Required to confirm this change" /><small>Changing the passcode requires the current one.</small></label>}<label className="wide"><span>Cash responsibility reminder</span><textarea value={cashReminderText} onChange={(event) => setCashReminderText(event.target.value)} /><small>This editable text appears after Cash is selected. It is not hardcoded in the registration screen.</small></label><label className="switch-field"><span>Default payment proof required</span><button className={proofRequired ? "setting-toggle on" : "setting-toggle"} role="switch" aria-checked={proofRequired} onClick={() => setProofRequired((current) => !current)}><span /></button></label><button className="admin-primary" onClick={() => void save()}>Save settings</button><button className="secondary-button" onClick={() => void signOut()}>Log out now</button></div></section><section className="admin-card"><div className="admin-card-head"><div><p className="eyebrow">Backups</p><h2>Protected records</h2></div><div className="card-actions"><button onClick={() => void backup()}>Create encrypted backup</button><a href="/api/admin/backups?download=1" download>Download JSON</a></div></div><p className="admin-muted">A protected server snapshot is created daily and after significant changes, no more than once every five minutes. Restore always creates one more safety snapshot first.</p><div className="backup-list">{backups.slice(0, 8).map((item) => <div key={item.id}><span><strong>{item.reason.replaceAll("-", " ")}</strong><small>{(item.byteSize / 1024).toFixed(1)} KB</small></span><time>{new Date(item.createdAt).toLocaleString("en-GB")}</time><button className="text-link" onClick={() => void restore(item)}>Restore</button><b>{item.status}</b></div>)}</div></section></div>;
}

function Modal({ close, children }: { close: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" onMouseDown={close}><section className="admin-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={close}>×</button>{children}</section></div>; }

function WhatsAppModal({ title, phone, templates, close, toast }: { title: string; phone: string; templates: WhatsAppTemplate[]; close: () => void; toast: (message: string) => void }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id || "");
  const [text, setText] = useState(templates[0]?.text || "");
  function pick(id: string) { setTemplateId(id); setText(templates.find((template) => template.id === id)?.text || ""); }
  return <Modal close={close}>
    <p className="eyebrow">WhatsApp message</p>
    <h2>{title}</h2>
    <div className="field-grid">
      <label className="field field-wide"><span>Message template</span><select value={templateId} onChange={(event) => pick(event.target.value)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></label>
      <label className="field field-wide"><span>Message to review before sending</span><textarea className="admin-textarea" rows={7} value={text} onChange={(event) => setText(event.target.value)} /></label>
    </div>
    <div className="card-actions">
      <a className="admin-primary admin-link-button" href={whatsappUrl(phone, text)} target="_blank" rel="noreferrer">Open in WhatsApp</a>
      <button className="secondary-button" onClick={async () => { await navigator.clipboard.writeText(text).catch(() => undefined); toast("Message copied."); }}>Copy message</button>
    </div>
    <p className="admin-muted">Nothing is sent automatically. WhatsApp opens with the message ready for your review.</p>
  </Modal>;
}
