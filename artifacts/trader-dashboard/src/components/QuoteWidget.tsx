import { motion, AnimatePresence } from "framer-motion";
import { useGetRandomQuote } from "@workspace/api-client-react";
import { Quote } from "lucide-react";

export function QuoteWidget() {
  const { data: quote } = useGetRandomQuote({ query: { staleTime: 3600_000 } });

  return (
    <AnimatePresence mode="wait">
      {quote && (
        <motion.div
          key={quote.id ?? quote.text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm px-5 sm:px-8 py-4 sm:py-6 overflow-hidden group hover:border-primary/20 transition-colors duration-300"
        >
          {/* Decorative quote icon */}
          <motion.div
            className="absolute top-3 left-4 pointer-events-none"
            initial={{ opacity: 0, scale: 0.5, rotate: -15 }}
            animate={{ opacity: 0.1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <Quote className="w-10 h-10 text-primary" />
          </motion.div>

          {/* Ambient glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl" />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-base sm:text-lg italic text-foreground/85 leading-relaxed relative z-10"
          >
            &ldquo;{quote.text}&rdquo;
          </motion.p>
          {quote.author && (
            <motion.p
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.22, duration: 0.35 }}
              className="text-sm text-accent/70 mt-2 font-medium relative z-10"
            >
              — {quote.author}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
