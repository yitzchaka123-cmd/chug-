export type PaymentPlanInput = {
  startsOn: string;
  endsOn: string;
  registrationFeeAgorot: number;
  monthlyFeeAgorot: number;
  juneFeeAgorot: number;
  dueDay?: number;
  monthOverrides?: Record<string, number>;
  oneTimeAmountAgorot?: number;
};

export type PaymentPeriod = {
  periodKey: string;
  label: string;
  dueOn: string;
  amountDueAgorot: number;
  kind: "registration" | "monthly" | "adjustment";
};

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function clampDueDate(year: number, monthIndex: number, dueDay: number) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return `${monthKey(year, monthIndex)}-${String(Math.min(Math.max(dueDay, 1), last)).padStart(2, "0")}`;
}

export function buildPaymentPlan(input: PaymentPlanInput): PaymentPeriod[] {
  const start = new Date(`${input.startsOn.slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${input.endsOn.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return [];
  const dueDay = Number.isInteger(input.dueDay) ? input.dueDay! : 20;
  const result: PaymentPeriod[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  let index = 0;

  // The registration fee is a separate one-time charge, due at registration and
  // additional to every monthly fee.
  const registrationFeeAgorot = Math.max(0, Math.round(input.registrationFeeAgorot));
  if (registrationFeeAgorot > 0) {
    result.push({
      periodKey: `${monthKey(year, month)}-registration`,
      label: "Registration fee",
      dueOn: input.startsOn.slice(0, 10),
      amountDueAgorot: registrationFeeAgorot,
      kind: "registration",
    });
  }

  while (year < end.getUTCFullYear() || (year === end.getUTCFullYear() && month <= end.getUTCMonth())) {
    const key = monthKey(year, month);
    const override = input.monthOverrides?.[key];
    const standard = month === 5 ? input.juneFeeAgorot : input.monthlyFeeAgorot;
    result.push({
      periodKey: key,
      label: monthNames[month],
      dueOn: clampDueDate(year, month, dueDay),
      amountDueAgorot: typeof override === "number" ? Math.max(0, Math.round(override)) : Math.max(0, Math.round(standard)),
      kind: "monthly",
    });
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
    index += 1;
    if (index > 24) break;
  }
  if (input.oneTimeAmountAgorot) {
    result.push({
      periodKey: `${result[0]?.periodKey || monthKey(start.getUTCFullYear(), start.getUTCMonth())}-adjustment`,
      label: "One-time adjustment",
      dueOn: result[0]?.dueOn || input.startsOn,
      amountDueAgorot: Math.round(input.oneTimeAmountAgorot),
      kind: "adjustment",
    });
  }
  return result;
}

