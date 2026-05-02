import { motion } from "framer-motion";
import { Link } from "wouter";
import { Settings, Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";
import { MacroNewsTicker } from "@/components/MacroNewsTicker";

export function TopNav() {
  const { mode, setMode } = useAudio();
  const isPlaying = mode !== "off";

  return (
    <motion.header
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.0 }}
      className="fixed top-0 left-0 right-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/30 lg:left-48"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 h-14 sm:h-14">
        {/* Brand name — visible on mobile/tablet only (desktop uses sidebar) */}
        <motion.h1
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18, duration: 0.35 }}
          className="text-sm font-bold font-mono tracking-widest whitespace-nowrap bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent lg:hidden shrink-0"
        >
          TRADER<span className="text-primary">LOADING</span>
        </motion.h1>

        {/* Ticker — fills remaining space */}
        <motion.div
          className="flex-1 min-w-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <MacroNewsTicker />
        </motion.div>

        {/* Audio toggle */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.22, type: "spring", stiffness: 400, damping: 20 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setMode(isPlaying ? "off" : "deepfocus")}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all shrink-0 ${
            isPlaying
              ? "bg-primary/20 text-primary border border-primary/40"
              : "bg-card/50 text-muted-foreground border border-border hover:border-primary/30"
          }`}
          title={isPlaying ? `${mode === "alpha" ? "Rilassamento" : "Focus"} attivo` : "Audio off"}
        >
          {isPlaying ? (
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
        </motion.button>

        {/* Settings link */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.26, type: "spring", stiffness: 400, damping: 20 }}
          whileTap={{ scale: 0.9 }}
        >
          <Link
            href="/settings"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-card/50 text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground transition-all shrink-0"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </motion.header>
  );
}
