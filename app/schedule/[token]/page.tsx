"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { choirConfig } from "../../site-config";

type ScheduleData = {
  year: { id: string; name: string };
  group: { id: string; name: string; startTime: string | null; endTime: string | null; location: string | null } | null;
  announcement: { title: string | null; body: string | null; updatedAt: string | null } | null;
  month: string;
  events: Array<{ id: string; kind: string; title_en: string; title_he: string | null; starts_at: string; ends_at: string | null; location: string | null; note: string | null; status: string; date: string; labels: { hebrewEn: string; hebrewHe: string }; holiday: { en: string; he: string } | null }>;
  next: { id: string; title_en: string; starts_at: string; ends_at: string | null; location: string | null } | null;
};

function addMonth(value: string, amount: number) {
  const date = new Date(`${value}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

export default function ParentSchedule({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState("");

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

  const cells = useMemo(() => {
    const first = new Date(`${month}-01T12:00:00Z`);
    const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const result: Array<{ date: string; day: number; event?: ScheduleData["events"][number] }> = [];
    for (let i = 0; i < first.getUTCDay(); i += 1) result.push({ date: "", day: 0 });
    for (let day = 1; day <= count; day += 1) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      result.push({ date, day, event: data?.events.find((event) => event.date === date) });
    }
    return result;
  }, [month, data]);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00Z`));

  return (
    <main className="parent-schedule-shell">
      <header className="parent-schedule-header"><Link href="/"><img src={choirConfig.brand.logo} alt="The Choir Chug" /></Link><span>Private parent schedule</span></header>
      {error ? <section className="schedule-error"><h1>Schedule unavailable</h1><p>{error}</p><a href={`tel:+972535906149`}>Call {choirConfig.brand.phone}</a></section> : !data ? <section className="schedule-loading">Loading schedule…</section> : (
        <>
          <section className="schedule-hero"><p className="eyebrow">{data.year.name}</p><h1>{data.group?.name || "Group schedule"}</h1>{data.group ? <p>{[data.group.startTime && data.group.endTime ? `${data.group.startTime}–${data.group.endTime}` : "", data.group.location || ""].filter(Boolean).join(" · ")}</p> : <p>Your group schedule is being prepared. This same private link will update automatically after group placement.</p>}</section>
          {data.announcement && <section className="schedule-announcement"><strong>{data.announcement.title || "Update"}</strong>{data.announcement.body && <p>{data.announcement.body}</p>}</section>}
          {data.next && <section className="schedule-announcement"><strong>Next session</strong><p>{new Date(`${data.next.starts_at.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · {data.next.starts_at.slice(11, 16)}{data.next.ends_at ? `–${data.next.ends_at.slice(11, 16)}` : ""}{data.next.location ? ` · ${data.next.location}` : ""}</p></section>}
          {data.group && <section className="parent-calendar">
            <div className="calendar-toolbar"><button onClick={() => setMonth(addMonth(month, -1))} aria-label="Previous month">←</button><h2>{monthLabel}</h2><button onClick={() => setMonth(addMonth(month, 1))} aria-label="Next month">→</button></div>
            <div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">{cells.map((cell, index) => <article key={`${cell.date}-${index}`} className={!cell.date ? "calendar-cell empty" : cell.event ? "calendar-cell has-event" : "calendar-cell"}>{cell.date && <><strong>{cell.day}</strong>{cell.event && <div><b>{cell.event.status === "cancelled" ? "Cancelled" : cell.event.title_en}</b><small>{cell.event.labels.hebrewEn}</small>{cell.event.holiday && <small>{cell.event.holiday.en} · <span lang="he" dir="rtl">{cell.event.holiday.he}</span></small>}{cell.event.note && <p>{cell.event.note}</p>}</div>}</>}</article>)}</div>
            <div className="schedule-list"><h2>Month details</h2>{data.events.length ? data.events.map((event) => <article key={event.id}><time>{new Date(`${event.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</time><h3>{event.title_en}{event.title_he && <span lang="he" dir="rtl"> · {event.title_he}</span>}</h3><p>{event.labels.hebrewEn} · <span lang="he" dir="rtl">{event.labels.hebrewHe}</span></p>{event.holiday && <p>{event.holiday.en} · <span lang="he" dir="rtl">{event.holiday.he}</span></p>}<p>{event.starts_at.slice(11, 16)}{event.ends_at ? `–${event.ends_at.slice(11, 16)}` : ""}{event.location ? ` · ${event.location}` : ""}</p>{event.note && <blockquote>{event.note}</blockquote>}</article>) : <p>No sessions or updates are listed for this month.</p>}</div>
          </section>}
        </>
      )}
      <footer className="parent-schedule-footer"><span>Schedule changes appear here live.</span><a href={`tel:+972535906149`}>{choirConfig.brand.phone}</a></footer>
    </main>
  );
}
