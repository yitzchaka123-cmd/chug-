import type { AgreementSection } from "@/app/agreement-2026-2027";
import { buildPaymentPlan } from "@/lib/payment-plan";

export type AgreementPricing = {
  schoolYearName: string;
  startsOn: string;
  endsOn: string;
  registrationFeeAgorot: number;
  monthlyFeeAgorot: number;
  juneFeeAgorot: number;
  securityCheckAgorot: number;
  securityCheckMonths: string;
  paymentDueDay: number;
  monthOverrides?: Record<string, number>;
  oneTimeAmountAgorot?: number;
  customLabel?: string;
  paymentMethodLabels?: readonly string[];
  scheduleWeekday: number;
  scheduleStartTime: string;
  scheduleEndTime: string;
  sessionLengthMinutes: number;
  location: string;
};

function shekels(agorot: number) {
  return `${Math.max(0, Math.round(agorot)) / 100}`.replace(/\.00$/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseAgreementSections(input: unknown): AgreementSection[] {
  if (!Array.isArray(input) || !input.length || input.length > 40) throw new Error("The agreement sections are invalid.");
  return input.map((section, sectionIndex) => {
    if (!section || typeof section !== "object") throw new Error("The agreement sections are invalid.");
    const source = section as { title?: unknown; paragraphs?: unknown };
    const title = typeof source.title === "string" ? source.title.trim().slice(0, 180) : "";
    if (!title || !Array.isArray(source.paragraphs) || !source.paragraphs.length || source.paragraphs.length > 40) {
      throw new Error(`Agreement section ${sectionIndex + 1} is incomplete.`);
    }
    const paragraphs = source.paragraphs.map((paragraph, paragraphIndex) => {
      if (!paragraph || typeof paragraph !== "object") throw new Error(`Agreement paragraph ${paragraphIndex + 1} is invalid.`);
      const item = paragraph as { id?: unknown; text?: unknown };
      const text = typeof item.text === "string" ? item.text.trim().slice(0, 12_000) : "";
      const id = typeof item.id === "string" && item.id.trim()
        ? item.id.trim().slice(0, 160)
        : `section-${sectionIndex + 1}-paragraph-${paragraphIndex + 1}`;
      if (!text) throw new Error(`Agreement paragraph ${paragraphIndex + 1} is empty.`);
      return { id, text };
    });
    return { title, paragraphs };
  });
}

export function personalizeAgreementSections(base: readonly AgreementSection[], pricing: AgreementPricing): AgreementSection[] {
  const plan = buildPaymentPlan({
    startsOn: pricing.startsOn,
    endsOn: pricing.endsOn,
    registrationFeeAgorot: pricing.registrationFeeAgorot,
    monthlyFeeAgorot: pricing.monthlyFeeAgorot,
    juneFeeAgorot: pricing.juneFeeAgorot,
    dueDay: pricing.paymentDueDay,
    monthOverrides: pricing.monthOverrides,
    oneTimeAmountAgorot: pricing.oneTimeAmountAgorot,
  });
  const totalAgorot = plan.reduce((sum, period) => sum + period.amountDueAgorot, 0);
  const planSummary = plan.map((period) => `${period.label}: ${shekels(period.amountDueAgorot)}₪`).join("; ");
  const methods = pricing.paymentMethodLabels?.length ? pricing.paymentMethodLabels.join("\n") : "The payment method selected during registration";

  const weekdays = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const weekday = weekdays[pricing.scheduleWeekday] || "Wednesdays";
  const weekdaySingular = weekday.replace(/s$/, "");
  const formatDate = (input: string, monthOnlyOnFirst = false) => {
    const date = new Date(`${input}T12:00:00Z`);
    return new Intl.DateTimeFormat("en-US", { month: "long", ...(monthOnlyOnFirst && date.getUTCDate() === 1 ? {} : { day: "numeric" }), year: "numeric", timeZone: "UTC" }).format(date);
  };
  const displayTime = (input: string) => {
    const [hour, minute] = input.split(":").map(Number);
    const clockHour = (hour || 0) % 12 || 12;
    return `${clockHour}:${String(minute || 0).padStart(2, "0")} ${hour >= 12 ? "p.m." : "a.m."}`;
  };

  return base.map((section) => {
    if (section.title === "Schedule" || section.title === "Schedule Terms") {
      return {
        title: section.title,
        paragraphs: section.paragraphs.map((paragraph) => {
          if (paragraph.id === "schedule-calendar") return { ...paragraph, text: `We follow the Israeli public school calendar for the ${pricing.schoolYearName} school year: choir meets every ${weekdaySingular} that school is in session, from ${formatDate(pricing.startsOn, true)} until ${formatDate(pricing.endsOn)} (no regular sessions after that date).` };
          if (paragraph.id === "schedule-dates") return { ...paragraph, text: `The choir year runs from ${formatDate(pricing.startsOn, true)} through ${formatDate(pricing.endsOn)}.` };
          if (paragraph.id === "schedule-school-closure") return { ...paragraph, text: `If there is no school on a ${weekdaySingular} - including a last-minute closure for any reason, security situations included - there is no choir that day. Individual cancelled sessions are not refunded, and the monthly fee stays the same as long as at least one session takes place that month. If a whole calendar month passes with no sessions at all, that month is simply free.` };
          return { ...paragraph };
        }),
      };
    }
    if (section.title === "Session Length & Group Times") {
      return {
        title: section.title,
        paragraphs: section.paragraphs.map((paragraph) => paragraph.id === "schedule-length-groups" ? { ...paragraph, text: `Sessions are ${pricing.sessionLengthMinutes} minutes, on ${weekday} between ${displayTime(pricing.scheduleStartTime)} and ${displayTime(pricing.scheduleEndTime)}. We share each group’s exact time once registration closes, so the girls land in the groups that fit their ages best. We can’t wait to open with a wonderful group of girls, b’ezrat Hashem - and in the unlikely case we do not reach the minimum number needed to run the program this year, every payment is returned in full.` } : { ...paragraph }),
      };
    }
    if (section.title === "Location") {
      return { title: section.title, paragraphs: section.paragraphs.map((paragraph) => paragraph.id === "location" ? { ...paragraph, text: `Choir Chug sessions take place at ${pricing.location} - your daughter’s exact location arrives together with her group placement.` } : { ...paragraph }) };
    }
    if (section.title !== "Payment Terms") return { title: section.title, paragraphs: section.paragraphs.map((paragraph) => ({ ...paragraph })) };
    const generatedIds = new Set(["payment-registration-fee", "payment-monthly", "payment-june", "payment-total", "payment-first-month", "payment-security-check", "payment-schedule", "payment-methods", "payment-private-arrangement"]);
    const preservedParagraphs = section.paragraphs.filter((paragraph) => !generatedIds.has(paragraph.id) && !["payment-cash", "payment-bank"].includes(paragraph.id)).map((paragraph) => ({ ...paragraph }));
    const customIntroduction = pricing.customLabel
      ? [{ id: "payment-private-arrangement", text: `This registration uses the private fee arrangement “${pricing.customLabel}”. The amounts shown below are the amounts that apply to this registration.` }]
      : [];
    const registrationFeeParagraphs = pricing.registrationFeeAgorot > 0
      ? [{ id: "payment-registration-fee", text: `Registration fee: a one-time ${shekels(pricing.registrationFeeAgorot)}₪ that secures your daughter’s place. It is paid now, at registration, and is separate from the monthly fees below.` }]
      : [];
    return {
      title: section.title,
      paragraphs: [
        ...customIntroduction,
        ...registrationFeeParagraphs,
        { id: "payment-monthly", text: `Monthly cost: ${shekels(pricing.monthlyFeeAgorot)}₪ per girl.` },
        { id: "payment-june", text: `June: ${shekels(pricing.juneFeeAgorot)}₪.` },
        { id: "payment-total", text: `Total for this choir year’s payment schedule: ${shekels(totalAgorot)}₪ per girl${pricing.registrationFeeAgorot > 0 ? ", including the registration fee" : ""}.` },
        { id: "payment-first-month", text: "The first month of choir is your trial month. From the second month, participation becomes a commitment for the rest of the choir year: it can no longer be cancelled, and the monthly payments continue through the end. If your daughter misses a session by choice there is no refund or makeup, and if we ever need to move a session we will arrange a makeup when possible." },
        { id: "payment-security-check", text: `Alongside the monthly payments, we ask for one security check covering the ${pricing.securityCheckMonths} balance. The security check amount is ${shekels(pricing.securityCheckAgorot)}₪. It is a safety net only - never used unless an agreed payment stays unpaid, and we will always speak with you first.` },
        { id: "payment-schedule", text: `Payment schedule: ${planSummary}.` },
        { id: "payment-methods", text: `Payment options:\n${methods}` },
        ...preservedParagraphs,
        ...section.paragraphs.filter((paragraph) => ["payment-cash", "payment-bank"].includes(paragraph.id)).map((paragraph) => ({ ...paragraph })),
      ],
    };
  });
}
