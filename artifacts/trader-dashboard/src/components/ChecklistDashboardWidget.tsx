import { ClipboardCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useGetChecklist } from "@workspace/api-client-react";

export function ChecklistDashboardWidget() {
  const { data: items, isLoading } = useGetChecklist();
  const total = items?.length ?? 0;

  return (
    <Card className="h-full relative overflow-hidden bg-card/60 backdrop-blur-sm border-border/30">
      <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6 border-b border-border/30">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Checklist Pre-Trade
          {total > 0 && (
            <span className="ml-auto text-xs sm:text-sm font-mono text-muted-foreground">
              {total} {total === 1 ? "regola" : "regole"}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-3 sm:p-4">
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !items || items.length === 0 ? (
          <Link
            href="/checklist"
            className="w-full py-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ClipboardCheck className="w-10 h-10 opacity-20 group-hover:opacity-40 transition-opacity" />
            <p className="text-sm font-medium">Nessuna voce configurata</p>
            <span className="text-xs flex items-center gap-1 text-primary">
              Configura la checklist
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : (
          <div className="space-y-1.5">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
              >
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground">{item.text}</span>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
