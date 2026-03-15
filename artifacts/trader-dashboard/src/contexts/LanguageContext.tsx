import { createContext, useContext, useState, type ReactNode } from "react";

export type Language = "it" | "en" | "es" | "fr" | "de";

export const LANGUAGES: Record<Language, { name: string; flag: string; label: string }> = {
  it: { name: "Italiano", flag: "🇮🇹", label: "IT" },
  en: { name: "English", flag: "🇬🇧", label: "EN" },
  es: { name: "Español", flag: "🇪🇸", label: "ES" },
  fr: { name: "Français", flag: "🇫🇷", label: "FR" },
  de: { name: "Deutsch", flag: "🇩🇪", label: "DE" },
};

const STORAGE_KEY = "tl_language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

type Translations = Record<string, string>;

const DICT: Record<Language, Translations> = {
  it: {
    "nav.home": "Home",
    "nav.journal": "Diario",
    "nav.settings": "Impostazioni",
    "nav.checklist": "Checklist",
    "nav.backtest": "Backtest",
    "nav.chat": "Chat",
    "settings.title": "Impostazioni",
    "settings.profile": "Profilo",
    "settings.audio": "Audio",
    "settings.appearance": "Aspetto",
    "settings.notifications": "Notifiche",
    "settings.security": "Sicurezza",
    "settings.language": "Lingua",
    "settings.trading": "Trading",
    "settings.missions": "Missioni",
    "settings.quotes": "Citazioni",
    "settings.account": "Account",
    "streak.days": "giorni",
    "level.prefix": "Livello",
  },
  en: {
    "nav.home": "Home",
    "nav.journal": "Journal",
    "nav.settings": "Settings",
    "nav.checklist": "Checklist",
    "nav.backtest": "Backtest",
    "nav.chat": "Chat",
    "settings.title": "Settings",
    "settings.profile": "Profile",
    "settings.audio": "Audio",
    "settings.appearance": "Appearance",
    "settings.notifications": "Notifications",
    "settings.security": "Security",
    "settings.language": "Language",
    "settings.trading": "Trading",
    "settings.missions": "Missions",
    "settings.quotes": "Quotes",
    "settings.account": "Account",
    "streak.days": "days",
    "level.prefix": "Level",
  },
  es: {
    "nav.home": "Inicio",
    "nav.journal": "Diario",
    "nav.settings": "Ajustes",
    "nav.checklist": "Checklist",
    "nav.backtest": "Backtest",
    "nav.chat": "Chat",
    "settings.title": "Ajustes",
    "settings.profile": "Perfil",
    "settings.audio": "Audio",
    "settings.appearance": "Apariencia",
    "settings.notifications": "Notificaciones",
    "settings.security": "Seguridad",
    "settings.language": "Idioma",
    "settings.trading": "Trading",
    "settings.missions": "Misiones",
    "settings.quotes": "Citas",
    "settings.account": "Cuenta",
    "streak.days": "días",
    "level.prefix": "Nivel",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.journal": "Journal",
    "nav.settings": "Paramètres",
    "nav.checklist": "Checklist",
    "nav.backtest": "Backtest",
    "nav.chat": "Chat",
    "settings.title": "Paramètres",
    "settings.profile": "Profil",
    "settings.audio": "Audio",
    "settings.appearance": "Apparence",
    "settings.notifications": "Notifications",
    "settings.security": "Sécurité",
    "settings.language": "Langue",
    "settings.trading": "Trading",
    "settings.missions": "Missions",
    "settings.quotes": "Citations",
    "settings.account": "Compte",
    "streak.days": "jours",
    "level.prefix": "Niveau",
  },
  de: {
    "nav.home": "Start",
    "nav.journal": "Tagebuch",
    "nav.settings": "Einstellungen",
    "nav.checklist": "Checkliste",
    "nav.backtest": "Backtest",
    "nav.chat": "Chat",
    "settings.title": "Einstellungen",
    "settings.profile": "Profil",
    "settings.audio": "Audio",
    "settings.appearance": "Aussehen",
    "settings.notifications": "Benachrichtigungen",
    "settings.security": "Sicherheit",
    "settings.language": "Sprache",
    "settings.trading": "Trading",
    "settings.missions": "Missionen",
    "settings.quotes": "Zitate",
    "settings.account": "Konto",
    "streak.days": "Tage",
    "level.prefix": "Ebene",
  },
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    return stored && stored in LANGUAGES ? stored : "it";
  });

  const setLanguage = (lang: Language) => {
    localStorage.setItem(STORAGE_KEY, lang);
    setLangState(lang);
  };

  const t = (key: string): string => {
    return DICT[language][key] ?? DICT["it"][key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be inside LanguageProvider");
  return ctx;
}
