import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useGetUserSettings } from "@workspace/api-client-react";

const FONT_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  jetbrains: "'JetBrains Mono', monospace",
  roboto: "'Roboto', sans-serif",
  "space-grotesk": "'Space Grotesk', monospace",
  "ibm-plex": "'IBM Plex Sans', sans-serif",
};

interface BackgroundContextValue {
  backgroundUrl: string | null;
  setBackgroundUrl: (url: string | null) => void;
  darkness: number;
  setDarkness: (d: number) => void;
  fontChoice: string;
  setFontChoice: (f: string) => void;
}

const BackgroundCtx = createContext<BackgroundContextValue>({
  backgroundUrl: null,
  setBackgroundUrl: () => {},
  darkness: 60,
  setDarkness: () => {},
  fontChoice: "inter",
  setFontChoice: () => {},
});

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [darkness, setDarkness] = useState(60);
  const [fontChoice, setFontChoice] = useState("inter");
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
  }, [settings]);

  useEffect(() => {
    const family = FONT_MAP[fontChoice] || FONT_MAP.inter;
    document.documentElement.style.setProperty("--font-sans", family);
    document.body.style.fontFamily = family;
  }, [fontChoice]);

  return (
    <BackgroundCtx.Provider value={{ backgroundUrl, setBackgroundUrl, darkness, setDarkness, fontChoice, setFontChoice }}>
      {children}
    </BackgroundCtx.Provider>
  );
}

export function useBackground() {
  return useContext(BackgroundCtx);
}
