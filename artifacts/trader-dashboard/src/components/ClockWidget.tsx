import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBackground, type TradingSessionConfig } from "@/contexts/BackgroundContext";

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

function isInSession(utcHours: number, session: TradingSessionConfig): boolean {
  const open = parseTime(session.openUTC);
  const close = parseTime(session.closeUTC);
  if (open < close) {
    return utcHours >= open && utcHours < close;
  }
  return utcHours >= open || utcHours < close;
}

export function ClockWidget() {
  const [time, setTime] = useState(new Date());
  const { tradingSessions } = useBackground();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeSession = useMemo(() => {
    const utcHours = time.getUTCHours() + time.getUTCMinutes() / 60;
    const enabledSessions = tradingSessions.filter(s => s.enabled);
    return enabledSessions.find(s => isInSession(utcHours, s)) || null;
  }, [time, tradingSessions]);

  const colorMap: Record<string, { bg: string; glow: string }> = {
    "session-asian": {
      bg: "bg-[hsl(var(--session-asian))]",
      glow: "neon-glow-asian",
    },
    "session-london": {
      bg: "bg-[hsl(var(--session-london))]",
      glow: "neon-glow-london",
    },
    "session-ny": {
      bg: "bg-[hsl(var(--session-ny))]",
      glow: "neon-glow-ny",
    },
    "session-volume": {
      bg: "bg-[hsl(var(--session-volume))]",
      glow: "neon-glow-volume",
    },
  };

  const activeColors = activeSession ? colorMap[activeSession.color] : null;

  return (
    <Card className="overflow-hidden border-t-4 border-t-primary/50 relative">
      <div className="absolute top-0 right-0 p-32 opacity-5 pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-primary blur-[100px]" />
      </div>
      
      <CardContent className="p-3 sm:p-6 md:p-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-8">
          <div className="flex flex-col items-center sm:items-start z-10">
            <p className="text-muted-foreground font-medium mb-0.5 sm:mb-1 uppercase tracking-widest text-xs sm:text-sm">Tempo Locale</p>
            <div className="text-5xl sm:text-6xl md:text-7xl font-mono font-bold tracking-tighter text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
              {format(time, "HH:mm:ss")}
            </div>
            <p className="text-primary/80 mt-1 sm:mt-2 font-mono font-medium text-sm">
              UTC: {format(new Date(time.getTime() + time.getTimezoneOffset() * 60000), "HH:mm:ss")}
            </p>
          </div>

          {activeSession && activeColors && (
            <div className={cn(
              "flex items-center gap-3 px-5 py-3 rounded-xl border bg-secondary/80 z-10",
              activeColors.glow
            )}>
              <div className={cn(
                "w-3 h-3 rounded-full animate-pulse shadow-[0_0_8px_currentColor]",
                activeColors.bg
              )} />
              <span className="font-bold text-sm tracking-wide text-foreground">
                {activeSession.name}
              </span>
            </div>
          )}

          {!activeSession && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-border/50 bg-secondary/30 z-10 opacity-60">
              <div className="w-3 h-3 rounded-full bg-muted-foreground/40" />
              <span className="font-bold text-sm tracking-wide text-muted-foreground">
                Nessuna sessione
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
