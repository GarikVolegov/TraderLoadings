import { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, Loader2, Image as ImageIcon } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useUploadJournalImage,
  useDeleteJournalImage,
  getGetJournalEntriesQueryKey,
  type JournalEntry
} from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry?: JournalEntry | null;
}

export function JournalEntryModal({ isOpen, onClose, entry }: JournalEntryModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const createMutation = useCreateJournalEntry();
  const updateMutation = useUpdateJournalEntry();
  const uploadImageMutation = useUploadJournalImage();
  const deleteImageMutation = useDeleteJournalImage();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tradeDate, setTradeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [result, setResult] = useState<"win" | "loss" | "breakeven" | "none">("none");
  const [tags, setTags] = useState("");

  const [existingImages, setExistingImages] = useState<{id: number, url: string}[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<number[]>([]);
  const [pendingFiles, setPendingFiles] = useState<(File & { preview: string })[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setTradeDate(entry.tradeDate);
      setResult(entry.result as any);
      setTags(entry.tags || "");
      setExistingImages(entry.images || []);
      setPendingDeletes([]);
      setPendingFiles([]);
    } else {
      setTitle("");
      setContent("");
      setTradeDate(format(new Date(), "yyyy-MM-dd"));
      setResult("none");
      setTags("");
      setExistingImages([]);
      setPendingDeletes([]);
      setPendingFiles([]);
    }
  }, [entry, isOpen]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => Object.assign(file, {
      preview: URL.createObjectURL(file)
    }));
    setPendingFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxSize: 5 * 1024 * 1024
  });

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const removeExistingImage = (imageId: number) => {
    setExistingImages(prev => prev.filter(img => img.id !== imageId));
    setPendingDeletes(prev => [...prev, imageId]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: t("common.error"), description: t("journal_modal.title_required"), variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      let entryId = entry?.id;
      const formData = { title, content, tradeDate, result, tags: tags || null };

      if (!entryId) {
        const newEntry = await createMutation.mutateAsync({ data: formData });
        entryId = newEntry.id;
      } else {
        await updateMutation.mutateAsync({ id: entryId, data: formData });
      }

      for (const imageId of pendingDeletes) {
        await deleteImageMutation.mutateAsync({ id: entryId, imageId });
      }

      for (const file of pendingFiles) {
        await uploadImageMutation.mutateAsync({
          id: entryId,
          data: { image: file as any }
        });
      }

      toast({ title: t("common.success"), description: t("journal_modal.saved") });
      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
      onClose();
    } catch (err: any) {
      toast({
        title: t("journal_modal.error"),
        description: err.message || t("common.error"),
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    return () => pendingFiles.forEach(file => URL.revokeObjectURL(file.preview));
  }, [pendingFiles]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] bg-card/95 backdrop-blur-xl border-border max-h-[90vh] overflow-y-auto hide-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl font-mono text-foreground flex items-center gap-2">
            {entry ? t("journal_modal.edit") : t("journal_modal.new")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">{t("journal_modal.date")}</Label>
              <Input
                type="date"
                value={tradeDate}
                onChange={e => setTradeDate(e.target.value)}
                className="bg-background/50 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">{t("journal_modal.result")}</Label>
              <div className="flex bg-background/50 p-1 rounded-xl border border-white/10">
                {(['win', 'loss', 'breakeven', 'none'] as const).map(res => (
                  <button
                    key={res}
                    onClick={() => setResult(res)}
                    className={`flex-1 text-xs sm:text-sm py-1.5 rounded-lg font-medium transition-all ${
                      result === res
                        ? res === 'win' ? 'bg-success/20 text-success'
                        : res === 'loss' ? 'bg-destructive/20 text-destructive'
                        : res === 'breakeven' ? 'bg-warning/20 text-warning'
                        : 'bg-white/10 text-white'
                        : 'text-muted-foreground hover:bg-white/5'
                    }`}
                  >
                    {res === 'win' ? 'Win' : res === 'loss' ? 'Loss' : res === 'breakeven' ? 'BE' : t("journal_modal.result_none")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">{t("journal_modal.title_label")}</Label>
            <Input
              placeholder={t("journal_modal.title_placeholder")}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="bg-background/50 border-white/10"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">
              {t("journal_modal.tags_label")} <span className="text-xs opacity-50">{t("journal_modal.tags_hint")}</span>
            </Label>
            <Input
              placeholder={t("journal_modal.tags_placeholder")}
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="bg-background/50 border-white/10"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">{t("journal_modal.notes_label")}</Label>
            <Textarea
              placeholder={t("journal_modal.notes_placeholder")}
              value={content}
              onChange={e => setContent(e.target.value)}
              className="min-h-[150px] bg-background/50 border-white/10 resize-y"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-muted-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              {t("journal_modal.images_label")}
            </Label>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-white/10 hover:border-primary/50 hover:bg-white/5'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <UploadCloud className={`w-8 h-8 ${isDragActive ? 'text-primary' : ''}`} />
                <p className="text-sm font-medium">
                  {isDragActive ? t("journal_modal.drop_active") : t("journal_modal.drop_inactive")}
                </p>
                <p className="text-xs opacity-70">{t("journal_modal.drop_hint")}</p>
              </div>
            </div>

            {(existingImages.length > 0 || pendingFiles.length > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                <AnimatePresence>
                  {existingImages.map((img) => (
                    <motion.div
                      key={`ext-${img.id}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative group aspect-video rounded-lg overflow-hidden border border-white/10 bg-background"
                    >
                      <img src={img.url} alt="Journal entry" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeExistingImage(img.id)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}

                  {pendingFiles.map((file, idx) => (
                    <motion.div
                      key={file.preview}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative group aspect-video rounded-lg overflow-hidden border border-primary/50 bg-background"
                    >
                      <img src={file.preview} alt="Preview" className="w-full h-full object-cover opacity-80" />
                      <div className="absolute inset-0 ring-2 ring-inset ring-primary/50 pointer-events-none rounded-lg" />
                      <button
                        onClick={() => removePendingFile(idx)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {t("journal_modal.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("journal_modal.saving")}</>
            ) : (
              t("journal_modal.save")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
