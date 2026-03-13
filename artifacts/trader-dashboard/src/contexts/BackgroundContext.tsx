import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useGetUserSettings, type TradingSessionConfig } from "@workspace/api-client-react";

export type { TradingSessionConfig };

const FONT_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  jetbrains: "'JetBrains Mono', monospace",
  roboto: "'Roboto', sans-serif",
  "space-grotesk": "'Space Grotesk', monospace",
  "ibm-plex": "'IBM Plex Sans', sans-serif",
};

export const DEFAULT_TRADING_SESSIONS: TradingSessionConfig[] = [
  { id: "asian", name: "Asiatica", openUTC: "00:00", closeUTC: "08:00", color: "session-asian", enabled: true },
  { id: "london", name: "Londinese", openUTC: "08:00", closeUTC: "13:30", color: "session-london", enabled: true },
  { id: "ny", name: "New York", openUTC: "13:30", closeUTC: "20:00", color: "session-ny", enabled: true },
  { id: "volume", name: "Conferma Vol.", openUTC: "20:00", closeUTC: "00:00", color: "session-volume", enabled: true },
];

export const DEFAULT_LOT_DIVISOR = 11;

interface BackgroundContextValue {
  backgroundUrl: string | null;
  setBackgroundUrl: (url: string | null) => void;
  darkness: number;
  setDarkness: (d: number) => void;
  fontChoice: string;
  setFontChoice: (f: string) => void;
  tradingSessions: TradingSessionConfig[];
  setTradingSessions: (s: TradingSessionConfig[]) => void;
  lotDivisor: number;
  setLotDivisor: (d: number) => void;
}

const BackgroundCtx = createContext<BackgroundContextValue>({
  backgroundUrl: null,
  setBackgroundUrl: () => {},
  darkness: 60,
  setDarkness: () => {},
  fontChoice: "inter",
  setFontChoice: () => {},
  tradingSessions: DEFAULT_TRADING_SESSIONS,
  setTradingSessions: () => {},
  lotDivisor: DEFAULT_LOT_DIVISOR,
  setLotDivisor: () => {},
});

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [darkness, setDarkness] = useState(60);
  const [fontChoice, setFontChoice] = useState("inter");
  const [tradingSessions, setTradingSessions] = useState<TradingSessionConfig[]>(DEFAULT_TRADING_SESSIONS);
  const [lotDivisor, setLotDivisor] = useState(DEFAULT_LOT_DIVISOR);
  const { data: settings } = useGetUserSettings();

  useEffect(() => {
    if (settings?.backgroundType === "custom" && settings.backgroundUrl) {
      setBackgroundUrl(settings.backgroundUrl);
    } else {
      setBackgroundUrl(null);
    }
    if (settings?.backgroundDarkness !== undefined) {
      setDarkness(settings.backgroundDarkness as number);
    }
    if (settings?.fontChoice) {
      setFontChoice(settings.fontChoice as string);
    }
    if (settings?.tradingSessions && Array.isArray(settings.tradingSessions)) {
      setTradingSessions(settings.tradingSessions);
    }
    if (settings?.lotDivisor !== undefined) {
      setLotDivisor(settings.lotDivisor);
    }
  }, [settings]);

  useEffect(() => {
    const family = FONT_MAP[fontChoice] || FONT_MAP.inter;
    document.documentElement.style.setProperty("--font-sans", family);
    document.body.style.fontFamily = family;
  }, [fontChoice]);

  return (
    <BackgroundCtx.Provider value={{ backgroundUrl, setBackgroundUrl, darkness, setDarkness, fontChoice, setFontChoice, tradingSessions, setTradingSessions, lotDivisor, setLotDivisor }}>
      {children}
    </BackgroundCtx.Provider>
  );
}

export function useBackground() {
  return useContext(BackgroundCtx);
}
