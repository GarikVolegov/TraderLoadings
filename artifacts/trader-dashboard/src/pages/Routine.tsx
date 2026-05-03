import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import confetti from "canvas-confetti";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import {
  Sunrise, Moon, Check, ChevronRight, Wind, Newspaper,
  CalendarDays, BarChart2, Target, ShieldCheck, Apple, Zap,
  BookOpen, Search, TrendingUp, BookMarked, Brain, RotateCcw,
  Clock, Coffee, AlarmClock, Star, Flame,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: number;
  icon: React.ElementType;
  title: string;
  desc: string;
  duration: string;
  href?: string;
  linkLabel?: string;
}

// ─── Program definitions ──────────────────────────────────────────────────────

const MORNING_STEPS: Step[] = [
  {
    id: 1, icon: Wind,
    title: "Sveglia mentale",
    desc: "5 minuti di respirazione consapevole per centrare la mente e prepararti alla sessione.",
    duration: "5 min", href: "/zen", linkLabel: "Apri Zen",
  },
  {
    id: 2, icon: Coffee,
    title: "Ritual di apertura",
    desc: "Colazione, acqua, ambiente ordinato. Il corpo e lo spazio influenzano la qualità delle decisioni.",
    duration: "10 min",
  },
  {
    id: 3, icon: Newspaper,
    title: "Briefing macro",
    desc: "Leggi il briefing economico: notizie geopolitiche, rischio sentiment, movimenti overnight sui mercati.",
    duration: "10 min", href: "/news", linkLabel: "Leggi notizie",
  },
  {
    id: 4, icon: CalendarDays,
    title: "Calendario eventi",
    desc: "Identifica gli eventi ad alto impatto nelle prossime ore: NFP, CPI, decisioni Fed e BCE.",
    duration: "5 min", href: "/tools", linkLabel: "Apri strumenti",
  },
  {
    id: 5, icon: BarChart2,
    title: "Analisi tecnica",
    desc: "Analizza i tuoi pair su H4 e D1: trend, struttura, supporti chiave e bias direzionale.",
    duration: "20 min",
  },
  {
    id: 6, icon: Target,
    title: "Definisci obiettivi",
    desc: "Imposta il target pip giornaliero e il max drawdown accettabile. Non operare oltre i limiti.",
    duration: "5 min",
  },
  {
    id: 7, icon: ShieldCheck,
    title: "Checklist pre-trade",
    desc: "Verifica che tutti i criteri del tuo setup siano soddisfatti. Nessuna eccezione alla regola.",
    duration: "3 min", href: "/checklist", linkLabel: "Apri checklist",
  },
  {
    id: 8, icon: Zap,
    title: "Avvia la sessione",
    desc: "Chart aperte, piano in mano, disciplina al massimo. Hai fatto tutto il necessario. Buon trading!",
    duration: "—",
  },
];

const EVENING_STEPS: Step[] = [
  {
    id: 1, icon: Search,
    title: "Review dei trade",
    desc: "Analizza ogni operazione: entry, gestione della posizione, uscita. Cosa ha funzionato e perché?",
    duration: "15 min", href: "/journal", linkLabel: "Apri diario",
  },
  {
    id: 2, icon: BookOpen,
    title: "Journaling",
    desc: "Scrivi le riflessioni di giornata, le emozioni provate e le lezioni apprese. La scrittura chiarisce la mente.",
    duration: "10 min", href: "/journal", linkLabel: "Scrivi",
  },
  {
    id: 3, icon: TrendingUp,
    title: "Aggiorna statistiche",
    desc: "Rivedi win rate, pips totali, R-multiplo e P&L settimanale. Il progresso si misura, non si percepisce.",
    duration: "5 min", href: "/journal", linkLabel: "Vedi stats",
  },
  {
    id: 4, icon: Target,
    title: "Autopsia degli errori",
    desc: "Identifica 1-2 comportamenti specifici da migliorare domani. Sii onesto, non ipercritico.",
    duration: "10 min",
  },
  {
    id: 5, icon: CalendarDays,
    title: "Piano di domani",
    desc: "Prepara la watchlist per domani: livelli chiave, eventi macro, bias atteso sui pair principali.",
    duration: "15 min",
  },
  {
    id: 6, icon: BookMarked,
    title: "Studio e formazione",
    desc: "Leggi 15 minuti su price action, psicologia o gestione del rischio. I trader migliori studiano sempre.",
    duration: "15 min",
  },
  {
    id: 7, icon: Brain,
    title: "Decompressione",
    desc: "Meditazione o respirazione serale per staccare la mentalità del trader. Il riposo è parte dell'edge.",
    duration: "10 min", href: "/zen", linkLabel: "Meditazione",
  },
  {
    id: 8, icon: Moon,
    title: "Disconnetti",
    desc: "Chiudi grafici e app. I mercati riaprono domani. Riposa profondamente — è il tuo vantaggio segreto.",
    duration: "—",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function useDailyRoutine(program: "morning" | "evening") {
  const key = `tl_routine_${program}_v1`;

  const [completed, setCompleted] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return new Set();
      const { date, ids } = JSON.parse(raw) as { date: string; ids: number[] };
      if (date !== todayKey()) return new Set();
      return new Set(ids);
    } catch {
      return new Set();
    }
  });

  const persist = useCallback(
    (next: Set<number>) => {
      localStorage.setItem(key, JSON.stringify({ date: todayKey(), ids: [...next] }));
    },
    [key],
  );

  const toggle = useCallback(
    (id: number) => {
      setCompleted((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    const empty = new Set<number>();
    setCompleted(empty);
    persist(empty);
  }, [persist]);

  return { completed, toggle, reset };
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({
  progress,
  size = 72,
  strokeWidth = 5,
  color,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke="currentColor" strokeWidth={strokeWidth}
        fill="none" style={{ opacity: 0.08 }}
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={color} strokeWidth={strokeWidth}
        fill="none" strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
      />
    </svg>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  isCompleted,
  onToggle,
  accentColor,
  accentClass,
  borderClass,
}: {
  step: Step;
  index: number;
  isCompleted: boolean;
  onToggle: () => void;
  accentColor: string;
  accentClass: string;
  borderClass: string;
}) {
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 + index * 0.04, type: "spring", stiffness: 400, damping: 30 }}
      className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer select-none ${
        isCompleted
          ? `${borderClass} bg-white/[0.02]`
          : "border-border/40 bg-card/40 hover:border-border/70 hover:bg-card/60"
      }`}
      onClick={onToggle}
      whileTap={{ scale: 0.985 }}
    >
      {/* Step number / check */}
      <div className="shrink-0 mt-0.5">
        <motion.div
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            isCompleted
              ? `border-transparent`
              : "border-border/50 group-hover:border-border"
          }`}
          style={isCompleted ? { backgroundColor: accentColor } : {}}
          animate={{ scale: isCompleted ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 0.3, ease: "backOut" }}
        >
          <AnimatePresence mode="wait">
            {isCompleted ? (
              <motion.div
                key="check"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 20 }}
              >
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.span
                key="num"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] font-bold text-muted-foreground/50"
              >
                {index + 1}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Icon */}
      <div
        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
          isCompleted ? "opacity-40" : `${accentClass} group-hover:scale-110`
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className={`font-semibold text-sm transition-all duration-200 ${
              isCompleted ? "line-through text-muted-foreground/40" : "text-foreground"
            }`}
          >
            {step.title}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted-foreground/50 font-mono flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {step.duration}
            </span>
            {step.href && !isCompleted && (
              <Link
                href={step.href}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-semibold text-primary/70 hover:text-primary flex items-center gap-0.5 transition-colors"
              >
                {step.linkLabel}
                <ChevronRight className="w-2.5 h-2.5" />
              </Link>
            )}
          </div>
        </div>
        <p
          className={`text-xs leading-relaxed transition-all duration-200 ${
            isCompleted ? "text-muted-foreground/30" : "text-muted-foreground/70"
          }`}
        >
          {step.desc}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Program panel ────────────────────────────────────────────────────────────

function ProgramPanel({
  program,
  steps,
  accentColor,
  accentClass,
  borderClass,
  bgGlow,
  icon: PanelIcon,
  label,
  timeLabel,
  isActive,
  delay,
}: {
  program: "morning" | "evening";
  steps: Step[];
  accentColor: string;
  accentClass: string;
  borderClass: string;
  bgGlow: string;
  icon: React.ElementType;
  label: string;
  timeLabel: string;
  isActive: boolean;
  delay: number;
}) {
  const { completed, toggle, reset } = useDailyRoutine(program);
  const firedRef = useRef(false);
  const totalSteps = steps.length;
  const completedCount = completed.size;
  const progress = Math.round((completedCount / totalSteps) * 100);
  const allDone = completedCount === totalSteps;

  const totalTime = useMemo(() => {
    const nums = steps
      .map((s) => parseInt(s.duration))
      .filter((n) => !isNaN(n));
    return nums.reduce((a, b) => a + b, 0);
  }, [steps]);

  useEffect(() => {
    if (allDone && !firedRef.current) {
      firedRef.current = true;
      const colors =
        program === "morning"
          ? ["#f59e0b", "#fcd34d", "#ffffff", "#fbbf24"]
          : ["#6366f1", "#818cf8", "#ffffff", "#a5b4fc"];
      confetti({
        particleCount: 80,
        spread: 65,
        origin: { y: 0.55 },
        colors,
        scalar: 0.9,
      });
    }
    if (!allDone) firedRef.current = false;
  }, [allDone, program]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 280, damping: 28 }}
      className={`relative flex flex-col rounded-3xl border overflow-hidden transition-all duration-500 ${
        isActive
          ? `${borderClass} shadow-[0_0_48px_-8px_${accentColor}33]`
          : "border-border/40"
      }`}
    >
      {/* Background glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          isActive ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${accentColor}0d 0%, transparent 70%)`,
        }}
      />

      {/* Header */}
      <div className="relative z-10 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: icon + title */}
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl ${accentClass} flex items-center justify-center shrink-0`}>
              <PanelIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg font-mono tracking-tight">{label}</h3>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                  >
                    Attivo
                  </motion.span>
                )}
              </div>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {timeLabel} · {totalTime} min totali
              </p>
            </div>
          </div>

          {/* Right: progress ring */}
          <div className="relative shrink-0">
            <ProgressRing progress={progress} color={accentColor} size={68} strokeWidth={5} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-bold text-sm font-mono" style={{ color: accentColor }}>
                {completedCount}/{totalSteps}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: accentColor }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
          />
        </div>

        {/* Completion badge */}
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.9 }}
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ backgroundColor: `${accentColor}15`, border: `1px solid ${accentColor}30` }}
            >
              <Star className="w-3.5 h-3.5" style={{ color: accentColor }} />
              <span className="text-xs font-semibold" style={{ color: accentColor }}>
                Programma completato! Ottimo lavoro, trader.
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Steps list */}
      <div className="relative z-10 px-4 pb-4 flex flex-col gap-2">
        {steps.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            index={i}
            isCompleted={completed.has(step.id)}
            onToggle={() => toggle(step.id)}
            accentColor={accentColor}
            accentClass={accentClass}
            borderClass={borderClass}
          />
        ))}
      </div>

      {/* Reset */}
      {completedCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10 px-4 pb-4"
        >
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Azzera progressi
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Routine() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const isMorningActive = hour >= 4 && hour < 13;
  const isEveningActive = hour >= 16 && hour < 24;

  const timeGreeting = useMemo(() => {
    if (hour >= 5 && hour < 12) return "Buongiorno";
    if (hour >= 12 && hour < 17) return "Buon pomeriggio";
    if (hour >= 17 && hour < 21) return "Buona sera";
    return "Buona notte";
  }, [hour]);

  return (
    <PageLayout>
      <PageHeader
        title="Programma del Trader"
        subtitle="Routine mattutina e serale per un trading disciplinato e professionale"
      />

      {/* Time hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="flex items-center justify-between px-5 py-4 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm"
      >
        <div>
          <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-semibold">
            {timeGreeting}
          </p>
          <p className="font-mono font-bold text-2xl tabular-nums tracking-tight mt-0.5">
            {now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xs text-muted-foreground/50 mt-0.5">
            {now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMorningActive && (
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b30" }}
            >
              <Sunrise className="w-3.5 h-3.5" />
              Sessione mattutina
            </motion.div>
          )}
          {isEveningActive && (
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: "#6366f120", color: "#818cf8", border: "1px solid #6366f130" }}
            >
              <Moon className="w-3.5 h-3.5" />
              Sessione serale
            </motion.div>
          )}
          {!isMorningActive && !isEveningActive && (
            <span className="text-xs text-muted-foreground/40 font-mono">
              Nessuna sessione attiva
            </span>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
            <Flame className="w-3.5 h-3.5" />
            Disciplina
          </div>
        </div>
      </motion.div>

      {/* Pro tips banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="px-4 py-3 rounded-xl border border-primary/15 bg-primary/5 text-xs text-primary/80 leading-relaxed"
      >
        <strong className="font-bold">Come usarlo:</strong>{" "}
        Tocca ogni step per marcarlo come completato. La routine si azzera automaticamente ogni giorno.
        Completare entrambi i programmi ogni giorno costruisce la disciplina che separa i trader professionisti dagli amatori.
      </motion.div>

      {/* Two panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <ProgramPanel
          program="morning"
          steps={MORNING_STEPS}
          accentColor="#f59e0b"
          accentClass="bg-amber-500/10 text-amber-400"
          borderClass="border-amber-500/20"
          bgGlow="amber"
          icon={Sunrise}
          label="Programma Mattutino"
          timeLabel="05:00 – 13:00"
          isActive={isMorningActive}
          delay={0.14}
        />
        <ProgramPanel
          program="evening"
          steps={EVENING_STEPS}
          accentColor="#818cf8"
          accentClass="bg-indigo-500/10 text-indigo-400"
          borderClass="border-indigo-500/20"
          bgGlow="indigo"
          icon={Moon}
          label="Programma Serale"
          timeLabel="17:00 – 23:00"
          isActive={isEveningActive}
          delay={0.2}
        />
      </div>

      {/* Bottom quote */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center pb-4"
      >
        <p className="text-sm italic text-muted-foreground/40">
          &ldquo;La disciplina è fare ciò che devi fare anche quando non ne hai voglia.&rdquo;
        </p>
        <p className="text-xs text-muted-foreground/30 mt-1">— Principio del trader professionale</p>
      </motion.div>
    </PageLayout>
  );
}
