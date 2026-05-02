import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Check, ChevronDown, BarChart2 } from "lucide-react";
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

const CATEGORY_ORDER = ["forex-major", "forex-minor", "metal", "index", "crypto", "forex-exotic"];

export function PairSelectionModal({
  open,
  onConfirm,
  initialPairs = [],
  dismissible = false,
  onClose,
}: PairSelectionModalProps) {
  const [selected, setSelected] = useState<string[]>(initialPairs);
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "forex-major": true,
    "forex-minor": false,
    "forex-exotic": false,
    "metal": true,
    "index": true,
    "crypto": true,
  });

  useEffect(() => {
    if (open) {
      setSelected(initialPairs);
      setSearch("");
    }
  }, [open]);

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
    for (const cat of CATEGORY_ORDER) {
      const pairs = filtered.filter((p) => p.category === cat);
      if (pairs.length > 0) map.set(cat, pairs);
    }
    for (const p of filtered) {
      if (!CATEGORY_ORDER.includes(p.category) && !map.has(p.category)) {
        map.set(p.category, []);
      }
    }
    return map;
  }, [filtered]);

  const toggle = (symbol: string) => {
    setSelected((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  const removeChip = (symbol: string) => setSelected((prev) => prev.filter((s) => s !== symbol));

  const toggleCategory = (cat: string) =>
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const handleConfirm = () => {
    if (selected.length > 0) onConfirm(selected);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => { if (dismissible) onClose?.(); }}
      />

      {/* Panel — bottom-sheet on mobile, centered modal on tablet/desktop */}
      <motion.div
        key="panel"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className={[
          "fixed z-50 bg-card border border-border shadow-2xl flex flex-col",
          /* Mobile: full-width sheet anchored to bottom */
          "bottom-0 left-0 right-0 rounded-t-3xl max-h-[92dvh]",
          /* Tablet and up: centered, rounded all sides */
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:rounded-2xl sm:w-[560px] sm:max-h-[88vh]",
          /* Desktop wide: slightly larger */
          "lg:w-[680px]",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 border-b border-border shrink-0 sm:pt-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Scegli i tuoi Strumenti</h2>
            </div>
            {dismissible && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Seleziona i pair su cui fai trading. La dashboard si adatterà automaticamente.
          </p>
        </div>

        {/* Selected chips */}
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden shrink-0"
            >
              <div className="px-4 pt-3 pb-1 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {selected.map((sym) => {
                  const entry = PAIR_CATALOG.find((p) => p.symbol === sym);
                  return (
                    <motion.span
                      key={sym}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-primary/15 text-primary border border-primary/30"
                    >
                      {entry?.label ?? sym}
                      <button
                        onClick={() => removeChip(sym)}
                        className="hover:text-destructive ml-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.span>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca pair... (es. EUR, gold, BTC)"
              className="pl-9 h-10 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable pair list */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-2 space-y-2">
          {Array.from(grouped.entries()).map(([category, pairs]) => {
            const isExpanded = search.trim() !== "" || expandedCategories[category];
            const selectedInCat = pairs.filter((p) => selected.includes(p.symbol)).length;

            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded-lg hover:bg-secondary/30"
                >
                  <span className="flex items-center gap-1.5">
                    {CATEGORY_LABELS[category] ?? category}
                    <span className="text-[10px] font-mono opacity-60">({pairs.length})</span>
                    {selectedInCat > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                        {selectedInCat} ✓
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      {/* 2 cols on mobile, 3 on sm, 4 on lg */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 pb-2 pt-1">
                        {pairs.map((pair) => {
                          const isSelected = selected.includes(pair.symbol);
                          return (
                            <button
                              key={pair.symbol}
                              onClick={() => toggle(pair.symbol)}
                              className={[
                                "flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all border",
                                "min-h-[44px] active:scale-95",
                                isSelected
                                  ? "bg-primary/15 border-primary/50 text-primary"
                                  : "bg-secondary/25 border-border/50 hover:border-primary/25 hover:bg-secondary/50 text-foreground",
                              ].join(" ")}
                            >
                              <div
                                className={[
                                  "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all",
                                  isSelected ? "bg-primary border-primary" : "border-muted-foreground/30",
                                ].join(" ")}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                              </div>
                              <span className="font-mono font-bold text-xs truncate">{pair.label}</span>
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
            <div className="py-12 text-center text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nessun pair trovato per "{search}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-4 border-t border-border flex items-center justify-between gap-3 bg-card rounded-b-2xl sm:rounded-b-2xl">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {selected.length} selezionat{selected.length === 1 ? "o" : "i"}
            </span>
            {selected.length > 0 && (
              <button
                onClick={() => setSelected([])}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors underline-offset-2 hover:underline"
              >
                Deseleziona tutti
              </button>
            )}
          </div>
          <Button
            onClick={handleConfirm}
            disabled={selected.length === 0}
            className="min-w-[120px] h-11 text-sm font-semibold"
          >
            Conferma selezione
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
