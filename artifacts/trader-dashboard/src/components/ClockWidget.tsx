import { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBackground, type TradingSessionConfig } from "@/contexts/BackgroundContext";

// ─── helpers ───────────────────────────────────────────────────────────────────

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

function isInSession(utcHours: number, session: TradingSessionConfig): boolean {
  const open = parseTime(session.openUTC);
  const close = parseTime(session.closeUTC);
  if (open < close) return utcHours >= open && utcHours < close;
  return utcHours >= open || utcHours < close;
}

function getNextSession(
  utcHours: number,
  sessions: TradingSessionConfig[],
): { session: TradingSessionConfig; minutesUntil: number } | null {
  const enabled = sessions.filter((s) => s.enabled);
  if (enabled.length === 0) return null;
  let best: { session: TradingSessionConfig; minutesUntil: number } | null = null;
  for (const s of enabled) {
    let diff = parseTime(s.openUTC) - utcHours;
    if (diff <= 0) diff += 24;
    const minutes = Math.round(diff * 60);
    if (!best || minutes < best.minutesUntil) best = { session: s, minutesUntil: minutes };
  }
  return best;
}

function formatCountdown(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── component ─────────────────────────────────────────────────────────────────

export function ClockWidget() {
  const [time, setTime] = useState(new Date());
  const { tradingSessions } = useBackground();
  const prevSessionRef = useRef<string | null>(null);
  const notifPermissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      notifPermissionRef.current = Notification.permission;
      if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => {
          notifPermissionRef.current = p;
        });
      }
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const utcHours = useMemo(
    () => time.getUTCHours() + time.getUTCMinutes() / 60,
    [time],
  );

  const activeSession = useMemo(() => {
    const enabled = tradingSessions.filter((s) => s.enabled);
    return enabled.find((s) => isInSession(utcHours, s)) ?? null;
  }, [utcHours, tradingSessions]);

  const nextSessionInfo = useMemo(() => {
    if (activeSession) return null;
    return getNextSession(utcHours, tradingSessions);
  }, [utcHours, tradingSessions, activeSession]);

  useEffect(() => {
    const name = activeSession?.name ?? null;
    if (name && name !== prevSessionRef.current) {
      if ("Notification" in window && notifPermissionRef.current === "granted") {
        new Notification(`Sessione ${name} iniziata`, {
          body: `La sessione ${name} è ora attiva. Buon trading!`,
          icon: "/favicon.ico",
        });
      }
    }
    prevSessionRef.current = name;
  }, [activeSession]);

  const colorMap: Record<string, { bg: string; glow: string }> = {
    "session-asian":  { bg: "bg-[hsl(var(--session-asian))]",  glow: "neon-glow-asian"  },
    "session-london": { bg: "bg-[hsl(var(--session-london))]", glow: "neon-glow-london" },
    "session-ny":     { bg: "bg-[hsl(var(--session-ny))]",     glow: "neon-glow-ny"     },
    "session-volume": { bg: "bg-[hsl(var(--session-volume))]", glow: "neon-glow-volume" },
  };

  const dayOfWeek = time.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const activeColors = activeSession ? colorMap[activeSession.color] : null;

  // Countdown text — always rendered (empty string when no next session) to keep height stable
  const countdownText = nextSessionInfo
    ? `${nextSessionInfo.session.name} tra ${formatCountdown(nextSessionInfo.minutesUntil)}`
    : "";

  // UTC string — always 8 chars wide (UTC HH:MM) thanks to tabular-nums
  const utcTimeStr = `UTC ${String(time.getUTCHours()).padStart(2, "0")}:${String(
    time.getUTCMinutes(),
  ).padStart(2, "0")}`;

  // Badge label — fixed set of possible strings; longest is "Mercato chiuso"
  const badgeLabel = activeSession
    ? activeSession.name
    : isWeekend
    ? "Mercato chiuso"
    : "Mercato aperto";

  const badgeDotClass = activeSession
    ? cn(activeColors?.bg, "animate-pulse shadow-[0_0_8px_currentColor]")
    : isWeekend
    ? "bg-red-500"
    : "bg-green-500";

  const badgeTextClass = activeSession
    ? "text-foreground"
    : isWeekend
    ? "text-red-400"
    : "text-green-400";

  const badgeBorderClass = activeSession
    ? ""
    : isWeekend
    ? "border-red-500/30 bg-red-500/10"
    : "border-green-500/30 bg-green-500/10";

  return (
    <Card className="overflow-hidden border-t-4 border-t-primary/50 relative">
      {/* decorative glow — doesn't affect layout */}
      <div className="absolute top-0 right-0 p-32 opacity-5 pointer-events-none select-none">
        <div className="w-64 h-64 rounded-full bg-primary blur-[100px]" />
      </div>

      <CardContent className="px-4 sm:px-5 py-3 sm:py-4 z-10">
        {/*
          Three-column grid with FIXED column sizes:
          - col 1 (time):   auto-width from the time string — locked by tabular-nums + font-mono
          - col 2 (date):   fixed 5rem / 6rem — always the same height (4 lines reserved)
          - col 3 (badge):  fixed min-width badge — never resizes
          Using CSS grid guarantees columns never shift regardless of content changes.
        */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 sm:gap-6">

          {/* ── Col 1: clock ─────────────────────────────────────── */}
          <div className="tabular-nums slashed-zero">
            <div className="text-2xl sm:text-4xl md:text-5xl font-mono font-bold tracking-tighter text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
              {format(time, "HH:mm:ss")}
            </div>
          </div>

          {/* ── Col 2: date block (fixed height = 4 lines always) ── */}
          <div className="flex flex-col items-center text-center gap-[2px]">
            {/* line 1 — day number */}
            <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs sm:text-sm leading-none">
              {format(time, "d")}
            </p>
            {/* line 2 — day name */}
            <p className="text-muted-foreground font-medium uppercase tracking-widest text-[9px] sm:text-xs leading-none">
              {format(time, "EEEE", { locale: it })}
            </p>
            {/* line 3 — UTC time */}
            <p className="text-primary/80 font-mono text-[10px] sm:text-xs leading-none tabular-nums">
              {utcTimeStr}
            </p>
            {/* line 4 — countdown (always rendered, invisible when empty) */}
            <p
              className={cn(
                "text-[9px] sm:text-[10px] leading-none truncate max-w-[120px]",
                countdownText ? "text-muted-foreground" : "invisible select-none",
              )}
              aria-hidden={!countdownText}
            >
              {countdownText || "placeholder"}
            </p>
          </div>

          {/* ── Col 3: session badge (fixed min-width) ────────────── */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md border bg-secondary/80",
              "min-w-[8rem] sm:min-w-[9.5rem]",          // prevents width jump between names
              activeColors?.glow ?? "",
              !activeSession && badgeBorderClass,
            )}
          >
            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", badgeDotClass)} />
            <span className={cn("font-bold text-sm sm:text-base tracking-wide truncate", badgeTextClass)}>
              {badgeLabel}
            </span>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
