import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface NewsArticle {
  title: string;
  summary: string;
  source: string;
  publishedAt: string | null;
  url: string | null;
  sentiment: string | null;
}

let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

function extractCDATA(block: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  return cdataRe.exec(block)?.[1] || plainRe.exec(block)?.[1] || "";
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#xA0;/g, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseRSS(xml: string, sourceName: string): NewsArticle[] {
  const items: NewsArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = decodeHtml(extractCDATA(block, "title"));
    const descRaw = extractCDATA(block, "description");
    const summary = decodeHtml(descRaw).slice(0, 280) || title;
    const pubDate = block.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] || null;
    const link =
      block.match(/<link>([^<]*)<\/link>/)?.[1] ||
      block.match(/<guid[^>]*>([^<]*)<\/guid>/)?.[1] || null;

    if (!title || title.length < 5) continue;

    let parsedDate: string | null = null;
    if (pubDate) {
      try { parsedDate = new Date(pubDate).toISOString(); } catch { /* ignore */ }
    }

    items.push({
      title,
      summary,
      source: sourceName,
      publishedAt: parsedDate,
      url: link?.startsWith("http") ? link : null,
      sentiment: null,
    });
  }
  return items;
}

async function fetchFeed(url: string, sourceName: string): Promise<NewsArticle[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  if (xml.trim().startsWith("<!DOCTYPE") || xml.trim().startsWith("<html")) {
    throw new Error("Received HTML instead of RSS");
  }
  return parseRSS(xml, sourceName);
}

async function fetchRSSNews(): Promise<NewsArticle[]> {
  const feeds = [
    { url: "https://seekingalpha.com/tag/gold.xml", source: "Seeking Alpha – Gold" },
    { url: "https://seekingalpha.com/tag/forex.xml", source: "Seeking Alpha – Forex" },
    { url: "https://www.cnbc.com/id/20409666/device/rss/rss.html", source: "CNBC Markets" },
    { url: "https://www.cnbc.com/id/15839135/device/rss/rss.html", source: "CNBC Finance" },
  ];

  const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f.url, f.source)));
  const all: NewsArticle[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      all.push(...r.value);
    } else {
      console.error(`[news] Feed ${feeds[i].source} failed:`, r.reason);
    }
  }

  // Filter only relevant articles about gold, dollar, macro, forex
  const keywords = /gold|xau|dollar|usd|forex|fed|rate|inflation|macro|silver|euro|yen|gbp|powell|treasury|yield|gdp|cpi/i;
  const filtered = all.filter((a) => keywords.test(a.title) || keywords.test(a.summary));

  // Deduplicate by title prefix
  const seen = new Set<string>();
  const deduped = (filtered.length >= 5 ? filtered : all).filter((a) => {
    const key = a.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by date descending
  deduped.sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return deduped.slice(0, 10);
}

async function tryPerplexity(apiKey: string): Promise<NewsArticle[] | null> {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a financial news analyst. Respond only with valid JSON and no extra text or markdown.",
          },
          {
            role: "user",
            content: `Give me the 5 most recent macro-economic news (last 24h) affecting gold (XAU/USD) or the US dollar.
Return ONLY this JSON (no markdown): {"articles":[{"title":"...","summary":"2-3 sentences","source":"...","publishedAt":"ISO date","sentiment":"bullish|bearish|neutral","url":null}]}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as { articles: NewsArticle[] };
    return Array.isArray(parsed.articles) && parsed.articles.length > 0 ? parsed.articles : null;
  } catch {
    return null;
  }
}

router.get("/news", async (req, res) => {
  const noCache = req.query.nocache === "1";
  if (!noCache && cache && Date.now() - cache.ts < CACHE_TTL) {
    res.json(cache.data);
    return;
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  let articles: NewsArticle[] = [];
  let source: "ai" | "rss" = "rss";

  if (apiKey) {
    const aiArticles = await tryPerplexity(apiKey);
    if (aiArticles && aiArticles.length > 0) {
      articles = aiArticles;
      source = "ai";
    }
  }

  if (source !== "ai") {
    try {
      articles = await fetchRSSNews();
    } catch {
      articles = [];
    }
  }

  const result = {
    articles,
    fetchedAt: new Date().toISOString(),
    hasApiKey: !!apiKey,
    source,
  };

  cache = { data: result, ts: Date.now() };
  res.json(result);
});

export default router;
