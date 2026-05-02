import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, X, Plus, GripVertical } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCreateChecklistItem, useGetChecklist, getGetChecklistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

const SUGGESTION_ITEMS = [
  "Verifica setup grafico",
  "Analisi timeframe superiore",
  "Identifica supporti/resistenze",
  "Controlla notizie macro",
  "Definisci entrata e exit",
  "Calcola risk/reward",
  "Gestione della posizione",
];

export function ChecklistSetupModal() {
  const { t } = useLanguage();
  const { data: items } = useGetChecklist();
  const [show, setShow] = useState(false);
  const [adding, setAdding] = useState(false);
  const [rows, setRows] = useState<{ id: number; value: string; isPlaceholder: boolean }[]>([]);
  const nextId = useRef(100);
  const qc = useQueryClient();
  const createMutation = useCreateChecklistItem();

  useEffect(() => {
    if (items && items.length === 0) {
      setRows(
        SUGGESTION_ITEMS.map((text, i) => ({
          id: i,
          value: text,
          isPlaceholder: true,
        }))
      );
      setShow(true);
    }
  }, [items]);

  const handleChange = (id: number, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, value, isPlaceholder: false } : r))
    );
  };

  const handleRemove = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddRow = () => {
    const id = nextId.current++;
    setRows((prev) => [...prev, { id, value: "", isPlaceholder: false }]);
    setTimeout(() => {
      document.getElementById(`cl-row-${id}`)?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddRow();
    }
    if (e.key === "Backspace" && (e.target as HTMLInputElement).value === "") {
      e.preventDefault();
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === id);
        const next = prev.filter((r) => r.id !== id);
        setTimeout(() => {
          const focusId = next[Math.max(0, idx - 1)]?.id;
          if (focusId !== undefined) document.getElementById(`cl-row-${focusId}`)?.focus();
        }, 0);
        return next;
      });
    }
  };

  const handleSave = async () => {
    const toSave = rows.map((r) => r.value.trim()).filter(Boolean);
    if (toSave.length === 0) return;
    setAdding(true);
    try {
      for (const text of toSave) {
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

  const filledCount = rows.filter((r) => r.value.trim()).length;

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
            className="relative w-full max-w-sm"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/15">
                    <CheckSquare className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">La tua Checklist</CardTitle>
                </div>
                <button onClick={() => setShow(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Personalizza i tuoi step pre-trade. I suggerimenti standard sono già inseriti — modificali o aggiungine di nuovi.
                </p>

                <div className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
                  <div className="px-3 pt-2.5 pb-1 border-b border-border/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Step pre-trade
                    </p>
                  </div>

                  <div className="max-h-52 overflow-y-auto divide-y divide-border/30">
                    {rows.map((row, idx) => (
                      <motion.div
                        key={row.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 px-2 py-1.5 group"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                        <span className="text-primary text-xs shrink-0">✓</span>
                        <input
                          id={`cl-row-${row.id}`}
                          type="text"
                          value={row.value}
                          onChange={(e) => handleChange(row.id, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, row.id)}
                          placeholder={row.isPlaceholder ? "" : `Step ${idx + 1}…`}
                          className={[
                            "flex-1 text-xs bg-transparent outline-none min-w-0",
                            "placeholder:text-muted-foreground/40",
                            row.isPlaceholder
                              ? "text-muted-foreground"
                              : "text-foreground",
                          ].join(" ")}
                          onFocus={() => {
                            if (row.isPlaceholder) {
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, isPlaceholder: false } : r
                                )
                              );
                            }
                          }}
                        />
                        <button
                          onClick={() => handleRemove(row.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-opacity shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    ))}

                    {rows.length === 0 && (
                      <p className="text-xs text-muted-foreground/50 text-center py-4">
                        Nessuno step — aggiungine uno sotto
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleAddRow}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors border-t border-border/30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi step
                  </button>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={adding || filledCount === 0}
                    className="flex-1"
                  >
                    {adding
                      ? "Salvataggio…"
                      : filledCount > 0
                      ? `Salva ${filledCount} step`
                      : "Salva"}
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
                  Puoi modificare la checklist in Impostazioni → Checklist
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
