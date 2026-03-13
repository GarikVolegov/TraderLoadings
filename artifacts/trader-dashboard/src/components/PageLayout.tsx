import { type ReactNode } from "react";
import { useBackground } from "@/contexts/BackgroundContext";
import { TopNav } from "./TopNav";

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  const { backgroundUrl } = useBackground();

  return (
    <div className="min-h-screen relative bg-background pb-12">
      <div className="fixed inset-0 z-0 pointer-events-none select-none">
        {backgroundUrl ? (
          <img
            src={backgroundUrl}
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
        ) : (
          <img
            src={`${import.meta.env.BASE_URL}images/dashboard-bg.png`}
            alt=""
            className="w-full h-full object-cover opacity-20 mix-blend-screen"
          />
        )}
        {backgroundUrl && <div className="absolute inset-0 bg-background/60" />}
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        <TopNav />
        {children}
      </div>
    </div>
  );
}
