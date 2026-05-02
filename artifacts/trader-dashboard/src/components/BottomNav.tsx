import { Link, useRoute } from "wouter";
import { LayoutDashboard, BookOpen, MessageCircle, Wrench, Brain } from "lucide-react";
import { useGetUnreadCount } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

const NAV_ITEMS = [
  { href: "/",        icon: LayoutDashboard, labelKey: "nav.home",    isChat: false },
  { href: "/journal", icon: BookOpen,         labelKey: "nav.journal", isChat: false },
  { href: "/tools",   icon: Wrench,           labelKey: "nav.tools",   isChat: false },
  { href: "/zen",     icon: Brain,            labelKey: "nav.zen",     isChat: false },
  { href: "/chat",    icon: MessageCircle,    labelKey: "nav.chat",    isChat: true  },
] as const;

function NavItem({ href, icon: Icon, label, badge, vertical }: {
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
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${
          isActive
            ? "bg-primary/10 text-primary border border-primary/30"
            : "text-muted-foreground hover:bg-card/80 hover:text-foreground border border-transparent"
        }`}
      >
        <div className="relative">
          <Icon className="w-5 h-5" />
          {badge != null && badge > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-0.5">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        <span className="text-sm font-medium">{label}</span>
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full" />
        )}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1 flex-1 py-3 relative"
    >
      <div className="relative">
        <Icon
          className={`w-6 h-6 transition-colors ${
            isActive ? "text-primary" : "text-muted-foreground"
          }`}
        />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-0.5">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span
        className={`text-[11px] font-medium transition-colors ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {isActive && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
      )}
    </Link>
  );
}

export function BottomNav() {
  const { t } = useLanguage();
  const { data: unreadData } = useGetUnreadCount({ query: { refetchInterval: 5000 } });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border/50 lg:hidden">
        <div className="max-w-7xl mx-auto flex items-center">
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
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </nav>

      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 z-50 w-48 bg-card/90 backdrop-blur-xl border-r border-border/50 flex-col">
        <div className="px-4 py-5 border-b border-border/30">
          <h1 className="text-sm font-bold font-mono tracking-widest bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            TRADER<span className="text-primary">LOADING</span>
          </h1>
        </div>
        <div className="flex-1 flex flex-col gap-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={t(item.labelKey)}
              badge={item.isChat ? unreadCount : undefined}
              vertical
            />
          ))}
        </div>
      </nav>
    </>
  );
}
