import { useState, useEffect } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SessionType = "asian" | "london" | "ny" | "volume";

interface SessionInfo {
  id: SessionType;
  name: string;
  timeRange: string;
  colorClass: string;
  glowClass: string;
  active: boolean;
}

export function ClockWidget() {
  const [time, setTime] = useState(new Date());
  const [activeSessionId, setActiveSessionId] = useState<SessionType>("asian");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);
      
      // Calculate current UTC hours (0-23.99)
      const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
      
      if (utcHours >= 0 && utcHours < 8) {
        setActiveSessionId("asian");
      } else if (utcHours >= 8 && utcHours < 13.5) {
        setActiveSessionId("london");
      } else if (utcHours >= 13.5 && utcHours < 20) {
        setActiveSessionId("ny");
      } else {
        setActiveSessionId("volume");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const sessions: SessionInfo[] = [
    {
      id: "asian",
      name: "Asiatica",
      timeRange: "00:00 - 08:00 UTC",
      colorClass: "bg-[hsl(var(--session-asian))]",
      glowClass: "neon-glow-asian border-[hsl(var(--session-asian))]",
      active: activeSessionId === "asian"
    },
    {
      id: "london",
      name: "Londinese",
      timeRange: "08:00 - 13:30 UTC",
      colorClass: "bg-[hsl(var(--session-london))]",
      glowClass: "neon-glow-london border-[hsl(var(--session-london))]",
      active: activeSessionId === "london"
    },
    {
      id: "ny",
      name: "New York",
      timeRange: "13:30 - 20:00 UTC",
      colorClass: "bg-[hsl(var(--session-ny))]",
      glowClass: "neon-glow-ny border-[hsl(var(--session-ny))]",
      active: activeSessionId === "ny"
    },
    {
      id: "volume",
      name: "Conferma Vol.",
      timeRange: "20:00 - 00:00 UTC",
      colorClass: "bg-[hsl(var(--session-volume))]",
      glowClass: "neon-glow-volume border-[hsl(var(--session-volume))]",
      active: activeSessionId === "volume"
    }
  ];

  return (
    <Card className="overflow-hidden border-t-4 border-t-primary/50 relative">
      <div className="absolute top-0 right-0 p-32 opacity-5 pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-primary blur-[100px]" />
      </div>
      
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Digital Clock */}
          <div className="flex flex-col items-center md:items-start z-10">
            <p className="text-muted-foreground font-medium mb-1 uppercase tracking-widest text-sm">Tempo Locale</p>
            <div className="text-6xl md:text-7xl font-mono font-bold tracking-tighter text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
              {format(time, "HH:mm:ss")}
            </div>
            <p className="text-primary/80 mt-2 font-mono font-medium">
              UTC: {format(new Date(time.getTime() + time.getTimezoneOffset() * 60000), "HH:mm:ss")}
            </p>
          </div>

          {/* Session Indicators */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full md:w-auto z-10">
            {sessions.map((session) => (
              <div 
                key={session.id}
                className={cn(
                  "relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-500",
                  session.active 
                    ? `bg-secondary/80 ${session.glowClass} scale-105` 
                    : "bg-secondary/30 border-border/50 opacity-60"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className={cn(
                      "w-3 h-3 rounded-full transition-all duration-300", 
                      session.colorClass,
                      session.active && "animate-pulse shadow-[0_0_8px_currentColor]"
                    )} 
                  />
                  <span className={cn(
                    "font-bold text-sm tracking-wide",
                    session.active ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {session.name}
                  </span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{session.timeRange}</span>
                
                {session.active && (
                  <motion.div 
                    layoutId="activeSession"
                    className="absolute inset-0 rounded-xl border-2 border-white/10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
