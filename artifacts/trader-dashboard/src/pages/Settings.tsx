import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { ProfileWidget } from "@/components/ProfileWidget";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BackgroundPresetsManager } from "@/components/BackgroundPresetsManager";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Image, Upload, X, LogIn, LogOut, UserPlus, RefreshCw, Type, Sun, TrendingUp, Target, Plus, Pencil, Trash2, Quote } from "lucide-react";
import { useBackground, DEFAULT_TRADING_SESSIONS, DEFAULT_LOT_DIVISOR, type TradingSessionConfig } from "@/contexts/BackgroundContext";
import { useGetUserSettings, useUpdateUserSettings, getGetUserSettingsQueryKey, useGetMissionTemplates, useCreateMissionTemplate, useUpdateMissionTemplate, useDeleteMissionTemplate, getGetMissionTemplatesQueryKey, useGetQuotes, useCreateQuote, useUpdateQuote, useDeleteQuote, getGetQuotesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@workspace/replit-auth-web";

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
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sessioni di Trading</h4>
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
                  <label className="text-xs text-muted-foreground block mb-1">Apertura (UTC)</label>
                  <Input
                    type="time"
                    value={session.openUTC}
                    onChange={(e) => handleSessionChange(idx, "openUTC", e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Chiusura (UTC)</label>
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

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetQuotesQueryKey() });

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      await createMutation.mutateAsync({ data: { text: newText.trim(), author: newAuthor.trim() || "Anonimo" } });
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

  const startEdit = (q: { id: number; text: string; author: string }) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditAuthor(q.author);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Quote className="w-5 h-5 text-primary" />
          Citazioni Trading
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
                      <p className="text-sm italic truncate">"{q.text}"</p>
                      <p className="text-xs text-muted-foreground mt-0.5">— {q.author}</p>
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

export default function Settings() {
  const { isAuthenticated, isLoading, login, logout } = useAuth();

  return (
    <PageLayout>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <ProfileWidget />
        </motion.div>

        {!isAuthenticated && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <AuthSection login={login} />
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <AudioPlayer />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <FontSettings />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <DarknessSettings />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
          <BackgroundPresetsManager />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <BackgroundSettings />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="lg:col-span-2">
          <TradingSettings />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
          <MissionTemplatesSettings />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.41 }}>
          <QuotesSettings />
        </motion.div>
      </div>

      {isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4 sm:mt-8"
        >
          <Button
            onClick={logout}
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Esci
          </Button>
        </motion.div>
      )}
    </PageLayout>
  );
}
