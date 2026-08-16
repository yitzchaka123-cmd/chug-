const JERUSALEM_TIME_ZONE = "Asia/Jerusalem";

export type HolidayLabel = { en: string; he: string };

const fixedHolidays: Record<string, HolidayLabel> = {
  "Tishri-1": { en: "Rosh Hashanah", he: "ראש השנה" },
  "Tishri-2": { en: "Rosh Hashanah", he: "ראש השנה" },
  "Tishri-10": { en: "Yom Kippur", he: "יום כיפור" },
  "Tishri-15": { en: "Sukkot", he: "סוכות" },
  "Tishri-16": { en: "Sukkot", he: "סוכות" },
  "Tishri-17": { en: "Sukkot", he: "סוכות" },
  "Tishri-18": { en: "Sukkot", he: "סוכות" },
  "Tishri-19": { en: "Sukkot", he: "סוכות" },
  "Tishri-20": { en: "Sukkot", he: "סוכות" },
  "Tishri-21": { en: "Hoshana Rabbah", he: "הושענא רבה" },
  "Tishri-22": { en: "Shemini Atzeret & Simchat Torah", he: "שמיני עצרת ושמחת תורה" },
  "Shevat-15": { en: "Tu BiShvat", he: "ט״ו בשבט" },
  "Adar-14": { en: "Purim", he: "פורים" },
  "Adar II-14": { en: "Purim", he: "פורים" },
  "Nisan-15": { en: "Passover", he: "פסח" },
  "Nisan-16": { en: "Passover", he: "פסח" },
  "Nisan-17": { en: "Passover", he: "פסח" },
  "Nisan-18": { en: "Passover", he: "פסח" },
  "Nisan-19": { en: "Passover", he: "פסח" },
  "Nisan-20": { en: "Passover", he: "פסח" },
  "Nisan-21": { en: "Passover", he: "פסח" },
  "Iyar-18": { en: "Lag BaOmer", he: "ל״ג בעומר" },
  "Sivan-6": { en: "Shavuot", he: "שבועות" },
};

function dateFromIso(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00+03:00`);
}

export function hebrewDateParts(date: string) {
  const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: JERUSALEM_TIME_ZONE,
  }).formatToParts(dateFromIso(date));
  const find = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return { day: Number(find("day")), month: find("month"), year: find("year") };
}

export function dateLabels(date: string) {
  const value = dateFromIso(date);
  return {
    gregorianEn: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: JERUSALEM_TIME_ZONE }).format(value),
    gregorianHe: new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: JERUSALEM_TIME_ZONE }).format(value),
    hebrewEn: new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: JERUSALEM_TIME_ZONE }).format(value),
    hebrewHe: new Intl.DateTimeFormat("he-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: JERUSALEM_TIME_ZONE }).format(value),
  };
}

export function holidayForDate(date: string): HolidayLabel | null {
  const parts = hebrewDateParts(date);
  if (parts.month === "Kislev" && parts.day >= 25) return { en: "Hanukkah", he: "חנוכה" };
  if (parts.month === "Tevet" && parts.day <= 2) return { en: "Hanukkah", he: "חנוכה" };
  return fixedHolidays[`${parts.month}-${parts.day}`] || null;
}

// Israeli national observances by their fixed Hebrew-calendar dates. The Knesset
// shifts some observances by a day or two around Shabbat in certain years; the
// calendar builder shows these as planning hints, so the fixed dates are used.
const israeliHolidays: Record<string, HolidayLabel> = {
  "Nisan-27": { en: "Yom HaShoah", he: "יום השואה" },
  "Iyar-4": { en: "Yom HaZikaron", he: "יום הזיכרון" },
  "Iyar-5": { en: "Yom HaAtzmaut", he: "יום העצמאות" },
  "Iyar-28": { en: "Yom Yerushalayim", he: "יום ירושלים" },
};

export function israeliHolidayForDate(date: string): HolidayLabel | null {
  const parts = hebrewDateParts(date);
  return israeliHolidays[`${parts.month}-${parts.day}`] || null;
}

// Lookup by pre-computed Hebrew date parts, so callers rendering a whole year
// can reuse one Intl formatter instead of constructing one per day.
export function holidaysForHebrewDate(day: number, month: string): { jewish: HolidayLabel | null; israeli: HolidayLabel | null } {
  let jewish: HolidayLabel | null = null;
  if (month === "Kislev" && day >= 25) jewish = { en: "Hanukkah", he: "חנוכה" };
  else if (month === "Tevet" && day <= 2) jewish = { en: "Hanukkah", he: "חנוכה" };
  else jewish = fixedHolidays[`${month}-${day}`] || null;
  return { jewish, israeli: israeliHolidays[`${month}-${day}`] || null };
}

export function dateOnly(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function recurringDates(startDate: string, endDate: string, weekday: number) {
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return [];
  const result: string[] = [];
  const current = new Date(start);
  while (current.getUTCDay() !== weekday) current.setUTCDate(current.getUTCDate() + 1);
  while (current <= end && result.length < 370) {
    result.push(dateOnly(current));
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return result;
}

export function combineLocalDateTime(date: string, time: string) {
  return `${date}T${/^\d{2}:\d{2}$/.test(time) ? time : "17:00"}`;
}

export function jerusalemNowLocal() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: JERUSALEM_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date()).replace(" ", "T");
}

// Zoneless timestamps (from datetime-local inputs) are interpreted as Israel
// local time; explicit-offset timestamps compare as instants.
export function isPastInJerusalem(value: string) {
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const instant = new Date(value).getTime();
    return Number.isFinite(instant) && instant <= Date.now();
  }
  return value.slice(0, 16) <= jerusalemNowLocal();
}

