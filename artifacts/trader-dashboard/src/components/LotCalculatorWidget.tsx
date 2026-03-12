import { useState, useMemo } from "react";
import { Calculator, RefreshCcw, DollarSign, Target, Activity } from "lucide-react";
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
    
    // Formula: (€/pips)/11
    const size = (risk / pips) / 11;
    return size.toFixed(2);
  }, [riskEuro, stopLossPips]);

  const handleReset = () => {
    setRiskEuro("");
    setStopLossPips("");
  };

  return (
    <Card className="h-full relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors duration-500" />
      
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-accent" />
          Calcolatore Lotti
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Rischio in Euro (€)
            </label>
            <Input 
              type="number" 
              placeholder="es. 100" 
              value={riskEuro}
              onChange={(e) => setRiskEuro(e.target.value)}
              className="text-lg"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-destructive" /> Stop Loss in Pips
            </label>
            <Input 
              type="number" 
              placeholder="es. 15" 
              value={stopLossPips}
              onChange={(e) => setStopLossPips(e.target.value)}
              className="text-lg"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/50 p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center text-center space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Lottaggio Consigliato
            </p>
            <div className="text-5xl font-mono font-bold text-foreground">
              {lotSize !== null ? lotSize : "0.00"}
            </div>
            <p className="text-xs text-muted-foreground/70 font-mono mt-2">
              Formula: (€ / pips) / 11
            </p>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full h-12" 
          onClick={handleReset}
          disabled={!riskEuro && !stopLossPips}
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Resetta Valori
        </Button>
      </CardContent>
    </Card>
  );
}
