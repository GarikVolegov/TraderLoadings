import { Link, useRoute } from "wouter";
import { motion } from "framer-motion";
import { LayoutDashboard, BookOpen, Settings, CheckSquare, Newspaper, Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";

export function TopNav() {
  const [isDash] = useRoute("/");
  const [isJournal] = useRoute("/journal");
  const [isChecklist] = useRoute("/checklist");
  const [isNews] = useRoute("/news");
  const [isSettings] = useRoute("/settings");
  const { mode, setMode } = useAudio();

  const isPlaying = mode !== "off";

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/20 rounded-xl border border-primary/50 flex items-center justify-center">
          <div className="w-4 h-4 bg-primary rounded-sm rotate-45 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
        </div>
        <h1 className="text-2xl font-bold font-mono tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          Trader<span className="text-primary">Loading</span>
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Audio indicator */}
        <button
          onClick={() => setMode(isPlaying ? "off" : "deepfocus")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            isPlaying
              ? "bg-primary/20 text-primary border border-primary/40"
              : "bg-card/50 text-muted-foreground border border-border hover:border-primary/30"
          }`}
          title={isPlaying ? `${mode === "alpha" ? "Rilassamento" : "Focus"} attivo` : "Audio off"}
        >
          {isPlaying ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
          {isPlaying ? (mode === "alpha" ? "Relax" : "Focus") : "Audio"}
        </button>

        <nav className="flex items-center gap-1 bg-card/50 backdrop-blur-md p-1.5 rounded-xl border border-border">
          <Link
            href="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isDash
                ? "bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <Link
            href="/journal"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isJournal
                ? "bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Diario</span>
          </Link>
          <Link
            href="/checklist"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isChecklist
                ? "bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Checklist</span>
          </Link>
          <Link
            href="/news"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isNews
                ? "bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <Newspaper className="w-4 h-4" />
            <span className="hidden sm:inline">News</span>
          </Link>
          <Link
            href="/settings"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isSettings
                ? "bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Impostazioni</span>
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}
