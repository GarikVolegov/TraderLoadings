import { Link } from "wouter";
import { motion } from "framer-motion";
import { Settings, Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";
import { useGetEconomicCalendar } from "@workspace/api-client-react";
import { useMemo } from "react";

export function TopNav() {
  const { mode, setMode } = useAudio();
  const isPlaying = mode !== "off";

  const { data: events } = useGetEconomicCalendar({});

  const tickerItems = useMemo(() => {
    if (!events || events.length === 0) return [];
    return events
      .filter((e) => e.impact === "High" || e.impact === "Medium")
      .slice(0, 10)
      .map((e) => {
        const flag = e.country === "USD" ? "🇺🇸" : e.country === "EUR" ? "🇪🇺" : e.country === "GBP" ? "🇬🇧" : e.country === "JPY" ? "🇯🇵" : "📊";
        return `${flag} ${e.country}: ${e.title}`;
      });
  }, [events]);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 h-10"
    >
      <div className="flex-1 min-w-0 overflow-hidden relative">
        {tickerItems.length > 0 ? (
          <div className="overflow-hidden whitespace-nowrap mask-fade">
            <div className="inline-flex animate-marquee gap-8">
              {tickerItems.map((item, i) => (
                <span key={i} className="text-xs text-muted-foreground font-medium">
                  {item}
                </span>
              ))}
              {tickerItems.map((item, i) => (
                <span key={`dup-${i}`} className="text-xs text-muted-foreground font-medium">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Caricamento news...</span>
        )}
      </div>

      <h1 className="text-sm font-bold font-mono tracking-widest whitespace-nowrap bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
        TRADER<span className="text-primary">LOADING</span>
      </h1>

      <button
        onClick={() => setMode(isPlaying ? "off" : "deepfocus")}
        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all shrink-0 ${
          isPlaying
            ? "bg-primary/20 text-primary border border-primary/40"
            : "bg-card/50 text-muted-foreground border border-border hover:border-primary/30"
        }`}
        title={isPlaying ? `${mode === "alpha" ? "Rilassamento" : "Focus"} attivo` : "Audio off"}
      >
        {isPlaying ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
      </button>

      <Link
        href="/settings"
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-card/50 text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground transition-all shrink-0"
      >
        <Settings className="w-4 h-4" />
      </Link>
    </motion.header>
  );
}
