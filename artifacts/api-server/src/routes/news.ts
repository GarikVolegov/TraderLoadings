import { Router, type IRouter } from "express";

const router: IRouter = Router();

let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000;

router.get("/news", async (_req, res) => {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    res.json({
      articles: [],
      fetchedAt: new Date().toISOString(),
      hasApiKey: false,
    });
    return;
  }

  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    res.json(cache.data);
    return;
  }

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a financial news analyst. Respond only in valid JSON.",
          },
          {
            role: "user",
            content: `Give me the 5 most important macro-economic news from the last 24 hours that affect gold (XAU/USD) or the US dollar (DXY/USD). 
For each news, provide: title, a 2-3 sentence summary, source name, approximate publishedAt (ISO date), and sentiment (bullish/bearish/neutral) for gold.
Respond with this exact JSON structure (no markdown, no extra text):
{"articles":[{"title":"...","summary":"...","source":"...","publishedAt":"...","sentiment":"bullish|bearish|neutral","url":null}]}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content ?? "{}";

    let parsed: { articles: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { articles: [] };
    }

    const result = {
      articles: parsed.articles || [],
      fetchedAt: new Date().toISOString(),
      hasApiKey: true,
    };

    cache = { data: result, ts: Date.now() };
    res.json(result);
  } catch (err) {
    console.error("News fetch error:", err);
    res.json({
      articles: [],
      fetchedAt: new Date().toISOString(),
      hasApiKey: true,
    });
  }
});

export default router;
