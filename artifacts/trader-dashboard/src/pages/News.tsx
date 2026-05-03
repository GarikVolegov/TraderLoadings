import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw,
  ExternalLink, Rss, Cpu, ShieldCheck, Clock, ChevronDown,
  ChevronUp, Zap, Bot,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useBackground } from "@/contexts/BackgroundContext";
import { useLanguage, useDateLocale } from "@/contexts/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  title: string;
  summary: string;
  source: string;
  sources?: string[];
  citationUrls?: string[];
  verified?: boolean;
  publishedAt?: string | null;
  url?: string | null;
  sentiment?: string | null;
  imageUrl?: string | null;
  affectedPairs?: string[];
  impactScore?: number;
  impactReason?: string;
}

interface NewsData {
  articles: Article[];
  fetchedAt: string;
  hasApiKey: boolean;
  source?: string;
  agentSummary?: string;
  watchedPairs?: string[];
  nextRefreshAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment?: string | null }) {
  const { t } = useLanguage();
  if (!sentiment) return null;
  const map: Record<string, { labelKey: string; cls: string; Icon: typeof TrendingUp }> = {
    bullish: { labelKey: "news.bullish", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", Icon: TrendingUp },
    bearish: { labelKey: "news.bearish", cls: "bg-red-500/10 text-red-400 border-red-500/30", Icon: TrendingDown },
    neutral: { labelKey: "news.neutral", cls: "bg-white/5 text-muted-foreground border-white/10", Icon: Minus },
  };
  const cfg = map[sentiment] ?? map.neutral;
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap shrink-0 ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {t(cfg.labelKey)}
    </span>
  );
}

function TimeAgo({ iso }: { iso?: string | null }) {
  const locale = useDateLocale();
  if (!iso) return null;
  try {
    return <span>{formatDistanceToNow(new Date(iso), { locale, addSuffix: true })}</span>;
  } catch {
    return null;
  }
}

function ImpactScore({ score }: { score: number }) {
  const color =
    score >= 8 ? "text-red-400 border-red-500/40 bg-red-500/10" :
    score >= 5 ? "text-amber-400 border-amber-500/40 bg-amber-500/10" :
                 "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  const label =
    score >= 8 ? "ALTO" :
    score >= 5 ? "MEDIO" : "BASSO";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${color}`}>
      <Zap className="w-2.5 h-2.5" />
      {score}/10 {label}
    </span>
  );
}

function PairBadge({ pair }: { pair: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/25 whitespace-nowrap">
      {pair}
    </span>
  );
}

// Countdown to next refresh
function RefreshCountdown({ nextRefreshAt }: { nextRefreshAt?: string }) {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!nextRefreshAt) return;
    const update = () => {
      const diff = new Date(nextRefreshAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining(null); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}m ${s.toString().padStart(2, "0")}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextRefreshAt]);

  if (!remaining) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50">
      <Clock className="w-3 h-3" />
      Aggiornamento tra {remaining}
    </span>
  );
}

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({ article, idx, isAI }: { article: Article; idx: number; isAI: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasImpactDetails = isAI && (article.impactScore || (article.affectedPairs && article.affectedPairs.length > 0) || article.impactReason);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="h-full"
    >
      <Card className="bg-card/60 backdrop-blur-sm border-border/30 hover:border-primary/40 transition-all duration-200 group h-full flex flex-col overflow-hidden">
        {/* Impact score header strip (AI only) */}
        {isAI && article.impactScore && (
          <div className={`h-0.5 w-full shrink-0 ${
            article.impactScore >= 8 ? "bg-red-500/60" :
            article.impactScore >= 5 ? "bg-amber-500/60" : "bg-emerald-500/60"
          }`} />
        )}

        {article.imageUrl && (
          <div className="w-full h-32 overflow-hidden shrink-0">
            <img
              src={article.imageUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        <CardContent className="p-4 flex flex-col flex-1 gap-2">
          {/* Impact + sentiment row */}
          {(article.impactScore || article.sentiment) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {isAI && article.impactScore && <ImpactScore score={article.impactScore} />}
              <SentimentBadge sentiment={article.sentiment} />
            </div>
          )}

          {/* Title */}
          <h3 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors">
            {article.url ? (
              <a href={article.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-start gap-1 hover:underline">
                {article.title}
                <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-50" />
              </a>
            ) : (
              article.title
            )}
          </h3>

          {/* Summary */}
          {article.summary && article.summary !== article.title && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
              {article.summary}
            </p>
          )}

          {/* Affected pairs */}
          {isAI && article.affectedPairs && article.affectedPairs.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-medium">Impatta:</span>
              {article.affectedPairs.map((p) => <PairBadge key={p} pair={p} />)}
            </div>
          )}

          {/* Impact reason expand */}
          {isAI && article.impactReason && (
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors font-medium"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Perché rilevante
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="mt-1.5 text-[11px] text-muted-foreground/80 leading-relaxed bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                      {article.impactReason}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 flex-wrap mt-auto pt-1 border-t border-border/20">
            <span className="font-medium text-muted-foreground/70">{article.source}</span>
            {article.publishedAt && (
              <>
                <span>·</span>
                <TimeAgo iso={article.publishedAt} />
              </>
            )}
            {article.verified && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 ml-auto">
                <ShieldCheck className="w-2.5 h-2.5" />
                {article.citationUrls && article.citationUrls.length > 0
                  ? `${article.citationUrls.length} URL`
                  : article.sources && article.sources.length >= 2
                    ? `${article.sources.length} FONTI`
                    : "✓"}
              </span>
            )}
          </div>

          {/* Citation URLs */}
          {article.citationUrls && article.citationUrls.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.citationUrls.map((url, si) => {
                let domain = url;
                try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* */ }
                return (
                  <a key={si} href={url} target="_blank" rel="noopener noreferrer" title={url}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border border-emerald-500/25 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/20 transition-all">
                    <ExternalLink className="w-2 h-2 shrink-0" />
                    {domain.length > 22 ? domain.slice(0, 20) + "…" : domain}
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function News() {
  const { t, language } = useLanguage();
  const qc = useQueryClient();
  const { selectedPairs } = useBackground();
  const pairsParam = selectedPairs.length > 0 ? `&pairs=${selectedPairs.join(",")}` : "";
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, isFetching } = useQuery<NewsData>({
    queryKey: ["macro-news", selectedPairs, language],
    queryFn: async () => {
      const res = await fetch(`api/news?_=1${pairsParam}&lang=${language}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    staleTime: 9 * 60 * 1000,           // stale dopo 9 min (server cache = 10 min)
    refetchInterval: 10 * 60 * 1000,    // auto-refresh ogni 10 min
    refetchIntervalInBackground: false,  // solo se la tab è attiva
  });

  const newsData = data;
  const isAI = newsData?.source === "ai";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`api/news?nocache=1${pairsParam}&lang=${language}`, { credentials: "include" });
      if (res.ok) {
        const freshData = await res.json();
        qc.setQueryData(["macro-news", selectedPairs, language], freshData);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const SourceIcon = isAI ? Cpu : Rss;
  const sourceLabel = isAI ? t("news.source.ai") : t("news.source.rss");

  return (
    <PageLayout>
      <PageHeader
        title={t("news.title")}
        subtitle={t("news.subtitle")}
        action={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing || isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing || isFetching ? "animate-spin" : ""}`} />
            {t("news.refresh")}
          </Button>
        }
      />

      {/* Agent summary panel (AI only) */}
      <AnimatePresence>
        {isAI && newsData?.agentSummary && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-bold text-primary/80 uppercase tracking-wider">Analisi AI Agent</span>
                {newsData.watchedPairs && newsData.watchedPairs.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {newsData.watchedPairs.map((p) => <PairBadge key={p} pair={p} />)}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground/90 leading-relaxed">{newsData.agentSummary}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meta bar (source, time, countdown) */}
      {newsData && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground/60 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <SourceIcon className="w-3.5 h-3.5" />
            {sourceLabel}
          </span>
          {newsData.fetchedAt && (
            <>
              <span>·</span>
              <TimeAgo iso={newsData.fetchedAt} />
            </>
          )}
          {isAI && newsData.nextRefreshAt && (
            <>
              <span>·</span>
              <RefreshCountdown nextRefreshAt={newsData.nextRefreshAt} />
            </>
          )}
        </div>
      )}

      {/* News grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 rounded-2xl animate-pulse bg-white/5 border border-white/5" />
          ))}
        </div>
      ) : newsData?.articles && newsData.articles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {newsData.articles.map((article, idx) => (
            <ArticleCard key={idx} article={article} idx={idx} isAI={isAI} />
          ))}
        </div>
      ) : (
        <Card className="bg-card/60 backdrop-blur-sm border-border/30">
          <CardContent className="p-16 text-center">
            <Newspaper className="w-14 h-14 mx-auto mb-5 opacity-15" />
            <h3 className="text-xl font-bold mb-2">{t("news.empty")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              {t("news.empty_desc")}
            </p>
            <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              {t("news.refresh")}
            </Button>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
}
