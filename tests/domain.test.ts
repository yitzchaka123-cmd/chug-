import assert from "node:assert/strict";
import test from "node:test";
import { agreementSections } from "@/app/agreement-2026-2027";
import { personalizeAgreementSections } from "@/lib/agreement-content";
import { dateLabels, recurringDates } from "@/lib/calendar";
import { buildPaymentPlan } from "@/lib/payment-plan";
import { decryptJson, encryptJson, hashOpaqueToken } from "@/lib/security";

test("a custom registration arrangement changes the exact agreement snapshot", () => {
  const sections = personalizeAgreementSections(agreementSections, {
    schoolYearName: "2026–2027",
    startsOn: "2026-09-01",
    endsOn: "2027-06-15",
    registrationFeeAgorot: 15_000,
    monthlyFeeAgorot: 15_000,
    juneFeeAgorot: 5_000,
    securityCheckAgorot: 120_000,
    securityCheckMonths: "October–June",
    paymentDueDay: 20,
    monthOverrides: { "2026-10": 10_000 },
    oneTimeAmountAgorot: 3_000,
    customLabel: "Sibling arrangement",
    paymentMethodLabels: ["Standing order"],
    scheduleWeekday: 3,
    scheduleStartTime: "17:00",
    scheduleEndTime: "19:00",
    sessionLengthMinutes: 50,
    location: "Mishkafayim or RBSA",
  });
  const payment = sections.find((section) => section.title === "Payment Terms");
  assert.ok(payment);
  const text = payment.paragraphs.map((paragraph) => paragraph.text).join("\n");
  assert.match(text, /Sibling arrangement/);
  assert.match(text, /Monthly cost: 150₪/);
  assert.match(text, /Total for this choir year[^\n]+1,380₪/);
  assert.match(text, /October: 100₪/);
  assert.match(text, /Standing order/);
  assert.doesNotMatch(text, /Monthly cost: 200₪/);
});

test("school-year settings flow into schedule agreement wording", () => {
  const sections = personalizeAgreementSections(agreementSections, {
    schoolYearName: "2027–2028",
    startsOn: "2027-09-01",
    endsOn: "2028-06-20",
    registrationFeeAgorot: 20_000,
    monthlyFeeAgorot: 20_000,
    juneFeeAgorot: 10_000,
    securityCheckAgorot: 170_000,
    securityCheckMonths: "October–June",
    paymentDueDay: 20,
    paymentMethodLabels: ["Bit"],
    scheduleWeekday: 2,
    scheduleStartTime: "16:30",
    scheduleEndTime: "18:30",
    sessionLengthMinutes: 55,
    location: "Studio A",
  });
  const all = sections.flatMap((section) => section.paragraphs).map((paragraph) => paragraph.text).join("\n");
  assert.match(all, /2027–2028 school year/);
  assert.match(all, /55 minutes/);
  assert.match(all, /Tuesdays between 4:30 p\.m\. and 6:30 p\.m\./);
  assert.match(all, /at Studio A/);
});

test("payment plans cover each school-year month and honor overrides", () => {
  const plan = buildPaymentPlan({ startsOn: "2026-09-01", endsOn: "2027-06-15", registrationFeeAgorot: 20_000, monthlyFeeAgorot: 20_000, juneFeeAgorot: 10_000, monthOverrides: { "2027-01": 12_500 } });
  assert.equal(plan.length, 10);
  assert.equal(plan[0].label, "September");
  assert.equal(plan.find((period) => period.periodKey === "2027-01")?.amountDueAgorot, 12_500);
  assert.equal(plan.at(-1)?.label, "June");
});

test("Jerusalem calendar helpers provide bilingual dates and recurring weekdays", () => {
  const labels = dateLabels("2026-09-09");
  assert.match(labels.gregorianEn, /2026/);
  assert.ok(labels.gregorianHe.length > 5);
  assert.ok(labels.hebrewEn.length > 5);
  assert.ok(labels.hebrewHe.length > 5);
  const dates = recurringDates("2026-09-01", "2026-09-30", 3);
  assert.deepEqual(dates, ["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30"]);
});

test("sensitive JSON uses authenticated encryption and private tokens use keyed hashes", async () => {
  const key = "v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const secret = "a-separate-high-entropy-token-secret-for-tests";
  const encrypted = await encryptJson({ medical: "test-only", note: "private" }, key);
  assert.doesNotMatch(encrypted, /test-only/);
  assert.deepEqual(await decryptJson(encrypted, key), { medical: "test-only", note: "private" });
  assert.equal(await hashOpaqueToken("same-token", secret), await hashOpaqueToken("same-token", secret));
  assert.notEqual(await hashOpaqueToken("same-token", secret), await hashOpaqueToken("different-token", secret));
});

test("PostgreSQL placeholder translation survives quoted literals", async () => {
  const { postgresQuery, translatePlaceholders } = await import("@/lib/vercel-runtime");
  assert.equal(translatePlaceholders("SELECT * FROM t WHERE a = ? AND b = ?"), "SELECT * FROM t WHERE a = $1 AND b = $2");
  assert.equal(
    translatePlaceholders("SELECT * FROM t WHERE a LIKE ? ESCAPE '!' OR b LIKE ? ESCAPE '!'"),
    "SELECT * FROM t WHERE a LIKE $1 ESCAPE '!' OR b LIKE $2 ESCAPE '!'",
  );
  // A backslash inside a string is a literal character, not a quote escape —
  // placeholders after it must still be numbered.
  assert.equal(
    translatePlaceholders("SELECT * FROM t WHERE a LIKE ? ESCAPE '\\' OR b LIKE ? ESCAPE '\\'"),
    "SELECT * FROM t WHERE a LIKE $1 ESCAPE '\\' OR b LIKE $2 ESCAPE '\\'",
  );
  // Doubled quotes stay inside the literal; the ? inside is never rewritten.
  assert.equal(
    translatePlaceholders("SELECT 'it''s a ? mark', ? FROM t"),
    "SELECT 'it''s a ? mark', $1 FROM t",
  );
  assert.equal(
    postgresQuery("INSERT OR IGNORE INTO t (a) VALUES (?);"),
    "INSERT INTO t (a) VALUES ($1) ON CONFLICT DO NOTHING",
  );
});

test("Beit Shemesh Shabbat times are computed within sane ranges", async () => {
  const { candleLightingTime, shabbatEndTime, sunsetTime } = await import("@/lib/zmanim");
  const summerSunset = sunsetTime("2026-06-21");
  assert.ok(summerSunset && summerSunset >= "19:35" && summerSunset <= "20:05", `summer sunset ${summerSunset}`);
  const winterSunset = sunsetTime("2026-12-25");
  assert.ok(winterSunset && winterSunset >= "16:30" && winterSunset <= "17:00", `winter sunset ${winterSunset}`);
  const candles = candleLightingTime("2026-09-04");
  assert.ok(candles && candles >= "18:30" && candles <= "18:55", `candle lighting ${candles}`);
  const shabbatEnds = shabbatEndTime("2026-09-05");
  assert.ok(shabbatEnds && shabbatEnds >= "19:25" && shabbatEnds <= "19:55", `shabbat ends ${shabbatEnds}`);
  assert.ok(shabbatEnds! > candles!, "Shabbat must end after candle lighting");
});
