import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Edit2, Trash2, Image as ImageIcon, CalendarDays, Tag } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { JournalEntryModal } from "@/components/JournalEntryModal";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetJournalEntries, 
  useDeleteJournalEntry,
  getGetJournalEntriesQueryKey,
  type JournalEntry 
} from "@workspace/api-client-react";

export default function Journal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  const { data: entries, isLoading } = useGetJournalEntries();
  const deleteMutation = useDeleteJournalEntry();

  const handleCreate = () => {
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Sei sicuro di voler eliminare questo entry?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
      toast({ description: "Entry eliminato." });
    } catch (e) {
      toast({ description: "Errore durante l'eliminazione.", variant: "destructive" });
    }
  };

  const getResultConfig = (result: string) => {
    switch (result) {
      case 'win': return { label: 'Win', class: 'bg-success/10 text-success border-success/30' };
      case 'loss': return { label: 'Loss', class: 'bg-destructive/10 text-destructive border-destructive/30' };
      case 'breakeven': return { label: 'Break Even', class: 'bg-warning/10 text-warning border-warning/30' };
      default: return { label: 'Nessuno', class: 'bg-white/5 text-muted-foreground border-white/10' };
    }
  };

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

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-8">
          <div>
            <h2 className="text-3xl font-bold font-mono">Diario di Trading</h2>
            <p className="text-muted-foreground mt-1">Registra, analizza e migliora le tue performance.</p>
          </div>
          <Button 
            onClick={handleCreate} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Entry
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card h-64 rounded-2xl animate-pulse bg-white/5" />
            ))}
          </div>
        ) : entries && entries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {entries.sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime()).map((entry, idx) => {
                const resConfig = getResultConfig(entry.result);
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass-card rounded-2xl p-5 flex flex-col group hover:border-primary/50 transition-colors"
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
                        {entry.tags.split(',').map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground text-xs font-medium border border-white/5">
                            <Tag className="w-3 h-3" />
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    {entry.images && entry.images.length > 0 && (
                      <div className="mb-4 aspect-video w-full rounded-lg overflow-hidden border border-white/10 relative">
                        <img 
                          src={entry.images[0].url} 
                          alt="Thumbnail" 
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                        {entry.images.length > 1 && (
                          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-white flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            +{entry.images.length - 1}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground/80 line-clamp-3 mb-6 flex-grow">
                      {entry.content || "Nessuna nota."}
                    </p>

                    <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8 hover:text-white" onClick={() => handleEdit(entry)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Modifica
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-destructive hover:bg-destructive/20 hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-2xl border-dashed border-white/10"
          >
            <img 
              src={`${import.meta.env.BASE_URL}images/journal-empty.png`} 
              alt="Empty Journal" 
              className="w-64 h-auto mb-6 opacity-80 drop-shadow-[0_0_30px_rgba(34,197,94,0.2)]"
            />
            <h3 className="text-2xl font-bold mb-2">Il tuo diario è vuoto</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Inizia a tracciare i tuoi trade, analizzare i setup e imparare dagli errori. Il journaling è la chiave per la profittabilità.
            </p>
            <Button onClick={handleCreate} className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Crea il tuo primo Entry
            </Button>
          </motion.div>
        )}

      </div>

      <JournalEntryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        entry={editingEntry} 
      />
    </div>
  );
}
