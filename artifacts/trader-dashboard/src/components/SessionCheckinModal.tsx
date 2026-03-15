import { useState, useEffect, useMemo, useRef } from "react";
import { useBackground, type TradingSessionConfig } from "@/contexts/BackgroundContext";
import { useGetIdeas, useGetUserSettings, useCreateCheckin, useGetTodayCheckin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Target, X } from "lucide-react";

const MOODS = [
  { emoji: "😤", label: "Agitato" },
  { emoji: "😐", label: "Neutro" },
  { emoji: "😊", label: "Positivo" },
  { emoji: "😄", label: "Eccellente" },
  { emoji: "🧘", label: "Zen" },
];

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

export function SessionCheckinModal() {
  const { tradingSessions } = useBackground();
  const { data: settings } = useGetUserSettings();
  const { data: ideas } = useGetIdeas();
  const { data: todayCheckin } = useGetTodayCheckin();
  const createCheckin = useCreateCheckin();
  const { toast } = useToast();

  const [time, setTime] = useState(new Date());
  const prevSessionRef = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [currentSession, setCurrentSession] = useState<string>("");
  const [mood, setMood] = useState<string>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 5000);
    return () => clearInterval(t);
  }, []);

  const activeSession = useMemo(() => {
    const utcHours = time.getUTCHours() + time.getUTCMinutes() / 60;
    return tradingSessions.filter((s) => s.enabled).find((s) => isInSession(utcHours, s)) || null;
  }, [time, tradingSessions]);

  useEffect(() => {
    const sessionName = activeSession?.name || null;
    if (sessionName && sessionName !== prevSessionRef.current && todayCheckin === null) {
      setCurrentSession(sessionName);
      setVisible(true);
    }
    prevSessionRef.current = sessionName;
  }, [activeSession, todayCheckin]);

  const goals = ideas?.filter((i) => i.type === "goal" && !i.completed) ?? [];

  const handleSubmit = async () => {
    if (!mood) return;
    try {
      await createCheckin.mutateAsync({
        data: { mood, sessionName: currentSession, note: note || undefined },
      });
      setVisible(false);
      toast({ description: "Check-in registrato. Buon trading!" });
    } catch {
      toast({ description: "Errore nel check-in.", variant: "destructive" });
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={() => setVisible(false)}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-xl font-bold">Check-in sessione</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sessione <span className="text-primary font-medium">{currentSession}</span> iniziata — come stai?
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Il tuo stato d'animo</p>
          <div className="flex gap-2 flex-wrap">
            {MOODS.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={() => setMood(emoji)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-sm transition-all ${
                  mood === emoji
                    ? "border-primary bg-primary/10 scale-105"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {goals.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Target className="w-4 h-4 text-primary" />
              Obiettivi di oggi
            </p>
            <ul className="space-y-1">
              {goals.slice(0, 3).map((g) => (
                <li key={g.id} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span className="line-clamp-1">{g.content}</span>
                </li>
              ))}
              {goals.length > 3 && (
                <li className="text-xs text-muted-foreground/60">+{goals.length - 3} altri obiettivi</li>
              )}
            </ul>
          </div>
        )}

        {settings?.maxDailyLoss && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
            <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">
              Max loss giornaliero: €{settings.maxDailyLoss}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nota veloce (facoltativa)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Come ti senti? Cosa vuoi ricordare?"
            className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={!mood || createCheckin.isPending} className="flex-1">
            Inizia sessione
          </Button>
          <Button variant="ghost" onClick={() => setVisible(false)}>
            Salta
          </Button>
        </div>
      </div>
    </div>
  );
}
