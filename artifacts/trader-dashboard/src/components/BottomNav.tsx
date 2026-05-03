import { Link, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, BookOpen, MessageCircle, Wrench, Brain, Trophy } from "lucide-react";
import { useGetUnreadCount } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

const NAV_ITEMS = [
  { href: "/",           icon: LayoutDashboard, labelKey: "nav.home",       isChat: false },
  { href: "/journal",    icon: BookOpen,         labelKey: "nav.journal",    isChat: false },
  { href: "/tools",      icon: Wrench,           labelKey: "nav.tools",      isChat: false },
  { href: "/zen",        icon: Brain,            labelKey: "nav.zen",        isChat: false },
  { href: "/milestones", icon: Trophy,           labelKey: "nav.milestones", isChat: false },
  { href: "/chat",       icon: MessageCircle,    labelKey: "nav.chat",       isChat: true  },
] as const;

function NavItem({
  href,
  icon: Icon,
  label,
  badge,
  vertical,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
  vertical?: boolean;
}) {
  const [isActive] = useRoute(href);

  if (vertical) {
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors relative overflow-hidden ${
          isActive
            ? "bg-primary/10 text-primary border border-primary/30"
            : "text-muted-foreground hover:bg-card/80 hover:text-foreground border border-transparent"
        }`}
      >
        {/* Animated left accent bar */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              layoutId="nav-indicator-desktop"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </AnimatePresence>

        {/* Active bg glow */}
        {isActive && (
          <motion.div
            layoutId="nav-bg-desktop"
            className="absolute inset-0 bg-primary/5 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}

        <div className="relative z-10">
          <motion.div
            animate={{
              scale: isActive ? 1.12 : 1,
              rotate: isActive ? 0 : 0,
            }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <Icon className="w-5 h-5" />
          </motion.div>
          {badge != null && badge > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-0.5"
            >
              {badge > 99 ? "99+" : badge}
            </motion.span>
          )}
        </div>
        <span className="text-sm font-medium relative z-10">{label}</span>
      </Link>
    );
  }

  /* ── Mobile tab bar item ── */
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 sm:py-3 relative"
    >
      {/* Top active indicator — shared layout */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="nav-indicator-mobile"
            className="absolute top-0 left-1/2 -translate-x-1/2 w-8 sm:w-10 h-0.5 bg-primary rounded-full"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </AnimatePresence>

      <div className="relative">
        <motion.div
          animate={{
            scale: isActive ? 1.15 : 1,
            y: isActive ? -1 : 0,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <Icon
            className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors duration-200 ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          />
        </motion.div>
        {badge != null && badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-0.5"
          >
            {badge > 99 ? "99+" : badge}
          </motion.span>
        )}
      </div>

      <motion.span
        animate={{ opacity: isActive ? 1 : 0.6 }}
        transition={{ duration: 0.2 }}
        className={`text-[10px] sm:text-[11px] font-medium transition-colors duration-200 ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </motion.span>
    </Link>
  );
}

export function BottomNav() {
  const { t } = useLanguage();
  const { data: unreadData } = useGetUnreadCount({ query: { refetchInterval: 5000 } });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <>
      {/* Mobile / tablet bottom tab bar */}
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border/50 lg:hidden"
      >
        <div className="flex items-center max-w-lg mx-auto px-1">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={t(item.labelKey)}
              badge={item.isChat ? unreadCount : undefined}
            />
          ))}
        </div>
        {/* iOS safe area */}
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </motion.nav>

      {/* Desktop sidebar */}
      <motion.nav
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.05 }}
        className="hidden lg:flex fixed left-0 top-0 bottom-0 z-50 w-48 bg-card/90 backdrop-blur-xl border-r border-border/50 flex-col"
      >
        <div className="px-5 py-5 border-b border-border/30">
          <motion.h1
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-sm font-bold font-mono tracking-widest bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent"
          >
            TRADER<span className="text-primary">LOADING</span>
          </motion.h1>
        </div>
        <div className="flex-1 flex flex-col gap-1 px-3 py-4">
          {NAV_ITEMS.map((item, i) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 400, damping: 28 }}
            >
              <NavItem
                href={item.href}
                icon={item.icon}
                label={t(item.labelKey)}
                badge={item.isChat ? unreadCount : undefined}
                vertical
              />
            </motion.div>
          ))}
        </div>
      </motion.nav>
    </>
  );
}
