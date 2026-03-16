import { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
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

function getNextSession(utcHours: number, sessions: TradingSessionConfig[]): { session: TradingSessionConfig; minutesUntil: number } | null {
  const enabled = sessions.filter(s => s.enabled);
  if (enabled.length === 0) return null;

  let best: { session: TradingSessionConfig; minutesUntil: number } | null = null;

  for (const s of enabled) {
    const open = parseTime(s.openUTC);
    let diff = open - utcHours;
    if (diff <= 0) diff += 24;
    const minutes = Math.round(diff * 60);
    if (!best || minutes < best.minutesUntil) {
      best = { session: s, minutesUntil: minutes };
    }
  }

  return best;
}

function formatCountdown(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ClockWidget() {
  const [time, setTime] = useState(new Date());
  const { tradingSessions } = useBackground();
  const prevSessionRef = useRef<string | null>(null);
  const notifPermissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      notifPermissionRef.current = Notification.permission;
      if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => { notifPermissionRef.current = p; });
      }
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeSession = useMemo(() => {
    const utcHours = time.getUTCHours() + time.getUTCMinutes() / 60;
    const enabledSessions = tradingSessions.filter(s => s.enabled);
    return enabledSessions.find(s => isInSession(utcHours, s)) || null;
  }, [time, tradingSessions]);

  const nextSessionInfo = useMemo(() => {
    if (activeSession) return null;
    const utcHours = time.getUTCHours() + time.getUTCMinutes() / 60;
    return getNextSession(utcHours, tradingSessions);
  }, [time, tradingSessions, activeSession]);

  useEffect(() => {
    const sessionName = activeSession?.name || null;
    if (sessionName && sessionName !== prevSessionRef.current) {
      if ("Notification" in window && notifPermissionRef.current === "granted") {
        new Notification(`Sessione ${sessionName} iniziata`, {
          body: `La sessione ${sessionName} è ora attiva. Buon trading!`,
          icon: "/favicon.ico",
        });
      }
    }
    prevSessionRef.current = sessionName;
  }, [activeSession]);

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

  const dayOfWeek = time.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const marketStatus = isWeekend ? "Mercato chiuso" : "Mercato aperto";

  const utcTimeStr = `UTC ${String(time.getUTCHours()).padStart(2, "0")}:${String(time.getUTCMinutes()).padStart(2, "0")}`;

  return (
    <Card className="overflow-hidden border-t-4 border-t-primary/50 relative">
      <div className="absolute top-0 right-0 p-32 opacity-5 pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-primary blur-[100px]" />
      </div>
      
      <CardContent className="px-3 sm:px-5 md:px-8 py-2 sm:py-3 md:py-4 z-10">
        <div className="flex items-center justify-between gap-3 sm:gap-4 md:gap-6">
          <div className="flex flex-col items-center z-10 flex-1 text-right">
            <div className="text-2xl sm:text-4xl md:text-5xl font-mono font-bold tracking-tighter text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
              {format(time, "HH:mm:ss")}
            </div>
          </div>

          <div className="flex flex-col items-center z-10 flex-1">
            <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs sm:text-sm leading-tight">
              {format(time, "d")}
            </p>
            <p className="text-muted-foreground font-medium uppercase tracking-widest text-[9px] sm:text-xs leading-tight">
              {format(time, "EEEE", { locale: it })}
            </p>
            <p className="text-primary/80 font-mono text-[10px] sm:text-xs leading-tight mt-0.5">
              {utcTimeStr}
            </p>
            {nextSessionInfo && (
              <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-tight mt-0.5 truncate max-w-[100px] sm:max-w-none">
                {nextSessionInfo.session.name} tra {formatCountdown(nextSessionInfo.minutesUntil)}
              </p>
            )}
          </div>

          {activeSession && activeColors && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md border bg-secondary/80 z-10 shrink-0 flex-1 text-left",
              activeColors.glow
            )}>
              <div className={cn(
                "w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]",
                activeColors.bg
              )} />
              <span className="font-bold text-sm sm:text-base tracking-wide text-foreground">
                {activeSession.name}
              </span>
            </div>
          )}

          {!activeSession && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md border z-10 shrink-0 flex-1 text-left",
              isWeekend 
                ? "border-red-500/30 bg-red-500/10" 
                : "border-green-500/30 bg-green-500/10"
            )}>
              <div className={cn(
                "w-2.5 h-2.5 rounded-full",
                isWeekend 
                  ? "bg-red-500" 
                  : "bg-green-500"
              )} />
              <span className={cn(
                "font-bold text-sm sm:text-base tracking-wide",
                isWeekend 
                  ? "text-red-500" 
                  : "text-green-500"
              )}>
                {marketStatus}
              </span>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
