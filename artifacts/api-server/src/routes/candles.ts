import { Router, type IRouter } from "express";

const router: IRouter = Router();

const YAHOO_SYMBOLS: Record<string, string> = {
  "EURUSD": "EURUSD=X", "GBPUSD": "GBPUSD=X", "USDJPY": "USDJPY=X",
  "USDCHF": "USDCHF=X", "AUDUSD": "AUDUSD=X", "NZDUSD": "NZDUSD=X",
  "USDCAD": "USDCAD=X", "EURGBP": "EURGBP=X", "EURJPY": "EURJPY=X",
  "GBPJPY": "GBPJPY=X", "AUDJPY": "AUDJPY=X", "XAUUSD": "GC=F",
  "US30": "YM=F", "NAS100": "NQ=F", "SPX500": "ES=F",
  "BTCUSD": "BTC-USD", "ETHUSD": "ETH-USD",
};

const INTERVAL_MAP: Record<string, string> = {
  "M15": "15m", "M30": "30m", "H1": "1h", "H4": "4h", "D1": "1d", "W1": "1wk",
};

const RANGE_MAP: Record<string, string> = {
  "M15": "60d", "M30": "60d", "H1": "2y", "H4": "2y", "D1": "10y", "W1": "10y",
};

interface CachedData {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CachedData>();
const CACHE_TTL = 60 * 60 * 1000;

router.get("/backtest/candles", async (req, res) => {
  const symbol = (req.query.symbol as string || "EURUSD").toUpperCase().replace("/", "");
  const interval = (req.query.interval as string) || "H1";

  const yahooSymbol = YAHOO_SYMBOLS[symbol];
  if (!yahooSymbol) {
    res.status(400).json({ error: `Symbol ${symbol} not supported. Available: ${Object.keys(YAHOO_SYMBOLS).join(", ")}` });
    return;
  }

  const yahooInterval = INTERVAL_MAP[interval] || "1h";
  const range = RANGE_MAP[interval] || "2y";

  const cacheKey = `${symbol}-${interval}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${yahooInterval}&range=${range}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`);
    }

    const json = await response.json() as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }>;
          };
        }>;
      };
    };

    const result = json?.chart?.result?.[0];
    if (!result?.timestamp || !result?.indicators?.quote?.[0]) {
      throw new Error("Invalid data from Yahoo Finance");
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const candles: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = quote.open?.[i];
      const h = quote.high?.[i];
      const l = quote.low?.[i];
      const c = quote.close?.[i];
      if (o != null && h != null && l != null && c != null) {
        candles.push({
          time: timestamps[i],
          open: parseFloat(o.toFixed(5)),
          high: parseFloat(h.toFixed(5)),
          low: parseFloat(l.toFixed(5)),
          close: parseFloat(c.toFixed(5)),
        });
      }
    }

    const responseData = { symbol, interval, candles };
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    res.json(responseData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Candle fetch error for ${symbol}:`, message);
    const stale = cache.get(cacheKey);
    if (stale) {
      res.json(stale.data);
      return;
    }
    res.status(502).json({ error: `Failed to fetch candle data: ${message}` });
  }
});

export default router;
