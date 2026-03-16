import { motion } from "framer-motion";
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, ExternalLink, Rss, Cpu } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface Article {
  title: string;
  summary: string;
  source: string;
  publishedAt?: string | null;
  url?: string | null;
  sentiment?: string | null;
}

interface NewsData {
  articles: Article[];
  fetchedAt: string;
  hasApiKey: boolean;
  source?: string;
}

function SentimentBadge({ sentiment }: { sentiment?: string | null }) {
  if (!sentiment) return null;
  const map: Record<string, { label: string; cls: string; Icon: typeof TrendingUp }> = {
    bullish: { label: "Rialzista 🟢", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", Icon: TrendingUp },
    bearish: { label: "Ribassista 🔴", cls: "bg-red-500/10 text-red-400 border-red-500/30", Icon: TrendingDown },
    neutral: { label: "Neutro ⚪", cls: "bg-white/5 text-muted-foreground border-white/10", Icon: Minus },
  };
  const cfg = map[sentiment] ?? map.neutral;
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function TimeAgo({ iso }: { iso?: string | null }) {
  if (!iso) return null;
  try {
    return (
      <span>
        {formatDistanceToNow(new Date(iso), { locale: it, addSuffix: true })}
      </span>
    );
  } catch {
    return null;
  }
}

export default function News() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useQuery<NewsData>({
    queryKey: ["macro-news"],
    queryFn: async () => {
      const res = await fetch("api/news", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const newsData = data;

  const handleRefresh = async () => {
    const res = await fetch("api/news?nocache=1", { credentials: "include" });
    if (res.ok) {
      const freshData = await res.json();
      qc.setQueryData(["macro-news"], freshData);
    }
  };

  const sourceLabel = newsData?.source === "ai" ? "Perplexity AI" : "RSS Feed in tempo reale";
  const SourceIcon = newsData?.source === "ai" ? Cpu : Rss;

  return (
    <PageLayout>
      <PageHeader
        title="Notizie Macro"
        subtitle="News su oro (XAU) e dollaro (USD) in tempo reale."
        action={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-36 rounded-2xl animate-pulse bg-white/5 border border-white/5" />
          ))}
        </div>
      ) : newsData?.articles && newsData.articles.length > 0 ? (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <SourceIcon className="w-3.5 h-3.5" />
            <span>Fonte: {sourceLabel}</span>
            {newsData.fetchedAt && (
              <>
                <span>·</span>
                <TimeAgo iso={newsData.fetchedAt} />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {newsData.articles.map((article, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
              >
                <Card className="bg-card/60 backdrop-blur-sm border-border/30 hover:border-primary/40 transition-all duration-200 group h-full flex flex-col">
                  <CardContent className="p-3 sm:p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-bold text-base leading-snug group-hover:text-primary transition-colors flex-1">
                        {article.url ? (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-start gap-1 hover:underline"
                          >
                            {article.title}
                            <ExternalLink className="w-3 h-3 mt-1 shrink-0 opacity-50" />
                          </a>
                        ) : (
                          article.title
                        )}
                      </h3>
                      <SentimentBadge sentiment={article.sentiment} />
                    </div>

                    {article.summary && article.summary !== article.title && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-2 flex-1">
                        {article.summary}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground/50 mt-auto">
                      <span className="font-medium text-muted-foreground/70">{article.source}</span>
                      {article.publishedAt && (
                        <>
                          <span>·</span>
                          <TimeAgo iso={article.publishedAt} />
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        <Card className="bg-card/60 backdrop-blur-sm border-border/30">
          <CardContent className="p-16 text-center">
            <Newspaper className="w-14 h-14 mx-auto mb-5 opacity-15" />
            <h3 className="text-xl font-bold mb-2">Nessuna notizia disponibile</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              Impossibile recuperare le notizie in questo momento. Controlla la connessione e riprova.
            </p>
            <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Riprova
            </Button>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
}
