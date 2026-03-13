import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { ProfileWidget } from "@/components/ProfileWidget";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image, Upload, X, LogIn, LogOut, RefreshCw, Type, Sun } from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { useGetUserSettings, useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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

function AuthSection() {
  const handleLogin = () => {
    window.location.href = `api/login?returnTo=${encodeURIComponent(window.location.origin + import.meta.env.BASE_URL)}`;
  };
  const handleLogout = () => {
    window.location.href = `api/logout`;
  };

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
          Accedi per mantenere i dati sincronizzati e restare collegato su questo dispositivo.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleLogin} className="flex-1">
            <LogIn className="w-4 h-4 mr-2" />
            Accedi
          </Button>
          <Button onClick={handleLogout} variant="outline" className="flex-1">
            <LogOut className="w-4 h-4 mr-2" />
            Esci
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  return (
    <PageLayout>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <ProfileWidget />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <AuthSection />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <AudioPlayer />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <FontSettings />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <DarknessSettings />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <BackgroundSettings />
        </motion.div>
      </div>
    </PageLayout>
  );
}
