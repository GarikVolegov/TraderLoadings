import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Volume2, Pause, Play } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";

export function AudioPlayer() {
  const { mode, volume, setMode, setVolume } = useAudio();

  return (
    <Card className="p-5 border-primary/20 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-5">
        <Volume2 className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Audio Binaural</h3>
        {mode !== "off" && (
          <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30 animate-pulse">
            {mode === "relax" ? "Rilassamento" : "Focus"} attivo
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { id: "relax" as const, label: "Rilassamento", sub: "8 Hz" },
          { id: "focus" as const, label: "Focus", sub: "40 Hz" },
          { id: "off" as const, label: "Stop", sub: "" },
        ].map(btn => (
          <motion.button
            key={btn.id}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setMode(btn.id)}
            className={`px-3 py-2.5 rounded-lg font-medium text-sm transition-all flex flex-col items-center gap-0.5 ${
              mode === btn.id
                ? btn.id === "off"
                  ? "bg-destructive/20 text-destructive border border-destructive/40"
                  : "bg-primary/20 text-primary border border-primary/40"
                : "bg-card border border-border hover:border-primary/30 text-foreground"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {mode === btn.id && btn.id !== "off"
                ? <Pause className="w-3.5 h-3.5" />
                : btn.id !== "off"
                ? <Play className="w-3.5 h-3.5" />
                : null}
              {btn.label}
            </div>
            {btn.sub && <span className="text-xs opacity-60">{btn.sub}</span>}
          </motion.button>
        ))}
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Volume</span>
          <span>{volume}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>
    </Card>
  );
}
