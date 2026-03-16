import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { ClockWidget } from "@/components/ClockWidget";
import { QuoteWidget } from "@/components/QuoteWidget";
import { MissionsWidget } from "@/components/MissionsWidget";
import { CalendarWidget } from "@/components/CalendarWidget";
import { ChecklistDashboardWidget } from "@/components/ChecklistDashboardWidget";
import { useGetMissions } from "@workspace/api-client-react";

export default function Dashboard() {
  const { data: missions } = useGetMissions();
  const hasMissions = (missions && missions.length > 0) ?? false;

  return (
    <PageLayout>
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
        transition={{ delay: 0.15 }}
      >
        <ChecklistDashboardWidget />
      </motion.section>

      {hasMissions && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <MissionsWidget />
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <CalendarWidget />
      </motion.section>

      {!hasMissions && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <MissionsWidget />
        </motion.section>
      )}
    </PageLayout>
  );
}
