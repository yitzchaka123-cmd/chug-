// The days a family can offer for the choir. Friday and Saturday are never
// offered, so the list is deliberately Sunday to Thursday only.
export const availableDayOptions = [
  { key: "sun", label: "Sunday", short: "Sun", weekday: 0 },
  { key: "mon", label: "Monday", short: "Mon", weekday: 1 },
  { key: "tue", label: "Tuesday", short: "Tue", weekday: 2 },
  { key: "wed", label: "Wednesday", short: "Wed", weekday: 3 },
  { key: "thu", label: "Thursday", short: "Thu", weekday: 4 },
] as const;

export type AvailableDayKey = (typeof availableDayOptions)[number]["key"];

const keys = availableDayOptions.map((option) => option.key) as readonly string[];

/**
 * Accepts whatever the registration form sent - an array of keys or a stored
 * comma-separated string - and returns the keys in a fixed order, so two
 * families who chose the same days always produce the same stored value.
 */
export function normalizeWeekdays(value: unknown): string {
  const supplied = Array.isArray(value)
    ? value
    : typeof value === "string" ? value.split(",") : [];
  const chosen = new Set(supplied.map((item) => String(item).trim().toLowerCase()).filter((item) => keys.includes(item)));
  return availableDayOptions.filter((option) => chosen.has(option.key)).map((option) => option.key).join(",");
}

export function formatWeekdays(value: string | null | undefined, style: "short" | "long" = "short") {
  const chosen = normalizeWeekdays(value || "");
  if (!chosen) return "";
  const set = new Set(chosen.split(","));
  return availableDayOptions.filter((option) => set.has(option.key)).map((option) => style === "short" ? option.short : option.label).join(", ");
}
