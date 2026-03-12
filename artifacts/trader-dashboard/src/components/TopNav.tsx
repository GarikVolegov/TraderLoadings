import { Link, useRoute } from "wouter";
import { motion } from "framer-motion";
import { LayoutDashboard, BookOpen } from "lucide-react";

export function TopNav() {
  const [isDash] = useRoute("/");
  const [isJournal] = useRoute("/journal");

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
          Trader<span className="text-primary">Dash</span>
        </h1>
      </div>

      <nav className="flex items-center gap-2 bg-card/50 backdrop-blur-md p-1.5 rounded-xl border border-border">
        <Link 
          href="/" 
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            isDash 
              ? 'bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]' 
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Link>
        <Link 
          href="/journal" 
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            isJournal 
              ? 'bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]' 
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Diario
        </Link>
      </nav>
    </motion.header>
  );
}
