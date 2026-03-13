import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Edit2, Trash2, Image as ImageIcon, CalendarDays, Tag, Lightbulb, Target, BookOpen, Check } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { JournalEntryModal } from "@/components/JournalEntryModal";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetJournalEntries,
  useDeleteJournalEntry,
  getGetJournalEntriesQueryKey,
  useGetIdeas,
  useCreateIdea,
  useUpdateIdea,
  useDeleteIdea,
  getGetIdeasQueryKey,
  type JournalEntry,
} from "@workspace/api-client-react";

type Tab = "trades" | "idee" | "obiettivi";

function TradesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const { data: entries, isLoading } = useGetJournalEntries();
  const deleteMutation = useDeleteJournalEntry();

  const getResultConfig = (result: string) => {
    switch (result) {
      case "win": return { label: "Win", class: "bg-success/10 text-success border-success/30" };
      case "loss": return { label: "Loss", class: "bg-destructive/10 text-destructive border-destructive/30" };
      case "breakeven": return { label: "Break Even", class: "bg-warning/10 text-warning border-warning/30" };
      default: return { label: "–", class: "bg-white/5 text-muted-foreground border-white/10" };
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminare questo entry?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
      toast({ description: "Entry eliminato." });
    } catch {
      toast({ description: "Errore.", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4 sm:mb-6">
        <Button onClick={() => { setEditingEntry(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Trade
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card h-64 rounded-2xl animate-pulse bg-white/5" />
          ))}
        </div>
      ) : entries && entries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <AnimatePresence>
            {entries
              .sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime())
              .map((entry, idx) => {
                const resConfig = getResultConfig(entry.result);
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass-card rounded-2xl p-3 sm:p-5 flex flex-col group hover:border-primary/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        <CalendarDays className="w-4 h-4" />
                        {format(parseISO(entry.tradeDate), "d MMM yyyy", { locale: it })}
                      </div>
                      <div className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${resConfig.class}`}>
                        {resConfig.label}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold mb-2 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      {entry.title}
                    </h3>

                    {entry.tags && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {entry.tags.split(",").map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground text-xs border border-white/5">
                            <Tag className="w-3 h-3" />
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    {entry.images && entry.images.length > 0 && (
                      <div className="mb-4 aspect-video w-full rounded-lg overflow-hidden border border-white/10 relative">
                        <img src={entry.images[0].url} alt="Thumbnail" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        {entry.images.length > 1 && (
                          <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />+{entry.images.length - 1}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground/80 line-clamp-3 mb-6 flex-grow">
                      {entry.content || "Nessuna nota."}
                    </p>

                    <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Modifica
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-destructive hover:bg-destructive/20" onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      ) : (
        <Card className="glass-card border-dashed border-white/10">
          <CardContent className="p-16 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold mb-2">Nessun trade registrato</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Inizia a tracciare i tuoi trade per migliorare le tue performance.
            </p>
            <Button onClick={() => { setEditingEntry(null); setIsModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Primo Trade
            </Button>
          </CardContent>
        </Card>
      )}

      <JournalEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entry={editingEntry}
      />
    </>
  );
}

function IdeasTab({ type }: { type: "idea" | "goal" }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newContent, setNewContent] = useState("");
  const { data: all, isLoading } = useGetIdeas();
  const createMutation = useCreateIdea();
  const updateMutation = useUpdateIdea();
  const deleteMutation = useDeleteIdea();
  const invalidate = () => qc.invalidateQueries({ queryKey: getGetIdeasQueryKey() });

  const items = all?.filter(i => i.type === type) ?? [];
  const Icon = type === "idea" ? Lightbulb : Target;
  const label = type === "idea" ? "idea" : "obiettivo";
  const placeholder = type === "idea" ? "Nuova strategia o osservazione..." : "Obiettivo da raggiungere...";

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    try {
      await createMutation.mutateAsync({ data: { type, content: newContent.trim() } });
      setNewContent("");
      invalidate();
    } catch {
      toast({ description: "Errore.", variant: "destructive" });
    }
  };

  const handleToggle = async (id: number, content: string, completed: boolean) => {
    await updateMutation.mutateAsync({ id, data: { content, completed: !completed } });
    invalidate();
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync({ id });
    invalidate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex gap-3">
            <Input
              placeholder={placeholder}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={!newContent.trim() || createMutation.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-white/10">
          <CardContent className="p-10 text-center">
            <Icon className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">Nessun{type === "idea" ? "a" : ""} {label} aggiunt{type === "idea" ? "a" : "o"}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.04 }}
                className="glass-card rounded-xl p-4 flex items-start gap-4 group hover:border-primary/40 transition-colors"
              >
                <button
                  onClick={() => handleToggle(item.id, item.content, item.completed)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    item.completed ? "bg-primary border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  {item.completed && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                    {item.content}
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-0.5">
                    {format(parseISO(item.createdAt), "d MMM yyyy", { locale: it })}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default function Journal() {
  const [tab, setTab] = useState<Tab>("trades");

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "trades", label: "Trade", icon: BookOpen },
    { id: "idee", label: "Idee", icon: Lightbulb },
    { id: "obiettivi", label: "Obiettivi", icon: Target },
  ];

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold font-mono">Diario</h2>
          <p className="text-muted-foreground mt-1">Registra trade, idee e obiettivi di trading.</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-card/50 backdrop-blur-md p-1.5 rounded-xl border border-border w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === t.id
                  ? "bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "trades" && <TradesTab />}
          {tab === "idee" && <IdeasTab type="idea" />}
          {tab === "obiettivi" && <IdeasTab type="goal" />}
        </motion.div>
      </AnimatePresence>
    </PageLayout>
  );
}
