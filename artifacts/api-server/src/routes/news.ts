import { Router, type IRouter } from "express";
import { getCurrenciesFromPairs } from "@workspace/pair-catalog";

const router: IRouter = Router();

interface NewsArticle {
  title: string;
  summary: string;
  source: string;
  publishedAt: string | null;
  url: string | null;
  sentiment: string | null;
  imageUrl: string | null;
}

let cache: { data: unknown; ts: number; key: string } | null = null;
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

function extractRSSImage(block: string, descRaw: string): string | null {
  const enclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image[^"']*["']/i)?.[1]
    || block.match(/<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/i)?.[1];
  if (enclosure) return enclosure;

  const mediaContent = block.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*(?:type=["']image[^"']*["']|medium=["']image["'])/i)?.[1]
    || block.match(/<media:content[^>]+(?:type=["']image[^"']*["']|medium=["']image["'])[^>]+url=["']([^"']+)["']/i)?.[1]
    || block.match(/<media:content[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp|gif))["']/i)?.[1];
  if (mediaContent) return mediaContent;

  const mediaThumbnail = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1];
  if (mediaThumbnail) return mediaThumbnail;

  const imgInDesc = descRaw.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)[^"']*)["']/i)?.[1];
  if (imgInDesc) return imgInDesc;

  return null;
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

    const imageUrl = extractRSSImage(block, descRaw);

    items.push({
      title,
      summary,
      source: sourceName,
      publishedAt: parsedDate,
      url: link?.startsWith("http") ? link : null,
      sentiment: null,
      imageUrl,
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

const PAIR_KEYWORDS: Record<string, string[]> = {
  EUR: ["euro", "eur", "ecb", "bce", "lagarde", "eurozone"],
  USD: ["dollar", "usd", "dxy", "fed", "fomc", "powell", "treasury", "nonfarm", "payroll"],
  GBP: ["pound", "gbp", "sterling", "boe", "bank of england", "bailey"],
  JPY: ["yen", "jpy", "boj", "bank of japan", "ueda"],
  CHF: ["swiss", "chf", "snb", "franc"],
  CAD: ["canadian", "cad", "boc", "bank of canada"],
  AUD: ["aussie", "aud", "rba", "reserve bank of australia"],
  NZD: ["kiwi", "nzd", "rbnz"],
  XAU: ["gold", "xau", "bullion", "world gold council"],
  XAG: ["silver", "xag"],
  BTC: ["bitcoin", "btc", "crypto"],
  ETH: ["ethereum", "eth"],
  MXN: ["peso", "mxn", "banxico"],
  ZAR: ["rand", "zar", "sarb"],
  TRY: ["lira", "try", "tcmb"],
  SGD: ["singapore", "sgd", "mas"],
  HKD: ["hong kong", "hkd", "hkma"],
  NOK: ["krone", "nok", "norges"],
  SEK: ["krona", "sek", "riksbank"],
};

function buildKeywordsRegex(pairCurrencies: string[]): RegExp {
  const baseKeywords = ["inflation", "gdp", "cpi", "rate\\s*(cut|hike|decision)", "central\\s*bank", "monetary\\s*policy", "yield"];
  const pairKw: string[] = [];
  for (const c of pairCurrencies) {
    const kws = PAIR_KEYWORDS[c.toUpperCase()];
    if (kws) pairKw.push(...kws);
  }
  const allKw = [...new Set([...baseKeywords, ...pairKw])];
  return new RegExp(allKw.join("|"), "i");
}

function pairsToCurrencies(pairsStr: string): string[] {
  if (!pairsStr) return [];
  const symbols = pairsStr.split(",").map((s) => s.trim()).filter(Boolean);
  return getCurrenciesFromPairs(symbols);
}

async function fetchRSSNews(pairCurrencies: string[]): Promise<NewsArticle[]> {
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

  const keywords = buildKeywordsRegex(pairCurrencies);
  const filtered = all.filter((a) => keywords.test(a.title) || keywords.test(a.summary));

  const seen = new Set<string>();
  const deduped = (filtered.length >= 5 ? filtered : all).filter((a) => {
    const key = a.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return deduped.slice(0, 10);
}

function buildNewsImageUrl(keywords: string[] | undefined, sentiment: string | null, index = 0): string {
  const lock = (index * 37 + 1) % 1000 || 1;
  const kws = (keywords ?? []).filter(Boolean).slice(0, 3);
  if (kws.length > 0) {
    return `https://loremflickr.com/800/400/${kws.join(",")}?lock=${lock}`;
  }
  const sentMap: Record<string, string> = {
    bullish: "growth,economy,finance", bearish: "recession,economy,finance", neutral: "economy,finance,market",
  };
  return `https://loremflickr.com/800/400/${sentMap[sentiment ?? ""] ?? "economy,finance,market"}?lock=${lock}`;
}

const VALID_NEWS_LANGS = new Set(["it", "en", "es", "fr", "de"]);
function sanitizeNewsLang(raw: string | undefined): string {
  const l = (raw ?? "it").toLowerCase().slice(0, 2);
  return VALID_NEWS_LANGS.has(l) ? l : "it";
}

async function translateNewsArticle(
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

const NEWS_LANG_NAMES: Record<string, string> = {
  it: "Italian", en: "English", es: "Spanish", fr: "French", de: "German",
};

async function tryPerplexity(apiKey: string, pairCurrencies: string[], lang = "it"): Promise<NewsArticle[] | null> {
  const currencyFocus = pairCurrencies.length > 0
    ? pairCurrencies.join(", ")
    : "gold (XAU/USD) or the US dollar";

  const langName = NEWS_LANG_NAMES[lang] ?? "Italian";

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
            content: `You are a financial news analyst. Respond only with valid JSON and no extra text or markdown. Write all title and summary fields in ${langName}.`,
          },
          {
            role: "user",
            content: `Give me the 5 most recent macro-economic news (last 24h) affecting ${currencyFocus}.
Return ONLY this JSON (no markdown): {"articles":[{"title":"...","summary":"2-3 sentences","source":"...","publishedAt":"ISO date","sentiment":"bullish|bearish|neutral","url":null,"imageKeywords":["keyword1","keyword2"]}]}
IMPORTANT: title and summary must be written in ${langName}.
imageKeywords: 2-3 short English words for a representative image (e.g. ["inflation","federal reserve"], ["gold","bullion"])`,
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
    const parsed = JSON.parse(cleaned) as { articles: Array<NewsArticle & { imageKeywords?: string[] }> };
    if (!Array.isArray(parsed.articles) || parsed.articles.length === 0) return null;
    return parsed.articles.map((a, i) => ({
      ...a,
      imageUrl: a.imageUrl ?? buildNewsImageUrl(a.imageKeywords, a.sentiment, i),
    }));
  } catch {
    return null;
  }
}

router.get("/news", async (req, res) => {
  const noCache = req.query.nocache === "1";
  const pairsStr = (req.query.pairs as string) || "";
  const lang = sanitizeNewsLang(req.query.lang as string | undefined);
  const pairCurrencies = pairsToCurrencies(pairsStr);
  const baseCacheKey = pairCurrencies.length > 0 ? pairCurrencies.sort().join(",") : "all";
  const cacheKey = `${baseCacheKey}:${lang}`;

  if (!noCache && cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
    res.json(cache.data);
    return;
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  let articles: NewsArticle[] = [];
  let source: "ai" | "rss" = "rss";

  if (apiKey) {
    const aiArticles = await tryPerplexity(apiKey, pairCurrencies, lang);
    if (aiArticles && aiArticles.length > 0) {
      articles = aiArticles;
      source = "ai";
    }
  }

  if (source !== "ai") {
    try {
      const rssArticles = await fetchRSSNews(pairCurrencies.length > 0 ? pairCurrencies : ["USD", "XAU"]);
      const withImages = rssArticles.map((a, i) => ({
        ...a,
        imageUrl: a.imageUrl ?? buildNewsImageUrl(undefined, a.sentiment, i),
      }));
      // Translate RSS articles to user language (parallel, with timeout fallback)
      articles = lang !== "en"
        ? await Promise.all(
            withImages.map(async (a) => {
              const { title, summary } = await translateNewsArticle(a.title, a.summary, lang);
              return { ...a, title, summary };
            })
          )
        : withImages;
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

  cache = { data: result, ts: Date.now(), key: cacheKey };
  res.json(result);
});

export default router;
