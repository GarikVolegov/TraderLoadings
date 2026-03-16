import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, BarChart, Bar, Cell, ReferenceLine, Legend,
} from "recharts";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TrendingUp, Activity, BarChart2, FileText, Newspaper,
  RefreshCw, ChevronDown, AlertCircle, Loader2,
  ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { LotCalculatorWidget } from "@/components/LotCalculatorWidget";

const API = "/api";

// ─── API fetch helpers ─────────────────────────────────────────────────────────
async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface MonteCarloResult {
  simulations: number[][];
  stats: {
    median: number;
    percentile10: number;
    percentile90: number;
    ruinProbability: string;
    avgReturnPercent: string;
    initialBalance: number;
  };
}

interface SentimentSymbol {
  name: string;
  longPercentage: number;
  shortPercentage: number;
  longPositions: number;
  shortPositions: number;
  longVolume: number;
  shortVolume: number;
}

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
  m1Pct: number | null;
  m3Pct: number | null;
  m6Pct: number | null;
  y1Pct: number | null;
  label: string;
  peakDay: string;
  pipUnit: string;
  last30: Array<{ day: number; date: string; weekday: string; pips: number }>;
  dataPoints: Array<{ day: number; value: number }>;
  daily5: number;
  daily21: number;
  daily63: number;
  dailyAll: number;
}

interface CotReport {
  market: string;
  currency: string;
  date: string;
  nonCommLong: number;
  nonCommShort: number;
  commLong: number;
  commShort: number;
  retailLong: number;
  retailShort: number;
  nonCommNet: number;
  commNet: number;
  retailNet: number;
  history: { date: string; nonCommNet: number; commNet: number }[];
}

interface MacroArticle {
  title: string;
  summary: string;
  impact: "alto" | "medio" | "basso";
  currency: string;
  direction: "bullish" | "bearish" | "neutrale";
  timestamp?: string;
}

interface MacroNewsResult {
  articles: MacroArticle[];
  sentiment: string;
  summary: string;
}

// ─── Error Card ────────────────────────────────────────────────────────────────
function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
      <AlertCircle className="w-5 h-5 flex-shrink-0" />
      {message}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm">Caricamento dati...</p>
    </div>
  );
}

// ─── 1. MONTE CARLO ───────────────────────────────────────────────────────────
function MonteCarloTool() {
  const [params, setParams] = useState({
    winrate: 55,
    avgR: 1.5,
    lossR: 1,
    numTrades: 100,
    riskPercent: 1,
    initialBalance: 10000,
    simCount: 50,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<MonteCarloResult>(`${API}/tools/montecarlo`, {
        method: "POST",
        body: JSON.stringify(params),
      }),
  });

  const chartData = mutation.data?.simulations
    ? Array.from({ length: params.numTrades + 1 }, (_, i) => {
        const point: Record<string, number | null> = { trade: i };
        (mutation.data!.simulations).forEach((sim, si) => {
          point[`sim${si}`] = sim[i] ?? null;
        });
        return point;
      })
    : [];

  const colors = ["#22c55e33", "#3b82f633", "#f59e0b33", "#ef444433", "#8b5cf633"];
  const simKeys = mutation.data?.simulations?.map((_, i) => `sim${i}`) ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "winrate", label: "Win Rate %", min: 10, max: 90, step: 1 },
          { key: "avgR", label: "Avg R (win)", min: 0.5, max: 10, step: 0.1 },
          { key: "lossR", label: "Loss R", min: 0.5, max: 5, step: 0.1 },
          { key: "numTrades", label: "N° Trade", min: 10, max: 500, step: 10 },
          { key: "riskPercent", label: "Risk %", min: 0.1, max: 10, step: 0.1 },
          { key: "initialBalance", label: "Balance €", min: 1000, max: 1000000, step: 1000 },
          { key: "simCount", label: "Simulazioni", min: 10, max: 200, step: 10 },
        ].map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">{field.label}</label>
            <Input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={params[field.key as keyof typeof params]}
              onChange={(e) =>
                setParams((p) => ({ ...p, [field.key]: parseFloat(e.target.value) || 0 }))
              }
              className="h-8 text-sm font-mono"
            />
          </div>
        ))}
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full sm:w-auto"
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
        Esegui Simulazione
      </Button>

      {mutation.isError && <ErrorCard message={(mutation.error as Error).message} />}

      {mutation.data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Mediana", value: `€${mutation.data.stats.median.toLocaleString("it-IT")}`, color: "text-primary" },
              { label: "10° Percentile", value: `€${mutation.data.stats.percentile10.toLocaleString("it-IT")}`, color: "text-destructive" },
              { label: "90° Percentile", value: `€${mutation.data.stats.percentile90.toLocaleString("it-IT")}`, color: "text-green-400" },
              { label: "Prob. Rovina", value: `${mutation.data.stats.ruinProbability}%`, color: mutation.data.stats.ruinProbability === "0.0" ? "text-primary" : "text-destructive" },
              { label: "Rend. Medio", value: `${mutation.data.stats.avgReturnPercent}%`, color: parseFloat(mutation.data.stats.avgReturnPercent) >= 0 ? "text-primary" : "text-destructive" },
            ].map((stat) => (
              <div key={stat.label} className="p-3 rounded-xl bg-secondary/40 border border-border text-center">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-base font-bold font-mono mt-0.5 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="trade" tick={{ fontSize: 10, fill: "#888" }} label={{ value: "Trade", position: "insideBottomRight", offset: -5, fontSize: 10, fill: "#888" }} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                  formatter={(v) => [`€${Number(v).toLocaleString("it-IT")}`, ""]}
                  labelFormatter={(l) => `Trade #${l}`}
                />
                <ReferenceLine y={params.initialBalance} stroke="#666" strokeDasharray="4 2" />
                {simKeys.map((key, i) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} dot={false} strokeWidth={1} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {mutation.data.simulations.length} curve di equity simulate — Linea tratteggiata = bilancio iniziale
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─── Emotional Wave Component ─────────────────────────────────────────────────
function EmotionalWave({ score }: { score: number }) {
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
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>😱 Panico</span>
        <span className="font-semibold" style={{ color: current.color }}>
          {current.label} ({score.toFixed(0)}% long)
        </span>
        <span>😄 Euforia</span>
      </div>
      <div className="relative h-10 rounded-xl overflow-hidden">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="30%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="70%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#waveGrad)" opacity={0.25} rx="12" />
          <path
            d="M0,30 C50,10 100,30 150,15 S250,5 300,20 S400,35 500,20 S600,10 700,25 S800,30 900,15 S1000,25 1100,20 S1200,10 1280,25 L1280,40 L0,40 Z"
            fill="url(#waveGrad)"
            opacity={0.4}
          />
        </svg>
        <div
          className="absolute top-1 bottom-1 w-0.5 rounded-full shadow-lg"
          style={{ left: markerX, backgroundColor: current.color, boxShadow: `0 0 8px ${current.color}` }}
        />
        <div
          className="absolute -top-1 w-4 h-4 rounded-full border-2 border-background shadow-lg flex items-center justify-center"
          style={{ left: `calc(${markerX} - 8px)`, backgroundColor: current.color }}
        />
      </div>
      <div className="flex justify-between">
        {zones.map((z) => (
          <div
            key={z.label}
            className={`text-[10px] font-medium px-1 rounded ${score >= z.min && score < z.max ? "opacity-100" : "opacity-30"}`}
            style={{ color: z.color }}
          >
            {z.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 2. SENTIMENT ─────────────────────────────────────────────────────────────
function SentimentTool() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["tools", "sentiment"],
    queryFn: () => apiFetch<{
      symbols: SentimentSymbol[];
      live?: boolean;
      cached?: boolean;
      fallback?: boolean;
      hasCredentials?: boolean;
      error?: string;
    }>(`${API}/tools/sentiment`),
    staleTime: 3 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const allPairs = data?.symbols?.map((s) => s.name) ?? [];
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const effectiveSelected = selectedPairs.length > 0 ? selectedPairs : allPairs;
  const visibleSymbols = data?.symbols?.filter((s) => effectiveSelected.includes(s.name)) ?? [];

  const togglePair = (name: string) => {
    setSelectedPairs((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const selectAll = () => setSelectedPairs([]);
  const selectNone = () => setSelectedPairs(allPairs.slice(0, 1));

  const avgLong = visibleSymbols.length
    ? visibleSymbols.reduce((s, sym) => s + sym.longPercentage, 0) / visibleSymbols.length
    : 50;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            Community Sentiment
            {data?.live && (
              <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">Myfxbook Community Outlook</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setFilterOpen((v) => !v)}
            className={`gap-1.5 transition-colors ${filterOpen ? "bg-primary/10 text-primary border-primary/30" : ""}`}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            Filtri {selectedPairs.length > 0 && `(${selectedPairs.length})`}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Credential hint */}
      {data && !data.hasCredentials && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2.5 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Dati dimostrativi — configura <span className="font-mono font-bold">MYFXBOOK_EMAIL</span> e{" "}
            <span className="font-mono font-bold">MYFXBOOK_PASSWORD</span> nelle variabili d'ambiente per dati reali.
          </span>
        </div>
      )}

      {data?.fallback && data.hasCredentials && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Connessione Myfxbook non riuscita — mostrati dati dimostrativi
        </div>
      )}

      {/* Filtro pair richiudibile */}
      <AnimatePresence>
        {filterOpen && allPairs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtra Pair</p>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[11px] text-primary hover:underline">Tutti</button>
                  <span className="text-muted-foreground text-[11px]">·</span>
                  <button onClick={selectNone} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">Nessuno</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {allPairs.map((name) => {
                  const active = selectedPairs.length === 0 || selectedPairs.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => togglePair(name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                        active
                          ? "bg-primary/15 text-primary border-primary/40"
                          : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/20 hover:text-foreground"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && <LoadingCard />}
      {isError && <ErrorCard message={(error as Error).message} />}

      {data?.symbols && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Emotional wave */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium">Onda delle emozioni</p>
              <span className="text-xs text-muted-foreground">{visibleSymbols.length} pair selezionati</span>
            </div>
            <EmotionalWave score={avgLong} />
          </Card>

          {/* Pair list */}
          <div className="space-y-2">
            {visibleSymbols.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">Nessun pair selezionato nel filtro</p>
            ) : (
              visibleSymbols.map((sym) => {
                const bias = sym.longPercentage >= 60 ? "Long" : sym.shortPercentage >= 60 ? "Short" : "Neutro";
                const biasColor = bias === "Long" ? "text-primary" : bias === "Short" ? "text-destructive" : "text-muted-foreground";
                return (
                  <motion.div
                    key={sym.name}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold">{sym.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          bias === "Long" ? "bg-primary/10 border-primary/30 text-primary"
                            : bias === "Short" ? "bg-destructive/10 border-destructive/30 text-destructive"
                            : "bg-secondary border-border text-muted-foreground"
                        }`}>{bias}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-primary font-semibold">▲ {sym.longPercentage.toFixed(1)}%</span>
                        <span className="text-destructive font-semibold">▼ {sym.shortPercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-destructive/30 overflow-hidden relative">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${sym.longPercentage}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{sym.longPositions.toLocaleString()} long pos.</span>
                      <span>{sym.shortPositions.toLocaleString()} short pos.</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {data.live && (
            <p className="text-[10px] text-center text-muted-foreground">
              Aggiornato automaticamente ogni 5 minuti · Fonte: Myfxbook Community
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── 3. VOLATILITY (stile Mataf) ──────────────────────────────────────────────
const PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD"];

function VolatilityTool() {
  const [selectedPair, setSelectedPair] = useState("EURUSD");
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["tools", "volatility", selectedPair],
    queryFn: () => apiFetch<VolatilityResult>(`${API}/tools/volatility?pair=${selectedPair}`),
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  const periods = data ? [
    { short: "1W", value: data.w1, vs: data.y1, pct: data.w1Pct },
    { short: "1M", value: data.m1, vs: data.y1, pct: data.m1Pct },
    { short: "3M", value: data.m3, vs: data.y1, pct: data.m3Pct },
    { short: "6M", value: data.m6, vs: data.y1, pct: data.m6Pct },
    { short: "1Y", value: data.y1, vs: data.y1, pct: data.y1Pct },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[160px]">
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-sm font-mono font-bold"
          >
            {selectedPair}
            <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute top-full mt-1 left-0 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-40"
              >
                {PAIRS.map((p) => (
                  <button key={p} onClick={() => { setSelectedPair(p); setOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm font-mono hover:bg-secondary transition-colors ${p === selectedPair ? "text-primary bg-primary/10" : ""}`}
                  >{p}</button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {data && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            data.label.includes("Alta") ? "bg-destructive/10 border-destructive/30 text-destructive" :
            data.label.includes("Bassa") ? "bg-blue-400/10 border-blue-400/30 text-blue-400" :
            "bg-primary/10 border-primary/30 text-primary"
          }`}>
            <Activity className="w-3.5 h-3.5" />
            {data.label}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="ml-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading && <LoadingCard />}
      {isError && <ErrorCard message={(error as Error).message} />}

      {data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Today + price */}
          <div className="flex gap-3">
            <div className="flex-1 p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Oggi</p>
              <p className="text-xl font-bold font-mono text-primary">{data.todayPips}</p>
              <p className="text-[10px] text-muted-foreground">{data.pipUnit}</p>
            </div>
            <div className="flex-1 p-3 rounded-xl bg-secondary/40 border border-border text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Prezzo</p>
              <p className="text-xl font-bold font-mono">{data.currentPrice?.toFixed(selectedPair.includes("JPY") ? 3 : 5)}</p>
              <p className="text-[10px] text-muted-foreground">corrente</p>
            </div>
            <div className="flex-1 p-3 rounded-xl bg-secondary/40 border border-border text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Peak</p>
              <p className="text-xl font-bold font-mono">{data.peakDay}</p>
              <p className="text-[10px] text-muted-foreground">giorno più volatile</p>
            </div>
          </div>

          {/* Periods table — stile Mataf + variazione % prezzo */}
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-5 bg-secondary/60 border-b border-border">
              {periods.map((p) => (
                <div key={p.short} className="py-2 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{p.short}</div>
              ))}
            </div>
            {/* Pip row */}
            <div className="grid grid-cols-5 border-b border-border/50">
              {periods.map((p) => {
                const ratio = p.vs > 0 ? p.value / p.vs : 1;
                const pipColor = ratio > 1.25 ? "text-destructive" : ratio < 0.75 ? "text-blue-400" : "text-primary";
                const volPct = p.short !== "1Y" ? Math.abs((ratio - 1) * 100) : null;
                const volUp = ratio > 1;
                return (
                  <div key={p.short} className="py-2.5 flex flex-col items-center border-r border-border last:border-r-0">
                    <span className={`text-sm font-bold font-mono ${pipColor}`}>{p.value}</span>
                    <span className="text-[9px] text-muted-foreground">{data.pipUnit}</span>
                    {volPct != null && (
                      <span className={`text-[9px] mt-0.5 flex items-center gap-0.5 ${volUp ? "text-destructive/60" : "text-blue-400/60"}`}>
                        {volUp ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
                        {volPct.toFixed(0)}% vol
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Price % row */}
            <div className="grid grid-cols-5 bg-secondary/20">
              {periods.map((p) => {
                const pct = p.pct;
                const isPos = pct != null && pct >= 0;
                return (
                  <div key={`pct-${p.short}`} className="py-2 flex flex-col items-center border-r border-border last:border-r-0">
                    <span className="text-[9px] text-muted-foreground/60 mb-0.5">variazione</span>
                    {pct != null ? (
                      <span className={`text-[10px] font-semibold font-mono flex items-center gap-0.5 ${isPos ? "text-primary" : "text-destructive"}`}>
                        {isPos ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                        {Math.abs(pct).toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bar chart ultimi 30 giorni */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">Range giornaliero — ultimi 30 giorni</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.last30} barSize={7} margin={{ top: 4, right: 0, left: -20, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="weekday"
                    tick={{ fontSize: 9, fill: "#777" }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={32}
                  />
                  <YAxis tick={{ fontSize: 9, fill: "#666" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(v: number, _name: string, props: { payload?: { pips: number; date: string; weekday: string } }) => [
                      `${v} ${data.pipUnit}`,
                      `${props.payload?.weekday} ${props.payload?.date}`,
                    ]}
                    labelFormatter={() => ""}
                  />
                  <ReferenceLine y={data.y1} stroke="#888" strokeDasharray="4 2" label={{ value: `media ${data.y1}`, position: "insideTopRight", fontSize: 9, fill: "#666" }} />
                  <Bar dataKey="pips" radius={[3, 3, 0, 0]}>
                    {data.last30.map((entry, i) => (
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

          <p className="text-[10px] text-center text-muted-foreground">
            Metodologia Mataf · Range H-L giornaliero in pips · Fonte: Yahoo Finance
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─── 4. COT REPORT (dati reali CFTC, aggiornato ogni venerdì) ────────────────
function CotTool() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["tools", "cot"],
    queryFn: () => apiFetch<{
      reports: CotReport[];
      cached?: boolean;
      fallback?: boolean;
      fetchedAt?: string;
      nextUpdate?: string;
    }>(`${API}/tools/cot`),
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
  });

  const [selected, setSelected] = useState<CotReport | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">COT Report — Futures Finanziari</h3>
          <p className="text-xs text-muted-foreground">
            Fonte: CFTC.gov • {data?.fetchedAt ? `Aggiornato: ${new Date(data.fetchedAt).toLocaleDateString("it-IT")}` : "Aggiornato ogni venerdì"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Prossimo aggiornamento */}
      {data?.nextUpdate && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
          data.fallback
            ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
            : "text-primary/80 bg-primary/5 border-primary/15"
        }`}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {data.fallback
            ? "CFTC non raggiungibile — dati di esempio · "
            : "Dati CFTC ufficiali · "}
          Prossimo aggiornamento: <span className="font-medium">{data.nextUpdate}</span>
        </div>
      )}

      {isLoading && <LoadingCard />}
      {isError && <ErrorCard message={(error as Error).message} />}

      {data?.reports && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {/* Currency grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {data.reports.map((r) => {
              const trend = r.history.length >= 2
                ? r.nonCommNet - r.history[r.history.length - 2]?.nonCommNet
                : 0;
              return (
                <button
                  key={r.currency}
                  onClick={() => setSelected(selected?.currency === r.currency ? null : r)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    selected?.currency === r.currency
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary/30 hover:border-primary/30"
                  }`}
                >
                  <p className="text-sm font-bold font-mono">{r.currency}</p>
                  <p className={`text-[10px] font-semibold mt-0.5 ${r.nonCommNet >= 0 ? "text-primary" : "text-destructive"}`}>
                    {r.nonCommNet >= 0 ? "+" : ""}{(r.nonCommNet / 1000).toFixed(0)}k
                  </p>
                  {trend !== 0 && (
                    <p className={`text-[9px] flex items-center justify-center gap-0.5 mt-0.5 ${trend > 0 ? "text-primary/70" : "text-destructive/70"}`}>
                      {trend > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                      {Math.abs(trend / 1000).toFixed(0)}k
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <motion.div
              key={selected.currency}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl border border-border bg-secondary/20 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold font-mono text-lg">{selected.currency}</h4>
                <span className="text-xs text-muted-foreground">Report: {selected.date}</span>
              </div>

              {/* Storico 12 settimane — Net Non-Commerciali */}
              {selected.history.length > 1 && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1.5">
                    Posizioni nette Non-Commerciali — ultime {selected.history.length} settimane
                  </p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selected.history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`cotGradPos-${selected.currency}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id={`cotGradNeg-${selected.currency}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 8, fill: "#666" }}
                          tickFormatter={(d) => d.slice(5)}
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 8, fill: "#666" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                          formatter={(v: number) => [`${(v / 1000).toFixed(1)}k contratti`, "Net Non-Comm."]}
                          labelFormatter={(l) => `Settimana: ${l}`}
                        />
                        <ReferenceLine y={0} stroke="#555" strokeDasharray="3 2" />
                        <Area
                          type="monotone"
                          dataKey="nonCommNet"
                          stroke={selected.nonCommNet >= 0 ? "#22c55e" : "#ef4444"}
                          strokeWidth={1.5}
                          fill={selected.nonCommNet >= 0 ? `url(#cotGradPos-${selected.currency})` : `url(#cotGradNeg-${selected.currency})`}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Bar confronto 3 categorie */}
              <div className="h-40">
                <p className="text-[10px] text-muted-foreground font-medium mb-1.5">Posizioni nette — settimana corrente</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Non-Comm.", net: selected.nonCommNet },
                      { name: "Commercial", net: selected.commNet },
                      { name: "Retail",     net: selected.retailNet },
                    ]}
                    margin={{ top: 4, right: 5, bottom: 5, left: 10 }}
                    barSize={36}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                      formatter={(v: number) => [`${(v / 1000).toFixed(1)}k contratti`, "Posizioni nette"]}
                    />
                    <ReferenceLine y={0} stroke="#555" />
                    <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                      {[selected.nonCommNet, selected.commNet, selected.retailNet].map((net, i) => (
                        <Cell key={i} fill={net >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Non-Comm.", net: selected.nonCommNet, long: selected.nonCommLong, short: selected.nonCommShort, desc: "Hedge fund / Speculatori" },
                  { label: "Commerciali", net: selected.commNet, long: selected.commLong, short: selected.commShort, desc: "Banche / Hedger" },
                  { label: "Non-Report.", net: selected.retailNet, long: selected.retailLong, short: selected.retailShort, desc: "Piccoli trader" },
                ].map((g) => (
                  <div key={g.label} className="p-2 rounded-xl bg-secondary/40 border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium">{g.label}</p>
                    <p className={`text-sm font-bold font-mono ${g.net >= 0 ? "text-primary" : "text-destructive"}`}>
                      {g.net >= 0 ? "+" : ""}{(g.net / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      L:{(g.long / 1000).toFixed(0)}k · S:{(g.short / 1000).toFixed(0)}k
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">{g.desc}</p>
                  </div>
                ))}
              </div>

              {/* Interpretazione */}
              <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Interpretazione: </span>
                  {selected.nonCommNet > 0
                    ? `Gli hedge fund sono NET LONG su ${selected.currency} (+${(selected.nonCommNet / 1000).toFixed(0)}k contratti). Segnale potenzialmente rialzista.`
                    : `Gli hedge fund sono NET SHORT su ${selected.currency} (${(selected.nonCommNet / 1000).toFixed(0)}k contratti). Segnale potenzialmente ribassista.`}
                  {Math.abs(selected.commNet) > Math.abs(selected.nonCommNet) * 0.8
                    ? ` I commerciali si posizionano in direzione opposta — possibile extremo di mercato.`
                    : ""}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── 5. MACRO NEWS ────────────────────────────────────────────────────────────
const IMPACT_STYLES: Record<string, string> = {
  alto: "bg-destructive/20 text-destructive border-destructive/40",
  medio: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  basso: "bg-secondary text-muted-foreground border-border",
};

const DIRECTION_ICONS = {
  bullish: <ArrowUp className="w-3.5 h-3.5 text-primary" />,
  bearish: <ArrowDown className="w-3.5 h-3.5 text-destructive" />,
  neutrale: <Minus className="w-3.5 h-3.5 text-muted-foreground" />,
};

const CURRENCIES = ["Tutte", "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"];

const SENTIMENT_STYLES: Record<string, string> = {
  "risk-on": "text-primary bg-primary/10 border-primary/30",
  "risk-off": "text-destructive bg-destructive/10 border-destructive/30",
  "neutrale": "text-muted-foreground bg-secondary/50 border-border",
};

function MacroNewsTool() {
  const [currency, setCurrency] = useState("Tutte");

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<MacroNewsResult>(`${API}/tools/macro-news`, {
        method: "POST",
        body: JSON.stringify({ currency: currency === "Tutte" ? "tutte le principali valute" : currency }),
      }),
  });

  const articles = mutation.data?.articles ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Agente Notizie Macro</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Briefing AI sulle notizie macroeconomiche rilevanti per il trading</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {CURRENCIES.map((c) => (
          <button
            key={c}
            onClick={() => setCurrency(c)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all ${
              currency === c ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/30"
            }`}
          >
            {c}
          </button>
        ))}
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2 ml-auto">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Newspaper className="w-4 h-4" />}
          {mutation.isPending ? "Analisi in corso..." : "Genera briefing"}
        </Button>
      </div>

      {mutation.isError && <ErrorCard message={(mutation.error as Error).message} />}

      {mutation.isPending && (
        <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <Newspaper className="w-4 h-4 text-primary absolute top-3 left-3" />
          </div>
          <p className="text-sm">L&apos;agente sta analizzando i mercati...</p>
          <p className="text-xs text-muted-foreground/60">Questo può richiedere 10-20 secondi</p>
        </div>
      )}

      {mutation.data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${SENTIMENT_STYLES[mutation.data.sentiment] ?? SENTIMENT_STYLES["neutrale"]}`}>
              <Activity className="w-3.5 h-3.5" />
              {mutation.data.sentiment.toUpperCase()}
            </div>
            <p className="text-xs text-muted-foreground">{articles.length} articoli generati</p>
          </div>

          {mutation.data.summary && (
            <div className="p-3 rounded-xl border border-border bg-secondary/30 text-sm text-muted-foreground italic">
              "{mutation.data.summary}"
            </div>
          )}

          <div className="space-y-3">
            {articles.map((article, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="p-4 rounded-2xl border border-border bg-card/60 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-semibold leading-tight flex-1">{article.title}</h4>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="font-mono text-xs font-bold text-muted-foreground">{article.currency}</span>
                    {DIRECTION_ICONS[article.direction as keyof typeof DIRECTION_ICONS] ?? DIRECTION_ICONS.neutrale}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{article.summary}</p>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${IMPACT_STYLES[article.impact] ?? IMPACT_STYLES.basso}`}>
                    {article.impact.toUpperCase()}
                  </span>
                  <span className={`text-[10px] font-medium ${
                    article.direction === "bullish" ? "text-primary" : article.direction === "bearish" ? "text-destructive" : "text-muted-foreground"
                  }`}>
                    {article.direction}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Generato con AI • Non costituisce consulenza finanziaria
          </p>
        </motion.div>
      )}

      {!mutation.data && !mutation.isPending && !mutation.isError && (
        <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
          <Newspaper className="w-12 h-12 opacity-20" />
          <p className="text-sm">Clicca "Genera briefing" per ottenere le ultime notizie macro</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "montecarlo", label: "Montecarlo", icon: TrendingUp },
  { id: "sentiment", label: "Sentiment", icon: Activity },
  { id: "volatility", label: "Volatilità", icon: BarChart2 },
  { id: "cot", label: "COT Report", icon: FileText },
  { id: "macro", label: "Notizie Macro", icon: Newspaper },
  { id: "lot", label: "Dimensionamento", icon: BarChart2 },
];

export default function Tools() {
  return (
    <PageLayout>
      <div className="space-y-1 mb-4">
        <h1 className="text-xl font-bold font-mono tracking-tight">Strumenti Avanzati</h1>
        <p className="text-xs text-muted-foreground">Analisi quantitativa, sentiment e dati istituzionali</p>
      </div>

      <Tabs defaultValue="montecarlo">
        <TabsList className="flex w-full h-auto gap-1 bg-card/50 backdrop-blur-md p-1.5 rounded-xl border border-border mb-4 overflow-x-auto">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1"
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <TabsContent value="montecarlo" className="m-0">
              <MonteCarloTool />
            </TabsContent>
            <TabsContent value="sentiment" className="m-0">
              <SentimentTool />
            </TabsContent>
            <TabsContent value="volatility" className="m-0">
              <VolatilityTool />
            </TabsContent>
            <TabsContent value="cot" className="m-0">
              <CotTool />
            </TabsContent>
            <TabsContent value="macro" className="m-0">
              <MacroNewsTool />
            </TabsContent>
            <TabsContent value="lot" className="m-0">
              <div className="p-4">
                <LotCalculatorWidget />
              </div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </PageLayout>
  );
}
