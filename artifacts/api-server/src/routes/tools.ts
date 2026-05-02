import { Router } from "express";
import cron from "node-cron";
import { getCurrenciesFromPairs } from "@workspace/pair-catalog";

const router = Router();

// ─── 1. MONTE CARLO ───────────────────────────────────────────────────────────
// Scenario-based Monte Carlo: ogni simulazione ha la propria sequenza di regimi
// di mercato (bull / neutral / bear) che cambiano stocasticamente. Questo rende
// ogni curva genuinamente unica, con drawdown, recuperi e fasi di trend diversi.
router.post("/tools/montecarlo", (req, res) => {
  const {
    winrate: rawWinrate = 55,
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

  // Normalize winrate: accept 0-100 or 0-1
  const winrate = rawWinrate > 1 ? rawWinrate / 100 : rawWinrate;

  // Regime definitions: multipliers applied to base parameters
  type Regime = "bull" | "neutral" | "bear";
  const regimeParams: Record<Regime, { wr: number; rr: number; lr: number }> = {
    bull:    { wr: 1.20, rr: 1.15, lr: 0.85 },
    neutral: { wr: 1.00, rr: 1.00, lr: 1.00 },
    bear:    { wr: 0.72, rr: 0.80, lr: 1.25 },
  };

  // Markov transition matrix: P[from][to]
  // Regimes tend to persist; transitions are gradual
  const transition: Record<Regime, Record<Regime, number>> = {
    bull:    { bull: 0.75, neutral: 0.20, bear: 0.05 },
    neutral: { bull: 0.20, neutral: 0.55, bear: 0.25 },
    bear:    { bull: 0.05, neutral: 0.30, bear: 0.65 },
  };

  function nextRegime(current: Regime): Regime {
    const r = Math.random();
    const t = transition[current];
    if (r < t.bull) return "bull";
    if (r < t.bull + t.neutral) return "neutral";
    return "bear";
  }

  // Each regime lasts between 5-20 trades before potentially switching
  function initialRegime(): Regime {
    const r = Math.random();
    if (r < 0.33) return "bull";
    if (r < 0.66) return "neutral";
    return "bear";
  }

  const simulations: number[][] = [];
  const finalValues: number[] = [];
  const N = Math.min(simCount, 200);

  for (let s = 0; s < N; s++) {
    const curve: number[] = [initialBalance];
    let balance = initialBalance;
    let regime: Regime = initialRegime();
    let regimeDuration = Math.floor(Math.random() * 12) + 5;   // trades left in current regime
    let consecutiveLosses = 0;

    for (let t = 0; t < numTrades; t++) {
      // Possibly switch regime
      if (regimeDuration <= 0) {
        regime = nextRegime(regime);
        regimeDuration = Math.floor(Math.random() * 15) + 5;
      }
      regimeDuration--;

      const rp = regimeParams[regime];

      // Effective parameters for this trade
      let effWr = Math.min(0.95, Math.max(0.05, winrate * rp.wr));
      // Tilt effect: 3+ consecutive losses slightly reduce next-trade win probability
      if (consecutiveLosses >= 3) effWr *= (1 - 0.04 * Math.min(consecutiveLosses - 2, 4));

      const win = Math.random() < effWr;

      // Black swan event: rare large unexpected loss (~3% in bear, ~1% otherwise)
      const blackSwanChance = regime === "bear" ? 0.035 : 0.010;
      const isBlackSwan = !win && Math.random() < blackSwanChance;

      const riskAmount = balance * (riskPercent / 100);
      let tradeResult: number;
      if (win) {
        // Slight randomness on the actual R achieved (±20%)
        const achievedR = avgR * rp.rr * (0.80 + Math.random() * 0.40);
        tradeResult = riskAmount * achievedR;
        consecutiveLosses = 0;
      } else if (isBlackSwan) {
        // Black swan: 2.5-4x normal loss
        const bsMult = 2.5 + Math.random() * 1.5;
        tradeResult = -riskAmount * lossR * rp.lr * bsMult;
        consecutiveLosses++;
      } else {
        // Slight randomness on loss R (±15%)
        const achievedLR = lossR * rp.lr * (0.85 + Math.random() * 0.30);
        tradeResult = -riskAmount * achievedLR;
        consecutiveLosses++;
      }

      balance += tradeResult;
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
  const avgReturn =
    ((finalValues.reduce((a, b) => a + b, 0) / finalValues.length - initialBalance) / initialBalance) * 100;

  res.json({
    simulations,
    stats: {
      median: Math.round(median),
      percentile10: Math.round(p10),
      percentile90: Math.round(p90),
      ruinProbability: ((ruinCount / N) * 100).toFixed(1),
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
    sources?: string[];
    citationUrls?: string[];   // real URLs from Perplexity search
    verified?: boolean;
    category?: string;
    timestamp?: string;
    imageUrl?: string | null;
    imageKeywords?: string[];
  }>;
  sentiment: string;
  summary: string;
  fetchedAt: string;
  citationUrls?: string[];     // all Perplexity citations for the full query
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

function buildMacroImageUrl(keywords: string[] | undefined, currency: string, index = 0): string {
  const lock = (index * 37 + 1) % 1000 || 1;
  const kws = (keywords ?? []).filter(Boolean).slice(0, 3);
  if (kws.length > 0) {
    return `https://loremflickr.com/800/400/${kws.join(",")}?lock=${lock}`;
  }
  const fallbacks: Record<string, string> = {
    EUR: "europe,economy", USD: "dollar,wallstreet", GBP: "london,finance",
    JPY: "tokyo,japan,finance", CHF: "switzerland,bank", CAD: "canada,economy",
    AUD: "australia,economy", NZD: "newzealand,economy", XAU: "gold,bullion",
    GLOBALE: "global,economy,finance",
  };
  return `https://loremflickr.com/800/400/${fallbacks[currency] ?? "finance,trading"}?lock=${lock}`;
}

async function translateMacroArticle(
  title: string, summary: string, lang: string
): Promise<{ title: string; summary: string }> {
  if (lang === "en") return { title, summary };
  try {
    const combined = `${title.slice(0, 200)} ||| ${summary.slice(0, 280)}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(combined)}&langpair=en|${lang}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { title, summary };
    const data = await res.json() as { responseData?: { translatedText?: string } };
    const translated = data.responseData?.translatedText ?? "";
    if (!translated) return { title, summary };
    const sep = translated.indexOf(" ||| ");
    if (sep === -1) return { title: translated, summary };
    return { title: translated.slice(0, sep).trim(), summary: translated.slice(sep + 5).trim() };
  } catch {
    return { title, summary };
  }
}

const LANG_NAMES: Record<string, string> = {
  it: "italiano", en: "inglese", es: "spagnolo", fr: "francese", de: "tedesco",
};

async function fetchMacroNewsPerplexity(currencyLabel: string, lang = "it"): Promise<MacroNewsResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");

  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const langName = LANG_NAMES[lang] ?? "italiano";

  // Perplexity sonar performs real-time web search.
  // The response includes `citations: string[]` — actual URLs of pages it searched.
  // We extract these as verified source proof instead of asking the AI to invent names.
  const systemPrompt = `Sei un analista macro-economico e geopolitico esperto. Oggi è ${today}.
Usa la tua capacità di ricerca web in tempo reale per trovare e riassumere le ultime notizie delle ultime 24-48 ore.
Copri sia notizie MACRO-ECONOMICHE che GEOPOLITICHE che muovono i mercati forex e commodities:
- Macro: decisioni banche centrali (Fed/BCE/BoE/BoJ), inflazione CPI, NFP, PIL, PMI, dati occupazione
- Geopolitica: conflitti armati, sanzioni, elezioni politiche, crisi diplomatiche, guerre commerciali, dazi, crisi energetiche
Scrivi title e summary in ${langName}. Rispondi SOLO con JSON valido, nessun testo extra o markdown:
{
  "articles": [
    {
      "title": "Titolo breve e descrittivo in ${langName}",
      "summary": "2-3 frasi in ${langName}: la notizia, il contesto macro/geopolitico e l'impatto atteso sui mercati",
      "impact": "alto|medio|basso",
      "currency": "EUR|USD|GBP|JPY|CHF|CAD|AUD|NZD|XAU|GLOBALE",
      "direction": "bullish|bearish|neutrale",
      "source": "Nome della fonte primaria trovata online",
      "sources": ["Fonte 1", "Fonte 2", "Fonte 3"],
      "category": "banca-centrale|macro-dati|conflitto|sanzioni|elezioni|commercio|energia|commodities",
      "timestamp": "ISO timestamp approssimativo della notizia",
      "imageKeywords": ["english_word1", "english_word2"]
    }
  ],
  "sentiment": "risk-on|risk-off|neutrale",
  "summary": "Sintesi del quadro macro-geopolitico globale di oggi in ${langName}"
}
Genera 6-8 articoli bilanciati tra macro e geopolitica. imageKeywords: 2-3 parole inglesi per immagine rappresentativa.`;

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Ricerca le ultime notizie macro-economiche e geopolitiche delle ultime 24-48 ore rilevanti per ${currencyLabel}. Includi sia eventi economici (banche centrali, dati macro) che geopolitici (conflitti, sanzioni, elezioni, crisi commerciali) che impattano il forex e le commodities. Rispondi SOLO con JSON in ${langName}.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
      search_recency_filter: "week",
      return_citations: true,
    }),
    signal: AbortSignal.timeout(35000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Perplexity ${response.status}: ${errText.slice(0, 200)}`);
  }

  // Perplexity returns `citations: string[]` — real URLs the model searched.
  // These are the actual verified sources, far more reliable than AI-invented names.
  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    citations?: string[];
  };

  const realCitationUrls: string[] = (data.citations ?? []).filter(
    (u) => typeof u === "string" && u.startsWith("http"),
  );

  const raw = data.choices[0]?.message?.content ?? "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as Partial<MacroNewsResult>;

  const totalArticles = Math.max((parsed.articles ?? []).length, 1);

  const articles = (parsed.articles ?? []).map((a, i) => {
    const rawSources = Array.isArray(a.sources) && a.sources.length > 0
      ? a.sources
      : a.source ? [a.source] : [];
    const dedupedSources = [...new Set(rawSources.map((s) => String(s).trim()).filter(Boolean))];

    // Distribute Perplexity's real citation URLs across articles.
    // Each article gets up to 3 real URLs drawn from the full citations pool.
    let articleCitationUrls: string[] = [];
    if (realCitationUrls.length > 0) {
      const perArticle = 3;
      const startIdx = (i * perArticle) % realCitationUrls.length;
      const slice1 = realCitationUrls.slice(startIdx, startIdx + perArticle);
      const slice2 = realCitationUrls.slice(0, Math.max(0, perArticle - slice1.length));
      articleCitationUrls = [...new Set([...slice1, ...slice2])].slice(0, perArticle);
    }

    // Verified = Perplexity found ≥3 real sources OR AI listed ≥3 named sources
    const verified = realCitationUrls.length >= 3 || dedupedSources.length >= 3;

    return {
      ...a,
      source: a.source || dedupedSources[0] || "",
      sources: dedupedSources,
      citationUrls: articleCitationUrls,
      verified,
      imageUrl: buildMacroImageUrl(a.imageKeywords, a.currency ?? "GLOBALE", i),
    };
  });

  // Warn in dev if Perplexity returned no citations (may indicate key/model issue)
  if (realCitationUrls.length === 0) {
    console.warn("[macro-news] Perplexity returned 0 citations — falling back to AI-named sources only");
  } else {
    console.log(`[macro-news] Perplexity returned ${realCitationUrls.length} real citation URLs for ${totalArticles} articles`);
  }

  return {
    articles,
    sentiment: parsed.sentiment ?? "neutrale",
    summary: parsed.summary ?? "",
    fetchedAt: new Date().toISOString(),
    citationUrls: realCitationUrls,
  };
}

// ─── RSS fallback for macro-news ──────────────────────────────────────────────
const RSS_MACRO_FEEDS = [
  { url: "https://www.cnbc.com/id/20409666/device/rss/rss.html", source: "CNBC Markets" },
  { url: "https://www.cnbc.com/id/15839135/device/rss/rss.html", source: "CNBC Finance" },
  { url: "https://seekingalpha.com/tag/forex.xml", source: "Seeking Alpha – Forex" },
  { url: "https://seekingalpha.com/tag/gold.xml", source: "Seeking Alpha – Gold" },
];

const CURRENCY_KW: Record<string, string[]> = {
  USD: ["dollar","usd","federal reserve","fed","fomc","powell","treasury","nonfarm","payroll","dxy"],
  EUR: ["euro","eur","ecb","lagarde","eurozone","bce","draghi"],
  GBP: ["pound","gbp","sterling","boe","bank of england","bailey"],
  JPY: ["yen","jpy","boj","bank of japan","ueda","nikkei"],
  CHF: ["swiss","chf","snb","franc"],
  CAD: ["canadian","cad","boc","loonie"],
  AUD: ["aussie","aud","rba"],
  NZD: ["kiwi","nzd","rbnz"],
  XAU: ["gold","xau","bullion","wgc","lbma","cftc"],
};

const BULLISH_KW = ["rally","surge","gain","rise","jump","strong","high","increase","growth","beat","above","positive","optimistic","hawkish","tightening"];
const BEARISH_KW = ["fall","drop","decline","plunge","weak","low","miss","below","cut","ease","dovish","selloff","recession","concern","risk","warn"];
const HIGH_IMPACT_KW = ["fomc","ecb","boe","boj","rate decision","nonfarm payroll","cpi","gdp","inflation","unemployment","recession","central bank","war","crisis","sanction","default"];

function detectCurrency(text: string): string {
  const t = text.toLowerCase();
  for (const [cur, kws] of Object.entries(CURRENCY_KW)) {
    if (kws.some((kw) => t.includes(kw))) return cur;
  }
  return "GLOBALE";
}

function detectDirection(text: string): "bullish" | "bearish" | "neutrale" {
  const t = text.toLowerCase();
  const bull = BULLISH_KW.filter((kw) => t.includes(kw)).length;
  const bear = BEARISH_KW.filter((kw) => t.includes(kw)).length;
  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutrale";
}

function detectImpact(text: string): "alto" | "medio" | "basso" {
  const t = text.toLowerCase();
  return HIGH_IMPACT_KW.some((kw) => t.includes(kw)) ? "alto" : "medio";
}

function extractRSSImageMacro(block: string, descRaw: string): string | null {
  return block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image[^"']*["']/i)?.[1]
    || block.match(/<media:content[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp|gif))["']/i)?.[1]
    || block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1]
    || descRaw.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)[^"']*)["']/i)?.[1]
    || null;
}

async function fetchMacroRSSFallback(currenciesInput: string, lang = "it"): Promise<MacroNewsResult> {
  const results = await Promise.allSettled(
    RSS_MACRO_FEEDS.map(async (f) => {
      const res = await fetch(f.url, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml, */*" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const articles: Array<{
        title: string; summary: string; currency: string; direction: "bullish"|"bearish"|"neutrale";
        impact: "alto"|"medio"|"basso"; source: string; sources: string[]; verified: boolean;
        timestamp: string | null; imageUrl: string | null;
      }> = [];
      const itemRe = /<item>([\s\S]*?)<\/item>/g;
      let m;
      while ((m = itemRe.exec(xml)) !== null) {
        const block = m[1];
        const titleRaw = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? "";
        const title = titleRaw.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#\d+;/g,"").trim();
        const descRaw = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] ?? "";
        const summary = descRaw.replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim().slice(0,280) || title;
        const pubDate = block.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1];
        const link = block.match(/<link>([^<]*)<\/link>/)?.[1] || block.match(/<guid[^>]*>([^<]*)<\/guid>/)?.[1];
        if (!title || title.length < 5) continue;
        let ts: string | null = null;
        try { ts = pubDate ? new Date(pubDate).toISOString() : null; } catch { /* */ }
        const combined = `${title} ${summary}`;
        articles.push({
          title, summary, source: f.source, sources: [f.source],
          currency: detectCurrency(combined),
          direction: detectDirection(combined),
          impact: detectImpact(combined),
          verified: false, timestamp: ts,
          imageUrl: extractRSSImageMacro(block, descRaw),
        });
      }
      return articles;
    })
  );

  const targetCurrencies = currenciesInput
    ? currenciesInput.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
    : [];

  let all: ReturnType<typeof fetchMacroRSSFallback> extends Promise<infer R> ? R["articles"] : never[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all = [...all, ...r.value];
  }

  // Filter by target currencies if specified
  const filtered = targetCurrencies.length > 0
    ? all.filter((a) => targetCurrencies.includes(a.currency) || a.currency === "GLOBALE")
    : all;
  const pool = filtered.length >= 4 ? filtered : all;

  // Deduplicate and take top 8
  const seen = new Set<string>();
  const deduped = pool.filter((a) => {
    const k = a.title.toLowerCase().slice(0, 40);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, 8);

  // Sort by timestamp desc
  deduped.sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Add fallback image for articles without one, with unique index
  const withImages = deduped.map((a, i) => ({
    ...a,
    imageUrl: a.imageUrl ?? buildMacroImageUrl(undefined, a.currency, i),
  }));

  // Translate title+summary if needed
  const articles = lang !== "en"
    ? await Promise.all(
        withImages.map(async (a) => {
          const { title, summary } = await translateMacroArticle(a.title, a.summary, lang);
          return { ...a, title, summary };
        })
      )
    : withImages;

  const bullCount = articles.filter((a) => a.direction === "bullish").length;
  const bearCount = articles.filter((a) => a.direction === "bearish").length;
  const sentiment = bullCount > bearCount ? "risk-on" : bearCount > bullCount ? "risk-off" : "neutrale";

  return {
    articles,
    sentiment,
    summary: `Notizie in tempo reale da ${RSS_MACRO_FEEDS.map((f) => f.source).join(", ")}`,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchMacroNews(currencyLabel: string, currenciesRaw = "", lang = "it"): Promise<MacroNewsResult> {
  try {
    return await fetchMacroNewsPerplexity(currencyLabel, lang);
  } catch (err) {
    console.warn("[tools/macro-news] AI failed, falling back to RSS:", err instanceof Error ? err.message : String(err));
    return fetchMacroRSSFallback(currenciesRaw, lang);
  }
}

const VALID_LANGS = new Set(["it", "en", "es", "fr", "de"]);
function sanitizeLang(raw: string | undefined): string {
  const l = (raw ?? "it").toLowerCase().slice(0, 2);
  return VALID_LANGS.has(l) ? l : "it";
}

router.get("/tools/macro-news", async (req, res) => {
  let currenciesInput = (req.query.currencies as string) || "";
  const pairsInput = (req.query.pairs as string) || "";
  const lang = sanitizeLang(req.query.lang as string | undefined);
  if (!currenciesInput && pairsInput) {
    const symbols = pairsInput.split(",").map((s) => s.trim()).filter(Boolean);
    const derived = getCurrenciesFromPairs(symbols);
    currenciesInput = derived.join(",");
  }
  const { key: baseKey, label } = normalizeCurrencies(currenciesInput);
  const key = `${baseKey}:${lang}`;
  const forceRefresh = req.query.force === "1";

  const cached = macroNewsCache.get(key);
  if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
    return res.json(cached.data);
  }

  try {
    const result = await fetchMacroNews(label, currenciesInput, lang);
    macroNewsCache.set(key, { data: result, expiresAt: Date.now() + MACRO_NEWS_TTL });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tools/macro-news GET]", msg);
    res.status(500).json({ error: msg });
  }
});

router.post("/tools/macro-news", async (req, res) => {
  const { currency = "", pairs = "", lang: langRaw = "" } = req.body as { currency?: string; pairs?: string; lang?: string };
  const lang = sanitizeLang(langRaw);
  let currencyInput = currency;
  const isGeneric = !currencyInput || currencyInput.toLowerCase().includes("tutte");
  if (isGeneric && pairs) {
    const symbols = pairs.split(",").map((s: string) => s.trim()).filter(Boolean);
    const derived = getCurrenciesFromPairs(symbols);
    if (derived.length > 0) {
      currencyInput = derived.join(",");
    }
  }
  const { key: baseKey, label } = normalizeCurrencies(currencyInput);
  const key = `${baseKey}:${lang}`;

  const cached = macroNewsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.data);
  }

  try {
    const result = await fetchMacroNews(label, currencyInput, lang);
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
