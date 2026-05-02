import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendingUp, ArrowRight, Loader2, AlertCircle, ChevronDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { BarChart, Bar, Cell, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts";
import { useBackground } from "@/contexts/BackgroundContext";

interface VolatilityResult {
  pair: string;
  currentPrice: number;
  todayPips: number;
  w1: number;
  m1: number;
  m3: number;
  m6: number;
  y1: number;
  w1Pct: number | null;
  label: string;
  peakDay: string;
  pipUnit: string;
  last30: Array<{ day: number; date: string; weekday: string; pips: number }>;
}

const ALL_VOL_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD"];

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function VolatilityWidget() {
  const { selectedPairs: userPairs } = useBackground();
  const [open, setOpen] = useState(false);

  const volPairs = useMemo(() => {
    if (userPairs.length === 0) return ALL_VOL_PAIRS;
    const supported = new Set(ALL_VOL_PAIRS);
    const filtered = userPairs.filter((p) => supported.has(p));
    return filtered.length > 0 ? filtered : ALL_VOL_PAIRS;
  }, [userPairs]);

  const [selectedPair, setSelectedPair] = useState(volPairs[0] || "EURUSD");
  const defaultAppliedRef = useRef(false);

  useEffect(() => {
    if (userPairs.length > 0 && !defaultAppliedRef.current) {
      defaultAppliedRef.current = true;
      if (volPairs.length > 0) setSelectedPair(volPairs[0]);
    } else if (volPairs.length > 0 && !volPairs.includes(selectedPair)) {
      setSelectedPair(volPairs[0]);
    }
  }, [volPairs, selectedPair, userPairs]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["widget", "volatility", selectedPair],
    queryFn: () => apiFetch<VolatilityResult>(`/api/tools/volatility?pair=${selectedPair}`),
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  const periods = data
    ? [
        { short: "1W", value: data.w1 },
        { short: "1M", value: data.m1 },
        { short: "3M", value: data.m3 },
        { short: "6M", value: data.m6 },
        { short: "1Y", value: data.y1 },
      ]
    : [];

  const last10 = data?.last30.slice(-10) ?? [];

  return (
    <Card className="relative overflow-hidden bg-card/60 backdrop-blur-sm border-border/30 flex flex-col">
      <CardHeader className="pb-3 px-4 pt-4 border-b border-border/30">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-primary" />
          Volatilità
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            </button>
            <Link href="/tools">
              <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
                Dettaglio <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-3 flex-1">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-xs font-mono font-bold transition-colors"
            >
              {selectedPair}
              <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-full mt-1 left-0 z-30 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[120px] max-h-48 overflow-y-auto"
                >
                  {volPairs.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setSelectedPair(p); setOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-secondary transition-colors ${p === selectedPair ? "text-primary bg-primary/10" : ""}`}
                    >
                      {p}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {data && (
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg border ${
              data.label.includes("Alta")
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : data.label.includes("Bassa")
                ? "bg-blue-400/10 border-blue-400/30 text-blue-400"
                : "bg-primary/10 border-primary/30 text-primary"
            }`}>
              {data.label}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Dati non disponibili
          </div>
        )}

        {data && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Oggi</p>
                <p className="text-lg font-bold font-mono text-primary">{data.todayPips}</p>
                <p className="text-[9px] text-muted-foreground">{data.pipUnit}</p>
              </div>
              <div className="flex-1 p-2.5 rounded-xl bg-secondary/40 border border-border text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Media 1Y</p>
                <p className="text-lg font-bold font-mono">{data.y1}</p>
                <p className="text-[9px] text-muted-foreground">{data.pipUnit}</p>
              </div>
              <div className="flex-1 p-2.5 rounded-xl bg-secondary/40 border border-border text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Peak</p>
                <p className="text-lg font-bold font-mono">{data.peakDay?.slice(0, 3)}</p>
                <p className="text-[9px] text-muted-foreground">giorno</p>
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-5 bg-secondary/60 border-b border-border">
                {periods.map((p) => (
                  <div key={p.short} className="py-1.5 text-center text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    {p.short}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5">
                {periods.map((p) => {
                  const ratio = data.y1 > 0 ? p.value / data.y1 : 1;
                  const pipColor =
                    ratio > 1.25 ? "text-destructive" : ratio < 0.75 ? "text-blue-400" : "text-primary";
                  const volPct = p.short !== "1Y" ? Math.abs((ratio - 1) * 100) : null;
                  const volUp = ratio > 1;
                  return (
                    <div key={p.short} className="py-2 flex flex-col items-center border-r border-border last:border-r-0">
                      <span className={`text-xs font-bold font-mono ${pipColor}`}>{p.value}</span>
                      {volPct != null && (
                        <span className={`text-[9px] flex items-center gap-0.5 ${volUp ? "text-destructive/60" : "text-blue-400/60"}`}>
                          {volUp ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
                          {volPct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[9px] text-muted-foreground mb-1">Ultimi 10 giorni (pips)</p>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last10} barSize={10} margin={{ top: 2, right: 0, left: -30, bottom: 0 }}>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "10px" }}
                      formatter={(v: number) => [`${v} ${data.pipUnit}`, ""]}
                      labelFormatter={() => ""}
                    />
                    <ReferenceLine y={data.y1} stroke="#555" strokeDasharray="3 2" />
                    <Bar dataKey="pips" radius={[2, 2, 0, 0]}>
                      {last10.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.pips > data.y1 * 1.25 ? "#ef4444" : entry.pips < data.y1 * 0.75 ? "#60a5fa" : "#22c55e"}
                          fillOpacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <p className="text-[9px] text-center text-muted-foreground">Fonte: Yahoo Finance · Range H-L in pips</p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
