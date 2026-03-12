import { motion } from "framer-motion";
import { ClockWidget } from "@/components/ClockWidget";
import { ProfileWidget } from "@/components/ProfileWidget";
import { LotCalculatorWidget } from "@/components/LotCalculatorWidget";
import { MissionsWidget } from "@/components/MissionsWidget";
import { TopNav } from "@/components/TopNav";

export default function Dashboard() {
  return (
    <div className="min-h-screen relative bg-background pb-12">
      {/* Background Graphic */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none select-none mix-blend-screen">
        <img 
          src={`${import.meta.env.BASE_URL}images/dashboard-bg.png`} 
          alt="Background" 
          className="w-full h-full object-cover"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        <TopNav />

        {/* Top Section: Clock & Sessions */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ClockWidget />
        </motion.section>

        {/* Middle Section: Profile & Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ProfileWidget />
          </motion.section>
          
          <motion.section 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <LotCalculatorWidget />
          </motion.section>
        </div>

        {/* Bottom Section: Missions */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <MissionsWidget />
        </motion.section>
        
      </div>
    </div>
  );
}
