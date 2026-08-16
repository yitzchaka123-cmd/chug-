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
      { id: "introduction-greeting", text: "Dear Parents, we’re so happy you’re joining us!" },
      { id: "introduction-read", text: "Please read this agreement before signing - it’s short, and it covers everything you need to know about the year." },
    ],
  },
  {
    title: "Schedule",
    paragraphs: [
      { id: "schedule-calendar", text: "We follow the Israeli public school calendar for the 2026–2027 school year: choir meets every Wednesday that school is in session, from September 2026 until June 15, 2027 (no regular sessions after that date)." },
      { id: "schedule-school-closure", text: "If there is no school on a Wednesday - including a last-minute closure for any reason, security situations included - there is no choir that day. Individual cancelled sessions are not refunded, and the monthly fee stays the same as long as at least one session takes place that month. If a whole calendar month passes with no sessions at all, that month is simply free." },
    ],
  },
  {
    title: "Session Length & Group Times",
    paragraphs: [
      { id: "schedule-length-groups", text: "Sessions are 50 minutes, on Wednesdays between 5:00 p.m. and 7:00 p.m. We share each group’s exact time once registration closes, so the girls land in the groups that fit their ages best. We can’t wait to open with a wonderful group of girls, b’ezrat Hashem - and in the unlikely case we do not reach the minimum number needed to run the program this year, every payment is returned in full." },
    ],
  },
  {
    title: "Location",
    paragraphs: [
      { id: "location", text: "Choir Chug sessions take place at Mishkafayim or RBSA - your daughter’s exact location arrives together with her group placement." },
    ],
  },
  {
    title: "Payment Terms",
    paragraphs: [
      { id: "payment-registration-fee", text: `Registration fee: a one-time ${formatAmount(payment.registrationFeeAmount)}₪ that secures your daughter’s place. It is paid now, at registration, and is separate from the monthly fees below.` },
      { id: "payment-monthly", text: `Monthly cost: ${formatAmount(payment.monthlyAmount)}₪ per girl, September through May.` },
      { id: "payment-june", text: `June: ${formatAmount(payment.juneAmount)}₪, since the year ends on June 15.` },
      { id: "payment-total", text: `Total for the choir year: ${formatAmount(payment.choirYearTotal)}₪ per girl, including the registration fee.` },
      { id: "payment-first-month", text: "The first month of choir is your trial month. From the second month, participation becomes a commitment for the rest of the choir year: it can no longer be cancelled, and the monthly payments continue through the end. If your daughter misses a session by choice there is no refund or makeup, and if we ever need to move a session we will arrange a makeup when possible." },
      { id: "payment-security-check", text: `Alongside the monthly payments, we ask for one security check covering the ${payment.securityCheckMonths} balance. For 2026–2027 the security check amount is ${formatAmount(payment.securityCheckAmount)}₪. It is a safety net only - never used unless an agreed payment stays unpaid, and we will always speak with you first.` },
      { id: "payment-methods", text: `Payment options:\nCash\nChecks\nBit\nהוראת קבע (standing order) on the 20th of each month: ${formatAmount(payment.monthlyAmount)}₪ per month from September through May, and ${formatAmount(payment.juneAmount)}₪ for June.` },
      { id: "payment-cash", text: "Paying cash? Please send the payment with your daughter at the start of each month - arriving on time without reminders is part of the arrangement, and it means so much." },
      { id: "payment-bank", text: "Bank transfer: Mercantile Bank (17), Branch 725, Account 92582127, Nechama Abergil." },
    ],
  },
  {
    title: "End-of-Year Video",
    paragraphs: [
      { id: "video-participation", text: "Every girl takes part in our end-of-year video - one of the highlights of the year!" },
      { id: "video-sharing", text: "The finished video goes on YouTube as an unlisted link: it does not appear in searches, and only people with the link can watch. We share the link with parents - please remember that once a link is shared, anyone who receives it can pass it along, and the Choir Chug cannot control or take responsibility for further sharing." },
    ],
  },
  {
    title: "General Information",
    paragraphs: [
      { id: "general-communication", text: "Communication: every group gets its own WhatsApp group for updates, schedule notices and important information. And for anything at all - call me, Nechama, at 053-590-6149. I’m always happy to talk." },
      { id: "general-recordings", text: "Recordings: rehearsals and performances may be recorded (audio and video). If recordings are shared, they stay private - within the parents’ WhatsApp groups, or sent privately to families considering joining." },
      { id: "general-behavior", text: "Behavior: we want the Choir Chug to be fun, warm and positive - a place where every girl feels comfortable. We expect the girls to treat the teacher and each other with respect, and if a behavior issue keeps disrupting, we’ll speak with the parents to find the best way forward together." },
      { id: "general-transportation", text: "Getting to and from choir: travel is the parents’ responsibility - please make sure your daughter knows her route. She should arrive at lesson time (not early) and head home straight afterward, since we aren’t able to supervise the girls before or after class." },
    ],
  },
] as const;

export const agreementParagraphs = agreementSections.flatMap((section) =>
  section.paragraphs.map((paragraph) => ({ ...paragraph, sectionTitle: section.title })),
);

export const approvalAgreementSections = agreementSections.filter((section) => section.title !== "Introduction");

export const agreementVersion = "2026-2027-v4";
