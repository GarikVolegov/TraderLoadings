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

  return (
    <Card className="overflow-hidden border-t-4 border-t-primary/50 relative">
      <div className="absolute top-0 right-0 p-32 opacity-5 pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-primary blur-[100px]" />
      </div>
      
      <CardContent className="p-1.5 sm:p-2 md:p-3 z-10">
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex flex-col items-start z-10 min-w-0">
            <p className="text-muted-foreground font-medium uppercase tracking-widest text-[9px] sm:text-xs leading-none">
              {format(time, "d EEEE", { locale: it })}
            </p>
            <div className="text-xl sm:text-2xl md:text-3xl font-mono font-bold tracking-tighter text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
              {format(time, "HH:mm:ss")}
            </div>
          </div>

          {activeSession && activeColors && (
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md border bg-secondary/80 z-10 shrink-0",
              activeColors.glow
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]",
                activeColors.bg
              )} />
              <span className="font-bold text-[11px] sm:text-xs tracking-wide text-foreground">
                {activeSession.name}
              </span>
            </div>
          )}

          {!activeSession && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border/50 bg-secondary/30 z-10 opacity-60 shrink-0">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              <span className="font-bold text-[11px] sm:text-xs tracking-wide text-muted-foreground">
                —
              </span>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
