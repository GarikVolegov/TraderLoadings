import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAIR_CATALOG, CATEGORY_LABELS, type PairEntry } from "@workspace/pair-catalog";

interface PairSelectionModalProps {
  open: boolean;
  onConfirm: (pairs: string[]) => void;
  initialPairs?: string[];
  dismissible?: boolean;
  onClose?: () => void;
}

export function PairSelectionModal({ open, onConfirm, initialPairs = [], dismissible = false, onClose }: PairSelectionModalProps) {
  const [selected, setSelected] = useState<string[]>(initialPairs);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(initialPairs);
      setSearch("");
    }
  }, [open, initialPairs]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "forex-major": true,
    "forex-minor": false,
    "forex-exotic": false,
    "metal": true,
    "index": true,
    "crypto": true,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return PAIR_CATALOG;
    return PAIR_CATALOG.filter(
      (p) =>
        p.symbol.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.currencies.some((c) => c.toLowerCase().includes(q))
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PairEntry[]>();
    for (const p of filtered) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [filtered]);

  const toggle = (symbol: string) => {
    setSelected((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  const removeChip = (symbol: string) => {
    setSelected((prev) => prev.filter((s) => s !== symbol));
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleConfirm = () => {
    if (selected.length > 0) {
      onConfirm(selected);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-4"
        onClick={(e) => {
          if (dismissible && e.target === e.currentTarget) onClose?.();
        }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative"
        >
          <div className="p-5 border-b border-border shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold">Scegli i tuoi Strumenti</h2>
              {dismissible && (
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Seleziona i pair su cui fai trading. La dashboard si adatterà automaticamente.
            </p>
          </div>

          {selected.length > 0 && (
            <div className="px-5 pt-3 flex flex-wrap gap-1.5 shrink-0">
              {selected.map((sym) => {
                const entry = PAIR_CATALOG.find((p) => p.symbol === sym);
                return (
                  <span
                    key={sym}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-primary/15 text-primary border border-primary/30"
                  >
                    {entry?.label ?? sym}
                    <button onClick={() => removeChip(sym)} className="hover:text-foreground ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="px-5 pt-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca pair... (es. EUR, gold, BTC)"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 min-h-0 pb-20">
            {Array.from(grouped.entries()).map(([category, pairs]) => {
              const isExpanded = search.trim() !== "" || expandedCategories[category];
              return (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    {CATEGORY_LABELS[category] ?? category} ({pairs.length})
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pb-2">
                          {pairs.map((pair) => {
                            const isSelected = selected.includes(pair.symbol);
                            return (
                              <button
                                key={pair.symbol}
                                onClick={() => toggle(pair.symbol)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm transition-all border ${
                                  isSelected
                                    ? "bg-primary/15 border-primary/40 text-primary"
                                    : "bg-secondary/30 border-border hover:border-primary/20 hover:bg-secondary/60 text-foreground"
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                  isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                                </div>
                                <span className="font-mono font-bold text-xs">{pair.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {grouped.size === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Nessun pair trovato per "{search}"
              </p>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-border flex items-center justify-between bg-gradient-to-t from-card via-card to-transparent backdrop-blur-sm rounded-b-2xl">
            <span className="text-xs text-muted-foreground">
              {selected.length} pair selezionat{selected.length === 1 ? "o" : "i"}
            </span>
            <Button onClick={handleConfirm} disabled={selected.length === 0} className="min-w-[120px]">
              Conferma
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
