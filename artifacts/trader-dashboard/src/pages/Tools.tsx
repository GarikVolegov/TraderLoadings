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
  TrendingUp, Activity, BarChart2, FileText, Newspaper, Calculator,
  RefreshCw, ChevronDown, AlertCircle, Loader2,
  ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";

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
  daily5: number;
  daily21: number;
  daily63: number;
  dailyAll: number;
  label: string;
  dataPoints: Array<{ day: number; value: number }>;
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
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tools", "sentiment"],
    queryFn: () => apiFetch<{ symbols: SentimentSymbol[]; cached?: boolean; fallback?: boolean; error?: string }>(`${API}/tools/sentiment`),
    staleTime: 5 * 60_000,
  });

  const avgLong = data?.symbols?.length
    ? data.symbols.reduce((s, sym) => s + sym.longPercentage, 0) / data.symbols.length
    : 50;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Community Sentiment</h3>
          <p className="text-xs text-muted-foreground">Fonte: Myfxbook Community Outlook</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Aggiorna
        </Button>
      </div>

      {data?.fallback && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Dati dimostrativi — Myfxbook non raggiungibile
        </div>
      )}

      {isLoading && <LoadingCard />}
      {isError && <ErrorCard message={(error as Error).message} />}

      {data?.symbols && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-3">Onda delle emozioni</p>
            <EmotionalWave score={avgLong} />
          </Card>

          <div className="space-y-2">
            {data.symbols.map((sym) => (
              <div key={sym.name} className="p-3 rounded-xl border border-border bg-secondary/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono font-bold">{sym.name}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-primary font-semibold">▲ {sym.longPercentage.toFixed(1)}% Long</span>
                    <span className="text-destructive font-semibold">▼ {sym.shortPercentage.toFixed(1)}% Short</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-destructive/40 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${sym.longPercentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── 3. VOLATILITY ────────────────────────────────────────────────────────────
const PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY", "XAUUSD"];

function VolatilityTool() {
  const [selectedPair, setSelectedPair] = useState("EURUSD");
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tools", "volatility", selectedPair],
    queryFn: () => apiFetch<VolatilityResult>(`${API}/tools/volatility?pair=${selectedPair}`),
    staleTime: 10 * 60_000,
  });

  const labelColor = data?.label.includes("Alta") ? "text-destructive" : data?.label.includes("Bassa") ? "text-blue-400" : "text-primary";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-sm font-mono font-bold min-w-32"
          >
            {selectedPair} <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-full mt-1 left-0 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-40"
              >
                {PAIRS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setSelectedPair(p); setOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm font-mono hover:bg-secondary transition-colors ${p === selectedPair ? "text-primary bg-primary/10" : ""}`}
                  >
                    {p}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {isLoading && <LoadingCard />}
      {isError && <ErrorCard message={(error as Error).message} />}

      {data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${
            data.label.includes("Alta") ? "bg-destructive/10 border-destructive/30 text-destructive" :
            data.label.includes("Bassa") ? "bg-blue-400/10 border-blue-400/30 text-blue-400" :
            "bg-primary/10 border-primary/30 text-primary"
          }`}>
            <Activity className="w-4 h-4" />
            {data.label}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "5 giorni", value: data.daily5, pct: (data.daily5 / data.dailyAll - 1) * 100 },
              { label: "1 mese", value: data.daily21, pct: (data.daily21 / data.dailyAll - 1) * 100 },
              { label: "3 mesi", value: data.daily63, pct: (data.daily63 / data.dailyAll - 1) * 100 },
              { label: "Media storica", value: data.dailyAll, pct: 0 },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-secondary/40 border border-border">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-base font-bold font-mono text-primary">{item.value.toFixed(3)}%</p>
                {item.pct !== 0 && (
                  <p className={`text-xs flex items-center gap-0.5 ${item.pct > 0 ? "text-destructive" : "text-blue-400"}`}>
                    {item.pct > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {Math.abs(item.pct).toFixed(1)}% vs media
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dataPoints}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#888" }} label={{ value: "Giorni fa", position: "insideBottomRight", offset: -5, fontSize: 10, fill: "#888" }} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                  formatter={(v) => [`${Number(v).toFixed(4)}%`, "Vol. giornaliera"]}
                />
                <ReferenceLine y={data.dailyAll} stroke="#888" strokeDasharray="4 2" label={{ value: "Media", fontSize: 10, fill: "#888" }} />
                <Area type="monotone" dataKey="value" stroke="#22c55e" fill="url(#volGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">Fonte: Yahoo Finance • Prezzi di chiusura ultimi 30 giorni</p>
        </motion.div>
      )}
    </div>
  );
}

// ─── 4. COT REPORT ────────────────────────────────────────────────────────────
function CotTool() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tools", "cot"],
    queryFn: () => apiFetch<{ reports: CotReport[]; cached?: boolean; stale?: boolean }>(`${API}/tools/cot`),
    staleTime: 30 * 60_000,
  });

  const [selected, setSelected] = useState<CotReport | null>(null);

  const maxNet = data?.reports
    ? Math.max(...data.reports.flatMap((r) => [Math.abs(r.nonCommNet), Math.abs(r.commNet), Math.abs(r.retailNet)]))
    : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">COT Report — Futures Finanziari</h3>
          <p className="text-xs text-muted-foreground">Fonte: CFTC • Aggiornato settimanalmente</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Aggiorna
        </Button>
      </div>

      {(data?.stale || data?.fallback) && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {data?.fallback
            ? "Dati dimostrativi basati su report del 11 Mar 2026 — CFTC non raggiungibile in questo ambiente"
            : "Dati in cache — aggiornamento automatico"}
        </div>
      )}

      {isLoading && <LoadingCard />}
      {isError && (
        <div className="space-y-2">
          <ErrorCard message={(error as Error).message} />
          <p className="text-xs text-muted-foreground">Il report CFTC potrebbe non essere disponibile. Riprova più tardi.</p>
        </div>
      )}

      {data?.reports && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {data.reports.map((r) => (
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
              </button>
            ))}
          </div>

          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl border border-border bg-secondary/20 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold font-mono text-lg">{selected.currency}</h4>
                <span className="text-xs text-muted-foreground">{selected.date}</span>
              </div>

              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Non-Comm.", net: selected.nonCommNet, long: selected.nonCommLong, short: selected.nonCommShort },
                      { name: "Commercial", net: selected.commNet, long: selected.commLong, short: selected.commShort },
                      { name: "Retail", net: selected.retailNet, long: selected.retailLong, short: selected.retailShort },
                    ]}
                    margin={{ top: 5, right: 5, bottom: 5, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                      formatter={(v) => [Number(v).toLocaleString("it-IT"), "Posizioni nette"]}
                    />
                    <ReferenceLine y={0} stroke="#666" />
                    <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                      {[selected.nonCommNet, selected.commNet, selected.retailNet].map((net, i) => (
                        <Cell key={i} fill={net >= 0 ? "#22c55e" : "#ef4444"} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Non-Commerciali", net: selected.nonCommNet, long: selected.nonCommLong, short: selected.nonCommShort, desc: "Grandi speculatori (hedge fund)" },
                  { label: "Commerciali", net: selected.commNet, long: selected.commLong, short: selected.commShort, desc: "Hedger (banche, aziende)" },
                  { label: "Non-Report. (Retail)", net: selected.retailNet, long: selected.retailLong, short: selected.retailShort, desc: "Piccoli trader" },
                ].map((g) => (
                  <div key={g.label} className="p-2 rounded-xl bg-secondary/40 border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight">{g.label}</p>
                    <p className={`text-sm font-bold font-mono ${g.net >= 0 ? "text-primary" : "text-destructive"}`}>
                      {g.net >= 0 ? "+" : ""}{(g.net / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">L:{(g.long / 1000).toFixed(0)}k S:{(g.short / 1000).toFixed(0)}k</p>
                    <p className="text-[9px] text-muted-foreground/70 mt-1 leading-tight">{g.desc}</p>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Interpretazione: </span>
                  {selected.nonCommNet > 0
                    ? `I grandi speculatori sono NET LONG su ${selected.currency} (+${(selected.nonCommNet / 1000).toFixed(0)}k). Segnale potenzialmente rialzista.`
                    : `I grandi speculatori sono NET SHORT su ${selected.currency} (${(selected.nonCommNet / 1000).toFixed(0)}k). Segnale potenzialmente ribassista.`}
                  {Math.abs(selected.commNet) > Math.abs(selected.nonCommNet) * 0.8
                    ? ` I commerciali contraddiscono la direzione — possibile extremo di mercato.`
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
function LotCalculatorTool() {
  const { lotDivisor } = useBackground();
  const [risk, setRisk] = useState("");
  const [stopLoss, setStopLoss] = useState("");

  const result = risk && stopLoss
    ? ((Number(risk) / Number(stopLoss)) / lotDivisor).toFixed(2)
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Rischio (€)</label>
          <Input
            type="number"
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            placeholder="Es: 50"
            step="0.01"
            min="0"
            className="text-base"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Stop Loss (pips)</label>
          <Input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="Es: 100"
            step="1"
            min="0"
            className="text-base"
          />
        </div>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl bg-primary/10 border border-primary/30 p-4 text-center"
        >
          <p className="text-xs text-muted-foreground mb-1">Dimensione Lotto</p>
          <p className="text-3xl font-bold text-primary font-mono">{result}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Formula: ({Number(risk).toFixed(2)} € / {Number(stopLoss).toFixed(0)} pips) / {lotDivisor}
          </p>
        </motion.div>
      )}

      <div className="rounded-xl bg-card border border-border p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Come usare:</strong> Inserisci il rischio in € e lo stop loss in pips. La formula calcola la dimensione del lotto in base al tuo divisore configurato.
        </p>
      </div>
    </div>
  );
}

const TABS = [
  { id: "montecarlo", label: "Montecarlo", icon: TrendingUp },
  { id: "sentiment", label: "Sentiment", icon: Activity },
  { id: "volatility", label: "Volatilità", icon: BarChart2 },
  { id: "cot", label: "COT Report", icon: FileText },
  { id: "macro", label: "Notizie Macro", icon: Newspaper },
  { id: "lot", label: "Calcolatore Lotti", icon: Calculator },
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
              <LotCalculatorTool />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </PageLayout>
  );
}
