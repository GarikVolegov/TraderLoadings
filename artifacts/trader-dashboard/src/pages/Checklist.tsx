import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, Plus, Trash2, Check, GripVertical } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetChecklist,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  getGetChecklistQueryKey,
} from "@workspace/api-client-react";

export default function Checklist() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newText, setNewText] = useState("");
  const { data: items, isLoading } = useGetChecklist();
  const createMutation = useCreateChecklistItem();
  const updateMutation = useUpdateChecklistItem();
  const deleteMutation = useDeleteChecklistItem();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      await createMutation.mutateAsync({ data: { text: newText.trim() } });
      setNewText("");
      invalidate();
    } catch {
      toast({ description: "Errore durante l'aggiunta.", variant: "destructive" });
    }
  };

  const handleToggle = async (id: number, text: string, completed: boolean) => {
    await updateMutation.mutateAsync({ id, data: { text, completed: !completed } });
    invalidate();
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync({ id });
    invalidate();
  };

  const handleResetAll = async () => {
    if (!items) return;
    await Promise.all(
      items.filter(i => i.completed).map(i =>
        updateMutation.mutateAsync({ id: i.id, data: { text: i.text, completed: false } })
      )
    );
    invalidate();
    toast({ description: "Checklist resettata." });
  };

  const completed = items?.filter(i => i.completed).length ?? 0;
  const total = items?.length ?? 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <PageLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold font-mono">Checklist Pre-Trade</h2>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Verifica ogni passaggio prima di entrare in trade.</p>
        </div>
        {total > 0 && (
          <Button variant="outline" size="sm" onClick={handleResetAll}>
            Reset Giornaliero
          </Button>
        )}
      </div>

      {total > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">{completed}/{total} completati</span>
            <span className="text-sm font-bold text-primary">{progress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <motion.div
              className="bg-primary h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            Aggiungi Voce
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="flex gap-2 sm:gap-3">
            <Input
              placeholder="es. Ho controllato le news..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={!newText.trim() || createMutation.isPending}>
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Aggiungi</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium mb-1">Nessuna voce nella checklist</p>
              <p className="text-sm">Aggiungi i passaggi da verificare prima di ogni trade.</p>
            </div>
          ) : (
            <AnimatePresence>
              <div className="divide-y divide-border/50">
                {items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`flex items-center gap-4 p-4 group hover:bg-secondary/20 transition-colors ${item.completed ? "opacity-60" : ""}`}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0" />

                    <button
                      onClick={() => handleToggle(item.id, item.text, item.completed)}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        item.completed
                          ? "bg-primary border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {item.completed && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                    </button>

                    <span className={`flex-1 text-sm font-medium ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                      {item.text}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
