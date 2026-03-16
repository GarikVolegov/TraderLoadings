import { type ReactNode } from "react";
import { useBackground } from "@/contexts/BackgroundContext";
import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  const { backgroundUrl, darkness } = useBackground();

  return (
    <div className="min-h-screen relative bg-background pb-20 sm:pb-24 lg:pb-6 lg:pl-48">
      <div className="fixed inset-0 z-0 pointer-events-none select-none">
        {backgroundUrl ? (
          <img
            src={backgroundUrl}
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: (100 - darkness) / 100 }}
          />
        ) : (
          <img
            src={`${import.meta.env.BASE_URL}images/dashboard-bg.png`}
            alt=""
            className="w-full h-full object-cover opacity-20 mix-blend-screen"
          />
        )}
        {backgroundUrl && (
          <div
            className="absolute inset-0 bg-background"
            style={{ opacity: darkness / 100 }}
          />
        )}
      </div>
      <TopNav />
      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-14 sm:pt-16 lg:pt-14 space-y-3 sm:space-y-4 md:space-y-6">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
