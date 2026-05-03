import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Sunrise, Moon, ChevronRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MORNING_TOTAL = 8;
const EVENING_TOTAL = 8;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadCount(program: "morning" | "evening"): number {
  try {
    const raw = localStorage.getItem(`tl_routine_${program}_v1`);
    if (!raw) return 0;
    const { date, ids } = JSON.parse(raw) as { date: string; ids: number[] };
    if (date !== todayKey()) return 0;
    return ids.length;
  } catch {
    return 0;
  }
}

interface PillProps {
  icon: React.ElementType;
  label: string;
  done: number;
  total: number;
  color: string;
  bgColor: string;
}

function RoutinePill({ icon: Icon, label, done, total, color, bgColor }: PillProps) {
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;
  return (
    <div className="flex-1 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-[11px] font-semibold" style={{ color }}>
            {label}
          </span>
          {allDone && <Check className="w-3 h-3" style={{ color }} strokeWidth={3} />}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/50">
          {done}/{total}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${bgColor}20` }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </div>
    </div>
  );
}

export function RoutineWidget() {
  const [morningDone, setMorningDone] = useState(0);
  const [eveningDone, setEveningDone] = useState(0);

  useEffect(() => {
    setMorningDone(loadCount("morning"));
    setEveningDone(loadCount("evening"));
    const handler = () => {
      setMorningDone(loadCount("morning"));
      setEveningDone(loadCount("evening"));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const totalDone = morningDone + eveningDone;
  const totalSteps = MORNING_TOTAL + EVENING_TOTAL;
  const allComplete = totalDone === totalSteps;

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
                {allComplete ? "✓ Completata oggi!" : `${totalDone}/${totalSteps} step completati`}
              </p>
            </div>
          </div>
          <Link
            href="/routine"
            className="flex items-center gap-1 text-xs font-semibold text-primary/70 hover:text-primary transition-colors"
          >
            Apri
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex gap-4">
          <RoutinePill
            icon={Sunrise}
            label="Mattina"
            done={morningDone}
            total={MORNING_TOTAL}
            color="#f59e0b"
            bgColor="#f59e0b"
          />
          <div className="w-px bg-border/30" />
          <RoutinePill
            icon={Moon}
            label="Sera"
            done={eveningDone}
            total={EVENING_TOTAL}
            color="#818cf8"
            bgColor="#818cf8"
          />
        </div>
      </CardContent>
    </Card>
  );
}
