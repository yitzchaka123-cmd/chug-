// Shabbat times for Beit Shemesh, Israel, computed with the standard NOAA
// solar-position approximation (accurate to about a minute).
//
// Customs used, matching the common published luach for Beit Shemesh:
// - Candle lighting: 18 minutes before sunset.
// - Shabbat ends: the sun 8.5 degrees below the horizon (three medium stars).

const BEIT_SHEMESH_LATITUDE = 31.747;
const BEIT_SHEMESH_LONGITUDE = 34.988;
const SUNSET_ALTITUDE = -0.833;
const SHABBAT_END_ALTITUDE = -8.5;
const CANDLE_LIGHTING_MINUTES = 18;
const RADIANS = Math.PI / 180;

function julianDayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function sunEventUtcMs(date: string, altitudeDegrees: number): number | null {
  const daysSinceEpoch = julianDayNumber(date) - 2451545 + 0.0008;
  const meanSolarTime = daysSinceEpoch - BEIT_SHEMESH_LONGITUDE / 360;
  const solarMeanAnomaly = (357.5291 + 0.98560028 * meanSolarTime) % 360;
  const anomalyRadians = solarMeanAnomaly * RADIANS;
  const equationOfCenter = 1.9148 * Math.sin(anomalyRadians) + 0.02 * Math.sin(2 * anomalyRadians) + 0.0003 * Math.sin(3 * anomalyRadians);
  const eclipticLongitude = (solarMeanAnomaly + equationOfCenter + 180 + 102.9372) % 360;
  const longitudeRadians = eclipticLongitude * RADIANS;
  const solarTransit = 2451545 + meanSolarTime + 0.0053 * Math.sin(anomalyRadians) - 0.0069 * Math.sin(2 * longitudeRadians);
  const declination = Math.asin(Math.sin(longitudeRadians) * Math.sin(23.4397 * RADIANS));
  const latitudeRadians = BEIT_SHEMESH_LATITUDE * RADIANS;
  const hourAngleCosine = (Math.sin(altitudeDegrees * RADIANS) - Math.sin(latitudeRadians) * Math.sin(declination)) / (Math.cos(latitudeRadians) * Math.cos(declination));
  if (hourAngleCosine < -1 || hourAngleCosine > 1) return null;
  const hourAngle = Math.acos(hourAngleCosine) / RADIANS;
  const julianSet = solarTransit + hourAngle / 360;
  return (julianSet - 2440587.5) * 86_400_000;
}

function formatJerusalemTime(utcMs: number) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date(utcMs));
}

export function sunsetTime(date: string): string | null {
  const ms = sunEventUtcMs(date, SUNSET_ALTITUDE);
  return ms === null ? null : formatJerusalemTime(ms);
}

export function candleLightingTime(fridayDate: string): string | null {
  const ms = sunEventUtcMs(fridayDate, SUNSET_ALTITUDE);
  return ms === null ? null : formatJerusalemTime(ms - CANDLE_LIGHTING_MINUTES * 60_000);
}

export function shabbatEndTime(saturdayDate: string): string | null {
  const ms = sunEventUtcMs(saturdayDate, SHABBAT_END_ALTITUDE);
  return ms === null ? null : formatJerusalemTime(ms);
}
