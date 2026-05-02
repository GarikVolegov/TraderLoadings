import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useBackground } from "@/contexts/BackgroundContext";

interface PageLayoutProps {
  children: ReactNode;
}

const pageVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export function PageLayout({ children }: PageLayoutProps) {
  const { backgroundUrl, darkness } = useBackground();

  return (
    <div className="min-h-screen relative bg-background pb-20 sm:pb-24 lg:pb-8 lg:pl-48">
      {/* Background layer */}
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

      {/* Main content — animated entrance per-page */}
      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-16 lg:pt-14 space-y-4 sm:space-y-6"
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
        {children}
      </motion.div>
    </div>
  );
}
