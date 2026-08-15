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
    if (section.title === "Schedule Terms") {
      return {
        title: section.title,
        paragraphs: section.paragraphs.map((paragraph) => {
          if (paragraph.id === "schedule-calendar") return { ...paragraph, text: `The choir will operate according to the Israeli public school calendar for the ${pricing.schoolYearName} school year, with sessions taking place every ${weekdaySingular} on days when school is in session.` };
          if (paragraph.id === "schedule-dates") return { ...paragraph, text: `The choir year will run from ${formatDate(pricing.startsOn, true)} through ${formatDate(pricing.endsOn)}. No regular Choir Chug sessions will take place after ${formatDate(pricing.endsOn)}.` };
          if (paragraph.id === "schedule-school-closure") return { ...paragraph, text: `If there is no school on a particular ${weekdaySingular}, there will be no choir session that day. This applies even if school is canceled at the last minute due to war, a national emergency, security circumstances, or any other reason.` };
          return { ...paragraph };
        }),
      };
    }
    if (section.title === "Session Length & Group Times") {
      return {
        title: section.title,
        paragraphs: section.paragraphs.map((paragraph) => paragraph.id === "schedule-length-groups" ? { ...paragraph, text: `Each Choir Chug session will be ${pricing.sessionLengthMinutes} minutes long. All groups will meet on ${weekday} between ${displayTime(pricing.scheduleStartTime)} and ${displayTime(pricing.scheduleEndTime)}. The exact time for each group will be shared with parents once registration is complete, so we can arrange the girls into the groups that fit their ages best. We will, b’ezrat Hashem, open the Choir Chug with a wonderful group of girls. If we do not reach the minimum number of girls needed to run the program, we may need to cancel the Choir Chug for this year. If that happens, all payments will be returned.` } : { ...paragraph }),
      };
    }
    if (section.title === "Location") {
      return { title: section.title, paragraphs: section.paragraphs.map((paragraph) => paragraph.id === "location" ? { ...paragraph, text: `Choir Chug sessions will take place at ${pricing.location}. The exact location for each group will be provided to parents.` } : { ...paragraph }) };
    }
    if (section.title !== "Payment Terms") return { title: section.title, paragraphs: section.paragraphs.map((paragraph) => ({ ...paragraph })) };
    const generatedIds = new Set(["payment-monthly", "payment-june", "payment-total", "payment-first-month", "payment-security-check", "payment-schedule", "payment-methods", "payment-private-arrangement"]);
    const preservedParagraphs = section.paragraphs.filter((paragraph) => !generatedIds.has(paragraph.id) && !["payment-cash", "payment-bank"].includes(paragraph.id)).map((paragraph) => ({ ...paragraph }));
    const customIntroduction = pricing.customLabel
      ? [{ id: "payment-private-arrangement", text: `This registration uses the private fee arrangement “${pricing.customLabel}”. The amounts shown below are the amounts that apply to this registration.` }]
      : [];
    return {
      title: section.title,
      paragraphs: [
        ...customIntroduction,
        { id: "payment-monthly", text: `Monthly Cost: ${shekels(pricing.monthlyFeeAgorot)}₪ per month, per girl.` },
        { id: "payment-june", text: `June: ${shekels(pricing.juneFeeAgorot)}₪.` },
        { id: "payment-total", text: `Total Cost for this Choir Year payment schedule: ${shekels(totalAgorot)}₪ per girl.` },
        { id: "payment-first-month", text: `The first payment is ${shekels(pricing.registrationFeeAgorot)}₪. After the first month, participation becomes a commitment for the remainder of the choir year, and the monthly payments must continue until the end of the choir year.` },
        { id: "payment-security-check", text: `In addition to the monthly payments, please provide a security check for the remaining ${pricing.securityCheckMonths} balance after the registration payment. The security check amount is ${shekels(pricing.securityCheckAgorot)}₪. It will be held only as security and used only if an agreed payment remains unpaid, after we contact you first.` },
        { id: "payment-schedule", text: `Payment schedule: ${planSummary}.` },
        { id: "payment-methods", text: `Payment Options:\n${methods}` },
        ...preservedParagraphs,
        ...section.paragraphs.filter((paragraph) => ["payment-cash", "payment-bank"].includes(paragraph.id)).map((paragraph) => ({ ...paragraph })),
      ],
    };
  });
}
