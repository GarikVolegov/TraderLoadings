import { Link, useRoute } from "wouter";
import { LayoutDashboard, BookOpen, TrendingDown, MessageCircle, Wrench, Brain } from "lucide-react";
import { useGetUnreadCount } from "@workspace/api-client-react";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/journal", icon: BookOpen, label: "Diario" },
  { href: "/backtest", icon: TrendingDown, label: "Backtest" },
  { href: "/tools", icon: Wrench, label: "Strumenti" },
  { href: "/zen", icon: Brain, label: "Zen" },
  { href: "/chat", icon: MessageCircle, label: "Chat" },
] as const;

function NavItem({ href, icon: Icon, label, badge }: { href: string; icon: typeof LayoutDashboard; label: string; badge?: number }) {
  const [isActive] = useRoute(href);

  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative"
    >
      <div className="relative">
        <Icon
          className={`w-5 h-5 transition-colors ${
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
        className={`text-[10px] font-medium transition-colors ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {isActive && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
      )}
    </Link>
  );
}

export function BottomNav() {
  const { data: unreadData } = useGetUnreadCount({ query: { refetchInterval: 5000 } });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border/50">
      <div className="max-w-7xl mx-auto flex items-center">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            badge={item.label === "Chat" ? unreadCount : undefined}
          />
        ))}
      </div>
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
}
