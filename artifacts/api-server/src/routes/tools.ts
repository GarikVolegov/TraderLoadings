import { Router } from "express";
import OpenAI from "openai";

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
router.get("/tools/sentiment", async (req, res) => {
  try {
    const response = await fetch(
      "https://www.myfxbook.com/community/outlook/get-community-outlook.json",
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; TraderLoading/1.0)",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) throw new Error(`Myfxbook HTTP ${response.status}`);

    const data = await response.json() as {
      error: boolean;
      message?: string;
      symbols?: Array<{
        name: string;
        longPercentage: number;
        shortPercentage: number;
        longVolume: number;
        shortVolume: number;
        longPositions: number;
        shortPositions: number;
      }>;
    };

    if (data.error) throw new Error(data.message ?? "Myfxbook error");

    res.json({ symbols: data.symbols ?? [], cached: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tools/sentiment]", msg);

    const fallbackSymbols = [
      { name: "EURUSD", longPercentage: 58, shortPercentage: 42, longPositions: 58000, shortPositions: 42000, longVolume: 58, shortVolume: 42 },
      { name: "GBPUSD", longPercentage: 45, shortPercentage: 55, longPositions: 45000, shortPositions: 55000, longVolume: 45, shortVolume: 55 },
      { name: "USDJPY", longPercentage: 62, shortPercentage: 38, longPositions: 62000, shortPositions: 38000, longVolume: 62, shortVolume: 38 },
      { name: "USDCHF", longPercentage: 51, shortPercentage: 49, longPositions: 51000, shortPositions: 49000, longVolume: 51, shortVolume: 49 },
      { name: "AUDUSD", longPercentage: 39, shortPercentage: 61, longPositions: 39000, shortPositions: 61000, longVolume: 39, shortVolume: 61 },
      { name: "USDCAD", longPercentage: 54, shortPercentage: 46, longPositions: 54000, shortPositions: 46000, longVolume: 54, shortVolume: 46 },
      { name: "NZDUSD", longPercentage: 47, shortPercentage: 53, longPositions: 47000, shortPositions: 53000, longVolume: 47, shortVolume: 53 },
      { name: "XAUUSD", longPercentage: 71, shortPercentage: 29, longPositions: 71000, shortPositions: 29000, longVolume: 71, shortVolume: 29 },
    ];

    res.json({ symbols: fallbackSymbols, cached: true, fallback: true, error: msg });
  }
});

// ─── 3. VOLATILITY (Yahoo Finance) ───────────────────────────────────────────
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
};

function computeVolatility(closes: number[]) {
  const returns = closes.slice(1).map((c, i) => Math.abs(c - closes[i]) / closes[i] * 100);

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const week5 = returns.slice(-5);
  const month1 = returns.slice(-21);
  const month3 = returns.slice(-63);

  const avgAll = avg(returns);
  const avg5 = avg(week5);
  const avg21 = avg(month1);
  const avg63 = avg(month3);

  const current = avg5;
  const label = current > avgAll * 1.3 ? "Alta volatilità" : current < avgAll * 0.7 ? "Bassa volatilità" : "Volatilità nella norma";

  return {
    daily5: parseFloat(avg5.toFixed(4)),
    daily21: parseFloat(avg21.toFixed(4)),
    daily63: parseFloat(avg63.toFixed(4)),
    dailyAll: parseFloat(avgAll.toFixed(4)),
    label,
    dataPoints: returns.slice(-30).map((v, i) => ({ day: i + 1, value: parseFloat(v.toFixed(4)) })),
  };
}

router.get("/tools/volatility", async (req, res) => {
  const pair = (req.query["pair"] as string ?? "EURUSD").toUpperCase();
  const ticker = YAHOO_PAIRS[pair];

  if (!ticker) {
    res.status(400).json({ error: `Pair ${pair} not supported` });
    return;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=6mo`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TraderLoading/1.0)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`);

    const data = await response.json() as {
      chart?: {
        result?: Array<{
          indicators?: { quote?: Array<{ close?: number[] }> };
          meta?: { currency?: string; regularMarketPrice?: number };
        }>;
      };
    };

    const result = data.chart?.result?.[0];
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((v): v is number => v != null);

    if (closes.length < 10) throw new Error("Dati insufficienti");

    const vol = computeVolatility(closes);
    const currentPrice = result?.meta?.regularMarketPrice ?? closes[closes.length - 1];

    res.json({ pair, currentPrice, ...vol });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tools/volatility]", msg);
    res.status(500).json({ error: msg });
  }
});

// ─── 4. COT REPORT ────────────────────────────────────────────────────────────
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

function parseCotCsv(text: string) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const rawHeader = lines[0];
  const headers = rawHeader.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const col = (name: string) => {
    const lower = name.toLowerCase();
    return headers.findIndex((h) => h.includes(lower));
  };

  const marketCol = col("market_and_exchange_names");
  const dateCol = col("report_date_as_yyyy");
  const ncLongCol = col("noncomm_positions_long_all");
  const ncShortCol = col("noncomm_positions_short_all");
  const commLongCol = col("comm_positions_long_all");
  const commShortCol = col("comm_positions_short_all");
  const nrLongCol = col("nonrept_positions_long_all");
  const nrShortCol = col("nonrept_positions_short_all");

  const latestByMarket: Record<string, {
    market: string;
    currency: string;
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
  }> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const market = cols[marketCol]?.toUpperCase() ?? "";

    const matchedKey = Object.keys(COT_MARKET_MAP).find((k) => market.includes(k));
    if (!matchedKey) continue;

    const currency = COT_MARKET_MAP[matchedKey];
    const date = cols[dateCol] ?? "";
    const ncLong = parseInt(cols[ncLongCol]) || 0;
    const ncShort = parseInt(cols[ncShortCol]) || 0;
    const commLong = parseInt(cols[commLongCol]) || 0;
    const commShort = parseInt(cols[commShortCol]) || 0;
    const nrLong = parseInt(cols[nrLongCol]) || 0;
    const nrShort = parseInt(cols[nrShortCol]) || 0;

    if (!latestByMarket[currency] || date > latestByMarket[currency].date) {
      latestByMarket[currency] = {
        market: matchedKey,
        currency,
        date,
        nonCommLong: ncLong,
        nonCommShort: ncShort,
        commLong,
        commShort,
        retailLong: nrLong,
        retailShort: nrShort,
        nonCommNet: ncLong - ncShort,
        commNet: commLong - commShort,
        retailNet: nrLong - nrShort,
      };
    }
  }

  return Object.values(latestByMarket).sort((a, b) =>
    ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "XAU", "USD"].indexOf(a.currency) -
    ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "XAU", "USD"].indexOf(b.currency)
  );
}

const COT_FALLBACK: ReturnType<typeof parseCotCsv> = [
  { market: "EURO FX", currency: "EUR", date: "2026-03-11", nonCommLong: 218450, nonCommShort: 142310, commLong: 136200, commShort: 211400, retailLong: 42100, retailShort: 42040, nonCommNet: 76140, commNet: -75200, retailNet: 60 },
  { market: "BRITISH POUND", currency: "GBP", date: "2026-03-11", nonCommLong: 68250, nonCommShort: 112340, commLong: 124800, commShort: 78900, retailLong: 18200, retailShort: 20010, nonCommNet: -44090, commNet: 45900, retailNet: -1810 },
  { market: "JAPANESE YEN", currency: "JPY", date: "2026-03-11", nonCommLong: 98200, nonCommShort: 54300, commLong: 62100, commShort: 107500, retailLong: 13400, retailShort: 12900, nonCommNet: 43900, commNet: -45400, retailNet: 500 },
  { market: "SWISS FRANC", currency: "CHF", date: "2026-03-11", nonCommLong: 22100, nonCommShort: 38500, commLong: 41200, commShort: 24900, retailLong: 6800, retailShort: 6700, nonCommNet: -16400, commNet: 16300, retailNet: 100 },
  { market: "CANADIAN DOLLAR", currency: "CAD", date: "2026-03-11", nonCommLong: 44500, nonCommShort: 112800, commLong: 118700, commShort: 51200, retailLong: 11400, retailShort: 10600, nonCommNet: -68300, commNet: 67500, retailNet: 800 },
  { market: "AUSTRALIAN DOLLAR", currency: "AUD", date: "2026-03-11", nonCommLong: 51300, nonCommShort: 89200, commLong: 94800, commShort: 57100, retailLong: 12300, retailShort: 12100, nonCommNet: -37900, commNet: 37700, retailNet: 200 },
  { market: "NEW ZEALAND DOLLAR", currency: "NZD", date: "2026-03-11", nonCommLong: 18200, nonCommShort: 32400, commLong: 34100, commShort: 19900, retailLong: 4500, retailShort: 4500, nonCommNet: -14200, commNet: 14200, retailNet: 0 },
  { market: "GOLD", currency: "XAU", date: "2026-03-11", nonCommLong: 312800, nonCommShort: 42100, commLong: 48200, commShort: 320700, retailLong: 18400, retailShort: 16600, nonCommNet: 270700, commNet: -272500, retailNet: 1800 },
  { market: "US DOLLAR INDEX", currency: "USD", date: "2026-03-11", nonCommLong: 28100, nonCommShort: 48200, commLong: 51400, commShort: 31200, retailLong: 6400, retailShort: 6500, nonCommNet: -20100, commNet: 20200, retailNet: -100 },
];

let cotCache: { data: ReturnType<typeof parseCotCsv>; fetchedAt: number; fallback?: boolean } | null = null;

const CFTC_URLS = [
  "https://www.cftc.gov/dea/newcot/FinFutWkly.txt",
  "https://www.cftc.gov/files/dea/newcot/FinFutWkly.txt",
];

router.get("/tools/cot", async (req, res) => {
  const now = Date.now();
  if (cotCache && now - cotCache.fetchedAt < 3600_000) {
    res.json({ reports: cotCache.data, cached: true, fallback: cotCache.fallback });
    return;
  }

  for (const url of CFTC_URLS) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TraderLoading/1.0)" },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) { console.warn(`[tools/cot] ${url} → HTTP ${response.status}`); continue; }

      const text = await response.text();
      if (text.trim().startsWith("<!")) { console.warn(`[tools/cot] ${url} → HTML response (blocked)`); continue; }

      const reports = parseCotCsv(text);
      if (reports.length === 0) continue;

      cotCache = { data: reports, fetchedAt: now, fallback: false };
      res.json({ reports, cached: false, fallback: false });
      return;
    } catch (err) {
      console.warn(`[tools/cot] ${url} →`, err instanceof Error ? err.message : err);
    }
  }

  console.info("[tools/cot] All CFTC URLs failed, returning fallback data");
  cotCache = { data: COT_FALLBACK, fetchedAt: now, fallback: true };
  res.json({ reports: COT_FALLBACK, cached: false, fallback: true });
});

// ─── 5. MACRO NEWS AI ─────────────────────────────────────────────────────────
router.post("/tools/macro-news", async (req, res) => {
  const { currency = "tutte le principali valute" } = req.body as { currency?: string };

  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `Sei un analista macro forex esperto. Fornisci un briefing sintetico sulle notizie macroeconomiche più rilevanti per i mercati forex. Oggi è ${today}.
          
Rispondi SEMPRE in formato JSON valido con questa struttura esatta:
{
  "articles": [
    {
      "title": "Titolo breve della notizia",
      "summary": "Riassunto in 2-3 frasi della notizia e del suo contesto",
      "impact": "alto|medio|basso",
      "currency": "EUR|USD|GBP|JPY|CHF|CAD|AUD|NZD|GLOBALE",
      "direction": "bullish|bearish|neutrale",
      "timestamp": "2025-03-15T09:00:00Z"
    }
  ],
  "sentiment": "risk-on|risk-off|neutrale",
  "summary": "Frase di sintesi del quadro macro generale"
}

Genera 6-8 articoli rilevanti e recenti per il trading forex intraday e swing.`,
        },
        {
          role: "user",
          content: `Genera il briefing macro per oggi con focus su ${currency}. Includi: decisioni banche centrali, inflazione, PIL, dati occupazione, geopolitica, sentiment risk-on/off. Sii preciso e utile per un trader.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      articles?: Array<{
        title: string;
        summary: string;
        impact: string;
        currency: string;
        direction: string;
        timestamp?: string;
      }>;
      sentiment?: string;
      summary?: string;
    };

    res.json(parsed);
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
