import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { ClockWidget } from "@/components/ClockWidget";
import { MissionsWidget } from "@/components/MissionsWidget";
import { LotCalculatorWidget } from "@/components/LotCalculatorWidget";

export default function Dashboard() {
  return (
    <PageLayout>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ClockWidget />
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
    </PageLayout>
  );
}
