import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Activity,
  Check,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const API = "/api";

interface MacroArticle {
  title: string;
  summary: string;
  impact: string;
  currency: string;
  direction: string;
  timestamp?: string;
}

interface MacroNewsData {
  articles: MacroArticle[];
  sentiment: string;
  summary: string;
  fetchedAt: string;
}

const ALL_CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"];

const STORAGE_KEY = "macro-news-currencies";

const CURRENCY_FLAGS: Record<string, string> = {
  EUR: "🇪🇺",
  USD: "🇺🇸",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  CHF: "🇨🇭",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  NZD: "🇳🇿",
  GLOBALE: "🌍",
};

const IMPACT_DOT: Record<string, string> = {
  alto: "🔴",
  medio: "🟡",
  basso: "🟢",
};

const IMPACT_STYLES: Record<string, string> = {
  alto: "text-red-400 bg-red-500/10 border-red-500/30",
  medio: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  basso: "text-green-400 bg-green-500/10 border-green-500/30",
};

const SENTIMENT_STYLES: Record<string, string> = {
  "risk-on": "text-primary bg-primary/10 border-primary/30",
  "risk-off": "text-destructive bg-destructive/10 border-destructive/30",
  neutrale: "text-muted-foreground bg-secondary/50 border-border",
};

const DIRECTION_ICONS: Record<string, React.ReactNode> = {
  bullish: <TrendingUp className="w-3.5 h-3.5 text-primary" />,
  bearish: <TrendingDown className="w-3.5 h-3.5 text-destructive" />,
  neutrale: <Minus className="w-3.5 h-3.5 text-muted-foreground" />,
};

function loadCurrencies(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...ALL_CURRENCIES];
}

function saveCurrencies(currencies: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currencies));
}

async function fetchMacroNews(currencies: string[]): Promise<MacroNewsData> {
  const qs = currencies.length === ALL_CURRENCIES.length || currencies.length === 0
    ? ""
    : `?currencies=${currencies.join(",")}`;
  const res = await fetch(`${API}/tools/macro-news${qs}`);
  if (!res.ok) throw new Error(`Errore ${res.status}`);
  return res.json();
}

export function MacroNewsTicker() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(loadCurrencies);

  useEffect(() => {
    saveCurrencies(selectedCurrencies);
  }, [selectedCurrencies]);

  const currenciesKey = useMemo(
    () => [...selectedCurrencies].sort().join(","),
    [selectedCurrencies],
  );

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["macro-news", currenciesKey],
    queryFn: () => fetchMacroNews(selectedCurrencies),
    refetchInterval: 30 * 60 * 1000,
    staleTime: 25 * 60 * 1000,
    retry: 1,
  });

  const tickerItems = useMemo(() => {
    if (!data?.articles?.length) return [];
    return data.articles.map((a) => {
      const flag = CURRENCY_FLAGS[a.currency] ?? "📊";
      const dot = IMPACT_DOT[a.impact] ?? "⚪";
      const impactLabel = a.impact ? a.impact.toUpperCase() : "";
      return `${dot} ${flag} ${a.currency}: ${a.title} — ${impactLabel}`;
    });
  }, [data]);

  const toggleCurrency = useCallback((cur: string) => {
    setSelectedCurrencies((prev) => {
      if (prev.includes(cur)) {
        const next = prev.filter((c) => c !== cur);
        return next.length === 0 ? [cur] : next;
      }
      return [...prev, cur];
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedCurrencies([...ALL_CURRENCIES]);
  }, []);

  const fetchedTime = useMemo(() => {
    if (!data?.fetchedAt) return null;
    return new Date(data.fetchedAt).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [data?.fetchedAt]);

  return (
    <>
      <div
        className="flex-1 min-w-0 overflow-hidden relative cursor-pointer group"
        onClick={() => setSheetOpen(true)}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Analisi macro AI...</span>
          </div>
        ) : isError ? (
          <span className="text-xs text-destructive/70">Errore caricamento notizie</span>
        ) : tickerItems.length > 0 ? (
          <div className="overflow-hidden whitespace-nowrap mask-fade">
            <div className="inline-flex animate-marquee gap-8">
              {tickerItems.map((item, i) => (
                <span
                  key={i}
                  className="text-xs text-muted-foreground font-medium group-hover:text-primary transition-colors"
                >
                  {item}
                </span>
              ))}
              {tickerItems.map((item, i) => (
                <span
                  key={`dup-${i}`}
                  className="text-xs text-muted-foreground font-medium group-hover:text-primary transition-colors"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Clicca per generare il briefing macro AI</span>
        )}
      </div>

      <button
        onClick={() => setSheetOpen((v) => !v)}
        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all shrink-0 ${
          sheetOpen
            ? "bg-primary/20 text-primary border border-primary/40"
            : "bg-card/50 text-muted-foreground border border-border hover:border-primary/30 hover:text-primary"
        }`}
        title="Agente Notizie Macro"
      >
        <Brain className="w-4 h-4" />
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  Agente Notizie Macro
                </SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  Briefing AI sulle notizie macroeconomiche
                  {fetchedTime && (
                    <span className="ml-2 text-muted-foreground/60">
                      Aggiornato alle {fetchedTime}
                    </span>
                  )}
                </SheetDescription>
              </div>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                {isFetching ? "Aggiornamento..." : "Aggiorna"}
              </button>
            </div>
          </SheetHeader>

          <div className="pt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Valute di interesse</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={selectAll}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    selectedCurrencies.length === ALL_CURRENCIES.length
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  Tutte
                </button>
                {ALL_CURRENCIES.map((cur) => {
                  const active = selectedCurrencies.includes(cur);
                  return (
                    <label
                      key={cur}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleCurrency(cur)}
                        className="sr-only"
                      />
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                        active ? "bg-primary border-primary" : "border-muted-foreground/40"
                      }`}>
                        {active && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </span>
                      {CURRENCY_FLAGS[cur]} {cur}
                    </label>
                  );
                })}
              </div>
            </div>

            {data?.sentiment && (
              <div className="flex items-center gap-3">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                    SENTIMENT_STYLES[data.sentiment] ?? SENTIMENT_STYLES["neutrale"]
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  {data.sentiment.toUpperCase()}
                </div>
                {data.summary && (
                  <p className="text-xs text-muted-foreground italic flex-1 line-clamp-2">
                    "{data.summary}"
                  </p>
                )}
              </div>
            )}

            {isFetching && !data && (
              <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm">Analisi macro in corso...</p>
                <p className="text-xs text-muted-foreground/60">Può richiedere 10-20 secondi</p>
              </div>
            )}

            {data?.articles && data.articles.length > 0 && (
              <div className="space-y-2.5">
                <AnimatePresence>
                  {data.articles.map((article, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="p-3.5 rounded-2xl border border-border bg-card/60 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold leading-tight flex-1">
                          {article.title}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="font-mono text-xs font-bold text-muted-foreground">
                            {CURRENCY_FLAGS[article.currency] ?? "📊"} {article.currency}
                          </span>
                          {DIRECTION_ICONS[article.direction] ?? DIRECTION_ICONS.neutrale}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {article.summary}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            IMPACT_STYLES[article.impact] ?? IMPACT_STYLES.basso
                          }`}
                        >
                          {article.impact.toUpperCase()}
                        </span>
                        <span
                          className={`text-[10px] font-medium ${
                            article.direction === "bullish"
                              ? "text-primary"
                              : article.direction === "bearish"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {article.direction}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {!data && !isFetching && (
              <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                <Brain className="w-10 h-10 opacity-20" />
                <p className="text-sm">Clicca "Aggiorna" per ottenere il briefing macro</p>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/50 text-center pt-2">
              Generato con AI · Non costituisce consulenza finanziaria
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
