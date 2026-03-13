import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { ProfileWidget } from "@/components/ProfileWidget";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image, Upload, X, LogIn, LogOut } from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { useGetUserSettings, useUpdateUserSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function BackgroundSettings() {
  const { backgroundUrl, setBackgroundUrl } = useBackground();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: settings } = useGetUserSettings();
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${import.meta.env.BASE_URL}api/settings/background`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json();
      if (data.url) {
        setBackgroundUrl(data.url);
        qc.invalidateQueries({ queryKey: ["getUserSettings"] });
        toast({ description: "Sfondo aggiornato." });
      }
    } catch {
      toast({ description: "Errore durante il caricamento.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    await updateMutation.mutateAsync({ data: { backgroundType: "default" } });
    setBackgroundUrl(null);
    qc.invalidateQueries({ queryKey: ["getUserSettings"] });
    toast({ description: "Sfondo ripristinato." });
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
        {backgroundUrl || settings?.backgroundType === "custom" ? (
          <div className="relative rounded-xl overflow-hidden border border-border aspect-video">
            <img
              src={backgroundUrl || settings?.backgroundUrl || ""}
              alt="Sfondo attuale"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Button variant="destructive" size="sm" onClick={handleReset}>
                <X className="w-4 h-4 mr-1" />
                Rimuovi
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-border flex items-center justify-center aspect-video text-muted-foreground">
            <div className="text-center">
              <Image className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nessuno sfondo personalizzato</p>
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />

        <Button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full"
          variant="outline"
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "Caricamento..." : "Scegli dalla libreria foto"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AuthSection() {
  const handleLogin = () => {
    window.location.href = `${import.meta.env.BASE_URL}api/login?returnTo=${encodeURIComponent(import.meta.env.BASE_URL)}`;
  };
  const handleLogout = () => {
    window.location.href = `${import.meta.env.BASE_URL}api/logout`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="w-5 h-5 text-primary" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Accedi per sincronizzare i tuoi dati e restare collegato su questo dispositivo.
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <ProfileWidget />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <AuthSection />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <AudioPlayer />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <BackgroundSettings />
        </motion.div>
      </div>
    </PageLayout>
  );
}
