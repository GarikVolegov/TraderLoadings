import { useState, useMemo } from "react";
import { Calculator, RefreshCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LotCalculatorWidget() {
  const [riskEuro, setRiskEuro] = useState<string>("");
  const [stopLossPips, setStopLossPips] = useState<string>("");

  const lotSize = useMemo(() => {
    const risk = parseFloat(riskEuro);
    const pips = parseFloat(stopLossPips);
    if (isNaN(risk) || isNaN(pips) || pips <= 0) return null;
    return ((risk / pips) / 11).toFixed(2);
  }, [riskEuro, stopLossPips]);

  return (
    <Card className="h-full relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors duration-500" />

      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-accent" />
          Calcolatore Lotti
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-5 px-3 sm:px-6 pb-3 sm:pb-6">
        <div className="space-y-2 sm:space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
              Rischio (€)
            </label>
            <Input
              type="number"
              placeholder="es. 100"
              value={riskEuro}
              onChange={(e) => setRiskEuro(e.target.value)}
              className="text-base sm:text-lg"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
              Stop Loss (pips)
            </label>
            <Input
              type="number"
              placeholder="es. 15"
              value={stopLossPips}
              onChange={(e) => setStopLossPips(e.target.value)}
              className="text-base sm:text-lg"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/50 p-3 sm:p-5 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Lottaggio</p>
          <div className="text-4xl sm:text-5xl font-mono font-bold">
            {lotSize ?? "0.00"}
          </div>
          <p className="text-xs text-muted-foreground/60 font-mono mt-1">(€ / pips) / 11</p>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => { setRiskEuro(""); setStopLossPips(""); }}
          disabled={!riskEuro && !stopLossPips}
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </CardContent>
    </Card>
  );
}
