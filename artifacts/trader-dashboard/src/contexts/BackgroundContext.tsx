import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { useGetUserSettings, type TradingSessionConfig } from "@workspace/api-client-react";
import { getCurrenciesFromPairs } from "@workspace/pair-catalog";

export type { TradingSessionConfig };

const FONT_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  jetbrains: "'JetBrains Mono', monospace",
  roboto: "'Roboto', sans-serif",
  "space-grotesk": "'Space Grotesk', monospace",
  "ibm-plex": "'IBM Plex Sans', sans-serif",
};

export const DEFAULT_TRADING_SESSIONS: TradingSessionConfig[] = [
  { id: "asian", name: "Asiatica", openUTC: "19:00", closeUTC: "03:00", color: "session-asian", enabled: true },
  { id: "london", name: "Londinese", openUTC: "03:00", closeUTC: "08:30", color: "session-london", enabled: true },
  { id: "ny", name: "New York", openUTC: "14:30", closeUTC: "21:00", color: "session-ny", enabled: true },
  { id: "volume", name: "Conferma Vol.", openUTC: "21:00", closeUTC: "23:00", color: "session-volume", enabled: true },
];

export const DEFAULT_LOT_DIVISOR = 11;

export interface BackgroundPreset {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
}

export const DEFAULT_BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "burj-khalifa", name: "Burj Khalifa", url: "/images/IMG_1796_1773606839183.jpeg", isDefault: true },
  { id: "gold-liquid", name: "Gold Liquid", url: "/images/IMG_1794_1773606839183.jpeg", isDefault: true },
  { id: "wall-street", name: "Wall Street", url: "/images/IMG_1795_1773606839183.jpeg", isDefault: true },
  { id: "nyc-rain", name: "NYC Rain", url: "/images/IMG_1804_1773606839183.jpeg", isDefault: true },
  { id: "forest", name: "Forest", url: "/images/IMG_1805_1773606839183.jpeg", isDefault: true },
];

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
  calendarCurrencies: string[];
  setCalendarCurrencies: (c: string[]) => void;
  calendarImpacts: string[];
  setCalendarImpacts: (i: string[]) => void;
  backgroundPresets: BackgroundPreset[];
  setBackgroundPresets: (p: BackgroundPreset[]) => void;
  selectedPairs: string[];
  setSelectedPairs: (p: string[]) => void;
  selectedCurrencies: string[];
  settingsLoaded: boolean;
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
  calendarCurrencies: ["USD"],
  setCalendarCurrencies: () => {},
  calendarImpacts: ["High"],
  setCalendarImpacts: () => {},
  backgroundPresets: DEFAULT_BACKGROUND_PRESETS,
  setBackgroundPresets: () => {},
  selectedPairs: [],
  setSelectedPairs: () => {},
  selectedCurrencies: [],
  settingsLoaded: false,
});

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [darkness, setDarkness] = useState(60);
  const [fontChoice, setFontChoice] = useState("inter");
  const [tradingSessions, setTradingSessions] = useState<TradingSessionConfig[]>(DEFAULT_TRADING_SESSIONS);
  const [lotDivisor, setLotDivisor] = useState(DEFAULT_LOT_DIVISOR);
  const [calendarCurrencies, setCalendarCurrencies] = useState<string[]>(["USD"]);
  const [calendarImpacts, setCalendarImpacts] = useState<string[]>(["High"]);
  const [backgroundPresets, setBackgroundPresets] = useState<BackgroundPreset[]>(DEFAULT_BACKGROUND_PRESETS);
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const { data: settings } = useGetUserSettings();

  const selectedCurrencies = useMemo(() => getCurrenciesFromPairs(selectedPairs), [selectedPairs]);

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
    if (settings?.calendarCurrencies && Array.isArray(settings.calendarCurrencies)) {
      setCalendarCurrencies(settings.calendarCurrencies);
    }
    if (settings?.calendarImpacts && Array.isArray(settings.calendarImpacts)) {
      setCalendarImpacts(settings.calendarImpacts);
    }
    if (settings?.backgroundPresets && Array.isArray(settings.backgroundPresets)) {
      setBackgroundPresets(settings.backgroundPresets);
    }
    if (settings?.selectedPairs && Array.isArray(settings.selectedPairs)) {
      setSelectedPairs(settings.selectedPairs as string[]);
    }
    if (settings) {
      setSettingsLoaded(true);
    }
  }, [settings]);

  useEffect(() => {
    const family = FONT_MAP[fontChoice] || FONT_MAP.inter;
    document.documentElement.style.setProperty("--font-sans", family);
    document.body.style.fontFamily = family;
  }, [fontChoice]);

  return (
    <BackgroundCtx.Provider value={{ backgroundUrl, setBackgroundUrl, darkness, setDarkness, fontChoice, setFontChoice, tradingSessions, setTradingSessions, lotDivisor, setLotDivisor, calendarCurrencies, setCalendarCurrencies, calendarImpacts, setCalendarImpacts, backgroundPresets, setBackgroundPresets, selectedPairs, setSelectedPairs, selectedCurrencies, settingsLoaded }}>
      {children}
    </BackgroundCtx.Provider>
  );
}

export function useBackground() {
  return useContext(BackgroundCtx);
}
