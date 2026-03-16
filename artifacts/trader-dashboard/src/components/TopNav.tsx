import { Link } from "wouter";
import { motion } from "framer-motion";
import { Settings, Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";
import { MacroNewsTicker } from "@/components/MacroNewsTicker";

export function TopNav() {
  const { mode, setMode } = useAudio();
  const isPlaying = mode !== "off";

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 h-10"
    >
      <MacroNewsTicker />

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
