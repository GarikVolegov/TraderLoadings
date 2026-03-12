import { motion } from "framer-motion";
import { ClockWidget } from "@/components/ClockWidget";
import { ProfileWidget } from "@/components/ProfileWidget";
import { LotCalculatorWidget } from "@/components/LotCalculatorWidget";
import { MissionsWidget } from "@/components/MissionsWidget";

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
        
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl border border-primary/50 flex items-center justify-center">
              <div className="w-4 h-4 bg-primary rounded-sm rotate-45 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
            </div>
            <h1 className="text-2xl font-bold font-mono tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              Trader<span className="text-primary">Dash</span>
            </h1>
          </div>
        </motion.header>

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
