"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { holidaysForHebrewDate } from "@/lib/calendar";
import { candleLightingTime, shabbatEndTime } from "@/lib/zmanim";
import { choirConfig } from "../../site-config";

type ScheduleData = {
  year: { id: string; name: string; startsOn?: string; endsOn?: string };
  group: { id: string; name: string; startTime: string | null; endTime: string | null; location: string | null } | null;
  announcement: { title: string | null; body: string | null; updatedAt: string | null } | null;
  announcementHistory: Array<{ id: string; title: string | null; body: string; createdAt: string }>;
  month: string;
  events: Array<{ id: string; kind: string; title_en: string; title_he: string | null; starts_at: string; ends_at: string | null; location: string | null; note: string | null; status: string; date: string; labels: { hebrewEn: string; hebrewHe: string }; holiday: { en: string; he: string } | null }>;
  next: { id: string; title_en: string; starts_at: string; ends_at: string | null; location: string | null } | null;
};

function addMonth(value: string, amount: number) {
  const date = new Date(`${value}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export default function ParentSchedule({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [printSize, setPrintSize] = useState<"A4" | "A5">("A4");
  const [printing, setPrinting] = useState(false);

  useEffect(() => { params.then((value) => setToken(value.token)); }, [params]);
  useEffect(() => {
    if (!token) return;
    fetch(`/api/schedule/${encodeURIComponent(token)}?month=${month}`, { cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async (response) => {
        const result = await response.json() as ScheduleData & { error?: string };
        if (!response.ok) throw new Error(result.error || "Schedule could not be loaded.");
        return result;
      })
      .then((result) => { setError(""); setData(result); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Schedule could not be loaded."));
  }, [token, month]);

  const hebrewShort = useMemo(() => new Intl.DateTimeFormat("he-u-ca-hebrew", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" }), []);
  const hebrewParts = useMemo(() => new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", timeZone: "Asia/Jerusalem" }), []);
  const today = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date()), []);

  const cells = useMemo(() => {
    const first = new Date(`${month}-01T12:00:00Z`);
    const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const result: Array<{ key: string; date: string; day: number; weekday: number; hebrew: string; holidays: Array<{ en: string; he: string }>; shabbat: string; event?: ScheduleData["events"][number] }> = [];
    for (let i = 0; i < first.getUTCDay(); i += 1) result.push({ key: `blank-${i}`, date: "", day: 0, weekday: i, hebrew: "", holidays: [], shabbat: "" });
    for (let day = 1; day <= count; day += 1) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const moment = new Date(`${date}T12:00:00+03:00`);
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const parts = hebrewParts.formatToParts(moment);
      const { jewish, israeli } = holidaysForHebrewDate(Number(parts.find((part) => part.type === "day")?.value || 0), parts.find((part) => part.type === "month")?.value || "");
      let shabbat = "";
      if (weekday === 5) { const candles = candleLightingTime(date); if (candles) shabbat = `🕯 ${candles}`; }
      if (weekday === 6) { const ends = shabbatEndTime(date); shabbat = ends ? `Shabbat ends ${ends}` : "Shabbat"; }
      result.push({
        key: date,
        date,
        day,
        weekday,
        hebrew: hebrewShort.format(moment),
        holidays: [jewish, israeli].filter(Boolean) as Array<{ en: string; he: string }>,
        shabbat,
        event: data?.events.find((event) => event.date === date),
      });
    }
    return result;
  }, [month, data, hebrewShort, hebrewParts]);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00Z`));

  const currentUpdate = data?.announcement && data.announcement.body ? data.announcement : null;
  const pastUpdates = useMemo(() => {
    const history = data?.announcementHistory || [];
    if (currentUpdate && history[0] && history[0].body === currentUpdate.body && (history[0].title || null) === (currentUpdate.title || null)) return history.slice(1);
    return history;
  }, [data, currentUpdate]);

  async function printYearCalendar() {
    if (!token || printing) return;
    setPrinting(true);
    try {
      const response = await fetch(`/api/schedule/${encodeURIComponent(token)}?scope=year`, { cache: "no-store", referrerPolicy: "no-referrer" });
      const result = await response.json() as ScheduleData & { error?: string };
      if (!response.ok) throw new Error(result.error || "The yearly calendar could not be loaded.");
      const startsOn = result.year.startsOn || `${new Date().getUTCFullYear()}-09-01`;
      const endsOn = result.year.endsOn || `${new Date().getUTCFullYear() + 1}-06-30`;
      const eventsByDate = new Map(result.events.map((event) => [event.date, event]));
      const partsFormatter = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", timeZone: "Asia/Jerusalem" });
      const hebrewFormatter = new Intl.DateTimeFormat("he-u-ca-hebrew", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" });
      const monthTitle = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

      const monthsHtml: string[] = [];
      const cursor = new Date(`${startsOn.slice(0, 7)}-01T12:00:00Z`);
      const last = new Date(`${endsOn.slice(0, 7)}-01T12:00:00Z`);
      let guard = 0;
      while (cursor <= last && guard < 14) {
        guard += 1;
        const monthKey = cursor.toISOString().slice(0, 7);
        const dayCount = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
        const lead = cursor.getUTCDay();
        const cellsHtml: string[] = [];
        for (let blank = 0; blank < lead; blank += 1) cellsHtml.push('<div class="cell blank"></div>');
        for (let day = 1; day <= dayCount; day += 1) {
          const date = `${monthKey}-${String(day).padStart(2, "0")}`;
          const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
          const moment = new Date(`${date}T12:00:00+03:00`);
          const parts = partsFormatter.formatToParts(moment);
          const hebrewDay = Number(parts.find((part) => part.type === "day")?.value || 0);
          const hebrewMonth = parts.find((part) => part.type === "month")?.value || "";
          const { jewish, israeli } = holidaysForHebrewDate(hebrewDay, hebrewMonth);
          const event = eventsByDate.get(date);
          const rows: string[] = [];
          if (event) {
            const time = `${event.starts_at.slice(11, 16)}${event.ends_at ? `–${event.ends_at.slice(11, 16)}` : ""}`;
            if (event.status === "cancelled") rows.push(`<div class="session cancelled">No choir</div>`);
            else rows.push(`<div class="session">Choir<br><span>${escapeHtml(time)}</span></div>`);
            if (event.note) rows.push(`<div class="note">${escapeHtml(event.note)}</div>`);
          }
          if (jewish) rows.push(`<div class="holiday">${escapeHtml(jewish.en)} · <bdi dir="rtl">${escapeHtml(jewish.he)}</bdi></div>`);
          if (israeli) rows.push(`<div class="holiday">${escapeHtml(israeli.en)} · <bdi dir="rtl">${escapeHtml(israeli.he)}</bdi></div>`);
          if (weekday === 5) { const candles = candleLightingTime(date); if (candles) rows.push(`<div class="shabbat">🕯 ${escapeHtml(candles)}</div>`); }
          if (weekday === 6) { const ends = shabbatEndTime(date); rows.push(`<div class="shabbat">Shabbat${ends ? ` · ends ${escapeHtml(ends)}` : ""}</div>`); }
          cellsHtml.push(`<div class="cell${event ? (event.status === "cancelled" ? " off" : " on") : ""}${weekday === 6 ? " shabbat-day" : ""}"><div class="corner"><b>${day}</b><i>${escapeHtml(hebrewFormatter.format(moment))}</i></div>${rows.join("")}</div>`);
        }
        monthsHtml.push(`<section class="month"><h2>${escapeHtml(monthTitle.format(cursor))}</h2><div class="grid"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>${cellsHtml.join("")}</div></section>`);
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }

      const groupLine = [result.group?.name, result.group?.startTime && result.group?.endTime ? `${result.group.startTime}–${result.group.endTime}` : "", result.group?.location || ""].filter(Boolean).join(" · ");
      const compact = printSize === "A5";
      const win = window.open("", "_blank");
      if (!win) { setError("Allow pop-ups to print the calendar."); return; }
      win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(result.group?.name || "Choir Chug")} · ${escapeHtml(result.year.name)}</title><style>
        @page { size: ${printSize}; margin: ${compact ? "8mm" : "12mm"}; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Georgia, "Times New Roman", serif; color: #3d2228; }
        header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #8f1838; padding-bottom: 8px; margin-bottom: 10px; }
        header img { height: ${compact ? "34px" : "46px"}; }
        header h1 { margin: 0; font-size: ${compact ? "1rem" : "1.3rem"}; color: #641126; }
        header p { margin: 2px 0 0; font-size: ${compact ? ".62rem" : ".78rem"}; color: #7a5a61; }
        .month { break-inside: avoid; margin-bottom: ${compact ? "8px" : "12px"}; }
        .month h2 { margin: 0 0 4px; font-size: ${compact ? ".8rem" : "1rem"}; color: #641126; }
        .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1.5px; }
        .grid > span { font-size: ${compact ? ".5rem" : ".6rem"}; font-weight: 700; text-align: center; color: #9b7d84; padding: 1px 0; }
        .cell { position: relative; min-height: ${compact ? "34px" : "52px"}; border: 0.6px solid #d9c3c8; border-radius: 3px; padding: ${compact ? "9px 2px 2px" : "13px 3px 3px"}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; text-align: center; overflow: hidden; }
        .cell.blank { border: 0; }
        .cell.on { background: #f6e7ea; border-color: #8f1838; }
        .cell.off { background: #f3f3f3; }
        .cell.shabbat-day { background: #fbf6ee; }
        .corner { position: absolute; top: 1px; left: 3px; right: 3px; display: flex; justify-content: space-between; align-items: baseline; }
        .corner b { font-size: ${compact ? ".55rem" : ".7rem"}; }
        .corner i { font-style: normal; font-size: ${compact ? ".4rem" : ".5rem"}; color: #9b7d84; }
        .session { font-size: ${compact ? ".62rem" : ".92rem"}; font-weight: 800; line-height: 1.05; color: #641126; }
        .session span { font-size: ${compact ? ".55rem" : ".8rem"}; font-weight: 700; }
        .session.cancelled { color: #8a8a8a; text-decoration: line-through; font-size: ${compact ? ".55rem" : ".75rem"}; }
        .note { font-size: ${compact ? ".42rem" : ".55rem"}; color: #7a5a61; line-height: 1.1; }
        .holiday { font-size: ${compact ? ".42rem" : ".55rem"}; color: #8f1838; font-weight: 700; line-height: 1.1; }
        .shabbat { font-size: ${compact ? ".42rem" : ".55rem"}; color: #6d5a2f; line-height: 1.1; }
        footer { margin-top: 8px; font-size: ${compact ? ".55rem" : ".68rem"}; color: #7a5a61; display: flex; justify-content: space-between; gap: 10px; }
      </style></head><body>
      <header><img src="${escapeHtml(`${window.location.origin}/choir-chug-logo-transparent.png`)}" alt="The Choir Chug"><div><h1>${escapeHtml(result.group?.name || "The Choir Chug")} · ${escapeHtml(result.year.name)}</h1><p>${escapeHtml(groupLine || "Weekly choir schedule")}</p></div></header>
      ${monthsHtml.join("")}
      <footer><span>Candle lighting 18 min before sunset and Shabbat end times are for Beit Shemesh.</span><span>Questions? ${escapeHtml(choirConfig.brand.phone)}</span></footer>
      <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 250); });</script>
      </body></html>`);
      win.document.close();
      win.focus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The yearly calendar could not be printed.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <main className="parent-schedule-shell">
      <header className="parent-schedule-header"><Link href="/"><img src={choirConfig.brand.logo} alt="The Choir Chug" /></Link><span>Private parent schedule</span></header>
      {error ? <section className="schedule-error"><h1>Schedule unavailable</h1><p>{error}</p><a href={`tel:+972535906149`}>Call {choirConfig.brand.phone}</a></section> : !data ? <section className="schedule-loading">Loading schedule…</section> : (
        <>
          <section className="schedule-hero"><p className="eyebrow">{data.year.name}</p><h1>{data.group?.name || "Group schedule"}</h1>{data.group ? <p>{[data.group.startTime && data.group.endTime ? `${data.group.startTime}–${data.group.endTime}` : "", data.group.location || ""].filter(Boolean).join(" · ")}</p> : <p>Your group schedule is being prepared. This same private link will update automatically after group placement.</p>}</section>
          <div className="schedule-body">
            <div className="schedule-main">
              {data.group ? <section className="parent-calendar">
                <div className="calendar-toolbar"><button onClick={() => setMonth(addMonth(month, -1))} aria-label="Previous month">←</button><h2>{monthLabel}</h2><button onClick={() => setMonth(addMonth(month, 1))} aria-label="Next month">→</button></div>
                <div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}><b>{day.charAt(0)}</b><i>{day}</i></span>)}</div>
                <div className="calendar-grid">{cells.map((cell) => {
                  if (!cell.date) return <article key={cell.key} className="calendar-cell empty" />;
                  const cancelled = cell.event?.status === "cancelled";
                  const classes = ["calendar-cell"];
                  if (cell.event) classes.push(cancelled ? "is-cancelled" : "has-event");
                  if (cell.weekday === 6) classes.push("is-shabbat");
                  if (cell.date === today) classes.push("is-today");
                  return <article key={cell.key} className={classes.join(" ")}>
                    <header><strong>{cell.day}</strong><span lang="he" dir="rtl">{cell.hebrew}</span></header>
                    <div className="calendar-cell-body">
                      {cell.event && (cancelled ? <p className="cell-session cancelled">No choir</p> : <p className="cell-session"><b>{cell.event.starts_at.slice(11, 16)}</b>{cell.event.ends_at && <i>until {cell.event.ends_at.slice(11, 16)}</i>}<span>{cell.event.title_en}</span></p>)}
                      {cell.holidays.map((holiday) => <p key={holiday.en} className="cell-holiday">{holiday.en}</p>)}
                      {cell.shabbat && <p className="cell-shabbat">{cell.shabbat}</p>}
                      {cell.event?.note && <p className="cell-note">{cell.event.note}</p>}
                    </div>
                  </article>;
                })}</div>
                <p className="calendar-legend"><span className="legend-dot" /> Choir session · candle lighting and Shabbat end times are for Beit Shemesh.</p>
              </section> : <section className="parent-calendar calendar-pending"><h2>Calendar coming soon</h2><p>Your daughter&rsquo;s group has not been set yet. The calendar appears here as soon as she is placed - this same link keeps working.</p></section>}
            </div>
            <aside className="schedule-side">
              <section className="schedule-updates">
                <div className="schedule-updates-head"><strong>Live updates</strong>{pastUpdates.length > 0 && <button type="button" onClick={() => setShowHistory((current) => !current)}>{showHistory ? "Hide history" : "View history"}</button>}</div>
                {currentUpdate ? <article className="schedule-update-current"><h3>{currentUpdate.title || "Update"}</h3><p>{currentUpdate.body}</p>{currentUpdate.updatedAt && <small>{new Date(currentUpdate.updatedAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</small>}</article> : <p className="schedule-update-empty">No current live updates. New updates will appear here first.</p>}
                {showHistory && <div className="schedule-update-history">{pastUpdates.map((update) => <article key={update.id}><h4>{update.title || "Update"}</h4><p>{update.body}</p><small>{new Date(update.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</small></article>)}{pastUpdates.length === 0 && <p className="schedule-update-empty">No earlier updates.</p>}</div>}
              </section>
              {data.next && <section className="schedule-announcement"><strong>Next session</strong><p>{new Date(`${data.next.starts_at.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p><b>{data.next.starts_at.slice(11, 16)}{data.next.ends_at ? `–${data.next.ends_at.slice(11, 16)}` : ""}</b>{data.next.location && <small>{data.next.location}</small>}</section>}
              {data.group && <section className="schedule-list">
                <h2>{monthLabel} sessions</h2>
                {data.events.length ? <ol>{data.events.map((event) => <li key={event.id} className={event.status === "cancelled" ? "cancelled" : ""}>
                  <span className="list-date"><b>{new Date(`${event.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric" })}</b><i>{new Date(`${event.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short" })}</i></span>
                  <span className="list-body"><strong>{event.status === "cancelled" ? "No choir" : `${event.starts_at.slice(11, 16)}${event.ends_at ? `–${event.ends_at.slice(11, 16)}` : ""}`}</strong><small>{event.labels.hebrewEn}{event.location ? ` · ${event.location}` : ""}</small>{event.holiday && <small className="list-holiday">{event.holiday.en} · <span lang="he" dir="rtl">{event.holiday.he}</span></small>}{event.note && <em>{event.note}</em>}</span>
                </li>)}</ol> : <p className="schedule-update-empty">No sessions are listed for this month.</p>}
              </section>}
              {data.group && <section className="calendar-print-row"><label><span>Paper</span><select value={printSize} onChange={(event) => setPrintSize(event.target.value === "A5" ? "A5" : "A4")}><option value="A4">A4</option><option value="A5">A5</option></select></label><button type="button" disabled={printing} onClick={() => void printYearCalendar()}>{printing ? "Preparing…" : "Print yearly calendar"}</button></section>}
            </aside>
          </div>
        </>
      )}
      <footer className="parent-schedule-footer"><span>Schedule changes appear here live.</span><a href={`tel:+972535906149`}>{choirConfig.brand.phone}</a></footer>
    </main>
  );
}
