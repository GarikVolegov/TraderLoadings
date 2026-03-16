import { Router, type IRouter } from "express";

const router: IRouter = Router();

const YAHOO_SYMBOLS: Record<string, string> = {
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X",
  USDCHF: "USDCHF=X", AUDUSD: "AUDUSD=X", NZDUSD: "NZDUSD=X",
  USDCAD: "USDCAD=X", EURGBP: "EURGBP=X", EURJPY: "EURJPY=X",
  GBPJPY: "GBPJPY=X", AUDJPY: "AUDJPY=X", XAUUSD: "GC=F",
  US30: "YM=F", NAS100: "NQ=F", SPX500: "ES=F",
  BTCUSD: "BTC-USD", ETHUSD: "ETH-USD",
};

const TWELVE_SYMBOLS: Record<string, string> = {
  EURUSD: "EUR/USD", GBPUSD: "GBP/USD", USDJPY: "USD/JPY",
  USDCHF: "USD/CHF", AUDUSD: "AUD/USD", NZDUSD: "NZD/USD",
  USDCAD: "USD/CAD", EURGBP: "EUR/GBP", EURJPY: "EUR/JPY",
  GBPJPY: "GBP/JPY", AUDJPY: "AUD/JPY", XAUUSD: "XAU/USD",
};

const COINGECKO_IDS: Record<string, string> = {
  BTCUSD: "bitcoin",
  ETHUSD: "ethereum",
};

const YAHOO_INTERVAL: Record<string, string> = {
  M15: "15m", M30: "30m", H1: "1h", H4: "4h", D1: "1d", W1: "1wk",
};

const YAHOO_RANGE: Record<string, string> = {
  M15: "60d", M30: "60d", H1: "2y", H4: "2y", D1: "10y", W1: "10y",
};

const TWELVE_INTERVAL: Record<string, string> = {
  M15: "15min", M30: "30min", H1: "1h", H4: "4h", D1: "1day", W1: "1week",
};

const TWELVE_OUTPUTSIZE: Record<string, number> = {
  M15: 8640, M30: 5000, H1: 5000, H4: 5000, D1: 5000, W1: 5000,
};

interface CachedData { data: unknown; timestamp: number; }
const cache = new Map<string, CachedData>();
const CACHE_TTL = 60 * 60 * 1000;

type Candle = { time: number; open: number; high: number; low: number; close: number };

async function fetchYahoo(symbol: string, interval: string): Promise<Candle[]> {
  const yahooSym = YAHOO_SYMBOLS[symbol];
  if (!yahooSym) throw new Error(`Yahoo: symbol ${symbol} unsupported`);

  const yahooInterval = YAHOO_INTERVAL[interval] || "1h";
  const range = YAHOO_RANGE[interval] || "2y";

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${yahooInterval}&range=${range}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);

  const json = await response.json() as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: (number | null)[]; high?: (number | null)[];
            low?: (number | null)[]; close?: (number | null)[];
          }>;
        };
      }>;
    };
  };

  const result = json?.chart?.result?.[0];
  if (!result?.timestamp || !result?.indicators?.quote?.[0]) {
    throw new Error("Yahoo: invalid data structure");
  }

  const ts = result.timestamp;
  const q = result.indicators.quote[0];
  const candles: Candle[] = [];

  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o != null && h != null && l != null && c != null) {
      candles.push({
        time: ts[i],
        open: parseFloat(o.toFixed(5)),
        high: parseFloat(h.toFixed(5)),
        low: parseFloat(l.toFixed(5)),
        close: parseFloat(c.toFixed(5)),
      });
    }
  }

  if (candles.length === 0) throw new Error("Yahoo: no valid candles");
  return candles;
}

async function fetchTwelveData(symbol: string, interval: string): Promise<Candle[]> {
  const twelveSym = TWELVE_SYMBOLS[symbol];
  if (!twelveSym) throw new Error(`TwelveData: symbol ${symbol} unsupported`);

  const twInterval = TWELVE_INTERVAL[interval] || "1h";
  const outputsize = TWELVE_OUTPUTSIZE[interval] || 5000;

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(twelveSym)}&interval=${twInterval}&outputsize=${outputsize}&apikey=demo&format=JSON`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!response.ok) throw new Error(`TwelveData HTTP ${response.status}`);

  const json = await response.json() as {
    status?: string;
    values?: Array<{
      datetime: string; open: string; high: string; low: string; close: string;
    }>;
    message?: string;
  };

  if (json.status === "error") throw new Error(`TwelveData: ${json.message}`);
  if (!json.values?.length) throw new Error("TwelveData: no values");

  const candles: Candle[] = json.values
    .map((v) => ({
      time: Math.floor(new Date(v.datetime).getTime() / 1000),
      open: parseFloat(parseFloat(v.open).toFixed(5)),
      high: parseFloat(parseFloat(v.high).toFixed(5)),
      low: parseFloat(parseFloat(v.low).toFixed(5)),
      close: parseFloat(parseFloat(v.close).toFixed(5)),
    }))
    .filter((c) => !isNaN(c.time) && !isNaN(c.open))
    .sort((a, b) => a.time - b.time);

  if (candles.length === 0) throw new Error("TwelveData: no valid candles");
  return candles;
}

async function fetchCoinGecko(symbol: string, interval: string): Promise<Candle[]> {
  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) throw new Error(`CoinGecko: symbol ${symbol} unsupported`);

  const daysMap: Record<string, number> = {
    M15: 90, M30: 90, H1: 365, H4: 365, D1: 1825, W1: 1825,
  };
  const days = daysMap[interval] || 365;

  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);

  const json = await response.json() as number[][];
  if (!Array.isArray(json) || json.length === 0) throw new Error("CoinGecko: no data");

  const candles: Candle[] = json
    .map((row) => ({
      time: Math.floor(row[0] / 1000),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
    }))
    .filter((c) => !isNaN(c.open) && !isNaN(c.close))
    .sort((a, b) => a.time - b.time);

  if (candles.length === 0) throw new Error("CoinGecko: no valid candles");
  return candles;
}

type FetchFn = (symbol: string, interval: string) => Promise<Candle[]>;

function getFallbackChain(symbol: string): Array<{ name: string; fn: FetchFn }> {
  const chain: Array<{ name: string; fn: FetchFn }> = [];
  chain.push({ name: "Yahoo", fn: fetchYahoo });
  if (TWELVE_SYMBOLS[symbol]) {
    chain.push({ name: "TwelveData", fn: fetchTwelveData });
  }
  if (COINGECKO_IDS[symbol]) {
    chain.push({ name: "CoinGecko", fn: fetchCoinGecko });
  }
  return chain;
}

router.get("/backtest/candles", async (req, res) => {
  const symbol = (req.query.symbol as string || "EURUSD").toUpperCase().replace("/", "");
  const interval = (req.query.interval as string) || "H1";

  if (!YAHOO_SYMBOLS[symbol]) {
    res.status(400).json({
      error: `Symbol ${symbol} not supported. Available: ${Object.keys(YAHOO_SYMBOLS).join(", ")}`,
    });
    return;
  }

  const cacheKey = `${symbol}-${interval}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  const errors: string[] = [];
  const chain = getFallbackChain(symbol);

  for (const { name, fn } of chain) {
    try {
      const candles = await fn(symbol, interval);
      console.log(`[candles] ${name} OK: ${symbol} ${interval} → ${candles.length} candles`);
      const responseData = { symbol, interval, source: name.toLowerCase(), candles };
      cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
      res.json(responseData);
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${name}: ${msg}`);
      console.warn(`[candles] ${name} failed for ${symbol} ${interval}: ${msg}`);
    }
  }

  const stale = cache.get(cacheKey);
  if (stale) {
    console.log(`[candles] Serving stale cache for ${symbol} ${interval}`);
    res.json(stale.data);
    return;
  }

  res.status(502).json({ error: `All data sources failed for ${symbol} ${interval}`, details: errors });
});

export default router;
