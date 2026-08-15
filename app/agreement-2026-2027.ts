import { choirConfig } from "./site-config";

export type AgreementParagraph = {
  id: string;
  text: string;
};

export type AgreementSection = {
  title: string;
  paragraphs: readonly AgreementParagraph[];
};

const payment = choirConfig.currentYear.payment;
const formatAmount = (amount: number) => amount.toLocaleString("en-US");

export const agreementSections: readonly AgreementSection[] = [
  {
    title: "Introduction",
    paragraphs: [
      { id: "introduction-greeting", text: "Dear Parents," },
      { id: "introduction-read", text: "Please read the following form carefully before signing:" },
    ],
  },
  {
    title: "Schedule Terms",
    paragraphs: [
      { id: "schedule-calendar", text: "The choir will operate according to the Israeli public school calendar for the 2026–2027 school year, with sessions taking place every Wednesday on days when school is in session." },
      { id: "schedule-dates", text: "The choir year will run from September 2026 through June 15, 2027. No regular Choir Chug sessions will take place after June 15, 2027." },
      { id: "schedule-school-closure", text: "If there is no school on a particular Wednesday, there will be no choir session that day. This applies even if school is canceled at the last minute due to war, a national emergency, security circumstances, or any other reason." },
      { id: "schedule-single-cancellation", text: "There will be no refund or reduction in the monthly fee for individual canceled sessions. The monthly fee remains due as long as at least one choir session takes place during that calendar month." },
      { id: "schedule-full-month", text: "If, during an entire calendar month, no choir sessions take place at all, no payment will be required for that month." },
      { id: "schedule-commitment", text: "Once the second month of participation begins, participation can no longer be canceled, and the monthly payments must continue through the end of the choir year." },
    ],
  },
  {
    title: "Session Length & Group Times",
    paragraphs: [
      { id: "schedule-length-groups", text: "Each Choir Chug session will be 50 minutes long. All groups will meet on Wednesdays between 5:00 p.m. and 7:00 p.m. The exact time for each group will be shared with parents once registration is complete, so we can arrange the girls into the groups that fit their ages best. We will, b’ezrat Hashem, open the Choir Chug with a wonderful group of girls. If we do not reach the minimum number of girls needed to run the program, we may need to cancel the Choir Chug for this year. If that happens, all payments will be returned." },
    ],
  },
  {
    title: "Location",
    paragraphs: [
      { id: "location", text: "Choir Chug sessions will take place either in Mishkafayim or in RBSA. The exact location for each group will be provided to parents." },
    ],
  },
  {
    title: "Payment Terms",
    paragraphs: [
      { id: "payment-monthly", text: `Monthly Cost: ${formatAmount(payment.monthlyAmount)}₪ per month, per girl, from September through May.` },
      { id: "payment-june", text: `June: ${formatAmount(payment.juneAmount)}₪, as Choir Chug sessions will only continue through June 15.` },
      { id: "payment-total", text: `Total Cost for the Choir Year: ${formatAmount(payment.choirYearTotal)}₪ per girl.` },
      { id: "payment-first-month", text: `The first month is ${formatAmount(payment.registrationFeeAmount)}₪. After the first month, participation becomes a commitment for the remainder of the choir year, and the monthly payments must continue until the end of the choir year.` },
      { id: "payment-security-check", text: `In addition to the monthly payments, please provide a security check for the remaining ${payment.securityCheckMonths} balance after the registration payment. For 2026–2027, the security check amount is ${formatAmount(payment.securityCheckAmount)}₪. It will be held only as security and used only if an agreed payment remains unpaid, after we contact you first.` },
      { id: "payment-methods", text: `Payment Options:\nCash\nChecks\nBit\nהוראת קבע (standing order) on the 20th of each month: ${formatAmount(payment.monthlyAmount)}₪ per month from September through May, and ${formatAmount(payment.juneAmount)}₪ for June.` },
      { id: "payment-cash", text: "If cash is selected, the monthly payment should be sent on time with your daughter. Parents are responsible for making sure the payment arrives each month without repeated reminders." },
      { id: "payment-bank", text: "Bank Transfer Details:\nMercantile Bank (17), Branch 725\nAccount No: 92582127\nAccount Name: Nechama Abergil" },
    ],
  },
  {
    title: "Cancellations & Absences",
    paragraphs: [
      { id: "cancellation-binding", text: "Binding Commitment: Starting from the second month of participation, participation cannot be canceled. Monthly payments must continue through the end of the choir year." },
      { id: "cancellation-absence", text: "Absences & Lesson Changes: If a girl misses a lesson by personal choice, there will be no refund or makeup session. The choir administration reserves the right to change the date of a lesson when necessary. In such cases, a makeup lesson will be arranged if possible." },
    ],
  },
  {
    title: "End-of-Year Video",
    paragraphs: [
      { id: "video-participation", text: "Every participating girl will take part in an end-of-year video featuring the girls of the Choir Chug together." },
      { id: "video-unlisted", text: "The completed video will be uploaded to YouTube as an unlisted video, meaning that it will not normally appear in public YouTube searches and will be accessible through the direct link." },
      { id: "video-sharing", text: "The video link will be shared with the parents. Parents acknowledge that anyone who receives the link may forward or share it with others. Once the link has been shared, the Choir Chug cannot control who the link is forwarded to or who views the video and is not responsible for further sharing of the link by parents, participants, or other recipients." },
    ],
  },
  {
    title: "Communication",
    paragraphs: [
      { id: "communication-whatsapp", text: "I will open a WhatsApp group for each group of the Choir Chug, where I will send all updates, scheduling notices, and important information." },
      { id: "communication-contact", text: "For any inquiries, please do not hesitate to call me, Nechama, at 053-590-6149 — I will be happy to speak with you and discuss any matter." },
    ],
  },
  {
    title: "Recordings",
    paragraphs: [
      { id: "recordings-made", text: "Rehearsals and performances may be recorded (audio & video)." },
      { id: "recordings-sharing", text: "These recordings, if shared, may be shared privately within the parents’ WhatsApp groups or sent privately to people who are interested in signing up for the Choir Chug so they can get an idea of the program." },
    ],
  },
  {
    title: "Behavior & Participation",
    paragraphs: [
      { id: "behavior-environment", text: "We want the Choir Chug to be a fun, friendly, and positive environment where every girl feels comfortable and enjoys participating. We expect all girls to behave respectfully toward the teacher and the other girls in the group." },
      { id: "behavior-concerns", text: "If a behavioral issue becomes disruptive or continues repeatedly, we will speak with the parents so that we can work together to find the best way to handle the situation." },
    ],
  },
  {
    title: "Transportation & Responsibility",
    paragraphs: [
      { id: "transportation", text: "The choir is not responsible for the girl’s travel to and from the class—this is the sole responsibility of the parents. We recommend ensuring that both child and parents know the route clearly." },
      { id: "transportation-timing", text: "It is important to emphasize: your child must arrive only at the time of the lesson and not too early, as we cannot be responsible for them beforehand. Immediately after the lesson, parents must ensure that their child goes home. The choir is not responsible for what happens before or after class time." },
    ],
  },
] as const;

export const agreementParagraphs = agreementSections.flatMap((section) =>
  section.paragraphs.map((paragraph) => ({ ...paragraph, sectionTitle: section.title })),
);

export const approvalAgreementSections = agreementSections.filter((section) => section.title !== "Introduction");

export const agreementVersion = "2026-2027-v2";
