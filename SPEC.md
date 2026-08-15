# The Choir Chug Website & Registration System

## Master Product Specification

**Status:** Full working system implemented, Vercel-portable, and privately deployed for owner verification; public launch remains private pending final business/legal/email setup
**Program year:** 2026–2027  
**Primary administrator:** Nechama  
**Public phone:** 053-590-6149  
**Purpose:** A polished public landing page, professional electronic registration and agreement flow, private group calendars, and a simple private administration system for students, payments, documents, groups, and yearly records.

This document is the single source of truth for the initial build. Existing agreement wording must not be silently rewritten. New requirements and approved wording changes must be added here before implementation.

---

## 1. Product Goals

1. Present The Choir Chug through a beautiful, mobile-first landing page.
2. Let parents register, approve every substantive agreement section, upload payment proof when applicable, review the completed agreement, sign it, and receive a copy.
3. Automatically create a manageable student record from every completed registration.
4. Give the administrator a simple dashboard for registrations, payments, groups, calendars, notes, documents, and exports.
5. Preserve complete records separately for every school year.
6. Protect children's personal information, medical information, signatures, and payment uploads.

---

## 2. Visual Direction

### Public website

- Elegant, exciting, feminine choir/studio appearance based on the supplied Choir Chug branding.
- Responsive on mobile, tablet, and desktop.
- A continuous, high-impact hero scroll sequence rather than duplicated “before” and “after” components. The original headline, supporting copy, actions, proof line, and one group photograph transform in place.
- As the parent scrolls, the same hero text reflows into three wide bands, the same bordered group photograph grows into a near-full-screen composition, and the “More than singing / A full experience built around her voice” copy moves over the image without a white card. The image and overlay continue upward without a long stationary hold.
- Motion is deliberately faster and more obvious on desktop, with a clear but safe mobile version.
- Respect the device's reduced-motion accessibility setting.
- Strong, visible **Register Now** calls to action.
- Use the approved Choir Chug transparent PNG lockup: glittered rose/burgundy **CHOIR CHUG**, crown, horizontal rules, and **PROFESSIONAL GIRL’S CHOIR** subtitle. Production asset: `public/choir-chug-logo-transparent.png`.
- The supplied approved choir/studio photographs are available to the build. Public use still requires the appropriate parent/guardian permissions.

### Admin system

- Very simple and uncluttered.
- A few top-level widgets followed by searchable student tiles.
- Clear status colors and plain-language labels.
- Touch-friendly controls for phone and tablet use.
- Destructive actions require a warning and confirmation.

### Product copy and configuration standard

- Business information must be data-driven and editable from the admin system rather than scattered as hard-coded text in the website source.
- School years, dates, schedules, session length, time windows, locations, groups, fees, registration fees, payment methods, payment instructions, contact information, agreement versions, calendar messages, and announcements must all be configurable.
- Only stable interface labels expected in a polished professional product—such as **Save**, **Next**, **Back**, **Search**, **Print**, and **Download**—may be fixed in the interface.
- Avoid unnecessary explanatory paragraphs in the interface. Short explanations belong in accessible tooltips/help icons unless they are legally required agreement text, a necessary warning, an error, or essential to completing the task safely.
- All visible permanent copy must meet a professional production standard and must not read like developer notes, placeholder text, or casual implementation explanations.
- Empty states, confirmations, warnings, and errors must be concise, intentional, and useful.

---

## 3. Pages and Private Links

### 3.1 Public landing page — `/`

- Hero section with Choir Chug logo, photographs or approved artwork, short headline, and **Register Now** button.
- Sections explaining the choir experience, technique, confidence, recording, friendships, and end-of-year video.
- Program summary and contact details.
- Parallax visual sections.
- Register buttons link to the standard registration page.
- An invisible or extremely discreet top-right admin hotspot must exist on both mobile and desktop. Activating it opens the protected admin passcode screen.
- The hidden-button login screen asks for the passcode only. It must not ask for an email address or username.
- The invisible hotspot is only a convenient entrance; it is not the security mechanism.

### 3.2 Standard registration page — `/register`

- Works as a standalone link that can be sent directly to parents.
- Does not require the parent to visit the landing page first.
- Uses the standard fees and current agreement version.

### 3.3 Custom registration link

- Created from the admin system when a custom price or discount is agreed.
- Contains a secure, unguessable token.
- The administrator selects the applicable school year and can override the registration fee, monthly amount, selected months, one-time amount, or payment method when relevant.
- Custom amounts and methods are displayed clearly to the parent and cannot be edited by the parent.
- The resulting registration remains traceable to the custom link that created it.
- The administrator can disable a custom link.
- The initial build supports custom registration fees, custom monthly amounts, one-time adjustments, selected-month overrides, an allowed payment method, and a private administrator note explaining the arrangement.

### 3.4 Save-and-continue link

- A parent can save an incomplete registration and continue later.
- A secure private return link is sent to the parent's email or can be copied for WhatsApp.
- Returning parents resume at the last completed step.
- An incomplete draft must not create an approved student or signed agreement.

### 3.5 Private group schedule page

- Every group receives its own secure, shareable link.
- No names, phone numbers, medical information, payment information, or other private student details appear on this page.
- The administrator can reset a group link if it has been shared too widely.
- Each page includes:
  - Group name and current school year.
  - A prominent live announcement at the top.
  - The next session date, time, location, and note.
  - A full month calendar.
  - Previous/next month navigation so parents can look into the future.
  - Gregorian date and Hebrew date for each day.
  - Jewish/Israeli holiday names in both English and Hebrew.
  - Sessions, breaks, recording dates, cancellations, and special events.
  - A note inside any applicable calendar day.
  - Tap/click expansion when a note is longer than the calendar cell.
- Calendar and announcement changes appear immediately after the administrator saves them.

### 3.6 Protected admin system — `/admin`

- Accessible through the hidden top-right hotspot and direct URL, but always protected by real server-side authentication.
- Normal login requires only the administrator passcode.
- Administrator email and passcode can both be changed or reset from Settings.
- Changing the administrator email or passcode requires confirmation and is written to the activity history.
- Account recovery is handled through the current configured administrator email without adding an email field to the normal hidden-button login.
- Automatic logout after inactivity.

---

## 4. Registration Flow

The form is a guided multi-step experience with a visible progress indicator.

### Step 1 — Participant and parent information

- Daughter's full name.
- Date of birth.
- Age calculated automatically from date of birth.
- Father's name and phone.
- Mother's name and phone.
- Parent email address for save/resume and completed agreement copy.
- Home address if enabled by the administrator.
- School if enabled by the administrator.

### Step 2 — Emergency and medical information

- Emergency contact name.
- Emergency contact phone.
- Relationship to child.
- Allergies.
- Medical conditions or important information.
- Medication or special assistance information.
- Optional private additional note.
- A clear “None” option where appropriate.

### Step 3 — Agreement review and approvals

- Display the exact active agreement version for the selected school year.
- Display the complete agreement on this screen; no paragraph may be replaced by a shortened preview.
- Place the registration summary above the agreement instead of in the side column so the agreement can use the full content width.
- Each substantive agreement **section** is presented as one approval block containing all of that section’s paragraphs.
- Under every substantive agreement section, the required checkbox label is exactly: **I understand**. There is one acknowledgement per section, not one per line or paragraph.
- Headings, blank participant-information fields, contact invitations, and the friendly closing sentence do not require approval checkboxes.
- A parent cannot continue until every required section-level **I understand** checkbox is selected.
- The system records the exact agreement version and every approval.
- Completed earlier steps remain directly accessible, and the final review includes a clear action to return to Step 3 without losing approvals.

### Step 4 — Payment method and proof

- Parent selects the applicable payment method.
- For the 2026–2027 default, show **₪200 per month** prominently and ***June is ₪100** as the smaller exception. Do not lead this screen with the full ₪1,900 choir-year total.
- Show relevant payment instructions.
- Include Bit, bank transfer, standing order, checks, and cash among the configurable methods.
- Payment-proof upload has a per-year administrator setting: **required** or **optional**. Cash never asks for a screenshot.
- Allow image upload from camera, photo library, or file picker.
- Accept a Bit or bank-transfer proof image when applicable.
- Show an upload preview and allow replacement before continuing.
- Uploading proof automatically changes the registration status to **Payment proof uploaded**; it does not automatically mark the money as verified.
- If cash is selected, pressing Continue opens a responsibility reminder asking the parent to send each monthly payment on time with the daughter and not require repeated payment chasing. The parent confirms before continuing.
- Show a compact security-check notice for the remaining October–June balance. For 2026–2027 the amount is ₪1,700, calculated as the ₪1,900 year total less the first ₪200 payment. The parent must select **I understand** before continuing.

### Step 5 — Full document review

- Generate a professional black-and-white A4-style preview with the color Choir Chug logo, all supplied information, and the full agreement.
- Render the agreement from the same stored paragraph source used in Step 3 so wording cannot differ between approval and signature.
- Parent can move backward to correct information before signing.
- The agreement version and agreed amount are visible.

### Step 6 — Signature

- Signature box works with touch, stylus, mouse, and trackpad.
- Clear-and-redraw option.
- Parent confirms the signer name and date.
- When the signature is applied, animate it into the visible agreement signature area and retain it in the generated document.

### Step 7 — Submission and confirmation

- Save the completed registration, approvals, signature, payment upload, timestamp, and agreement version.
- Automatically create the student record and tile.
- Produce a professional signed PDF.
- Email the PDF and registration summary to the configured administrator email.
- Email the parent a copy of the signed PDF and confirmation.
- Give the parent a private schedule link on the completion screen immediately. Before group placement it shows that the schedule is being prepared; after assignment the same private link automatically resolves to the correct group’s live calendar.
- Display a friendly completion screen.

---

## 5. Automatic Registration Status

Every student/registration has the following status steps:

1. **Form started** — automatic.
2. **Form completed** — automatic when required information is complete.
3. **Agreement accepted** — automatic when every required section acknowledgement is approved.
4. **Agreement signed** — automatic when a valid signature is saved.
5. **Payment proof uploaded** — automatic when an upload is saved.
6. **Payment verified** — manual administrator action only.
7. **Registration approved** — manual administrator action.

The dashboard must clearly distinguish **proof uploaded** from **payment verified**.

---

## 6. Simple Admin Dashboard

### Top widgets

Keep the dashboard small and useful. Initial widgets:

1. Total active students for the selected school year.
2. New registrations awaiting approval.
3. Payments missing for the current month.
4. Upcoming birthdays, including the girl's current age and next birthday.

### Student tiles

Every completed registration automatically creates a student tile. Administrators can also add a girl manually.

Each tile shows:

- Student name.
- Age and date of birth.
- Assigned group or **Not assigned**.
- Registration status.
- Current-month payment status.
- Missing document/status warning.
- Quick actions.

Opening a tile shows:

- All participant and parent information.
- Emergency and medical information.
- Private administrator notes.
- Agreement version, approval record, signature, and signed PDF.
- Uploaded transfer/Bit screenshot.
- Full payment history.
- Group and school-year history.
- Change history.
- Archive action.

### Search and filters

- Search by student name, parent name, or phone number.
- Filter by school year.
- Filter by group.
- Filter by registration status.
- Filter by missing payment.
- Filter by missing agreement, signature, or upload.
- Filter active versus archived students.

---

## 7. Payment Tracking

### Standard 2026–2027 schedule

- September through May: ₪200 per month, per girl.
- June: ₪100.
- Standard total: ₪1,900.
- Security check: ₪1,700 for the remaining October–June balance after the first ₪200 registration payment.

These values are the default only for 2026–2027. They are not permanent system constants.

### Yearly fee and payment-method setup

For each school year, the administrator can configure:

- Whether a separate registration fee is used and its amount.
- Monthly fees, including different amounts for individual months.
- The full-year total and security-check requirement.
- Due dates and recurring payment dates.
- Available payment methods.
- The display name and instructions for each method.
- Whether proof upload is required, optional, or not applicable for each method.
- Bank, Bit, check, cash, standing-order, or other payment instructions.
- Which method is preselected, if any.

Payment methods are records that can be added, edited, enabled, disabled, reordered, and reused in future years. They must not be limited to a hard-coded list.

### Per-student payment record

Every student has a registration/payment area with:

- Registration payment or initial payment status.
- One payment row/checkmark for every applicable month.
- Amount due for that month.
- Amount received.
- Paid/unpaid state.
- Payment date.
- Payment method selected from the methods enabled for that school year, with support for Bit, cash, check, standing order, bank transfer, and administrator-created methods.
- Uploaded proof or reference number.
- Private payment note.
- Administrator who made the change.

### Payment behavior

- Selecting a payment checkmark saves the payment as paid.
- Unselecting a paid checkmark displays a warning and requires confirmation.
- The dashboard shows payments missing for the current month.
- Custom monthly amounts replace the standard amount only for the student linked to that custom registration.
- A custom registration link may also override the registration fee, one or more monthly amounts, a one-time amount, or the allowed payment method for that registration only.
- Payment proof upload does not equal payment verification.
- The administrator can copy a ready-made WhatsApp payment reminder containing the correct student, month, amount, and payment details.
- The administrator can create a professional confirmation/receipt message after verifying a payment.

---

## 8. Student and Group Management

- Add a student manually without a public form submission.
- Edit student details.
- Create groups after registrations are received.
- Assign and move girls between groups.
- Keep unassigned students visible until grouping is finalized.
- Define group name, school year, age range, Wednesday time, location, and private calendar link.
- Copy a WhatsApp message containing group details and the group's private schedule link.
- Archive a student who leaves without deleting her records.
- Archived records remain searchable and exportable.

---

## 9. School-Year Management

- School-year selector/drop-down throughout the admin system.
- Add future school years.
- Prepare the next year while the current year remains active.
- Each year has its own:
  - Agreement version.
  - Optional registration fee.
  - Standard payment schedule.
  - Enabled payment methods and payment instructions.
  - Schedule-generation mode and date range.
  - Finalized schedule versions and printable schedule layouts.
  - Groups.
  - Sessions and calendar notes.
  - Active/archived status.
  - Student enrollments and payment records.
- A student's core profile can remain connected across years without mixing yearly agreements or payments.
- Returning students can be copied/enrolled into a new year while all old records remain unchanged.

---

## 10. Calendar Management

### Per-year schedule setup

Every school year has its own editable schedule configuration. The administrator chooses one of two modes:

1. **Manual schedule** — create each session, break, recording date, or event individually.
2. **Recurring schedule** — enter the school-year start and end dates, weekly day, time window, session length, and applicable groups. The system then creates the repeating schedule, after which individual dates can be edited, excluded, moved, or canceled.

The recurring setup supports:

- Start and end dates for the year.
- One or more days of the week.
- Overall time window and group-specific exact times.
- Session length.
- Excluded dates and school breaks.
- One-off makeup sessions or date changes.
- Preview of the sessions that will be generated before saving.
- Regeneration safeguards so existing notes, attendance, or manual exceptions are not silently overwritten.

The default 2026–2027 setup is:

- Israeli public-school calendar basis.
- September 2026 through June 15, 2027.
- Wednesdays.
- Overall group window: 5:00 p.m.–7:00 p.m.
- Session length: 50 minutes.
- Exact group times assigned after groups are formed.

All of these defaults can be changed for 2026–2027 and configured differently for every future year.

The administrator can:

- Add, edit, move, or cancel a session.
- Add future sessions.
- Enter English and Hebrew titles if desired.
- Add a visible note to any calendar day.
- Set group time and location per event.
- Add a live announcement at the top of each group page.
- Mark recording dates, breaks, or special sessions.
- Switch a future year between manual and recurring setup before that year's sessions are finalized.
- Preview what parents will see.

Calendar display requirements:

- Hebrew and Gregorian dates.
- Hebrew and English Jewish/Israeli holiday names.
- Month navigation into the past and future.
- Correct mobile calendar layout.
- Group-specific content only.

### Finalize and print the yearly schedule

- Each school year has a **Finalize Schedule** action after its dates, groups, times, locations, holidays, breaks, recording days, and notes are ready.
- Finalizing creates a named schedule version and records when it was finalized. Later edits create a newer version instead of silently changing the already-issued schedule.
- The administrator can reopen a finalized schedule, make changes, preview them, and finalize a replacement version.
- A finalized schedule can be printed or downloaded as a beautifully formatted, logo-branded PDF.
- Print options include the entire school year, an individual group, selected months, or all groups.
- The print layout includes the school year, group, dates, times, locations, Hebrew and Gregorian dates, Hebrew and English holiday names, session notes, breaks, recordings, and special sessions where applicable.
- The print view is optimized for clear black-and-white printing while retaining a polished branded appearance. A color version may also be available.
- The administrator previews the exact pages before printing or downloading.

---

## 11. Documents, Printing, and Exports

### Agreements

- Download a single signed agreement PDF.
- Download all signed agreements for a selected year or group together.
- Generate a black-and-white A4 blank agreement with the supplied Choir Chug logo.
- Keep a copy of the exact agreement version that each parent signed.

### Class lists

- Printable class list by group and school year.
- Administrator chooses which private fields to include before printing.

### Lyrics formatter

- Paste song lyrics into the admin system.
- Enter song title and optional subtitle/group.
- Select A4 or A5.
- Automatically format cleanly with the Choir Chug logo.
- Print or download as PDF.
- Prefer fitting onto one page when readable; warn when the text is too long rather than making it illegibly small.

### Data exports

- Export student, group, registration, and payment data to Excel.
- Download a complete JSON backup.
- Exports respect the selected year and filters, with an option for all years.

### Creative prompt studio

The admin system includes a professional prompt-building area for creating branded visual materials in an external image generator that is strong at rendering text.

Available prompt types initially include:

1. **Detail sheet** — an information-first page, not an advertising flyer. It prioritizes clear schedules, groups, fees, locations, contact details, and other selected facts.
2. **Promotional flyer** — a more visual marketing design with a headline, benefits, call to action, and selected program details.
3. **Custom material** — the administrator describes another item, such as a registration announcement, schedule notice, recording-day sheet, or social image.

Prompt creation behavior:

- The administrator selects a school year so the prompt can pull the correct finalized facts from that year's settings rather than using stale hard-coded information.
- The administrator chooses which information to include: schedule, groups, age ranges, fees, registration fee, payment details, location, phone, website link, benefits, recording information, and other editable content.
- The resulting prompts may be long and detailed. Accuracy, exact wording, readable text, hierarchy, dimensions, branding, and layout instructions are more important than brevity.
- The prompt begins with a clearly separated **Files to attach before generating** instruction.
- The official Choir Chug logo is always listed first and is permanently available from the saved logo asset. The prompt instructs the administrator to attach it as the first image/reference and instructs the generator to place the supplied logo prominently without redrawing, restyling, recoloring, misspelling, or replacing it.
- The attachment checklist can also request optional student/choir photographs, an approved background/style reference, a QR code, or another required asset. It explains exactly which files should be attached and what role each file serves.
- The prompt includes all exact text in a clearly marked verbatim-copy section and explicitly instructs the generator not to alter names, dates, prices, phone numbers, Hebrew text, or spelling.
- The detail-sheet prompt explicitly states that the output is a clean information sheet and **not a flyer**.
- The flyer prompt includes an editable visual style, mood, palette, composition, audience, format, and call to action.
- Produce several useful prompt variations at once, with individual **Copy Prompt** buttons.
- Include a **Refresh** button that produces a new prompt variation.
- Include separate controls to refresh only the style, palette, layout, or creative direction while locking all approved facts, exact text, logo instructions, dimensions, and required attachments.
- The administrator can edit any generated prompt before copying it.
- Previous useful prompts can be saved, named, duplicated, and reused for another year with that year's current facts.
- Prompts must be production-quality and specific enough for a professional text-capable image generator; they must not contain vague filler, developer commentary, or contradictory instructions.
- The studio does not send anything automatically. It prepares the assets checklist and prompt for the administrator to copy into the chosen generator.

---

## 12. WhatsApp Helpers

The website does not send a WhatsApp message without the administrator's action. It prepares a message and opens/copies it for review.

Templates include:

- Registration received.
- Missing registration information.
- Missing payment proof.
- Current-month payment reminder.
- Payment confirmed.
- Group assignment and schedule link.
- Session update or cancellation.

Messages automatically insert the relevant name, group, date, amount, and link. The administrator can edit the message before sending.

---

## 13. Security, Privacy, and Change History

- Real server-protected administrator login.
- Hidden hotspot is not treated as authentication.
- The normal hidden-button login contains one passcode field only; no email or username field.
- Configurable administrator passcode that can be changed or reset from Settings.
- Configurable administrator email that can be changed or reset from Settings.
- The administrator email is used for registration delivery, security notices, and recovery, but not for normal sign-in.
- Changing the administrator email requires verification of the new address.
- Changing the passcode requires the current passcode or a verified recovery flow.
- Recovery uses the configured administrator email.
- Rate limiting and temporary lockout after repeated incorrect attempts.
- Automatic logout after inactivity.
- Secure, private file uploads.
- Sensitive student, medical, signature, and payment files never use public predictable URLs.
- Administrator actions affecting students, payments, agreements, groups, calendars, settings, and archives are recorded in a change history.
- Change history includes date/time, administrator, action, and before/after values where appropriate.
- Parents cannot browse other registrations or groups.
- Private group schedule pages contain no student personal data.

---

## 14. Backups

- Regular automatic protected server backups.
- The production Vercel build creates encrypted database snapshots on a daily protected maintenance schedule and keeps private uploads in the configured object-storage account.
- Important changes save immediately to the main database.
- **Download Full JSON Backup** button in Settings.
- After significant administration work, the system may display a non-blocking reminder to download a personal JSON backup.
- Do not force an automatic browser download every five minutes, because browsers may block it and it would create many unnecessary files.
- Backup and restore formats include students, registrations, years, groups, calendars, notes, payment records, agreement versions, and settings. Uploaded binary files are backed up by the protected file-storage backup process and referenced in the JSON manifest.

---

## 15. Final 2026–2027 Agreement Text

The following is the approved master text. The new **Session Length & Group Times** section is included in its approved position immediately after **Schedule Terms** and before **Location**. The agreement interface and final PDF use one **I understand** acknowledgement after each substantive heading/section. Any older paragraph-level checkbox placement still visible in the quoted editorial copy below is superseded by this latest section-level rule and must not be implemented.

> **Dear Parents,**  
> Please read the following form carefully before signing:
>
> ### Participant Information
>
> Daughter’s full name: ___________________________
>
> Father’s name: ____________________ Phone: _____________
>
> Mother’s name: ___________________ Phone: _____________
>
> ### Schedule Terms
>
> The choir will operate according to the Israeli public school calendar for the 2026–2027 school year, with sessions taking place every Wednesday on days when school is in session.
>
> **☐ I understand**
>
> The choir year will run from September 2026 through June 15, 2027. No regular Choir Chug sessions will take place after June 15, 2027.
>
> **☐ I understand**
>
> If there is no school on a particular Wednesday, there will be no choir session that day. This applies even if school is canceled at the last minute due to war, a national emergency, security circumstances, or any other reason.
>
> **☐ I understand**
>
> There will be no refund or reduction in the monthly fee for individual canceled sessions. The monthly fee remains due as long as at least one choir session takes place during that calendar month.
>
> **☐ I understand**
>
> If, during an entire calendar month, no choir sessions take place at all, no payment will be required for that month.
>
> **☐ I understand**
>
> Once the second month of participation begins, participation can no longer be canceled, and the monthly payments must continue through the end of the choir year.
>
> **☐ I understand**
>
> ### Session Length & Group Times
>
> Each Choir Chug session will be 50 minutes long. All groups will meet on Wednesdays between 5:00 p.m. and 7:00 p.m. The exact time for each group will be shared with parents once registration is complete, so we can arrange the girls into the groups that fit their ages best. We will, b’ezrat Hashem, open the Choir Chug with a wonderful group of girls. If we do not reach the minimum number of girls needed to run the program, we may need to cancel the Choir Chug for this year. If that happens, all payments will be returned.
>
> **☐ I understand**
>
> ### Location
>
> Choir Chug sessions will take place either in Mishkafayim or in RBSA. The exact location for each group will be provided to parents.
>
> **☐ I understand**
>
> ### Payment Terms
>
> Monthly Cost: 200₪ per month, per girl, from September through May.
>
> **☐ I understand**
>
> June: 100₪, as Choir Chug sessions will only continue through June 15.
>
> **☐ I understand**
>
> Total Cost for the Choir Year: 1,900₪ per girl.
>
> **☐ I understand**
>
> The first month is 200₪. After the first month, participation becomes a commitment for the remainder of the choir year, and the monthly payments must continue until the end of the choir year.
>
> **☐ I understand**
>
> In addition to the monthly payments, please provide a security check for the remaining October–June balance after the registration payment. For 2026–2027, the security check amount is 1,700₪. It will be held only as security and used only if an agreed payment remains unpaid, after we contact you first.
>
> **☐ I understand**
>
> Payment Options:<br>
> Cash<br>
> Checks<br>
> Bit<br>
> הוראת קבע (standing order) on the 20th of each month: 200₪ per month from September through May, and 100₪ for June.
>
> **☐ I understand**
>
> If cash is selected, the monthly payment should be sent on time with your daughter. Parents are responsible for making sure the payment arrives each month without repeated reminders.
>
> **☐ I understand**
>
> Bank Transfer Details:  
> Mercantile Bank (17), Branch 725  
> Account No: 92582127  
> Account Name: Nechama Abergil
>
> **☐ I understand**
>
> ### Cancellations & Absences
>
> Binding Commitment: Starting from the second month of participation, participation cannot be canceled. Monthly payments must continue through the end of the choir year.
>
> **☐ I understand**
>
> Absences & Lesson Changes: If a girl misses a lesson by personal choice, there will be no refund or makeup session. The choir administration reserves the right to change the date of a lesson when necessary. In such cases, a makeup lesson will be arranged if possible.
>
> **☐ I understand**
>
> ### End-of-Year Video
>
> Every participating girl will take part in an end-of-year video featuring the girls of the Choir Chug together.
>
> **☐ I understand**
>
> The completed video will be uploaded to YouTube as an unlisted video, meaning that it will not normally appear in public YouTube searches and will be accessible through the direct link.
>
> **☐ I understand**
>
> The video link will be shared with the parents. Parents acknowledge that anyone who receives the link may forward or share it with others. Once the link has been shared, the Choir Chug cannot control who the link is forwarded to or who views the video and is not responsible for further sharing of the link by parents, participants, or other recipients.
>
> **☐ I understand**
>
> ### Communication
>
> I will open a WhatsApp group for each group of the Choir Chug, where I will send all updates, scheduling notices, and important information.
>
> **☐ I understand**
>
> For any inquiries, please do not hesitate to call me, Nechama, at 053-590-6149 — I will be happy to speak with you and discuss any matter.
>
> ### Recordings
>
> Rehearsals and performances may be recorded (audio & video).
>
> **☐ I understand**
>
> These recordings, if shared, may be shared privately within the parents’ WhatsApp groups or sent privately to people who are interested in signing up for the Choir Chug so they can get an idea of the program.
>
> **☐ I understand**
>
> ### Behavior & Participation
>
> We want the Choir Chug to be a fun, friendly, and positive environment where every girl feels comfortable and enjoys participating. We expect all girls to behave respectfully toward the teacher and the other girls in the group.
>
> **☐ I understand**
>
> If a behavioral issue becomes disruptive or continues repeatedly, we will speak with the parents so that we can work together to find the best way to handle the situation.
>
> **☐ I understand**
>
> ### Transportation & Responsibility
>
> The choir is not responsible for the girl’s travel to and from the class — this is the sole responsibility of the parents. We recommend ensuring that both child and parents know the route clearly.
>
> **☐ I understand**
>
> It is important to emphasize: your child must arrive only at the time of the lesson and not too early, as we cannot be responsible for them beforehand. Immediately after the lesson, parents must ensure that their child goes home. The choir is not responsible for what happens before or after class time.
>
> **☐ I understand**
>
> ### Confirmation
>
> Singer’s name: ___________________________
>
> Parent’s signature: ________________________ Date: _____________
>
> Looking forward to a wonderful year of music and growth together! 🎶

---

## 16. A4 Black-and-White Agreement Deliverable

After the logo is supplied:

- Create a clean black-and-white A4 agreement using the exact Section 15 text.
- Place the Choir Chug logo prominently but economically so it prints well.
- Use clear headings, readable spacing, and printable checkboxes.
- Avoid colored backgrounds and ink-heavy decoration.
- Provide both a blank printable agreement and the system-generated completed signed PDF layout.
- Visually inspect the rendered pages before final delivery.

---

## 17. Data Structure Summary

The system needs connected records for:

- Administrator account and settings.
- School years.
- Agreement versions and individual section approvals.
- Student core profiles.
- Yearly enrollments.
- Parents/guardians and contact information.
- Emergency and medical information.
- Registration drafts and secure resume tokens.
- Standard and custom registration links.
- Groups and private group links.
- Calendar events, notes, holidays, and announcements.
- Payment schedules, payments, methods, proof files, and verification.
- Per-year fee settings, registration-fee settings, payment-method definitions, and payment instructions.
- Per-year schedule mode, recurring schedule rules, exclusions, and manual exceptions.
- Finalized schedule versions and generated printable schedule PDFs.
- Creative prompt templates, saved prompt variations, locked facts, attachment requirements, and prompt history.
- Signatures and generated agreement PDFs.
- Private notes.
- Archived records.
- Activity/change history.
- Backup manifests.

---

## 18. Items Awaiting User Assets or Final Values

These are intentionally not guessed:

1. Verified administrator/recovery email and the final public privacy contact.
2. Verified parent-facing sender/reply-to email plus the transactional-email provider key.
3. Legal/trading name, business/dealer number, business address, public email, and VAT wording if applicable.
4. Israeli lawyer review of the agreement, cancellations, security-check arrangement, media permissions, privacy notice, and accessibility applicability before real registrations are accepted.
5. Preferred public domain, if using a custom domain.
6. Exact 2026–2027 registration-fee amount if it is intended to differ from the first monthly payment; future years remain configurable.
7. Final media/photo permissions and confirmation that the supplied children’s photographs may be used publicly.

These pending items do not change the approved system structure. They must be resolved before the relevant feature is published for real registrations.

---

## 19. Delivery Sequence

1. Receive logo, photographs, and remaining values listed in Section 18.
2. Create an approximate visual mock for landing page, registration flow, and simple admin dashboard.
3. Confirm the visual direction.
4. Create and visually verify the black-and-white A4 agreement.
5. Build the public landing page and standalone registration experience.
6. Build the database, secure uploads, electronic signature, PDF, and email flow.
7. Build the simple administrator dashboard, student tiles, payments, groups, years, exports, calendar, printable yearly schedules, lyrics formatter, and creative prompt studio.
8. Test mobile and desktop behavior, registration completion, document creation, schedule finalization/printing, prompt copying/refreshing, permissions, backups, and critical admin actions.
9. Publish and provide the live public link, direct registration link, and administrator access instructions.
10. Provide a downloadable ordinary source-code folder with both deployment adapters, generated migrations, automated tests, and owner setup documentation. The handoff must document environment variables, database, storage, email, domain, backup, and deployment without including live secrets.

### Portable deployment requirement

- The source code and business logic are downloadable and owner-controlled. Runtime adapters support Cloudflare D1/R2 for ChatGPT Sites and Neon Postgres/private Vercel Blob for a normal Vercel deployment.
- The downloadable project is ready for Vercel after the owner provisions Neon and Vercel Blob, supplies the documented environment variables, and runs the included PostgreSQL migration. No application rewrite is required.
- Persistent services such as the database, protected uploads, transactional email, backups, and authentication must be documented separately so the owner can connect and control them from the chosen accounts.
- Never place production passwords, passcodes, API keys, database credentials, or recovery secrets inside the downloadable source archive.
