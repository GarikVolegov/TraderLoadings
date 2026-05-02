import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

const titleVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

const subtitleVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: 0.07, ease: [0.22, 1, 0.36, 1] },
  },
};

const actionVariants = {
  hidden: { opacity: 0, scale: 0.88, x: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: { duration: 0.3, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] },
  },
};

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <motion.div
      className="flex items-start sm:items-center justify-between gap-3 pb-1"
      initial="hidden"
      animate="visible"
    >
      <div className="min-w-0">
        <motion.h2
          variants={titleVariants}
          className="text-xl sm:text-2xl font-bold font-mono tracking-tight leading-tight"
        >
          {title}
        </motion.h2>
        {subtitle && (
          <motion.p
            variants={subtitleVariants}
            className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {action && (
        <motion.div variants={actionVariants} className="shrink-0">
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
