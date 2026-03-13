import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from "react";

type FrequencyMode = "relax" | "focus" | "off";

interface AudioContextValue {
  mode: FrequencyMode;
  volume: number;
  setVolume: (v: number) => void;
  setMode: (m: FrequencyMode) => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<FrequencyMode>("off");
  const [volume, setVolumeState] = useState(50);
  const oscillatorsRef = useRef<OscillatorNode[] | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopFrequencies = useCallback(() => {
    if (oscillatorsRef.current) {
      oscillatorsRef.current.forEach(osc => { try { osc.stop(); } catch (_) {} });
      oscillatorsRef.current = null;
    }
  }, []);

  const startFrequencies = useCallback((baseFreq: number, beatFreq: number, vol: number) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    stopFrequencies();

    if (!gainRef.current) {
      gainRef.current = ctx.createGain();
      gainRef.current.connect(ctx.destination);
    }
    gainRef.current.gain.value = (vol / 100) * 0.1;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.frequency.value = baseFreq;
    osc2.frequency.value = baseFreq + beatFreq;
    osc1.connect(gainRef.current);
    osc2.connect(gainRef.current);
    osc1.start();
    osc2.start();
    oscillatorsRef.current = [osc1, osc2];
  }, [stopFrequencies]);

  const setMode = useCallback((newMode: FrequencyMode) => {
    if (newMode === "off") {
      stopFrequencies();
    } else if (newMode === "relax") {
      startFrequencies(200, 8, volume);
    } else if (newMode === "focus") {
      startFrequencies(220, 40, volume);
    }
    setModeState(newMode);
  }, [volume, stopFrequencies, startFrequencies]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (gainRef.current) {
      gainRef.current.gain.value = (v / 100) * 0.1;
    }
  }, []);

  return (
    <AudioCtx.Provider value={{ mode, volume, setVolume, setMode }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
