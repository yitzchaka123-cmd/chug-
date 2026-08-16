import { dateLabels, holidayForDate } from "@/lib/calendar";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { hashOpaqueToken } from "@/lib/security";

export const dynamic = "force-dynamic";

type AccessRow = {
  group_id: string | null;
  school_year_id: string;
  year_name: string;
  group_name: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  announcement_title: string | null;
  announcement_body: string | null;
  announcement_updated_at: string | null;
};

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const runtime = getRuntimeEnv();
    const { token } = await context.params;
    if (!token || token.length > 300) return Response.json({ error: "Schedule link not found." }, { status: 404 });
    const tokenHash = await hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET);
    let access = await runtime.DB.prepare(`
      SELECT g.id AS group_id, g.school_year_id, sy.name AS year_name, g.name AS group_name,
        g.start_time, g.end_time, g.location, g.announcement_title, g.announcement_body, g.announcement_updated_at
      FROM groups g JOIN school_years sy ON sy.id = g.school_year_id
      WHERE g.share_token_hash = ? AND g.status = 'active' LIMIT 1
    `).bind(tokenHash).first<AccessRow>();
    if (!access) {
      access = await runtime.DB.prepare(`
        SELECT e.group_id, e.school_year_id, sy.name AS year_name, g.name AS group_name,
          g.start_time, g.end_time, g.location, g.announcement_title, g.announcement_body, g.announcement_updated_at
        FROM enrollments e JOIN school_years sy ON sy.id = e.school_year_id
        LEFT JOIN groups g ON g.id = e.group_id
        WHERE e.schedule_token_hash = ? AND e.status = 'active' LIMIT 1
      `).bind(tokenHash).first<AccessRow>();
    }
    if (!access) return Response.json({ error: "This private schedule link is invalid or has been reset." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const url = new URL(request.url);
    const nowMonth = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Jerusalem" }).format(new Date()).slice(0, 7);
    const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month")! : nowMonth;
    const yearScope = url.searchParams.get("scope") === "year";
    const yearRange = yearScope ? await runtime.DB.prepare(`SELECT starts_on, ends_on FROM school_years WHERE id = ? LIMIT 1`).bind(access.school_year_id).first<{ starts_on: string; ends_on: string }>() : null;
    const start = yearRange ? `${yearRange.starts_on}T00:00` : `${month}-01T00:00`;
    const endDate = new Date(`${month}-01T12:00:00Z`);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    const end = yearRange ? `${yearRange.ends_on}T23:59` : `${endDate.toISOString().slice(0, 10)}T00:00`;
    const events = access.group_id ? await runtime.DB.prepare(`
      SELECT id, kind, title_en, title_he, starts_at, ends_at, location, note, status
      FROM schedule_events WHERE school_year_id = ? AND group_id = ? AND starts_at >= ? AND starts_at < ?
      ORDER BY starts_at
    `).bind(access.school_year_id, access.group_id, start, end).all<{ id: string; kind: string; title_en: string; title_he: string | null; starts_at: string; ends_at: string | null; location: string | null; note: string | null; status: string }>() : { results: [] };
    const enriched = events.results.map((event) => {
      const date = event.starts_at.slice(0, 10);
      return { ...event, date, labels: dateLabels(date), holiday: holidayForDate(date) };
    });
    const next = access.group_id ? await runtime.DB.prepare(`
      SELECT id, kind, title_en, title_he, starts_at, ends_at, location, note, status
      FROM schedule_events WHERE group_id = ? AND starts_at >= ? AND status = 'scheduled'
      ORDER BY starts_at LIMIT 1
    `).bind(access.group_id, new Date().toISOString().slice(0, 16)).first<Record<string, unknown>>() : null;
    const history = access.group_id ? await runtime.DB.prepare(`
      SELECT id, title, body, created_at FROM group_announcements WHERE group_id = ? ORDER BY created_at DESC LIMIT 20
    `).bind(access.group_id).all<{ id: string; title: string | null; body: string; created_at: string }>() : { results: [] };
    return Response.json({
      year: { id: access.school_year_id, name: access.year_name, startsOn: yearRange?.starts_on, endsOn: yearRange?.ends_on },
      group: access.group_id ? { id: access.group_id, name: access.group_name, startTime: access.start_time, endTime: access.end_time, location: access.location } : null,
      announcement: access.announcement_title || access.announcement_body ? { title: access.announcement_title, body: access.announcement_body, updatedAt: access.announcement_updated_at } : null,
      announcementHistory: history.results.map((row) => ({ id: row.id, title: row.title, body: row.body, createdAt: row.created_at })),
      month, events: enriched, next,
    }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Schedule could not be loaded." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

