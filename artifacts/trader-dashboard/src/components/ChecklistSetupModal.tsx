import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateChecklistItem, useGetChecklist, getGetChecklistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_CHECKLIST_ITEMS = [
  "Verifica setup grafico",
  "Analisi timeframe superiore",
  "Identifica supporti/resistenze",
  "Controlla notizie macro",
  "Definisci entrata e exit",
  "Calcola risk/reward",
  "Gestione della posizione",
];

export function ChecklistSetupModal() {
  const { data: items } = useGetChecklist();
  const [show, setShow] = useState(false);
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();
  const createMutation = useCreateChecklistItem();

  useEffect(() => {
    if (items && items.length === 0) {
      setShow(true);
    }
  }, [items]);

  const handleSetupDefault = async () => {
    setAdding(true);
    try {
      for (const text of DEFAULT_CHECKLIST_ITEMS) {
        await createMutation.mutateAsync({ data: { text, completed: true } });
      }
      qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
      setShow(false);
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShow(false); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative"
          >
            <Card className="w-full max-w-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/15">
                    <CheckSquare className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Inizializza Checklist</CardTitle>
                </div>
                <button onClick={() => setShow(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  La tua checklist pre-trade è vuota. Vuoi caricare la checklist standard o crearne una personalizzata?
                </p>

                <div className="space-y-2 p-3 rounded-lg bg-secondary/40 border border-border">
                  <p className="text-xs font-semibold text-muted-foreground">Checklist standard:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {DEFAULT_CHECKLIST_ITEMS.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSetupDefault}
                    disabled={adding}
                    className="flex-1"
                  >
                    {adding ? "Caricamento..." : "Carica standard"}
                  </Button>
                  <Button
                    onClick={() => setShow(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Dopo
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center">
                  Puoi modificare la checklist in Impostazioni → Missioni
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
