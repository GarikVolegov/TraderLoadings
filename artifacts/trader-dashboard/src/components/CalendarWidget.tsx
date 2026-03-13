import { useState, useMemo } from "react";
import { Calendar, RefreshCw, Clock, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetEconomicCalendar, getGetEconomicCalendarQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"] as const;

const IMPACT_CONFIG = {
  High: { color: "bg-red-500", border: "border-red-500/30", text: "text-red-400", label: "Alto" },
  Medium: { color: "bg-orange-500", border: "border-orange-500/30", text: "text-orange-400", label: "Medio" },
  Low: { color: "bg-yellow-500", border: "border-yellow-500/30", text: "text-yellow-400", label: "Basso" },
  Holiday: { color: "bg-blue-500", border: "border-blue-500/30", text: "text-blue-400", label: "Festivo" },
} as const;

type Impact = keyof typeof IMPACT_CONFIG;

export function CalendarWidget() {
  const queryClient = useQueryClient();
  const [selectedCurrencies, setSelectedCurrencies] = useState<Set<string>>(new Set(["USD", "EUR", "GBP"]));
  const [selectedImpacts, setSelectedImpacts] = useState<Set<string>>(new Set(["High", "Medium"]));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [forceNocache, setForceNocache] = useState(false);

  const { data: events, isLoading, refetch } = useGetEconomicCalendar(
    forceNocache ? { nocache: "1" } : {},
  );

  const toggleCurrency = (currency: string) => {
    setSelectedCurrencies((prev) => {
      const next = new Set(prev);
      if (next.has(currency)) {
        if (next.size > 1) next.delete(currency);
      } else {
        next.add(currency);
      }
      return next;
    });
  };

  const toggleImpact = (impact: string) => {
    setSelectedImpacts((prev) => {
      const next = new Set(prev);
      if (next.has(impact)) {
        if (next.size > 1) next.delete(impact);
      } else {
        next.add(impact);
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setForceNocache(true);
    await queryClient.invalidateQueries({ queryKey: getGetEconomicCalendarQueryKey() });
    await refetch();
    setForceNocache(false);
    setIsRefreshing(false);
  };

  const now = new Date();

  const filtered = useMemo(() => {
    if (!events) return [];
    return events.filter(
      (e) => selectedCurrencies.has(e.country) && selectedImpacts.has(e.impact)
    );
  }, [events, selectedCurrencies, selectedImpacts]);

  const upcoming = filtered.filter((e) => new Date(e.date) >= now);
  const past = filtered.filter((e) => new Date(e.date) < now);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const day = d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });

    if (isToday) return { day: "Oggi", time };
    if (isTomorrow) return { day: "Domani", time };
    return { day, time };
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6 border-b border-border/50 bg-secondary/10">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
          Calendario Economico
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          className="h-8 w-8 text-muted-foreground hover:text-primary"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>

      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valuta</p>
          <div className="flex flex-wrap gap-1.5">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => toggleCurrency(c)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  selectedCurrencies.has(c)
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-secondary/40 text-muted-foreground border border-border/50 hover:border-primary/30"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Impatto</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(IMPACT_CONFIG) as Impact[]).filter(i => i !== "Holiday").map((impact) => {
              const cfg = IMPACT_CONFIG[impact];
              return (
                <button
                  key={impact}
                  onClick={() => toggleImpact(impact)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedImpacts.has(impact)
                      ? `${cfg.border} ${cfg.text} bg-secondary/60 border`
                      : "bg-secondary/40 text-muted-foreground border border-border/50 hover:border-primary/30"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/30 pt-3">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nessun evento trovato con i filtri selezionati.
            </div>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
              {upcoming.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Prossimi ({upcoming.length})
                  </p>
                  {upcoming.map((event, i) => {
                    const { day, time } = formatDate(event.date);
                    const cfg = IMPACT_CONFIG[event.impact as Impact] ?? IMPACT_CONFIG.Low;
                    return (
                      <div
                        key={`upcoming-${i}`}
                        className={`flex items-start gap-3 p-2.5 rounded-lg bg-secondary/20 border ${cfg.border} hover:bg-secondary/40 transition-colors`}
                      >
                        <div className="flex flex-col items-center min-w-[52px] text-center">
                          <span className="text-[10px] text-muted-foreground leading-tight">{day}</span>
                          <span className="text-sm font-mono font-bold text-foreground">{time}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`w-2 h-2 rounded-full ${cfg.color} shrink-0`} />
                            <span className="text-xs font-bold text-muted-foreground">{event.country}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                          {(event.forecast || event.previous) && (
                            <div className="flex gap-3 mt-1 text-[11px]">
                              {event.forecast && (
                                <span className="text-muted-foreground">
                                  Prev: <span className="text-foreground font-mono">{event.forecast}</span>
                                </span>
                              )}
                              {event.previous && (
                                <span className="text-muted-foreground">
                                  Prec: <span className="text-foreground font-mono">{event.previous}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {past.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Passati ({past.length})
                  </p>
                  {past.map((event, i) => {
                    const { day, time } = formatDate(event.date);
                    const cfg = IMPACT_CONFIG[event.impact as Impact] ?? IMPACT_CONFIG.Low;
                    return (
                      <div
                        key={`past-${i}`}
                        className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/10 border border-border/20 opacity-50"
                      >
                        <div className="flex flex-col items-center min-w-[52px] text-center">
                          <span className="text-[10px] text-muted-foreground leading-tight">{day}</span>
                          <span className="text-sm font-mono font-bold text-muted-foreground">{time}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`w-2 h-2 rounded-full ${cfg.color} shrink-0 opacity-50`} />
                            <span className="text-xs font-bold text-muted-foreground">{event.country}</span>
                          </div>
                          <p className="text-sm font-medium text-muted-foreground truncate">{event.title}</p>
                          {(event.forecast || event.previous) && (
                            <div className="flex gap-3 mt-1 text-[11px]">
                              {event.forecast && (
                                <span className="text-muted-foreground">
                                  Prev: <span className="font-mono">{event.forecast}</span>
                                </span>
                              )}
                              {event.previous && (
                                <span className="text-muted-foreground">
                                  Prec: <span className="font-mono">{event.previous}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
