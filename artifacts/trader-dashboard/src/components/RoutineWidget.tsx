import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Sunrise, Moon, ChevronRight, CheckCircle2, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadDone(program: "morning" | "evening"): boolean {
  try {
    const raw = localStorage.getItem(`tl_session_${program}_v2`);
    if (!raw) return false;
    const { date } = JSON.parse(raw) as { date: string };
    return date === todayKey();
  } catch { return false; }
}

interface PillProps {
  program: "morning" | "evening";
  label: string;
  icon: React.ElementType;
  color: string;
  done: boolean;
}

function StatusPill({ label, icon: Icon, color, done }: PillProps) {
  return (
    <div className="flex-1 flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[11px] font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
      {done ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
      ) : (
        <div className="w-2 h-2 rounded-full bg-border/50 shrink-0" />
      )}
    </div>
  );
}

export function RoutineWidget() {
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);

  const refresh = () => {
    setMorningDone(loadDone("morning"));
    setEveningDone(loadDone("evening"));
  };

  useEffect(() => {
    refresh();
    window.addEventListener("tl_routine_morning_done", refresh);
    window.addEventListener("tl_routine_evening_done", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tl_routine_morning_done", refresh);
      window.removeEventListener("tl_routine_evening_done", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const bothDone = morningDone && eveningDone;

  return (
    <Card className="overflow-hidden">
      <CardContent className="px-4 sm:px-5 py-3 sm:py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sunrise className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold font-mono tracking-tight">Routine Giornaliera</p>
              <p className="text-[10px] text-muted-foreground/50">
                {bothDone
                  ? "✓ Entrambe le sessioni completate"
                  : `${(morningDone ? 1 : 0) + (eveningDone ? 1 : 0)}/2 sessioni completate`}
              </p>
            </div>
          </div>
          <Link
            href="/routine"
            className="flex items-center gap-1 text-xs font-semibold text-primary/70 hover:text-primary transition-colors"
          >
            {morningDone && eveningDone ? "Vedi" : <><Play className="w-3 h-3" />Inizia</>}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex flex-col gap-1 border-t border-border/20 pt-2.5">
          <StatusPill
            program="morning"
            label="Programma mattutino"
            icon={Sunrise}
            color="#f59e0b"
            done={morningDone}
          />
          <div className="h-px bg-border/15" />
          <StatusPill
            program="evening"
            label="Programma serale"
            icon={Moon}
            color="#818cf8"
            done={eveningDone}
          />
        </div>

        {!morningDone && !eveningDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2.5 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10"
          >
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Tocca <strong className="text-primary/70">Inizia</strong> per avviare la sessione guidata interattiva
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
