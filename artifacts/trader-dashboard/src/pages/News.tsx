import { motion } from "framer-motion";
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, Key } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetMacroNews } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMacroNewsQueryKey } from "@workspace/api-client-react";

function SentimentBadge({ sentiment }: { sentiment?: string | null }) {
  if (!sentiment) return null;
  const config = {
    bullish: { label: "Rialzista", class: "bg-success/10 text-success border-success/30", icon: TrendingUp },
    bearish: { label: "Ribassista", class: "bg-destructive/10 text-destructive border-destructive/30", icon: TrendingDown },
    neutral: { label: "Neutro", class: "bg-white/5 text-muted-foreground border-white/10", icon: Minus },
  }[sentiment] ?? { label: sentiment, class: "bg-white/5 text-muted-foreground border-white/10", icon: Minus };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${config.class}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export default function News() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useGetMacroNews();

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: getGetMacroNewsQueryKey() });
  };

  return (
    <PageLayout>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-mono">Notizie Macro</h2>
          <p className="text-muted-foreground mt-1">News macroeconomiche in tempo reale su oro e dollaro.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </div>

      {!data?.hasApiKey && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-5 flex items-start gap-4">
            <Key className="w-8 h-8 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-400 mb-1">API Key Perplexity richiesta</h3>
              <p className="text-sm text-muted-foreground">
                Per accedere alle notizie macroeconomiche in tempo reale è necessaria una chiave API di Perplexity.
                Aggiungi il segreto <code className="bg-white/10 px-1 rounded text-xs">PERPLEXITY_API_KEY</code> nelle impostazioni dell'ambiente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="glass-card h-32 rounded-2xl animate-pulse bg-white/5" />
          ))}
        </div>
      ) : data?.articles && data.articles.length > 0 ? (
        <div className="space-y-4">
          {(data.articles as Array<{
            title: string;
            summary: string;
            source: string;
            publishedAt?: string | null;
            url?: string | null;
            sentiment?: string | null;
          }>).map((article, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
            >
              <Card className="glass-card hover:border-primary/40 transition-colors group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-bold text-lg leading-snug group-hover:text-primary transition-colors">
                      {article.url ? (
                        <a href={article.url} target="_blank" rel="noopener noreferrer">
                          {article.title}
                        </a>
                      ) : article.title}
                    </h3>
                    <SentimentBadge sentiment={article.sentiment} />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    {article.summary}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
                    <span className="font-medium">{article.source}</span>
                    {article.publishedAt && (
                      <>
                        <span>·</span>
                        <span>{new Date(article.publishedAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {data.fetchedAt && (
            <p className="text-center text-xs text-muted-foreground/50">
              Aggiornato: {new Date(data.fetchedAt).toLocaleTimeString("it-IT")}
            </p>
          )}
        </div>
      ) : data?.hasApiKey ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium mb-1">Nessuna notizia disponibile</p>
            <p className="text-sm text-muted-foreground">Prova ad aggiornare tra qualche istante.</p>
          </CardContent>
        </Card>
      ) : null}
    </PageLayout>
  );
}
