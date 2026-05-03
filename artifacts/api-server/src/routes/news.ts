import { Router, type IRouter } from "express";
import { getCurrenciesFromPairs } from "@workspace/pair-catalog";

const router: IRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsArticle {
  title: string;
  summary: string;
  source: string;
  sources?: string[];
  citationUrls?: string[];
  verified?: boolean;
  publishedAt: string | null;
  url: string | null;
  sentiment: string | null;
  imageUrl: string | null;
  // AI agent fields
  affectedPairs?: string[];
  impactScore?: number;       // 1–10
  impactReason?: string;      // perché è rilevante per questi pair
}

interface NewsResponse {
  articles: NewsArticle[];
  fetchedAt: string;
  hasApiKey: boolean;
  source: "ai" | "rss";
  // AI agent fields
  agentSummary?: string;
  watchedPairs?: string[];
  nextRefreshAt?: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let cache: { data: NewsResponse; ts: number; key: string } | null = null;

const AI_CACHE_TTL  = 60 * 60 * 1000;  // 1 ora per Perplexity (come richiesto)
const RSS_CACHE_TTL = 10 * 60 * 1000;  // 10 min per RSS fallback

// Short-circuit: se la chiave Perplexity restituisce 401, evita di riprovare per 1 ora
let _perplexityKeyInvalidUntil = 0;

// ─── RSS helpers ──────────────────────────────────────────────────────────────

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
      title, summary, source: sourceName,
      publishedAt: parsedDate,
      url: link?.startsWith("http") ? link : null,
      sentiment: null, imageUrl,
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

// ─── Keyword filtering (RSS) ──────────────────────────────────────────────────

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

// Formats pair symbols for Perplexity prompt (e.g. "XAUUSD" → "XAU/USD")
function formatPairsForPrompt(pairsStr: string): string {
  if (!pairsStr) return "gold (XAU/USD), US dollar (DXY) and major forex pairs";
  const pairs = pairsStr.split(",").map((p) => {
    const s = p.trim();
    if (s.length === 6) return `${s.slice(0, 3)}/${s.slice(3)}`;
    return s;
  }).filter(Boolean);
  return pairs.length > 0 ? pairs.join(", ") : "major forex pairs";
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
      console.warn(`[news] Feed ${feeds[i].source} failed:`, r.reason);
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

// ─── Image helper ─────────────────────────────────────────────────────────────

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

// ─── Translation (RSS fallback) ───────────────────────────────────────────────

const VALID_NEWS_LANGS = new Set(["it", "en", "es", "fr", "de"]);
function sanitizeNewsLang(raw: string | undefined): string {
  const l = (raw ?? "it").toLowerCase().slice(0, 2);
  return VALID_NEWS_LANGS.has(l) ? l : "it";
}

async function translateNewsArticle(title: string, summary: string, lang: string): Promise<{ title: string; summary: string }> {
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

// ─── Perplexity AI Agent ──────────────────────────────────────────────────────

const NEWS_LANG_NAMES: Record<string, string> = {
  it: "Italian", en: "English", es: "Spanish", fr: "French", de: "German",
};

interface PerplexityArticle extends NewsArticle {
  imageKeywords?: string[];
  affectedPairs?: string[];
  impactScore?: number;
  impactReason?: string;
}

interface PerplexityResponse {
  agentSummary: string;
  articles: PerplexityArticle[];
}

async function tryPerplexity(
  apiKey: string,
  pairCurrencies: string[],
  pairsStr: string,
  lang = "it",
): Promise<{ articles: NewsArticle[]; agentSummary: string } | null> {
  if (Date.now() < _perplexityKeyInvalidUntil) return null;

  const langName = NEWS_LANG_NAMES[lang] ?? "Italian";
  const formattedPairs = formatPairsForPrompt(pairsStr);
  const currencyFocus = pairCurrencies.length > 0
    ? pairCurrencies.join(", ")
    : "USD, EUR, XAU";

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        search_recency_filter: "day",
        return_citations: true,
        messages: [
          {
            role: "system",
            content: `You are an expert forex and commodities market analyst AI agent. Your job is to:
1. Search the web for the most impactful macro-economic and geopolitical news from the last 24 hours
2. Carefully select ONLY news that directly affects the user's specific trading pairs
3. For each article, explain exactly WHY it matters and score its market impact (1-10)
4. Write a brief agent summary of the overall market situation for these pairs today
Respond ONLY with valid JSON. All text (title, summary, impactReason, agentSummary) MUST be in ${langName}.`,
          },
          {
            role: "user",
            content: `The user trades these pairs: ${formattedPairs}
Key currencies involved: ${currencyFocus}

Search for and select the 6 most market-moving news from the last 24 hours that DIRECTLY affect these specific pairs. Be selective — only include news that genuinely moves these markets.

Return ONLY this JSON structure (no markdown, no extra text):
{
  "agentSummary": "2-3 sentence overview in ${langName} of today's macro situation for ${formattedPairs}",
  "articles": [
    {
      "title": "article title in ${langName}",
      "summary": "2-3 sentence summary in ${langName} explaining the news",
      "impactReason": "1-2 sentences in ${langName} explaining specifically why this affects ${formattedPairs}",
      "impactScore": 8,
      "affectedPairs": ["EUR/USD", "GBP/USD"],
      "sentiment": "bullish|bearish|neutral",
      "source": "Primary source name",
      "sources": ["Source 1", "Source 2"],
      "publishedAt": "ISO date or null",
      "url": null,
      "imageKeywords": ["keyword1", "keyword2"]
    }
  ]
}

RULES:
- impactScore: 1-10 (10 = extremely high market impact, e.g. Fed rate decision; 1 = low)
- affectedPairs: only include pairs from the user's list that are actually affected
- sentiment: from the perspective of the BASE currency (first in the pair)
- Order articles by impactScore descending
- Include both macro-economic data (CPI, NFP, PMI, rate decisions) AND geopolitical events`,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      if (response.status === 401 || response.status === 403) {
        _perplexityKeyInvalidUntil = Date.now() + 60 * 60 * 1000;
        console.warn(`[news/agent] Chiave API non valida (${response.status}) — fallback RSS per 1h`);
      } else {
        console.warn(`[news/agent] HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }
      return null;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      citations?: string[];
    };

    const realCitationUrls: string[] = (data.citations ?? []).filter(
      (u) => typeof u === "string" && u.startsWith("http"),
    );
    if (realCitationUrls.length > 0) {
      console.info(`[news/agent] ${realCitationUrls.length} citation URLs from Perplexity`);
    }

    const raw = data.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as PerplexityResponse;

    if (!Array.isArray(parsed.articles) || parsed.articles.length === 0) return null;

    const articles: NewsArticle[] = parsed.articles.map((a, i) => {
      const rawSources = Array.isArray(a.sources) && a.sources.length > 0
        ? a.sources
        : a.source ? [a.source] : [];
      const dedupedSources = [...new Set(rawSources.map((s) => String(s).trim()).filter(Boolean))];

      // Distribute Perplexity citation URLs across articles
      let articleCitationUrls: string[] = [];
      if (realCitationUrls.length > 0) {
        const perArticle = 3;
        const startIdx = (i * perArticle) % realCitationUrls.length;
        const slice1 = realCitationUrls.slice(startIdx, startIdx + perArticle);
        const slice2 = realCitationUrls.slice(0, Math.max(0, perArticle - slice1.length));
        articleCitationUrls = [...new Set([...slice1, ...slice2])].slice(0, perArticle);
      }

      return {
        title: a.title,
        summary: a.summary,
        source: a.source || dedupedSources[0] || "",
        sources: dedupedSources,
        citationUrls: articleCitationUrls,
        verified: realCitationUrls.length >= 3 || dedupedSources.length >= 2,
        publishedAt: a.publishedAt ?? null,
        url: a.url ?? null,
        sentiment: a.sentiment ?? null,
        imageUrl: buildNewsImageUrl(a.imageKeywords, a.sentiment ?? null, i),
        // AI agent enrichment
        affectedPairs: Array.isArray(a.affectedPairs) ? a.affectedPairs : [],
        impactScore: typeof a.impactScore === "number" ? Math.min(10, Math.max(1, Math.round(a.impactScore))) : undefined,
        impactReason: typeof a.impactReason === "string" ? a.impactReason : undefined,
      };
    });

    console.info(`[news/agent] OK — ${articles.length} curated articles for [${formattedPairs}]`);
    return { articles, agentSummary: parsed.agentSummary ?? "" };

  } catch (err) {
    console.warn("[news/agent] Error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get("/news", async (req, res) => {
  const noCache    = req.query.nocache === "1";
  const pairsStr   = (req.query.pairs as string) || "";
  const lang       = sanitizeNewsLang(req.query.lang as string | undefined);
  const pairCurrencies = pairsToCurrencies(pairsStr);
  const baseCacheKey   = pairCurrencies.length > 0 ? pairCurrencies.sort().join(",") : "all";
  const cacheKey       = `${baseCacheKey}:${lang}`;

  // Check cache — use different TTL depending on source
  if (!noCache && cache && cache.key === cacheKey) {
    const ttl = cache.data.source === "ai" ? AI_CACHE_TTL : RSS_CACHE_TTL;
    if (Date.now() - cache.ts < ttl) {
      res.json(cache.data);
      return;
    }
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  let articles: NewsArticle[] = [];
  let source: "ai" | "rss" = "rss";
  let agentSummary: string | undefined;
  let nextRefreshAt: string | undefined;

  // 1. Try Perplexity AI agent
  if (apiKey) {
    const aiResult = await tryPerplexity(apiKey, pairCurrencies, pairsStr, lang);
    if (aiResult && aiResult.articles.length > 0) {
      articles = aiResult.articles;
      agentSummary = aiResult.agentSummary;
      source = "ai";
      nextRefreshAt = new Date(Date.now() + AI_CACHE_TTL).toISOString();
    }
  }

  // 2. RSS fallback
  if (source !== "ai") {
    try {
      const rssArticles = await fetchRSSNews(pairCurrencies.length > 0 ? pairCurrencies : ["USD", "XAU"]);
      const withImages = rssArticles.map((a, i) => ({
        ...a,
        imageUrl: a.imageUrl ?? buildNewsImageUrl(undefined, a.sentiment, i),
      }));
      articles = lang !== "en"
        ? await Promise.all(
            withImages.map(async (a) => {
              const { title, summary } = await translateNewsArticle(a.title, a.summary, lang);
              return { ...a, title, summary };
            })
          )
        : withImages;
      nextRefreshAt = new Date(Date.now() + RSS_CACHE_TTL).toISOString();
    } catch {
      articles = [];
    }
  }

  const watchedPairs = pairsStr
    ? pairsStr.split(",").map((p) => {
        const s = p.trim();
        return s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s;
      }).filter(Boolean)
    : [];

  const result: NewsResponse = {
    articles,
    fetchedAt: new Date().toISOString(),
    hasApiKey: !!apiKey,
    source,
    agentSummary,
    watchedPairs,
    nextRefreshAt,
  };

  cache = { data: result, ts: Date.now(), key: cacheKey };
  res.json(result);
});

export default router;
