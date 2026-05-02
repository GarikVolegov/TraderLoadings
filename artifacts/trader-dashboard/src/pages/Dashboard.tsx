import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ClockWidget } from "@/components/ClockWidget";
import { QuoteWidget } from "@/components/QuoteWidget";
import { MissionsWidget } from "@/components/MissionsWidget";
import { CalendarWidget } from "@/components/CalendarWidget";
import { ChecklistDashboardWidget } from "@/components/ChecklistDashboardWidget";
import { SentimentWidget } from "@/components/SentimentWidget";
import { VolatilityWidget } from "@/components/VolatilityWidget";
import { CotWidget } from "@/components/CotWidget";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const { t } = useLanguage();
  return (
    <PageLayout>
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />

      <div className="space-y-4 sm:space-y-6">
        {/* Row 1 — Clock / Checklist + Calendar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_2fr] gap-4 sm:gap-6">
          <div className="space-y-4 sm:space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ClockWidget />
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <QuoteWidget />
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <MissionsWidget />
            </motion.section>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <ChecklistDashboardWidget />
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <CalendarWidget />
            </motion.section>
          </div>
        </div>

        {/* Row 2 — Market Intelligence: Sentiment · Volatilità · COT */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-3 mb-3"
          >
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Market Intelligence
            </span>
            <div className="h-px flex-1 bg-border/40" />
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              <SentimentWidget />
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <VolatilityWidget />
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="sm:col-span-2 lg:col-span-1"
            >
              <CotWidget />
            </motion.section>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
