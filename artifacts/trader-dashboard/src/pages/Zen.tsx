import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Wind, Eye, BookOpen, Heart, Clock, Play, Pause, RotateCcw, ChevronRight } from "lucide-react";

type Phase = "inspira" | "trattieni" | "espira" | "riposa";

const PHASE_CONFIG: Record<Phase, { label: string; duration: number; color: string; ringColor: string }> = {
  inspira:   { label: "Inspira",   duration: 4, color: "text-emerald-400", ringColor: "stroke-emerald-400" },
  trattieni: { label: "Trattieni", duration: 4, color: "text-sky-400",     ringColor: "stroke-sky-400" },
  espira:    { label: "Espira",    duration: 4, color: "text-amber-400",   ringColor: "stroke-amber-400" },
  riposa:    { label: "Riposa",    duration: 2, color: "text-slate-400",   ringColor: "stroke-slate-400" },
};

const PHASES: Phase[] = ["inspira", "trattieni", "espira", "riposa"];
const CIRCUMFERENCE = 2 * Math.PI * 46;

function BreathingExercise() {
  const [phase, setPhase] = useState<Phase>("inspira");
  const [isActive, setIsActive] = useState(false);
  const [count, setCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  const tick = useCallback(() => {
    const now = performance.now();
    const dt = (now - startTimeRef.current) / 1000;
    const dur = PHASE_CONFIG[phaseRef.current].duration;

    if (dt >= dur) {
      const idx = PHASES.indexOf(phaseRef.current);
      const nextIdx = (idx + 1) % PHASES.length;
      if (nextIdx === 0) setCount(c => c + 1);
      setPhase(PHASES[nextIdx]);
      setElapsed(0);
      startTimeRef.current = now;
    } else {
      setElapsed(dt);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = performance.now();
      setElapsed(0);
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, tick]);

  const config = PHASE_CONFIG[phase];
  const progress = elapsed / config.duration;
  const remaining = Math.ceil(config.duration - elapsed);
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const scale = phase === "inspira" ? 1 + progress * 0.25
    : phase === "espira" ? 1.25 - progress * 0.25
    : phase === "trattieni" ? 1.25
    : 1;

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardContent className="flex flex-col items-center gap-6 py-8 sm:py-12 px-4">
        <div className="relative w-44 h-44 sm:w-56 sm:h-56">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" strokeWidth="3" className="stroke-muted-foreground/15" />
            <circle
              cx="50" cy="50" r="46"
              fill="none"
              strokeWidth="3.5"
              strokeLinecap="round"
              className={`${config.ringColor} transition-[stroke] duration-500`}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={isActive ? dashOffset : CIRCUMFERENCE}
              style={{ transition: "stroke-dashoffset 100ms linear, stroke 500ms" }}
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-card to-card/60 border border-border/50 flex flex-col items-center justify-center shadow-lg"
            >
              <span className={`text-base sm:text-lg font-bold ${config.color} transition-colors duration-500`}>
                {config.label}
              </span>
              {isActive && (
                <span className="text-2xl sm:text-3xl font-mono font-bold text-foreground mt-0.5">
                  {remaining}
                </span>
              )}
            </motion.div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {PHASES.map((p, i) => (
            <div key={p} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                p === phase ? `${PHASE_CONFIG[p].ringColor.replace("stroke-", "bg-")} scale-125` : "bg-muted-foreground/20"
              }`} />
              {i < PHASES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Cicli completati: <span className="font-semibold text-foreground">{count}</span>
        </p>

        <div className="flex gap-3">
          <Button onClick={() => setIsActive(!isActive)} className="gap-2 min-w-[120px]">
            {isActive ? <><Pause className="w-4 h-4" /> Pausa</> : <><Play className="w-4 h-4" /> Inizia</>}
          </Button>
          <Button
            variant="outline"
            onClick={() => { setIsActive(false); setPhase("inspira"); setCount(0); setElapsed(0); }}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
        </div>

        <p className="text-[10px] sm:text-xs text-muted-foreground/60 text-center max-w-xs">
          Tecnica 4-4-4-2: inspira (4s), trattieni (4s), espira (4s), riposa (2s)
        </p>
      </CardContent>
    </Card>
  );
}

function ResultVisualization() {
  const [goal, setGoal] = useState("");

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardContent className="space-y-4 sm:space-y-6 py-6 sm:py-8 px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">Visualizzazione del Risultato</h3>
        </div>

        <div>
          <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
            Visualizza il tuo obiettivo di trading:
          </label>
          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Es. Voglio completare 3 trade vincenti con disciplina, gestire il rischio perfettamente..."
            className="h-24 sm:h-32 resize-none text-sm"
          />
        </div>

        {goal && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 sm:p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 space-y-3 sm:space-y-4"
          >
            <p className="text-xs sm:text-sm text-muted-foreground">
              Chiudi gli occhi, respira profondamente e visualizza chiaramente:
            </p>
            <motion.p
              className="text-sm sm:text-lg font-semibold text-foreground italic"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {goal}
            </motion.p>
            <p className="text-[10px] sm:text-xs text-muted-foreground/60">
              Mantieni questa immagine per 1-2 minuti. Senti le emozioni di successo.
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

function MotivationalQuotes() {
  const quotes = [
    { text: "La disciplina \u00e8 scegliere tra ci\u00f2 che vuoi adesso e ci\u00f2 che vuoi di pi\u00f9.", author: "Abraham Lincoln" },
    { text: "Il trading non \u00e8 una maratona, \u00e8 una serie di sprint disciplinati.", author: "Saggezza del mercato" },
    { text: "La paura e l\u2019avidit\u00e0 sono i nemici del trader consapevole.", author: "Saggio del trading" },
    { text: "Ogni perdita \u00e8 una lezione, non una sconfitta.", author: "Mentalit\u00e0 vincente" },
    { text: "Il successo arriva a chi controlla le emozioni, non a chi segue le emozioni.", author: "Psicologia del trading" },
    { text: "Pianifica il tuo trade, quindi trada il tuo piano.", author: "Mark Douglas" },
  ];

  const [current, setCurrent] = useState(0);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardContent className="flex flex-col items-center justify-center py-8 sm:py-14 px-4 space-y-6 sm:space-y-8">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">Frasi Motivazionali</h3>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center space-y-3 sm:space-y-4"
          >
            <p className="text-base sm:text-xl font-semibold text-foreground italic max-w-md leading-relaxed">
              &ldquo;{quotes[current].text}&rdquo;
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">&mdash; {quotes[current].author}</p>
          </motion.div>
        </AnimatePresence>

        <Button variant="outline" onClick={() => setCurrent((current + 1) % quotes.length)} size="sm">
          Prossima
        </Button>

        <p className="text-[10px] sm:text-xs text-muted-foreground/60">
          {current + 1} / {quotes.length}
        </p>
      </CardContent>
    </Card>
  );
}

function Gratitude() {
  const [gratitudes, setGratitudes] = useState<string[]>([]);
  const [input, setInput] = useState("");

  const addGratitude = () => {
    if (input.trim()) {
      setGratitudes([...gratitudes, input.trim()]);
      setInput("");
    }
  };

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardContent className="space-y-4 py-6 sm:py-8 px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">Gratitudine</h3>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground">
          Elenca 3 cose per cui sei grato oggi:
        </p>

        <div className="flex gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGratitude()}
            placeholder="Es. La disciplina..."
            className="flex-1 text-sm"
          />
          <Button onClick={addGratitude} size="sm" className="px-3">
            +
          </Button>
        </div>

        {gratitudes.length > 0 && (
          <div className="space-y-2">
            {gratitudes.map((g, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-sm flex items-start gap-2.5"
              >
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-foreground">{g}</p>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MeditationTimer() {
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(300);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s === 0) {
          setMinutes(m => {
            if (m === 0) {
              setIsRunning(false);
              return 0;
            }
            return m - 1;
          });
          return 59;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStart = (mins: number) => {
    setMinutes(mins);
    setSeconds(0);
    setIsRunning(true);
    setTotalSeconds(mins * 60);
  };

  const remaining = minutes * 60 + seconds;
  const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;
  const circumference = 2 * Math.PI * 46;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 space-y-6 sm:space-y-8">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">Meditazione</h3>
        </div>

        <div className="relative w-36 h-36 sm:w-48 sm:h-48">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" strokeWidth="3" className="stroke-muted-foreground/15" />
            <circle
              cx="50" cy="50" r="46"
              fill="none"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="stroke-primary"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-3xl sm:text-4xl font-bold text-foreground font-mono">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
          </div>
        </div>

        {!isRunning ? (
          <div className="flex gap-2">
            {[3, 5, 10].map((mins) => (
              <Button
                key={mins}
                onClick={() => handleStart(mins)}
                variant="outline"
                size="sm"
                className="min-w-[56px]"
              >
                {mins} min
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => setIsRunning(false)} className="gap-2">
              <Pause className="w-4 h-4" /> Pausa
            </Button>
            <Button
              variant="outline"
              onClick={() => { setIsRunning(false); setMinutes(5); setSeconds(0); }}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </Button>
          </div>
        )}

        <p className="text-[10px] sm:text-xs text-muted-foreground/60 text-center max-w-xs">
          Trova un posto tranquillo, chiudi gli occhi e concentrati sul respiro.
        </p>
      </CardContent>
    </Card>
  );
}

export default function Zen() {
  return (
    <PageLayout>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs defaultValue="breathing" className="w-full">
          <TabsList className="flex w-full h-auto gap-1 bg-card/50 backdrop-blur-md p-1.5 rounded-xl border border-border/40 mb-4">
            <TabsTrigger value="breathing" className="flex-1 text-xs py-2">Respira</TabsTrigger>
            <TabsTrigger value="visualization" className="flex-1 text-xs py-2">Visualizza</TabsTrigger>
            <TabsTrigger value="quotes" className="flex-1 text-xs py-2">Frasi</TabsTrigger>
            <TabsTrigger value="gratitude" className="flex-1 text-xs py-2">Gratitudine</TabsTrigger>
            <TabsTrigger value="meditation" className="flex-1 text-xs py-2">Meditazione</TabsTrigger>
          </TabsList>

          <TabsContent value="breathing" className="mt-0">
            <BreathingExercise />
          </TabsContent>
          <TabsContent value="visualization" className="mt-0">
            <ResultVisualization />
          </TabsContent>
          <TabsContent value="quotes" className="mt-0">
            <MotivationalQuotes />
          </TabsContent>
          <TabsContent value="gratitude" className="mt-0">
            <Gratitude />
          </TabsContent>
          <TabsContent value="meditation" className="mt-0">
            <MeditationTimer />
          </TabsContent>
        </Tabs>
      </motion.section>
    </PageLayout>
  );
}
