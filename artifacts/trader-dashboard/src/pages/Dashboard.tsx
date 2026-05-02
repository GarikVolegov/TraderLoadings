import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ClockWidget } from "@/components/ClockWidget";
import { QuoteWidget } from "@/components/QuoteWidget";
import { MissionsWidget } from "@/components/MissionsWidget";
import { CalendarWidget } from "@/components/CalendarWidget";
import { ChecklistDashboardWidget } from "@/components/ChecklistDashboardWidget";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const { t } = useLanguage();
  return (
    <PageLayout>
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />
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
    </PageLayout>
  );
}
