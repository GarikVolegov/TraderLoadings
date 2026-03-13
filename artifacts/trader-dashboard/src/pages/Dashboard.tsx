import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { ClockWidget } from "@/components/ClockWidget";
import { MissionsWidget } from "@/components/MissionsWidget";
import { LotCalculatorWidget } from "@/components/LotCalculatorWidget";
import { LeaderboardWidget } from "@/components/LeaderboardWidget";
import { CalendarWidget } from "@/components/CalendarWidget";

export default function Dashboard() {
  return (
    <PageLayout>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <CalendarWidget />
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <ClockWidget />
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        <motion.section
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <MissionsWidget />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <LotCalculatorWidget />
        </motion.section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <CalendarWidget />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <LeaderboardWidget />
        </motion.section>
      </div>
    </PageLayout>
  );
}
