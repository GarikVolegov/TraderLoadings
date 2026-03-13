import { motion } from "framer-motion";
import { TopNav } from "@/components/TopNav";
import { ProfileWidget } from "@/components/ProfileWidget";
import { LotCalculatorWidget } from "@/components/LotCalculatorWidget";
import { AudioPlayer } from "@/components/AudioPlayer";

export default function Settings() {
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

        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-foreground"
        >
          Impostazioni
        </motion.h2>

        {/* Profile Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ProfileWidget />
        </motion.section>

        {/* Lot Calculator Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <LotCalculatorWidget />
        </motion.section>

        {/* Audio Player Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AudioPlayer />
        </motion.section>
        
      </div>
    </div>
  );
}
