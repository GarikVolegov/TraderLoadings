import { Router } from "express";
import OpenAI from "openai";
import cron from "node-cron";

const router = Router();

// ─── OpenAI client ────────────────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "",
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ?? "https://api.openai.com/v1",
});

// ─── 1. MONTE CARLO ───────────────────────────────────────────────────────────
router.post("/tools/montecarlo", (req, res) => {
  const {
    winrate = 0.55,
    avgR = 1.5,
    lossR = 1,
    numTrades = 100,
    riskPercent = 1,
    initialBalance = 10000,
    simCount = 50,
  } = req.body as {
    winrate?: number;
    avgR?: number;
    lossR?: number;
    numTrades?: number;
    riskPercent?: number;
    initialBalance?: number;
    simCount?: number;
  };

  const simulations: number[][] = [];
  const finalValues: number[] = [];

  for (let s = 0; s < Math.min(simCount, 200); s++) {
    const curve: number[] = [initialBalance];
    let balance = initialBalance;

    for (let t = 0; t < numTrades; t++) {
      const win = Math.random() < winrate;
      const riskAmount = balance * (riskPercent / 100);
      balance += win ? riskAmount * avgR : -riskAmount * lossR;
      curve.push(Math.max(0, balance));
      if (balance <= 0) {
        while (curve.length <= numTrades) curve.push(0);
        break;
      }
    }

    simulations.push(curve);
    finalValues.push(curve[curve.length - 1]);
  }

  finalValues.sort((a, b) => a - b);
  const ruinCount = finalValues.filter((v) => v <= 0).length;
  const median = finalValues[Math.floor(finalValues.length / 2)];
  const p10 = finalValues[Math.floor(finalValues.length * 0.1)];
  const p90 = finalValues[Math.floor(finalValues.length * 0.9)];
  const avgReturn = ((finalValues.reduce((a, b) => a + b, 0) / finalValues.length - initialBalance) / initialBalance) * 100;

  res.json({
    simulations,
    stats: {
      median: Math.round(median),
      percentile10: Math.round(p10),
      percentile90: Math.round(p90),
      ruinProbability: ((ruinCount / simCount) * 100).toFixed(1),
      avgReturnPercent: avgReturn.toFixed(1),
      initialBalance,
    },
  });
});

// ─── 2. MYFXBOOK SENTIMENT ────────────────────────────────────────────────────

interface MyfxbookSymbol {
  name: string;
  longPercentage: number;
  shortPercentage: number;
  longVolume: number;
  shortVolume: number;
  longPositions: number;
  shortPositions: number;
}

let _mfxSession: { token: string; expiresAt: number } | null = null;

async function getMyfxbookSession(): Promise<string | null> {
  if (_mfxSession && Date.now() < _mfxSession.expiresAt) {
    return _mfxSession.token;
  }
  const email = process.env.MYFXBOOK_EMAIL;
  const password = process.env.MYFXBOOK_PASSWORD;
  if (!email || !password) return null;

  const url = `https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Myfxbook login HTTP ${res.status}`);
  const data = await res.json() as { error: boolean; message?: string; session: string };
  if (data.error || !data.session) throw new Error(data.message ?? "Login fallito");

  _mfxSession = { token: data.session, expiresAt: Date.now() + 55 * 60 * 1000 };
  console.log("[myfxbook] Sessione ottenuta");
  return _mfxSession.token;
}

async function fetchMyfxbookOutlook(): Promise<MyfxbookSymbol[]> {
  const session = await getMyfxbookSession();
  if (!session) throw new Error("No credentials");

  const url = `https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Myfxbook outlook HTTP ${res.status}`);
  const data = await res.json() as { error: boolean; message?: string; symbols?: MyfxbookSymbol[] };
  if (data.error) {
    _mfxSession = null;
    throw new Error(data.message ?? "Outlook error");
  }
  return data.symbols ?? [];
}

const FALLBACK_SYMBOLS: MyfxbookSymbol[] = [
  { name: "EURUSD", longPercentage: 58, shortPercentage: 42, longPositions: 58000, shortPositions: 42000, longVolume: 58, shortVolume: 42 },
  { name: "GBPUSD", longPercentage: 45, shortPercentage: 55, longPositions: 45000, shortPositions: 55000, longVolume: 45, shortVolume: 55 },
  { name: "USDJPY", longPercentage: 62, shortPercentage: 38, longPositions: 62000, shortPositions: 38000, longVolume: 62, shortVolume: 38 },
  { name: "USDCHF", longPercentage: 51, shortPercentage: 49, longPositions: 51000, shortPositions: 49000, longVolume: 51, shortVolume: 49 },
  { name: "AUDUSD", longPercentage: 39, shortPercentage: 61, longPositions: 39000, shortPositions: 61000, longVolume: 39, shortVolume: 61 },
  { name: "USDCAD", longPercentage: 54, shortPercentage: 46, longPositions: 54000, shortPositions: 46000, longVolume: 54, shortVolume: 46 },
  { name: "NZDUSD", longPercentage: 47, shortPercentage: 53, longPositions: 47000, shortPositions: 53000, longVolume: 47, shortVolume: 53 },
  { name: "EURGBP", longPercentage: 55, shortPercentage: 45, longPositions: 55000, shortPositions: 45000, longVolume: 55, shortVolume: 45 },
  { name: "EURJPY", longPercentage: 61, shortPercentage: 39, longPositions: 61000, shortPositions: 39000, longVolume: 61, shortVolume: 39 },
  { name: "GBPJPY", longPercentage: 43, shortPercentage: 57, longPositions: 43000, shortPositions: 57000, longVolume: 43, shortVolume: 57 },
  { name: "XAUUSD", longPercentage: 71, shortPercentage: 29, longPositions: 71000, shortPositions: 29000, longVolume: 71, shortVolume: 29 },
  { name: "XAGUSD", longPercentage: 66, shortPercentage: 34, longPositions: 66000, shortPositions: 34000, longVolume: 66, shortVolume: 34 },
  { name: "USDJPY", longPercentage: 62, shortPercentage: 38, longPositions: 62000, shortPositions: 38000, longVolume: 62, shortVolume: 38 },
  { name: "BTCUSD", longPercentage: 68, shortPercentage: 32, longPositions: 68000, shortPositions: 32000, longVolume: 68, shortVolume: 32 },
];

router.get("/tools/sentiment", async (req, res) => {
  const hasCredentials = !!(process.env.MYFXBOOK_EMAIL && process.env.MYFXBOOK_PASSWORD);
  try {
    const symbols = await fetchMyfxbookOutlook();
    res.json({ symbols, live: true, cached: false, hasCredentials });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tools/sentiment]", msg);
    res.json({ symbols: FALLBACK_SYMBOLS, live: false, fallback: true, hasCredentials, error: msg });
  }
});

// ─── 3. VOLATILITY (Mataf-methodology via Yahoo Finance OHLCV) ────────────────

const YAHOO_PAIRS: Record<string, string> = {
  "EURUSD": "EURUSD=X",
  "GBPUSD": "GBPUSD=X",
  "USDJPY": "JPY=X",
  "USDCHF": "CHF=X",
  "AUDUSD": "AUDUSD=X",
  "USDCAD": "CAD=X",
  "NZDUSD": "NZDUSD=X",
  "EURGBP": "EURGBP=X",
  "EURJPY": "EURJPY=X",
  "GBPJPY": "GBPJPY=X",
  "XAUUSD": "GC=F",
  "XAGUSD": "SI=F",
  "USDMXN": "MXN=X",
  "USDZAR": "ZAR=X",
};

// Pip multiplier: how many pips per 1.0 of price movement
const PIP_MULTIPLIER: Record<string, number> = {
  "USDJPY": 100, "EURJPY": 100, "GBPJPY": 100, "CADJPY": 100, "AUDJPY": 100,
  "XAUUSD": 10,  "XAGUSD": 100,
};
const DEFAULT_PIP = 10000;

function getPipMultiplier(pair: string) {
  for (const [k, v] of Object.entries(PIP_MULTIPLIER)) {
    if (pair.includes(k.slice(3)) && k.slice(3) === "JPY") return v;
    if (pair === k) return v;
  }
  if (pair.endsWith("JPY")) return 100;
  return DEFAULT_PIP;
}

function avgPips(arr: number[]) {
  return arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;
}

router.get("/tools/volatility", async (req, res) => {
  const pair = (req.query["pair"] as string ?? "EURUSD").toUpperCase();
  const ticker = YAHOO_PAIRS[pair];

  if (!ticker) {
    res.status(400).json({ error: `Pair ${pair} non supportato` });
    return;
  }

  try {
    // Fetch 1 year of OHLCV daily data
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TraderLoading/1.0)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`);

    const data = await response.json() as {
      chart?: {
        result?: Array<{
          indicators?: { quote?: Array<{ close?: (number|null)[]; high?: (number|null)[]; low?: (number|null)[] }> };
          meta?: { regularMarketPrice?: number; regularMarketDayHigh?: number; regularMarketDayLow?: number };
          timestamp?: number[];
        }>;
      };
    };

    const result = data.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp ?? [];

    if (!quote || !timestamps.length) throw new Error("Dati insufficienti da Yahoo Finance");

    const pip = getPipMultiplier(pair);

    // Build per-day pip ranges (H-L) — exactly Mataf's method
    const ranges: { ts: number; pips: number; close: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const h = quote.high?.[i];
      const l = quote.low?.[i];
      const c = quote.close?.[i];
      if (h != null && l != null && c != null && h > 0 && l > 0) {
        ranges.push({ ts: timestamps[i], pips: parseFloat(((h - l) * pip).toFixed(1)), close: c });
      }
    }

    if (ranges.length < 5) throw new Error("Storico insufficiente");

    const currentPrice = result?.meta?.regularMarketPrice ?? ranges[ranges.length - 1].close;
    const todayHigh = result?.meta?.regularMarketDayHigh;
    const todayLow  = result?.meta?.regularMarketDayLow;
    const todayPips = todayHigh && todayLow ? parseFloat(((todayHigh - todayLow) * pip).toFixed(1)) : ranges[ranges.length - 1].pips;

    const pipValues = ranges.map((r) => r.pips);
    const w1  = avgPips(pipValues.slice(-5));
    const m1  = avgPips(pipValues.slice(-22));
    const m3  = avgPips(pipValues.slice(-66));
    const m6  = avgPips(pipValues.slice(-132));
    const y1  = avgPips(pipValues);

    // Volatility label vs 1Y average
    const ratio = w1 / (y1 || 1);
    const label = ratio > 1.3 ? "Alta volatilità" : ratio < 0.7 ? "Bassa volatilità" : "Nella norma";

    // Price return % for each period (close-to-close)
    const closePrices = ranges.map((r) => r.close);
    const latestClose = closePrices[closePrices.length - 1];
    const pricePct = (n: number): number | null => {
      if (closePrices.length <= n) return null;
      const past = closePrices[closePrices.length - 1 - n];
      return past > 0 ? parseFloat(((latestClose / past - 1) * 100).toFixed(2)) : null;
    };
    const w1Pct = pricePct(5);
    const m1Pct = pricePct(22);
    const m3Pct = pricePct(66);
    const m6Pct = pricePct(132);
    const y1Pct = pricePct(closePrices.length - 1);

    const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

    // Last 30 trading days for chart — include weekday name
    const last30 = ranges.slice(-30).map((r, i) => {
      const d = new Date(r.ts * 1000);
      return {
        day: i + 1,
        date: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
        weekday: dayNames[d.getDay()],
        pips: r.pips,
      };
    });

    // Peak weekday (which day of the week is most volatile on average)
    const byDay: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    ranges.forEach((r) => {
      const d = new Date(r.ts * 1000).getDay();
      if (byDay[d]) byDay[d].push(r.pips);
    });
    const peakDay = Object.entries(byDay)
      .map(([d, vals]) => ({ day: dayNames[+d], avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 }))
      .sort((a, b) => b.avg - a.avg)[0]?.day ?? "Mer";

    res.json({
      pair,
      currentPrice,
      todayPips,
      w1, m1, m3, m6, y1,
      w1Pct, m1Pct, m3Pct, m6Pct, y1Pct,
      label,
      peakDay,
      pipUnit: pip === 100 ? "pip (JPY)" : pip === 10 ? "pip (XAU)" : "pip",
      last30,
      // legacy fields for backwards compat
      daily5: w1,
      daily21: m1,
      daily63: m3,
      dailyAll: y1,
      dataPoints: last30.map((r) => ({ day: r.day, value: r.pips })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tools/volatility]", msg);
    res.status(500).json({ error: msg });
  }
});

// ─── 4. COT REPORT (CFTC, aggiornamento ogni venerdì) ────────────────────────

const COT_MARKET_MAP: Record<string, string> = {
  "EURO FX": "EUR",
  "BRITISH POUND": "GBP",
  "JAPANESE YEN": "JPY",
  "SWISS FRANC": "CHF",
  "CANADIAN DOLLAR": "CAD",
  "AUSTRALIAN DOLLAR": "AUD",
  "NEW ZEALAND DOLLAR": "NZD",
  "GOLD": "XAU",
  "US DOLLAR INDEX": "USD",
};

const COT_ORDER = ["EUR","GBP","JPY","CHF","CAD","AUD","NZD","XAU","USD"];
const COT_HISTORY_WEEKS = 12; // settimane di storico da mostrare

interface CotWeek {
  date: string;
  nonCommLong: number;
  nonCommShort: number;
  commLong: number;
  commShort: number;
  retailLong: number;
  retailShort: number;
  nonCommNet: number;
  commNet: number;
  retailNet: number;
}
interface CotEntry extends CotWeek {
  market: string;
  currency: string;
  history: { date: string; nonCommNet: number; commNet: number }[];
}

function parseCotCsv(text: string): CotEntry[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const col = (name: string) => headers.findIndex((h) => h.includes(name.toLowerCase()));

  const marketCol  = col("market_and_exchange_names");
  const dateCol    = col("report_date_as_yyyy");
  const ncLongCol  = col("noncomm_positions_long_all");
  const ncShortCol = col("noncomm_positions_short_all");
  const commLCol   = col("comm_positions_long_all");
  const commSCol   = col("comm_positions_short_all");
  const nrLCol     = col("nonrept_positions_long_all");
  const nrSCol     = col("nonrept_positions_short_all");

  const historyByMarket: Record<string, CotWeek[]> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const market = cols[marketCol]?.toUpperCase() ?? "";
    const matchedKey = Object.keys(COT_MARKET_MAP).find((k) => market.includes(k));
    if (!matchedKey) continue;

    const currency = COT_MARKET_MAP[matchedKey];
    const date = cols[dateCol] ?? "";
    const ncLong  = parseInt(cols[ncLongCol])  || 0;
    const ncShort = parseInt(cols[ncShortCol]) || 0;
    const commL   = parseInt(cols[commLCol])   || 0;
    const commS   = parseInt(cols[commSCol])   || 0;
    const nrL     = parseInt(cols[nrLCol])     || 0;
    const nrS     = parseInt(cols[nrSCol])     || 0;

    if (!historyByMarket[currency]) historyByMarket[currency] = [];
    // Avoid duplicate dates
    if (!historyByMarket[currency].some((w) => w.date === date)) {
      historyByMarket[currency].push({
        date, nonCommLong: ncLong, nonCommShort: ncShort,
        commLong: commL, commShort: commS,
        retailLong: nrL, retailShort: nrS,
        nonCommNet: ncLong - ncShort,
        commNet: commL - commS,
        retailNet: nrL - nrS,
      });
    }
  }

  return Object.entries(historyByMarket)
    .map(([currency, weeks]) => {
      // Sort by date desc, take latest as "current"
      weeks.sort((a, b) => b.date.localeCompare(a.date));
      const latest = weeks[0];
      const history = weeks.slice(0, COT_HISTORY_WEEKS).reverse().map((w) => ({
        date: w.date, nonCommNet: w.nonCommNet, commNet: w.commNet,
      }));
      const matchedKey = Object.keys(COT_MARKET_MAP).find((k) => COT_MARKET_MAP[k] === currency) ?? "";
      return { ...latest, market: matchedKey, currency, history };
    })
    .sort((a, b) => COT_ORDER.indexOf(a.currency) - COT_ORDER.indexOf(b.currency));
}

const COT_FALLBACK: CotEntry[] = [
  { market:"EURO FX",          currency:"EUR", date:"2026-03-11", nonCommLong:218450, nonCommShort:142310, commLong:136200, commShort:211400, retailLong:42100, retailShort:42040, nonCommNet:76140,  commNet:-75200, retailNet:60,   history:[{date:"2026-03-11",nonCommNet:76140,commNet:-75200}] },
  { market:"BRITISH POUND",    currency:"GBP", date:"2026-03-11", nonCommLong:68250,  nonCommShort:112340, commLong:124800, commShort:78900,  retailLong:18200, retailShort:20010, nonCommNet:-44090, commNet:45900,  retailNet:-1810,history:[{date:"2026-03-11",nonCommNet:-44090,commNet:45900}] },
  { market:"JAPANESE YEN",     currency:"JPY", date:"2026-03-11", nonCommLong:98200,  nonCommShort:54300,  commLong:62100,  commShort:107500, retailLong:13400, retailShort:12900, nonCommNet:43900,  commNet:-45400, retailNet:500,  history:[{date:"2026-03-11",nonCommNet:43900,commNet:-45400}] },
  { market:"SWISS FRANC",      currency:"CHF", date:"2026-03-11", nonCommLong:22100,  nonCommShort:38500,  commLong:41200,  commShort:24900,  retailLong:6800,  retailShort:6700,  nonCommNet:-16400, commNet:16300,  retailNet:100,  history:[{date:"2026-03-11",nonCommNet:-16400,commNet:16300}] },
  { market:"CANADIAN DOLLAR",  currency:"CAD", date:"2026-03-11", nonCommLong:44500,  nonCommShort:112800, commLong:118700, commShort:51200,  retailLong:11400, retailShort:10600, nonCommNet:-68300, commNet:67500,  retailNet:800,  history:[{date:"2026-03-11",nonCommNet:-68300,commNet:67500}] },
  { market:"AUSTRALIAN DOLLAR",currency:"AUD", date:"2026-03-11", nonCommLong:51300,  nonCommShort:89200,  commLong:94800,  commShort:57100,  retailLong:12300, retailShort:12100, nonCommNet:-37900, commNet:37700,  retailNet:200,  history:[{date:"2026-03-11",nonCommNet:-37900,commNet:37700}] },
  { market:"NEW ZEALAND DOLLAR",currency:"NZD",date:"2026-03-11", nonCommLong:18200,  nonCommShort:32400,  commLong:34100,  commShort:19900,  retailLong:4500,  retailShort:4500,  nonCommNet:-14200, commNet:14200,  retailNet:0,    history:[{date:"2026-03-11",nonCommNet:-14200,commNet:14200}] },
  { market:"GOLD",             currency:"XAU", date:"2026-03-11", nonCommLong:312800, nonCommShort:42100,  commLong:48200,  commShort:320700, retailLong:18400, retailShort:16600, nonCommNet:270700, commNet:-272500,retailNet:1800, history:[{date:"2026-03-11",nonCommNet:270700,commNet:-272500}] },
  { market:"US DOLLAR INDEX",  currency:"USD", date:"2026-03-11", nonCommLong:28100,  nonCommShort:48200,  commLong:51400,  commShort:31200,  retailLong:6400,  retailShort:6500,  nonCommNet:-20100, commNet:20200,  retailNet:-100, history:[{date:"2026-03-11",nonCommNet:-20100,commNet:20200}] },
];

const CFTC_URLS = [
  "https://www.cftc.gov/dea/newcot/FinFutWkly.txt",
  "https://www.cftc.gov/files/dea/newcot/FinFutWkly.txt",
];

// Smart cache — porta la data del prossimo venerdì CFTC come scadenza
function nextCftcPublishMs(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=dom, 5=ven
  const hour = now.getUTCHours() * 60 + now.getUTCMinutes();
  // CFTC pubblica ogni venerdì alle 15:30 EST = 20:30 UTC = 1230 minuti
  const daysToFriday = (5 - day + 7) % 7;
  const todayIsFridayAfterPublish = day === 5 && hour >= 1230;
  const daysUntilNext = todayIsFridayAfterPublish ? 7 : daysToFriday === 0 ? 7 : daysToFriday;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + daysUntilNext);
  next.setUTCHours(20, 35, 0, 0);
  return next.getTime();
}

interface CotCache {
  data: CotEntry[];
  fetchedAt: number;
  expiresAt: number;
  fallback: boolean;
}
let cotCache: CotCache | null = null;

async function fetchCotData(): Promise<void> {
  const now = Date.now();
  console.info("[tools/cot] Fetching CFTC data...");

  for (const url of CFTC_URLS) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TraderLoading/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) { console.warn(`[tools/cot] ${url} → HTTP ${response.status}`); continue; }
      const text = await response.text();
      if (text.trim().startsWith("<!")) { console.warn(`[tools/cot] ${url} → HTML (blocked)`); continue; }
      const reports = parseCotCsv(text);
      if (reports.length === 0) continue;
      cotCache = { data: reports, fetchedAt: now, expiresAt: nextCftcPublishMs(), fallback: false };
      console.info(`[tools/cot] OK — ${reports.length} markets, expires at ${new Date(cotCache.expiresAt).toISOString()}`);
      return;
    } catch (err) {
      console.warn(`[tools/cot] ${url} →`, err instanceof Error ? err.message : err);
    }
  }

  console.info("[tools/cot] All CFTC URLs failed, keeping/using fallback");
  if (!cotCache) {
    cotCache = { data: COT_FALLBACK, fetchedAt: now, expiresAt: nextCftcPublishMs(), fallback: true };
  }
}

// Cron: ogni venerdì alle 21:00 UTC (30 min dopo pubblicazione CFTC)
cron.schedule("0 21 * * 5", () => {
  console.info("[tools/cot] Cron triggered — fetching new COT data");
  fetchCotData().catch(console.error);
}, { timezone: "UTC" });

// Fetch iniziale al boot del server
fetchCotData().catch(console.error);

router.get("/tools/cot", async (req, res) => {
  const now = Date.now();
  const isStale = cotCache ? now >= cotCache.expiresAt : true;

  if (!cotCache || isStale) {
    await fetchCotData();
  }

  const cache = cotCache!;
  const nextUpdate = new Date(cache.expiresAt).toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

  res.json({
    reports: cache.data,
    cached: !isStale,
    fallback: cache.fallback,
    fetchedAt: new Date(cache.fetchedAt).toISOString(),
    nextUpdate,
  });
});

// ─── 5. MACRO NEWS AI ─────────────────────────────────────────────────────────
interface MacroNewsResult {
  articles: Array<{
    title: string;
    summary: string;
    impact: string;
    currency: string;
    direction: string;
    source: string;
    timestamp?: string;
  }>;
  sentiment: string;
  summary: string;
  fetchedAt: string;
}

const macroNewsCache = new Map<string, { data: MacroNewsResult; expiresAt: number }>();
const MACRO_NEWS_TTL = 30 * 60 * 1000;
const VALID_CURRENCIES = new Set(["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "XAU"]);

function normalizeCurrencies(raw: string): { key: string; label: string } {
  if (!raw || raw.trim().length === 0) {
    return { key: "all", label: "tutte le principali valute" };
  }
  const filtered = raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => VALID_CURRENCIES.has(c));
  const unique = [...new Set(filtered)].sort();
  if (unique.length === 0 || unique.length === VALID_CURRENCIES.size) {
    return { key: "all", label: "tutte le principali valute" };
  }
  return { key: unique.join(",").toLowerCase(), label: unique.join(", ") };
}

async function fetchMacroNews(currencyLabel: string): Promise<MacroNewsResult> {
  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Sei un analista macro forex e commodities esperto. Fornisci un briefing sintetico sulle notizie macroeconomiche più rilevanti per i mercati forex e oro. Oggi è ${today}.

Per le notizie sull'oro (XAU), includi SEMPRE dati dal World Gold Council: acquisti di oro da parte delle banche centrali (Cina, India, Polonia, ecc.), variazioni nelle riserve auree nazionali, domanda fisica vs investimento, flussi ETF auriferi, e report trimestrali Gold Demand Trends.
          
Rispondi SEMPRE in formato JSON valido con questa struttura esatta:
{
  "articles": [
    {
      "title": "Titolo breve della notizia",
      "summary": "Riassunto in 2-3 frasi della notizia e del suo contesto",
      "impact": "alto|medio|basso",
      "currency": "EUR|USD|GBP|JPY|CHF|CAD|AUD|NZD|XAU|GLOBALE",
      "direction": "bullish|bearish|neutrale",
      "source": "Nome fonte (es: World Gold Council, BCE, Federal Reserve, Reuters, Bloomberg, FMI, BIS, CFTC, Bureau of Labor Statistics)",
      "timestamp": "2025-03-15T09:00:00Z"
    }
  ],
  "sentiment": "risk-on|risk-off|neutrale",
  "summary": "Frase di sintesi del quadro macro generale"
}

IMPORTANTE: Ogni articolo DEVE avere il campo "source" con il nome della fonte primaria dell'informazione. Per XAU usa principalmente "World Gold Council", "LBMA", "WGC Gold Demand Trends". Per valute usa fonti come banche centrali, agenzie statistiche, o media finanziari.

Genera 6-8 articoli rilevanti e recenti per il trading forex intraday e swing.`,
      },
      {
        role: "user",
        content: `Genera il briefing macro per oggi con focus su ${currencyLabel}. Includi: decisioni banche centrali, inflazione, PIL, dati occupazione, geopolitica, sentiment risk-on/off. Per XAU includi dati World Gold Council su acquisti banche centrali e riserve auree. Cita SEMPRE la fonte per ogni notizia. Sii preciso e utile per un trader.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 2500,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<MacroNewsResult>;
  return {
    articles: (parsed.articles ?? []).map((a) => ({ ...a, source: a.source || "" })),
    sentiment: parsed.sentiment ?? "neutrale",
    summary: parsed.summary ?? "",
    fetchedAt: new Date().toISOString(),
  };
}

router.get("/tools/macro-news", async (req, res) => {
  const { key, label } = normalizeCurrencies((req.query.currencies as string) || "");
  const forceRefresh = req.query.force === "1";

  const cached = macroNewsCache.get(key);
  if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
    return res.json(cached.data);
  }

  try {
    const result = await fetchMacroNews(label);
    macroNewsCache.set(key, { data: result, expiresAt: Date.now() + MACRO_NEWS_TTL });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tools/macro-news GET]", msg);
    res.status(500).json({ error: msg });
  }
});

router.post("/tools/macro-news", async (req, res) => {
  const { currency = "" } = req.body as { currency?: string };
  const { key, label } = normalizeCurrencies(currency);

  const cached = macroNewsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.data);
  }

  try {
    const result = await fetchMacroNews(label);
    macroNewsCache.set(key, { data: result, expiresAt: Date.now() + MACRO_NEWS_TTL });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tools/macro-news]", msg);
    res.status(500).json({ error: msg });
  }
});

// ─── SUPPORTED PAIRS LIST ─────────────────────────────────────────────────────
router.get("/tools/pairs", (req, res) => {
  res.json({ pairs: Object.keys(YAHOO_PAIRS) });
});

export default router;
