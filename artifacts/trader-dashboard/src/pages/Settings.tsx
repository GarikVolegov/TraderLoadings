import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { ProfileWidget } from "@/components/ProfileWidget";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BackgroundPresetsManager } from "@/components/BackgroundPresetsManager";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Image, Upload, X, LogIn, LogOut, UserPlus, RefreshCw, Type, Sun, TrendingUp, Target, Plus, Pencil, Trash2, Quote, Bell, ShieldAlert, Lock, Globe, Music, ChevronRight, Check, Shield, KeyRound, CheckSquare, ChevronDown } from "lucide-react";
import { useBackground, DEFAULT_TRADING_SESSIONS, DEFAULT_LOT_DIVISOR, type TradingSessionConfig } from "@/contexts/BackgroundContext";
import { useGetUserSettings, useUpdateUserSettings, getGetUserSettingsQueryKey, useGetMissionTemplates, useCreateMissionTemplate, useUpdateMissionTemplate, useDeleteMissionTemplate, getGetMissionTemplatesQueryKey, useGetQuotes, useCreateQuote, useUpdateQuote, useDeleteQuote, getGetQuotesQueryKey, getGetRandomQuoteQueryKey, useGetChecklist, useCreateChecklistItem, useDeleteChecklistItem, getGetChecklistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@workspace/replit-auth-web";
import { usePinLock } from "@/contexts/PinLockContext";
import { useLanguage, LANGUAGES, type Language } from "@/contexts/LanguageContext";

const FONT_OPTIONS = [
  { value: "inter", label: "Inter", sample: "font-['Inter']" },
  { value: "jetbrains", label: "JetBrains Mono", sample: "font-['JetBrains_Mono']" },
  { value: "roboto", label: "Roboto", sample: "font-['Roboto']" },
  { value: "space-grotesk", label: "Space Grotesk", sample: "font-['Space_Grotesk']" },
  { value: "ibm-plex", label: "IBM Plex Sans", sample: "font-['IBM_Plex_Sans']" },
];

function FontSettings() {
  const { fontChoice, setFontChoice } = useBackground();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();

  const handleFontChange = async (value: string) => {
    setFontChoice(value);
    try {
      await updateMutation.mutateAsync({ data: { fontChoice: value } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Font aggiornato." });
    } catch {
      toast({ description: "Errore nell'aggiornamento del font.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="w-5 h-5 text-primary" />
          Font
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {FONT_OPTIONS.map(opt => (
          <motion.button
            key={opt.value}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => handleFontChange(opt.value)}
            className={`w-full px-4 py-3 rounded-lg text-left transition-all flex items-center justify-between ${
              fontChoice === opt.value
                ? "bg-primary/15 border border-primary/40 text-primary"
                : "bg-card border border-border hover:border-primary/30 text-foreground"
            }`}
          >
            <span style={{ fontFamily: opt.label }}>{opt.label}</span>
            {fontChoice === opt.value && (
              <span className="text-xs bg-primary/20 px-2 py-0.5 rounded-full">Attivo</span>
            )}
          </motion.button>
        ))}
      </CardContent>
    </Card>
  );
}

function DarknessSettings() {
  const { darkness, setDarkness } = useBackground();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (value: number) => {
    setDarkness(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await updateMutation.mutateAsync({ data: { backgroundDarkness: value } });
        qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      } catch {}
    }, 500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          Oscuramento Sfondo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Chiaro</span>
          <span className="font-mono text-foreground">{darkness}%</span>
          <span>Scuro</span>
        </div>
        <input
          type="range"
          min="0"
          max="90"
          value={darkness}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="rounded-lg overflow-hidden border border-border aspect-[3/1] relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/30" />
          <div className="absolute inset-0 bg-background" style={{ opacity: darkness / 100 }} />
          <div className="absolute inset-0 flex items-center justify-center text-xs text-foreground/70">
            Anteprima oscuramento
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BackgroundSettings() {
  const { backgroundUrl, setBackgroundUrl } = useBackground();
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: settings, refetch } = useGetUserSettings();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();

  const isCustom = settings?.backgroundType === "custom" && settings?.backgroundUrl && !imgError;
  const previewUrl = backgroundUrl || settings?.backgroundUrl;

  const handleFileChange = async (file: File) => {
    setUploading(true);
    setImgError(false);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("api/settings/background", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { url: string };
      setBackgroundUrl(data.url);
      await refetch();
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Sfondo aggiornato con successo." });
    } catch {
      toast({ description: "Errore durante il caricamento.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    try {
      await updateMutation.mutateAsync({ data: { backgroundType: "default", backgroundUrl: null } });
      setBackgroundUrl(null);
      setImgError(false);
      await refetch();
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Sfondo ripristinato." });
    } catch {
      toast({ description: "Errore durante il ripristino.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5 text-primary" />
          Sfondo Personalizzato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCustom && previewUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-border aspect-video group">
            <img
              src={previewUrl}
              alt="Sfondo attuale"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" />
                Cambia
              </Button>
              <Button size="sm" variant="destructive" onClick={handleReset}>
                <X className="w-4 h-4 mr-1" />
                Rimuovi
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center aspect-video text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Image className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nessuno sfondo personalizzato</p>
            <p className="text-xs opacity-60 mt-1">Clicca per selezionare un'immagine</p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileChange(f);
            e.target.value = "";
          }}
        />

        {!isCustom && (
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full"
            variant="outline"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Caricamento...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Scegli dalla libreria foto
              </>
            )}
          </Button>
        )}

        {(imgError || (settings?.backgroundType === "custom" && !settings?.backgroundUrl)) && (
          <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Ripristina sfondo predefinito
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TradingSettings() {
  const { tradingSessions, setTradingSessions, lotDivisor, setLotDivisor } = useBackground();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [localSessions, setLocalSessions] = useState<TradingSessionConfig[]>(tradingSessions);
  const [localDivisor, setLocalDivisor] = useState(String(lotDivisor));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocalSessions(tradingSessions);
  }, [tradingSessions]);

  useEffect(() => {
    setLocalDivisor(String(lotDivisor));
  }, [lotDivisor]);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const saveSessions = (sessions: TradingSessionConfig[]) => {
    setLocalSessions(sessions);
    setTradingSessions(sessions);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await updateMutation.mutateAsync({ data: { tradingSessions: sessions, lotDivisor: Number(localDivisor) || DEFAULT_LOT_DIVISOR } });
        qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      } catch {
        toast({ description: "Errore nel salvataggio.", variant: "destructive" });
      }
    }, 800);
  };

  const handleSessionChange = (idx: number, field: keyof TradingSessionConfig, value: string | boolean) => {
    const updated = localSessions.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    saveSessions(updated);
  };

  const handleDivisorChange = (value: string) => {
    setLocalDivisor(value);
    const num = Number(value);
    if (num >= 1) {
      setLotDivisor(num);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await updateMutation.mutateAsync({ data: { lotDivisor: num, tradingSessions: localSessions } });
          qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
        } catch {
          toast({ description: "Errore nel salvataggio.", variant: "destructive" });
        }
      }, 800);
    }
  };

  const handleReset = async () => {
    setLocalSessions(DEFAULT_TRADING_SESSIONS);
    setTradingSessions(DEFAULT_TRADING_SESSIONS);
    setLocalDivisor(String(DEFAULT_LOT_DIVISOR));
    setLotDivisor(DEFAULT_LOT_DIVISOR);
    try {
      await updateMutation.mutateAsync({ data: { tradingSessions: DEFAULT_TRADING_SESSIONS, lotDivisor: DEFAULT_LOT_DIVISOR } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Impostazioni trading ripristinate." });
    } catch {
      toast({ description: "Errore nel ripristino.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Trading
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sessioni di Trading</h4>
            <p className="text-xs text-muted-foreground mt-1">Tutti gli orari sono impostati in EST (Eastern Standard Time - New York)</p>
          </div>
          {localSessions.map((session, idx) => (
            <div key={session.id} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Input
                  value={session.name}
                  onChange={(e) => handleSessionChange(idx, "name", e.target.value)}
                  className="text-sm font-medium w-40"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Visibile</span>
                  <Switch
                    checked={session.enabled}
                    onCheckedChange={(checked) => handleSessionChange(idx, "enabled", checked)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Apertura (EST)</label>
                  <Input
                    type="time"
                    value={session.openUTC}
                    onChange={(e) => handleSessionChange(idx, "openUTC", e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Chiusura (EST)</label>
                  <Input
                    type="time"
                    value={session.closeUTC}
                    onChange={(e) => handleSessionChange(idx, "closeUTC", e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Divisore Calcolatore Lotti</h4>
          <Input
            type="number"
            min="1"
            value={localDivisor}
            onChange={(e) => handleDivisorChange(e.target.value)}
            className="text-base w-32"
          />
          <p className="text-xs text-muted-foreground">Formula: (Rischio € / Stop Loss pips) / {localDivisor}</p>
        </div>

        <Button variant="outline" className="w-full" onClick={handleReset}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Ripristina valori predefiniti
        </Button>
      </CardContent>
    </Card>
  );
}

function QuotesSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: quotes, isLoading } = useGetQuotes();
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const deleteMutation = useDeleteQuote();
  const [newText, setNewText] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editAuthor, setEditAuthor] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetQuotesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRandomQuoteQueryKey() });
  };

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      await createMutation.mutateAsync({ data: { text: newText.trim(), author: newAuthor.trim() || undefined } });
      setNewText("");
      setNewAuthor("");
      invalidate();
      toast({ description: "Citazione aggiunta." });
    } catch {
      toast({ description: "Errore nell'aggiunta.", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateMutation.mutateAsync({ id, data: { text: editText, author: editAuthor } });
      setEditingId(null);
      invalidate();
      toast({ description: "Citazione aggiornata." });
    } catch {
      toast({ description: "Errore nell'aggiornamento.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      invalidate();
      toast({ description: "Citazione eliminata." });
    } catch {
      toast({ description: "Errore nell'eliminazione.", variant: "destructive" });
    }
  };

  const startEdit = (q: { id: number; text: string; author?: string | null }) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditAuthor(q.author ?? "");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Quote className="w-5 h-5 text-primary" />
          Citazioni Motivazionali
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Aggiungi le tue citazioni preferite. Se non ne aggiungi, verranno mostrate quelle predefinite.
        </p>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <Input placeholder="Citazione" value={newText} onChange={(e) => setNewText(e.target.value)} className="text-sm" />
          <div className="flex gap-2">
            <Input placeholder="Autore" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} className="text-sm flex-1" />
            <Button onClick={handleAdd} disabled={!newText.trim() || createMutation.isPending} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Aggiungi
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-4 flex justify-center">
            <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !quotes || quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">Nessuna citazione personalizzata. Verranno usate quelle predefinite.</p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <div key={q.id} className="rounded-lg border border-border p-3">
                {editingId === q.id ? (
                  <div className="space-y-2">
                    <Input value={editText} onChange={(e) => setEditText(e.target.value)} className="text-sm" />
                    <div className="flex gap-2">
                      <Input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} className="text-sm flex-1" />
                      <Button size="sm" onClick={() => handleUpdate(q.id)} disabled={updateMutation.isPending}>Salva</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Annulla</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm italic truncate">&ldquo;{q.text}&rdquo;</p>
                      {q.author && <p className="text-xs text-muted-foreground mt-0.5">— {q.author}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(q)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(q.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MissionTemplatesSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: templates, isLoading } = useGetMissionTemplates();
  const createMutation = useCreateMissionTemplate();
  const updateMutation = useUpdateMissionTemplate();
  const deleteMutation = useDeleteMissionTemplate();
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newXp, setNewXp] = useState("50");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editXp, setEditXp] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetMissionTemplatesQueryKey() });

  const handleAdd = async () => {
    if (!newTitle.trim() || !newDesc.trim()) return;
    try {
      await createMutation.mutateAsync({ data: { title: newTitle.trim(), description: newDesc.trim(), xpReward: Number(newXp) || 50 } });
      setNewTitle("");
      setNewDesc("");
      setNewXp("50");
      invalidate();
      toast({ description: "Missione aggiunta." });
    } catch {
      toast({ description: "Errore nell'aggiunta.", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateMutation.mutateAsync({ id, data: { title: editTitle, description: editDesc, xpReward: Number(editXp) || 50 } });
      setEditingId(null);
      invalidate();
      toast({ description: "Missione aggiornata." });
    } catch {
      toast({ description: "Errore nell'aggiornamento.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      invalidate();
      toast({ description: "Missione eliminata." });
    } catch {
      toast({ description: "Errore nell'eliminazione.", variant: "destructive" });
    }
  };

  const startEdit = (t: { id: number; title: string; description: string; xpReward: number }) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditDesc(t.description);
    setEditXp(String(t.xpReward));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Missioni Giornaliere
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Personalizza le missioni giornaliere. Se non ne aggiungi, verranno usate quelle predefinite.
        </p>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <Input placeholder="Titolo missione" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="text-sm" />
          <Input placeholder="Descrizione" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="text-sm" />
          <div className="flex gap-2">
            <Input type="number" min="1" placeholder="XP" value={newXp} onChange={(e) => setNewXp(e.target.value)} className="text-sm w-24" />
            <Button onClick={handleAdd} disabled={!newTitle.trim() || !newDesc.trim() || createMutation.isPending} size="sm" className="flex-1">
              <Plus className="w-4 h-4 mr-1" />
              Aggiungi
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-4 flex justify-center">
            <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">Nessuna missione personalizzata. Verranno usate le 5 predefinite.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3">
                {editingId === t.id ? (
                  <div className="space-y-2">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-sm" />
                    <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="text-sm" />
                    <div className="flex gap-2">
                      <Input type="number" min="1" value={editXp} onChange={(e) => setEditXp(e.target.value)} className="text-sm w-24" />
                      <Button size="sm" onClick={() => handleUpdate(t.id)} disabled={updateMutation.isPending}>Salva</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Annulla</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold truncate">{t.title}</h4>
                        <span className="text-xs font-mono text-accent bg-secondary/60 px-1.5 py-0.5 rounded">{t.xpReward} XP</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  const { data: settings, isLoading } = useGetUserSettings();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [reminderTime, setReminderTime] = useState("");
  const [preMacro, setPreMacro] = useState("15");
  const [maxLoss, setMaxLoss] = useState("");

  useEffect(() => {
    if (!settings) return;
    setReminderTime(settings.dailyReminderTime ?? "");
    setPreMacro(String(settings.preMacroMinutes ?? 15));
    setMaxLoss(settings.maxDailyLoss ? String(settings.maxDailyLoss) : "");
  }, [settings]);

  const save = async () => {
    try {
      await updateMutation.mutateAsync({
        data: {
          dailyReminderTime: reminderTime || undefined,
          preMacroMinutes: Number(preMacro),
          maxDailyLoss: maxLoss ? Number(maxLoss) : undefined,
        },
      });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Impostazioni notifiche salvate." });
    } catch {
      toast({ description: "Errore nel salvataggio.", variant: "destructive" });
    }
  };

  const requestPermission = () => {
    if (!("Notification" in window)) {
      toast({ description: "Le notifiche non sono supportate da questo browser.", variant: "destructive" });
      return;
    }
    Notification.requestPermission().then((p) => {
      if (p === "granted") toast({ description: "Notifiche attivate." });
      else toast({ description: "Permesso notifiche negato.", variant: "destructive" });
    });
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notifiche e Promemoria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Orario promemoria giornaliero</p>
          <p className="text-xs text-muted-foreground">Ricevi ogni giorno una notifica con il riepilogo delle missioni.</p>
          <Input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Anticipo alert eventi macro (minuti)</p>
          <p className="text-xs text-muted-foreground">Quanto prima ricevere la notifica per eventi ad alto impatto.</p>
          <div className="flex gap-2">
            {["5", "10", "15", "30"].map((v) => (
              <button
                key={v}
                onClick={() => setPreMacro(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  preMacro === v
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {v} min
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            Max loss giornaliero (€)
          </p>
          <p className="text-xs text-muted-foreground">Ricevi un avviso alla sessione se hai impostato un limite.</p>
          <Input
            type="number"
            min="0"
            placeholder="es. 200"
            value={maxLoss}
            onChange={(e) => setMaxLoss(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={save} disabled={updateMutation.isPending}>
            Salva
          </Button>
          <Button size="sm" variant="outline" onClick={requestPermission}>
            <Bell className="w-4 h-4 mr-1.5" />
            Attiva notifiche browser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PinSettings() {
  const { isPinSet, setPin, removePin, unlock } = usePinLock();
  const { toast } = useToast();
  const [mode, setMode] = useState<"idle" | "set" | "change-old" | "change-new">("idle");
  const [pin, setLocalPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [error, setError] = useState("");

  const handleReset = () => {
    setMode("idle");
    setLocalPin("");
    setConfirm("");
    setOldPin("");
    setError("");
  };

  const handleSet = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("Il PIN deve essere di 4 cifre numeriche");
      return;
    }
    if (pin !== confirm) {
      setError("I PIN non coincidono");
      return;
    }
    await setPin(pin);
    toast({ title: "PIN impostato", description: "L'app è ora protetta da PIN." });
    handleReset();
  };

  const handleVerifyOld = async () => {
    const ok = await unlock(oldPin);
    if (!ok) {
      setError("PIN corrente non corretto");
      return;
    }
    setMode("change-new");
    setOldPin("");
    setError("");
  };

  const handleChangeNew = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { setError("Il PIN deve essere di 4 cifre"); return; }
    if (pin !== confirm) { setError("I PIN non coincidono"); return; }
    await setPin(pin);
    toast({ title: "PIN aggiornato" });
    handleReset();
  };

  const handleRemove = () => {
    removePin();
    toast({ title: "PIN rimosso", description: "L'app non richiede più autenticazione." });
    handleReset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPinSet ? "bg-primary/15 border border-primary/40" : "bg-secondary border border-border"}`}>
            <Shield className={`w-5 h-5 ${isPinSet ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold">{isPinSet ? "PIN attivo" : "PIN non impostato"}</p>
            <p className="text-xs text-muted-foreground">{isPinSet ? "L'app richiede PIN ad ogni avvio" : "Nessuna protezione PIN"}</p>
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${isPinSet ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
      </div>

      {mode === "idle" && (
        <div className="grid grid-cols-1 gap-2">
          {!isPinSet ? (
            <Button onClick={() => setMode("set")} className="w-full justify-start gap-3" variant="outline">
              <KeyRound className="w-4 h-4 text-primary" /> Imposta PIN
            </Button>
          ) : (
            <>
              <Button onClick={() => setMode("change-old")} className="w-full justify-start gap-3" variant="outline">
                <KeyRound className="w-4 h-4 text-primary" /> Cambia PIN
              </Button>
              <Button onClick={handleRemove} className="w-full justify-start gap-3 text-destructive border-destructive/30 hover:bg-destructive/10" variant="outline">
                <X className="w-4 h-4" /> Rimuovi PIN
              </Button>
            </>
          )}
        </div>
      )}

      {mode === "change-old" && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">PIN attuale</label>
            <Input type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={oldPin} onChange={(e) => { setOldPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} className="font-mono text-center tracking-[0.5em] text-lg" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleVerifyOld} className="flex-1" disabled={oldPin.length < 4}>
              <ChevronRight className="w-4 h-4 mr-2" /> Avanti
            </Button>
            <Button variant="outline" onClick={handleReset} className="flex-1">Annulla</Button>
          </div>
        </div>
      )}

      {(mode === "set" || mode === "change-new") && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nuovo PIN (4 cifre)</label>
            <Input type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={pin} onChange={(e) => { setLocalPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} className="font-mono text-center tracking-[0.5em] text-lg" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Conferma PIN</label>
            <Input type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={confirm} onChange={(e) => { setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} className="font-mono text-center tracking-[0.5em] text-lg" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={mode === "set" ? handleSet : handleChangeNew} className="flex-1" disabled={pin.length < 4 || confirm.length < 4}>
              <Check className="w-4 h-4 mr-2" /> Conferma
            </Button>
            <Button variant="outline" onClick={handleReset} className="flex-1">Annulla</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LanguageSettings() {
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    toast({ title: `Lingua impostata: ${LANGUAGES[lang].name}` });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Seleziona la lingua dell'interfaccia</p>
      <div className="grid grid-cols-1 gap-2">
        {(Object.entries(LANGUAGES) as [Language, typeof LANGUAGES[Language]][]).map(([code, lang]) => (
          <button
            key={code}
            onClick={() => handleSelect(code)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
              language === code
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/40 hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{lang.flag}</span>
              <div>
                <p className="text-sm font-medium">{lang.name}</p>
                <p className="text-xs text-muted-foreground">{lang.label}</p>
              </div>
            </div>
            {language === code && <Check className="w-4 h-4 text-primary" />}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center pt-1">
        La traduzione completa è in fase di sviluppo
      </p>
    </div>
  );
}

function ChecklistSettings() {
  const { data: items, isLoading } = useGetChecklist();
  const [newText, setNewText] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const createMutation = useCreateChecklistItem();
  const deleteMutation = useDeleteChecklistItem();

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      await createMutation.mutateAsync({ data: { text: newText.trim(), completed: false } });
      setNewText("");
      qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
      toast({ title: "Elemento aggiunto" });
    } catch {
      toast({ description: "Errore", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
    } catch {
      toast({ description: "Errore", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">Aggiungi elemento</label>
        <div className="flex gap-2">
          <Input
            placeholder="Es. Analizza timeframe superiore..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!newText.trim()} size="sm">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-4">Caricamento...</div>
      ) : items && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border group hover:bg-secondary/50 transition-colors"
            >
              <p className="text-sm text-muted-foreground">{item.text}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <p>Nessun elemento nella checklist</p>
          <p className="text-xs mt-1">Aggiungine uno per iniziare</p>
        </div>
      )}
    </div>
  );
}

function AuthSection({ login }: { login: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="w-5 h-5 text-primary" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Hai già un account? Accedi per sincronizzare i tuoi dati. Sei nuovo? Registrati per iniziare.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={login} className="w-full">
            <LogIn className="w-4 h-4 mr-2" />
            Accedi
          </Button>
          <Button onClick={login} variant="outline" className="w-full">
            <UserPlus className="w-4 h-4 mr-2" />
            Registrati
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type TileId = "profilo" | "audio" | "aspetto" | "notifiche" | "sicurezza" | "lingua" | "trading" | "missioni" | "citazioni" | "checklist" | "account";

interface SettingsTile {
  id: TileId;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  color: string;
  glow: string;
}

export default function Settings() {
  const { isAuthenticated, isLoading, login, logout } = useAuth();
  const { isPinSet } = usePinLock();
  const { language } = useLanguage();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    audio: false,
    aspetto: false,
    notifiche: false,
    sicurezza: false,
    lingua: false,
    trading: false,
    missioni: false,
    citazioni: false,
    checklist: false,
    account: false,
  });

  const tiles: SettingsTile[] = [
    { id: "profilo", icon: <UserPlus className="w-6 h-6" />, label: "Profilo", subtitle: "Nome, avatar, XP", color: "text-primary", glow: "group-hover:shadow-primary/20" },
    { id: "audio", icon: <Music className="w-6 h-6" />, label: "Audio", subtitle: "Binaural & focus", color: "text-blue-400", glow: "group-hover:shadow-blue-400/20" },
    { id: "aspetto", icon: <Sun className="w-6 h-6" />, label: "Aspetto", subtitle: "Sfondo, font, tema", color: "text-yellow-400", glow: "group-hover:shadow-yellow-400/20" },
    { id: "notifiche", icon: <Bell className="w-6 h-6" />, label: "Notifiche", subtitle: "Allarmi & reminder", color: "text-orange-400", glow: "group-hover:shadow-orange-400/20" },
    { id: "sicurezza", icon: <Lock className="w-6 h-6" />, label: "Sicurezza", subtitle: isPinSet ? "PIN attivo 🟢" : "PIN non impostato", color: "text-emerald-400", glow: "group-hover:shadow-emerald-400/20" },
    { id: "lingua", icon: <Globe className="w-6 h-6" />, label: "Lingua", subtitle: `${LANGUAGES[language].flag} ${LANGUAGES[language].name}`, color: "text-cyan-400", glow: "group-hover:shadow-cyan-400/20" },
    { id: "trading", icon: <TrendingUp className="w-6 h-6" />, label: "Trading", subtitle: "Sessioni & risk", color: "text-violet-400", glow: "group-hover:shadow-violet-400/20" },
    { id: "missioni", icon: <Target className="w-6 h-6" />, label: "Missioni", subtitle: "Template & abitudini", color: "text-rose-400", glow: "group-hover:shadow-rose-400/20" },
    { id: "citazioni", icon: <Quote className="w-6 h-6" />, label: "Citazioni", subtitle: "Frasi motivazionali", color: "text-amber-400", glow: "group-hover:shadow-amber-400/20" },
    { id: "checklist", icon: <CheckSquare className="w-6 h-6" />, label: "Checklist", subtitle: "Routine pre-trade", color: "text-teal-400", glow: "group-hover:shadow-teal-400/20" },
    { id: "account", icon: isAuthenticated ? <LogOut className="w-6 h-6" /> : <LogIn className="w-6 h-6" />, label: "Account", subtitle: isAuthenticated ? "Accesso attivo" : "Accedi o registrati", color: "text-slate-400", glow: "group-hover:shadow-slate-400/20" },
  ];
  
  const collapsibleSections = tiles.filter(t => t.id !== "profilo");

  const tileContent: Record<TileId, React.ReactNode> = {
    profilo: <ProfileWidget />,
    audio: <AudioPlayer />,
    aspetto: (
      <div className="space-y-6">
        <FontSettings />
        <DarknessSettings />
        <BackgroundPresetsManager />
        <BackgroundSettings />
      </div>
    ),
    notifiche: <NotificationSettings />,
    sicurezza: <PinSettings />,
    lingua: <LanguageSettings />,
    trading: <TradingSettings />,
    missioni: <MissionTemplatesSettings />,
    citazioni: <QuotesSettings />,
    checklist: <ChecklistSettings />,
    account: isAuthenticated ? (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Sei attualmente autenticato. Puoi uscire dal tuo account in qualsiasi momento.</p>
        <Button onClick={logout} variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10">
          <LogOut className="w-4 h-4 mr-2" /> Esci
        </Button>
      </div>
    ) : (
      !isLoading ? <AuthSection login={login} /> : <p className="text-sm text-muted-foreground">Caricamento...</p>
    ),
  };

  return (
    <PageLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Profilo - Always Open */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="text-primary"><UserPlus className="w-6 h-6" /></div>
            <div>
              <h2 className="text-lg font-bold">Profilo</h2>
              <p className="text-xs text-muted-foreground">Nome, avatar, XP</p>
            </div>
          </div>
          <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-5 sm:p-6">
            <ProfileWidget />
          </div>
        </motion.div>

        {/* Collapsible Sections */}
        {collapsibleSections.map((tile, i) => (
          <motion.div
            key={tile.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (i + 1) * 0.05 }}
            className="space-y-2"
          >
            <button
              onClick={() => setOpenSections(prev => ({ ...prev, [tile.id]: !prev[tile.id] }))}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card/60 backdrop-blur-sm hover:border-primary/30 hover:bg-card transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className={`${tile.color} transition-transform duration-200 group-hover:scale-110`}>
                  {tile.icon}
                </div>
                <div className="text-left">
                  <h2 className="text-base font-bold">{tile.label}</h2>
                  <p className="text-xs text-muted-foreground">{tile.subtitle}</p>
                </div>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                  openSections[tile.id] ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {openSections[tile.id] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-5 sm:p-6">
                    {tileContent[tile.id]}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </PageLayout>
  );
}
