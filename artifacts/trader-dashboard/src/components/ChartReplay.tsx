import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  ColorType,
  CrosshairMode,
  type SeriesMarker,
} from "lightweight-charts";
import {
  Play, Pause, SkipForward, SkipBack, RotateCcw,
  TrendingUp, TrendingDown, X, ChevronLeft, ChevronRight,
  Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_BASE || "";

interface CandleRaw {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ReplayTrade {
  id: number;
  direction: "buy" | "sell";
  entryPrice: number;
  entryIndex: number;
  exitPrice?: number;
  exitIndex?: number;
  stopLoss?: number;
  takeProfit?: number;
  result?: "win" | "loss" | "breakeven";
  pips?: number;
}

interface ChartReplayProps {
  symbol: string;
  interval: string;
  onTradesChange?: (trades: ReplayTrade[]) => void;
}

const SPEEDS = [1, 2, 5, 10];
const START_CANDLES = 50;

export default function ChartReplay({ symbol, interval, onTradesChange }: ChartReplayProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const slLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tpLineRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [allCandles, setAllCandles] = useState<CandlestickData<Time>[]>([]);
  const [visibleCount, setVisibleCount] = useState(START_CANDLES);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trades, setTrades] = useState<ReplayTrade[]>([]);
  const [openTrade, setOpenTrade] = useState<ReplayTrade | null>(null);
  const [settingSL, setSettingSL] = useState(false);
  const [settingTP, setSettingTP] = useState(false);
  const [showTradePanel, setShowTradePanel] = useState(false);
  const [showTrades, setShowTrades] = useState(true);
  const tradeIdCounter = useRef(0);

  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  const visibleCountRef = useRef(visibleCount);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { visibleCountRef.current = visibleCount; }, [visibleCount]);

  useEffect(() => {
    const s = symbol.replace("/", "");
    setLoading(true);
    setError(null);
    setVisibleCount(START_CANDLES);
    setTrades([]);
    setOpenTrade(null);

    fetch(`${API_BASE}/api/backtest/candles?symbol=${s}&interval=${interval}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ candles: CandleRaw[] }>;
      })
      .then((data) => {
        const candles: CandlestickData<Time>[] = data.candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        setAllCandles(candles);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Errore caricamento dati");
        setLoading(false);
      });
  }, [symbol, interval]);

  const visibleCandles = useMemo(
    () => allCandles.slice(0, visibleCount),
    [allCandles, visibleCount]
  );

  const currentPrice = useMemo(() => {
    if (visibleCandles.length === 0) return 0;
    return visibleCandles[visibleCandles.length - 1].close;
  }, [visibleCandles]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(16,185,129,0.3)", labelBackgroundColor: "#10b981" },
        horzLine: { color: "rgba(16,185,129,0.3)", labelBackgroundColor: "#10b981" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const slLine = chart.addLineSeries({
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const tpLine = chart.addLineSeries({
      color: "#10b981",
      lineWidth: 1,
      lineStyle: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    slLineRef.current = slLine;
    tpLineRef.current = tpLine;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      slLineRef.current = null;
      tpLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || visibleCandles.length === 0) return;
    candleSeriesRef.current.setData(visibleCandles);

    const markers: SeriesMarker<Time>[] = [];
    const allTrades = [...trades, ...(openTrade ? [openTrade] : [])];

    if (showTrades) {
      allTrades.forEach((t) => {
        if (t.entryIndex < visibleCandles.length) {
          markers.push({
            time: visibleCandles[t.entryIndex].time,
            position: t.direction === "buy" ? "belowBar" : "aboveBar",
            color: t.direction === "buy" ? "#10b981" : "#ef4444",
            shape: t.direction === "buy" ? "arrowUp" : "arrowDown",
            text: `${t.direction.toUpperCase()} @ ${t.entryPrice.toFixed(5)}`,
          });
        }
        if (t.exitIndex != null && t.exitIndex < visibleCandles.length) {
          markers.push({
            time: visibleCandles[t.exitIndex].time,
            position: "aboveBar",
            color: t.result === "win" ? "#10b981" : t.result === "loss" ? "#ef4444" : "#eab308",
            shape: "circle",
            text: `EXIT @ ${t.exitPrice?.toFixed(5) ?? ""}`,
          });
        }
      });
    }

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    candleSeriesRef.current.setMarkers(markers);

    if (openTrade && slLineRef.current && tpLineRef.current) {
      const first = visibleCandles[0];
      const last = visibleCandles[visibleCandles.length - 1];

      if (openTrade.stopLoss != null) {
        slLineRef.current.setData([
          { time: first.time, value: openTrade.stopLoss },
          { time: last.time, value: openTrade.stopLoss },
        ]);
      } else {
        slLineRef.current.setData([]);
      }

      if (openTrade.takeProfit != null) {
        tpLineRef.current.setData([
          { time: first.time, value: openTrade.takeProfit },
          { time: last.time, value: openTrade.takeProfit },
        ]);
      } else {
        tpLineRef.current.setData([]);
      }
    } else {
      slLineRef.current?.setData([]);
      tpLineRef.current?.setData([]);
    }

    chartRef.current?.timeScale().scrollToPosition(2, false);
  }, [visibleCandles, trades, openTrade, showTrades]);

  const advanceCandle = useCallback((count = 1) => {
    setVisibleCount((prev) => {
      const next = Math.min(prev + count, allCandles.length);

      if (openTrade) {
        for (let i = prev; i < next; i++) {
          const candle = allCandles[i];
          if (openTrade.stopLoss != null) {
            const hitSL = openTrade.direction === "buy"
              ? candle.low <= openTrade.stopLoss
              : candle.high >= openTrade.stopLoss;
            if (hitSL) {
              closeTrade(openTrade.stopLoss, i);
              break;
            }
          }
          if (openTrade.takeProfit != null) {
            const hitTP = openTrade.direction === "buy"
              ? candle.high >= openTrade.takeProfit
              : candle.low <= openTrade.takeProfit;
            if (hitTP) {
              closeTrade(openTrade.takeProfit, i);
              break;
            }
          }
        }
      }

      return next;
    });
  }, [allCandles, openTrade]);

  const closeTrade = useCallback((exitPrice: number, exitIndex: number) => {
    setOpenTrade((prev) => {
      if (!prev) return null;
      const diff = prev.direction === "buy"
        ? exitPrice - prev.entryPrice
        : prev.entryPrice - exitPrice;
      const pips = parseFloat((diff * 10000).toFixed(1));
      const result: "win" | "loss" | "breakeven" = pips > 0 ? "win" : pips < 0 ? "loss" : "breakeven";
      const closedTrade = { ...prev, exitPrice, exitIndex, pips, result };
      setTrades((old) => {
        const updated = [...old, closedTrade];
        onTradesChange?.(updated);
        return updated;
      });
      return null;
    });
  }, [onTradesChange]);

  useEffect(() => {
    if (!isPlaying) return;
    playingRef.current = true;

    const tick = () => {
      if (!playingRef.current) return;
      if (visibleCountRef.current >= allCandles.length) {
        setIsPlaying(false);
        return;
      }
      advanceCandle(1);
      const delay = Math.max(50, 500 / speedRef.current);
      setTimeout(tick, delay);
    };
    tick();

    return () => { playingRef.current = false; };
  }, [isPlaying, advanceCandle, allCandles.length]);

  const handleBuy = () => {
    if (openTrade) return;
    const trade: ReplayTrade = {
      id: ++tradeIdCounter.current,
      direction: "buy",
      entryPrice: currentPrice,
      entryIndex: visibleCount - 1,
    };
    setOpenTrade(trade);
    setShowTradePanel(true);
  };

  const handleSell = () => {
    if (openTrade) return;
    const trade: ReplayTrade = {
      id: ++tradeIdCounter.current,
      direction: "sell",
      entryPrice: currentPrice,
      entryIndex: visibleCount - 1,
    };
    setOpenTrade(trade);
    setShowTradePanel(true);
  };

  const handleCloseTrade = () => {
    if (!openTrade) return;
    closeTrade(currentPrice, visibleCount - 1);
    setShowTradePanel(false);
  };

  const handleSetSL = () => {
    setSettingSL(true);
    setSettingTP(false);
  };

  const handleSetTP = () => {
    setSettingTP(true);
    setSettingSL(false);
  };

  useEffect(() => {
    if (!chartRef.current || (!settingSL && !settingTP)) return;
    const chart = chartRef.current;

    const handler = (param: { point?: { x: number; y: number } }) => {
      if (!param.point || !candleSeriesRef.current) return;
      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      if (price == null) return;

      setOpenTrade((prev) => {
        if (!prev) return null;
        if (settingSL) return { ...prev, stopLoss: price as number };
        if (settingTP) return { ...prev, takeProfit: price as number };
        return prev;
      });
      setSettingSL(false);
      setSettingTP(false);
    };

    chart.subscribeClick(handler);
    return () => chart.unsubscribeClick(handler);
  }, [settingSL, settingTP]);

  const handleReset = () => {
    setIsPlaying(false);
    setVisibleCount(START_CANDLES);
    setTrades([]);
    setOpenTrade(null);
    setShowTradePanel(false);
    onTradesChange?.([]);
  };

  const stats = useMemo(() => {
    if (trades.length === 0) return null;
    const wins = trades.filter((t) => t.result === "win").length;
    const losses = trades.filter((t) => t.result === "loss").length;
    const totalPips = trades.reduce((s, t) => s + (t.pips ?? 0), 0);
    const winRate = Math.round((wins / trades.length) * 100);
    return { total: trades.length, wins, losses, totalPips: totalPips.toFixed(1), winRate };
  }, [trades]);

  const openPnL = useMemo(() => {
    if (!openTrade) return null;
    const diff = openTrade.direction === "buy"
      ? currentPrice - openTrade.entryPrice
      : openTrade.entryPrice - currentPrice;
    return parseFloat((diff * 10000).toFixed(1));
  }, [openTrade, currentPrice]);

  const progress = allCandles.length > 0 ? Math.round((visibleCount / allCandles.length) * 100) : 0;

  if (loading) {
    return (
      <div className="rounded-2xl bg-card/60 border border-border/50 p-8 text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Caricamento dati {symbol}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-card/60 border border-red-500/30 p-8 text-center">
        <p className="text-red-400 text-sm mb-2">Errore: {error}</p>
        <p className="text-xs text-muted-foreground">Verifica che il simbolo sia supportato.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-primary">{symbol}</span>
            <span className="text-[10px] text-muted-foreground">{interval}</span>
            <span className="text-[10px] text-muted-foreground">
              {visibleCount}/{allCandles.length} candele
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold">{currentPrice.toFixed(5)}</span>
            <button
              onClick={() => setShowTrades(!showTrades)}
              className="p-1 rounded hover:bg-white/5"
              title={showTrades ? "Nascondi trade" : "Mostra trade"}
            >
              {showTrades ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div
          ref={chartContainerRef}
          className="w-full"
          style={{ height: "clamp(280px, 45vh, 500px)" }}
        />

        <div className="px-3 py-2 border-t border-border/30">
          <div className="h-1 rounded-full bg-secondary/40 overflow-hidden mb-2">
            <div
              className="h-full bg-primary/60 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="sm"
                className="h-8 w-8 p-0"
                onClick={() => { setVisibleCount((p) => Math.max(START_CANDLES, p - 10)); }}
                disabled={visibleCount <= START_CANDLES}
              >
                <SkipBack className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="ghost" size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={visibleCount >= allCandles.length}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>

              <Button
                variant="ghost" size="sm"
                className="h-8 w-8 p-0"
                onClick={() => advanceCandle(1)}
                disabled={isPlaying || visibleCount >= allCandles.length}
              >
                <SkipForward className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="ghost" size="sm"
                className="h-8 w-8 p-0"
                onClick={() => advanceCandle(10)}
                disabled={isPlaying || visibleCount >= allCandles.length}
                title="+10 candele"
              >
                <ChevronRight className="w-4 h-4" />
                <ChevronRight className="w-4 h-4 -ml-3" />
              </Button>
            </div>

            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                    speed === s
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <Button
              variant="ghost" size="sm"
              className="h-8 w-8 p-0 text-orange-400"
              onClick={handleReset}
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleBuy}
          disabled={!!openTrade || isPlaying}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          BUY
        </Button>
        <Button
          onClick={handleSell}
          disabled={!!openTrade || isPlaying}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
        >
          <TrendingDown className="w-4 h-4 mr-2" />
          SELL
        </Button>
      </div>

      {openTrade && (
        <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-primary/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                openTrade.direction === "buy" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}>
                {openTrade.direction.toUpperCase()}
              </span>
              <span className="text-xs font-mono">@ {openTrade.entryPrice.toFixed(5)}</span>
            </div>
            <div className={`text-sm font-mono font-bold ${
              (openPnL ?? 0) >= 0 ? "text-green-400" : "text-red-400"
            }`}>
              {(openPnL ?? 0) >= 0 ? "+" : ""}{openPnL?.toFixed(1)} pips
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              className={`flex-1 text-xs ${settingSL ? "border-red-500 text-red-400" : ""} ${openTrade.stopLoss ? "border-red-500/30" : ""}`}
              onClick={handleSetSL}
            >
              {settingSL ? "Clicca sul grafico..." : openTrade.stopLoss ? `SL: ${openTrade.stopLoss.toFixed(5)}` : "Imposta SL"}
            </Button>
            <Button
              variant="outline" size="sm"
              className={`flex-1 text-xs ${settingTP ? "border-green-500 text-green-400" : ""} ${openTrade.takeProfit ? "border-green-500/30" : ""}`}
              onClick={handleSetTP}
            >
              {settingTP ? "Clicca sul grafico..." : openTrade.takeProfit ? `TP: ${openTrade.takeProfit.toFixed(5)}` : "Imposta TP"}
            </Button>
          </div>

          <Button
            variant="outline" size="sm"
            className="w-full text-orange-400 border-orange-500/30"
            onClick={handleCloseTrade}
          >
            <X className="w-3.5 h-3.5 mr-2" />
            Chiudi Trade al prezzo corrente ({currentPrice.toFixed(5)})
          </Button>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl bg-card/40 border border-border/30 p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Trade</div>
            <div className="text-sm font-bold font-mono">{stats.total}</div>
          </div>
          <div className="rounded-xl bg-card/40 border border-border/30 p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Win Rate</div>
            <div className={`text-sm font-bold font-mono ${stats.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
              {stats.winRate}%
            </div>
          </div>
          <div className="rounded-xl bg-card/40 border border-border/30 p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Pips</div>
            <div className={`text-sm font-bold font-mono ${parseFloat(stats.totalPips) >= 0 ? "text-green-400" : "text-red-400"}`}>
              {stats.totalPips}
            </div>
          </div>
          <div className="rounded-xl bg-card/40 border border-border/30 p-2 text-center">
            <div className="text-[10px] text-muted-foreground">W/L</div>
            <div className="text-sm font-bold font-mono">
              <span className="text-green-400">{stats.wins}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-400">{stats.losses}</span>
            </div>
          </div>
        </div>
      )}

      {trades.length > 0 && showTradePanel && (
        <div className="rounded-2xl bg-card/40 border border-border/30 p-3 space-y-2 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Storico Trade</span>
            <button onClick={() => setShowTradePanel(false)} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          {trades.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0">
              <div className="flex items-center gap-2">
                <span className={t.direction === "buy" ? "text-green-400" : "text-red-400"}>
                  {t.direction.toUpperCase()}
                </span>
                <span className="font-mono text-muted-foreground">
                  {t.entryPrice.toFixed(5)} → {t.exitPrice?.toFixed(5)}
                </span>
              </div>
              <span className={`font-bold font-mono ${
                t.result === "win" ? "text-green-400" : t.result === "loss" ? "text-red-400" : "text-yellow-400"
              }`}>
                {(t.pips ?? 0) >= 0 ? "+" : ""}{t.pips?.toFixed(1)} pips
              </span>
            </div>
          ))}
        </div>
      )}

      {trades.length > 0 && !showTradePanel && (
        <button
          onClick={() => setShowTradePanel(true)}
          className="w-full text-xs text-muted-foreground hover:text-foreground py-2 text-center"
        >
          Mostra storico ({trades.length} trade)
        </button>
      )}
    </div>
  );
}
