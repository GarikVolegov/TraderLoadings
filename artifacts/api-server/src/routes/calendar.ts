import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface ForexFactoryEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: "High" | "Medium" | "Low" | "Holiday";
  forecast: string | null;
  previous: string | null;
}

let cache: { data: CalendarEvent[]; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const res = await fetch(FF_URL, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent": "TraderLoading/1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Forex Factory returned ${res.status}`);
  }

  const text = await res.text();
  let raw: ForexFactoryEvent[];
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Response is not valid JSON (possibly rate-limited)");
  }

  if (!Array.isArray(raw)) {
    throw new Error("Unexpected response format from Forex Factory");
  }

  return raw
    .filter((e) => ["High", "Medium", "Low", "Holiday"].includes(e.impact))
    .map((e) => ({
      title: e.title,
      country: e.country,
      date: e.date,
      impact: e.impact as CalendarEvent["impact"],
      forecast: e.forecast || null,
      previous: e.previous || null,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

router.get("/calendar", async (_req, res) => {
  try {
    const noCache = _req.query.nocache === "1";

    if (!noCache && cache && Date.now() - cache.ts < CACHE_TTL) {
      res.json(cache.data);
      return;
    }

    const events = await fetchCalendarEvents();
    cache = { data: events, ts: Date.now() };
    res.json(events);
  } catch (err) {
    console.error("Calendar fetch error:", err);
    if (cache) {
      res.json(cache.data);
      return;
    }
    res.status(502).json({ error: "Impossibile recuperare il calendario economico" });
  }
});

export default router;
