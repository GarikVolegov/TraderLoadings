import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, ArrowRight, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";

interface SentimentSymbol {
  name: string;
  longPercentage: number;
  shortPercentage: number;
  longPositions: number;
  shortPositions: number;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function EmotionalWaveMini({ score }: { score: number }) {
  const zones = [
    { label: "Panico", min: 0, max: 30, color: "#ef4444" },
    { label: "Paura", min: 30, max: 45, color: "#f97316" },
    { label: "Neutrale", min: 45, max: 55, color: "#eab308" },
    { label: "Ottimismo", min: 55, max: 70, color: "#84cc16" },
    { label: "Euforia", min: 70, max: 100, color: "#22c55e" },
  ];
  const current = zones.find((z) => score >= z.min && score < z.max) ?? zones[2];
  const markerX = `${Math.min(Math.max(score, 2), 98)}%`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>😱 Panico</span>
        <span className="font-semibold text-xs" style={{ color: current.color }}>
          {current.label} · {score.toFixed(0)}% long
        </span>
        <span>😄 Euforia</span>
      </div>
      <div className="relative h-7 rounded-lg overflow-hidden">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <linearGradient id="sentWaveGradW" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="30%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="70%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#sentWaveGradW)" opacity={0.2} rx="8" />
          <path
            d="M0,22 C80,8 160,22 240,12 S360,4 480,15 S600,26 720,14 S880,6 1024,18 L1024,28 L0,28 Z"
            fill="url(#sentWaveGradW)" opacity={0.35}
          />
        </svg>
        <div
          className="absolute top-1 bottom-1 w-0.5 rounded-full"
          style={{ left: markerX, backgroundColor: current.color, boxShadow: `0 0 6px ${current.color}` }}
        />
        <div
          className="absolute top-0.5 w-3 h-3 rounded-full border-2 border-background"
          style={{ left: `calc(${markerX} - 6px)`, backgroundColor: current.color }}
        />
      </div>
    </div>
  );
}

export function SentimentWidget() {
  const { selectedPairs: userPairs } = useBackground();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["widget", "sentiment"],
    queryFn: () => apiFetch<{ symbols: SentimentSymbol[]; live?: boolean; fallback?: boolean; hasCredentials?: boolean }>("/api/tools/sentiment"),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const sortedSymbols = useMemo(() => {
    if (!data?.symbols) return [];
    if (userPairs.length === 0) return data.symbols.slice(0, 6);
    const userSet = new Set(userPairs);
    return [...data.symbols]
      .sort((a, b) => (userSet.has(a.name) ? 0 : 1) - (userSet.has(b.name) ? 0 : 1))
      .slice(0, 6);
  }, [data?.symbols, userPairs]);

  const avgLong = sortedSymbols.length
    ? sortedSymbols.reduce((s, sym) => s + sym.longPercentage, 0) / sortedSymbols.length
    : 50;

  return (
    <Card className="relative overflow-hidden bg-card/60 backdrop-blur-sm border-border/30 flex flex-col">
      <CardHeader className="pb-3 px-4 pt-4 border-b border-border/30">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4 text-primary" />
          Sentiment
          {data?.live && (
            <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
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
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 text-xs text-destructive py-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Dati non disponibili
          </div>
        )}
        {data?.symbols && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <EmotionalWaveMini score={avgLong} />

            <div className="space-y-1.5">
              {sortedSymbols.map((sym) => {
                const bias = sym.longPercentage >= 55 ? "Long" : sym.shortPercentage >= 55 ? "Short" : "Neutro";
                const biasColor =
                  bias === "Long" ? "text-primary" : bias === "Short" ? "text-destructive" : "text-muted-foreground";
                return (
                  <div key={sym.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold">{sym.name}</span>
                        <span className={`text-[9px] font-semibold ${biasColor}`}>{bias}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-primary font-semibold">▲ {sym.longPercentage.toFixed(0)}%</span>
                        <span className="text-destructive font-semibold">▼ {sym.shortPercentage.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-destructive/25 overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${sym.longPercentage}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {!data.hasCredentials && (
              <p className="text-[9px] text-amber-400/80 text-center">Dati dimostrativi · configura MYFXBOOK_EMAIL/PASSWORD</p>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
