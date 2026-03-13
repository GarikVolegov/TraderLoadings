import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2 } from "lucide-react";

type FrequencyMode = "relax" | "focus" | "off";

export function AudioPlayer() {
  const [mode, setMode] = useState<FrequencyMode>("off");
  const [volume, setVolume] = useState(50);
  const oscillatorsRef = useRef<OscillatorNode[] | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (oscillatorsRef.current && audioCtxRef.current) {
        oscillatorsRef.current.forEach(osc => {
          try { osc.stop(); } catch (e) {}
        });
        oscillatorsRef.current = null;
      }
    };
  }, []);

  const startFrequencies = (baseFreq: number, beatFreq: number) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioCtxRef.current;
    
    if (oscillatorsRef.current) {
      oscillatorsRef.current.forEach(osc => osc.stop());
    }

    if (!gainRef.current) {
      gainRef.current = ctx.createGain();
      gainRef.current.connect(ctx.destination);
    }

    gainRef.current.gain.value = volume / 100 * 0.1;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    
    osc1.frequency.value = baseFreq;
    osc2.frequency.value = baseFreq + beatFreq;
    
    osc1.connect(gainRef.current);
    osc2.connect(gainRef.current);
    
    osc1.start();
    osc2.start();
    
    oscillatorsRef.current = [osc1, osc2];
  };

  const stopFrequencies = () => {
    if (oscillatorsRef.current && audioCtxRef.current) {
      oscillatorsRef.current.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      oscillatorsRef.current = null;
    }
  };

  const handleModeChange = (newMode: FrequencyMode) => {
    if (newMode === "off") {
      stopFrequencies();
      setMode("off");
    } else if (newMode === "relax") {
      stopFrequencies();
      startFrequencies(200, 8);
      setMode("relax");
    } else if (newMode === "focus") {
      stopFrequencies();
      startFrequencies(220, 40);
      setMode("focus");
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (gainRef.current) {
      gainRef.current.gain.value = newVolume / 100 * 0.1;
    }
  };

  return (
    <Card className="p-6 border-primary/20 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <Volume2 className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold text-foreground">Audio di Sottofondo</h3>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ascolta frequenze binaural per aiutare la concentrazione e il relax durante le tue sessioni di trading.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleModeChange("relax")}
            className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              mode === "relax"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-card border border-border hover:border-primary/50 text-foreground"
            }`}
          >
            {mode === "relax" && <Pause className="w-4 h-4" />}
            {mode !== "relax" && <Play className="w-4 h-4" />}
            Rilassamento (8 Hz)
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleModeChange("focus")}
            className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              mode === "focus"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-card border border-border hover:border-primary/50 text-foreground"
            }`}
          >
            {mode === "focus" && <Pause className="w-4 h-4" />}
            {mode !== "focus" && <Play className="w-4 h-4" />}
            Concentrazione (40 Hz)
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleModeChange("off")}
            className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              mode === "off"
                ? "bg-destructive text-destructive-foreground shadow-lg"
                : "bg-card border border-border hover:border-destructive/50 text-foreground"
            }`}
          >
            Spegni
          </motion.button>
        </div>

        <div className="bg-card/50 p-4 rounded-lg border border-border">
          <label className="text-sm font-medium text-foreground block mb-2">
            Volume: {volume}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          💡 Le frequenze binaural vengono create in tempo reale usando l'Web Audio API. Utilizza le cuffie per il miglior effetto.
        </p>
      </div>
    </Card>
  );
}
