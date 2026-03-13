import { useState, useMemo } from "react";
import { useBackground } from "@/contexts/BackgroundContext";

export function LotCalculatorWidget() {
  const [riskEuro, setRiskEuro] = useState<string>("");
  const [stopLossPips, setStopLossPips] = useState<string>("");
  const { lotDivisor } = useBackground();

  const lotSize = useMemo(() => {
    const risk = parseFloat(riskEuro);
    const pips = parseFloat(stopLossPips);
    if (isNaN(risk) || isNaN(pips) || pips <= 0) return null;
    return ((risk / pips) / lotDivisor).toFixed(2);
  }, [riskEuro, stopLossPips, lotDivisor]);

  return (
    <div className="h-full rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-4 sm:p-6 space-y-4 sm:space-y-5">
      <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold uppercase tracking-[0.2em] text-foreground/90">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
        Dimensionamento Posizione
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <label className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Rischio (€)
          </label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={riskEuro}
            onChange={(e) => setRiskEuro(e.target.value)}
            className="w-full bg-secondary/60 border-0 rounded-xl px-4 py-3 sm:py-4 text-lg sm:text-xl font-mono text-foreground/80 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Stop Pips
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={stopLossPips}
            onChange={(e) => setStopLossPips(e.target.value)}
            className="w-full bg-secondary/60 border-0 rounded-xl px-4 py-3 sm:py-4 text-lg sm:text-xl font-mono text-foreground/80 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
      </div>

      <div className="rounded-2xl border-2 border-foreground/20 bg-background/40 p-4 sm:p-6 text-center">
        <p className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-[0.25em] mb-2">
          Lotti Risultanti
        </p>
        <div className="text-4xl sm:text-5xl font-mono font-bold text-foreground tracking-wider">
          {lotSize ?? "0.00"}
        </div>
      </div>
    </div>
  );
}
