import { ClipboardCheck, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useGetChecklist } from "@workspace/api-client-react";
import { useLocation } from "wouter";

export function ChecklistDashboardWidget() {
  const { data: items, isLoading } = useGetChecklist();
  const [, navigate] = useLocation();

  const completed = items?.filter((i) => i.completed).length ?? 0;
  const total = items?.length ?? 0;

  return (
    <Card className="h-full relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6 border-b border-border/50 bg-secondary/10">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Checklist Pre-Trade
        </CardTitle>
        {total > 0 && (
          <span className="text-xs sm:text-sm font-bold font-mono text-muted-foreground">
            {completed}/{total}
          </span>
        )}
      </CardHeader>

      <CardContent className="p-3 sm:p-4">
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !items || items.length === 0 ? (
          <button
            onClick={() => navigate("/checklist")}
            className="w-full py-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ClipboardCheck className="w-10 h-10 opacity-20 group-hover:opacity-40 transition-opacity" />
            <p className="text-sm font-medium">Nessuna voce configurata</p>
            <span className="text-xs flex items-center gap-1 text-primary">
              Configura la checklist
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-colors ${
                  item.completed
                    ? "bg-primary/10 border-primary/30 text-primary line-through opacity-50"
                    : "bg-secondary/60 border-border/60 text-foreground"
                }`}
              >
                {item.text}
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
