import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wind, Eye, BookOpen, Heart, Clock, Play, Pause, RotateCcw } from "lucide-react";

// Breathing Exercises
function BreathingExercise() {
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale" | "rest">("inhale");
  const [isActive, setIsActive] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const timings = { inhale: 4000, hold: 4000, exhale: 4000, rest: 2000 };
    const timer = setTimeout(() => {
      const phases: Array<"inhale" | "hold" | "exhale" | "rest"> = ["inhale", "hold", "exhale", "rest"];
      const nextIndex = (phases.indexOf(phase) + 1) % phases.length;
      setPhase(phases[nextIndex]);
      if (nextIndex === 0) setCount(c => c + 1);
    }, timings[phase]);
    return () => clearTimeout(timer);
  }, [isActive, phase]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wind className="w-5 h-5 text-primary" />
          Respirazione Consapevole
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 md:gap-8 py-6 md:py-12">
        <motion.div
          animate={{
            scale: phase === "inhale" ? 1.3 : phase === "exhale" ? 0.7 : 1,
          }}
          transition={{ duration: phase === "hold" || phase === "rest" ? 0 : 3.5 }}
          className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center"
        >
          <span className="text-lg md:text-2xl font-bold text-white capitalize">{phase}</span>
        </motion.div>

        <div className="text-center">
          <p className="text-xs md:text-sm text-muted-foreground">Cicli completati: {count}</p>
        </div>

        <div className="flex gap-2 md:gap-3 flex-wrap justify-center">
          <Button
            onClick={() => setIsActive(!isActive)}
            className="gap-2"
          >
            {isActive ? (
              <>
                <Pause className="w-4 h-4" />
                Pausa
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Inizia
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setIsActive(false);
              setPhase("inhale");
              setCount(0);
            }}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>

        <p className="text-[10px] md:text-xs text-muted-foreground text-center max-w-xs">
          Respira seguendo il cerchio: inspira (4s), trattieni (4s), espira (4s), riposa (2s)
        </p>
      </CardContent>
    </Card>
  );
}

// Result Visualization
function ResultVisualization() {
  const [goal, setGoal] = useState("");

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          Visualizzazione del Risultato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-6">
        <div>
          <label className="text-xs md:text-sm font-medium text-muted-foreground block mb-1 md:mb-2">
            Visualizza il tuo obiettivo di trading:
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Es. Voglio completare 3 trade vincenti con disciplina, gestire il rischio perfettamente..."
            className="w-full h-20 md:h-32 p-2 md:p-3 rounded-lg border border-border bg-secondary/30 text-xs md:text-sm resize-none focus:outline-none focus:border-primary"
          />
        </div>

        {goal && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 md:p-6 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 space-y-2 md:space-y-4"
          >
            <p className="text-xs md:text-sm text-muted-foreground">
              Chiudi gli occhi, respira profondamente e visualizza chiaramente:
            </p>
            <motion.p
              className="text-sm md:text-lg font-semibold text-foreground italic"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {goal}
            </motion.p>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Mantieni questa immagine per 1-2 minuti. Senti le emozioni di successo.
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

// Motivational Quotes
function MotivationalQuotes() {
  const quotes = [
    { text: "La disciplina è scegliere tra ciò che vuoi adesso e ciò che vuoi di più.", author: "Abraham Lincoln" },
    { text: "Il trading non è una maratona, è una serie di sprint disciplinati.", author: "Saggezza del mercato" },
    { text: "La paura e l'avidità sono i nemici del trader consapevole.", author: "Saggio del trading" },
    { text: "Ogni perdita è una lezione, non una sconfitta.", author: "Mentalità vincente" },
    { text: "Il successo arriva a chi controlla le emozioni, non a chi segue le emozioni.", author: "Psicologia del trading" },
    { text: "Piano il tuo trade, quindi trada il tuo piano.", author: "Mark Douglas" },
  ];

  const [current, setCurrent] = useState(0);

  const nextQuote = () => {
    setCurrent((current + 1) % quotes.length);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Frasi Motivazionali
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-6 md:py-12 space-y-4 md:space-y-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center space-y-2 md:space-y-4"
          >
            <p className="text-base md:text-xl font-semibold text-foreground italic max-w-md">
              "{quotes[current].text}"
            </p>
            <p className="text-xs md:text-sm text-muted-foreground">— {quotes[current].author}</p>
          </motion.div>
        </AnimatePresence>

        <Button variant="outline" onClick={nextQuote} size="sm">
          Prossima
        </Button>

        <p className="text-[10px] md:text-xs text-muted-foreground">
          {current + 1} / {quotes.length}
        </p>
      </CardContent>
    </Card>
  );
}

// Gratitude
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          Gratitudine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 md:space-y-4">
        <p className="text-xs md:text-sm text-muted-foreground">
          Elenca 3 cose per cui sei grato oggi:
        </p>

        <div className="flex gap-1 md:gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGratitude()}
            placeholder="Es. La disciplina..."
            className="flex-1 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-border bg-secondary/30 text-xs md:text-sm focus:outline-none focus:border-primary"
          />
          <Button onClick={addGratitude} size="sm" className="w-8 h-8 p-0">
            +
          </Button>
        </div>

        {gratitudes.length > 0 && (
          <div className="space-y-1 md:space-y-2">
            {gratitudes.map((g, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-2 md:p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs md:text-sm flex items-start gap-2"
              >
                <span className="text-primary text-lg">✓</span>
                <p className="text-foreground">{g}</p>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Meditation Timer
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

  const progress = ((totalSeconds - (minutes * 60 + seconds)) / totalSeconds) * 100;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Meditazione
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-6 md:py-12 space-y-4 md:space-y-8">
        <div className="relative w-28 h-28 md:w-40 md:h-40">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground opacity-20" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
              strokeDasharray={`${(progress / 100) * 282.74} 282.74`}
              style={{ transition: "stroke-dasharray 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-bold text-foreground font-mono">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>

        {!isRunning && (
          <div className="grid grid-cols-3 gap-1 md:gap-2">
            {[3, 5, 10].map((mins) => (
              <Button
                key={mins}
                onClick={() => handleStart(mins)}
                variant="outline"
                size="sm"
                className="text-xs md:text-sm"
              >
                {mins}m
              </Button>
            ))}
          </div>
        )}

        {isRunning && (
          <Button
            onClick={() => setIsRunning(false)}
            className="gap-2"
            size="sm"
          >
            <Pause className="w-3 h-3 md:w-4 md:h-4" />
            <span className="hidden md:inline">Pausa</span>
          </Button>
        )}

        <p className="text-[10px] md:text-xs text-muted-foreground text-center max-w-xs">
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
          <TabsList className="flex w-full h-auto gap-1 bg-card/50 backdrop-blur-md p-1.5 rounded-xl border border-border mb-4">
            <TabsTrigger value="breathing" className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1">Respira</TabsTrigger>
            <TabsTrigger value="visualization" className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1">Visualizza</TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1">Frasi</TabsTrigger>
            <TabsTrigger value="gratitude" className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1">Gratitudine</TabsTrigger>
            <TabsTrigger value="meditation" className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1">Meditazione</TabsTrigger>
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
