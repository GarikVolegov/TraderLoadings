import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trophy, Edit2, Hexagon, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";

export function ProfileWidget() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetProfile();
  
  const updateProfileMutation = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        setIsEditModalOpen(false);
      }
    }
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");

  const handleOpenEdit = () => {
    if (profile) {
      setEditName(profile.name);
      setEditAvatarUrl(profile.avatarUrl || "");
      setIsEditModalOpen(true);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      data: {
        name: editName,
        avatarUrl: editAvatarUrl || null
      }
    });
  };

  if (isLoading || !profile) {
    return (
      <Card className="h-full animate-pulse">
        <CardContent className="p-8 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-secondary/50" />
        </CardContent>
      </Card>
    );
  }

  const progressPercentage = Math.min(100, (profile.xp / profile.xpToNextLevel) * 100);

  return (
    <>
      <Card className="h-full relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
        
        <CardContent className="p-6 md:p-8 relative z-10 flex flex-col h-full justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
                <div className="w-20 h-20 rounded-full border-2 border-primary/50 overflow-hidden relative z-10 bg-secondary">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <img src={`${import.meta.env.BASE_URL}images/avatar-default.png`} alt="Default avatar" className="w-full h-full object-cover opacity-80" />
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-background border border-primary text-primary text-xs font-bold w-8 h-8 flex items-center justify-center rounded-full z-20 shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                  {profile.level}
                </div>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-foreground font-mono flex items-center gap-2">
                  {profile.name}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={handleOpenEdit}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-primary font-medium">
                  <Star className="w-4 h-4 fill-primary" />
                  Trader Livello {profile.level}
                </div>
              </div>
            </div>
            
            <div className="hidden md:flex flex-col items-end">
              <Trophy className="w-8 h-8 text-accent/40 mb-2" />
            </div>
          </div>
          
          <div className="mt-8 space-y-3">
            <div className="flex justify-between items-end text-sm">
              <span className="font-medium text-muted-foreground flex items-center gap-1">
                <Hexagon className="w-4 h-4" /> Esperienza (XP)
              </span>
              <span className="font-mono font-bold">
                <span className="text-primary">{profile.xp}</span> 
                <span className="text-muted-foreground"> / {profile.xpToNextLevel}</span>
              </span>
            </div>
            
            <div className="h-3 w-full bg-secondary/80 rounded-full overflow-hidden border border-border shadow-inner">
              <motion.div 
                className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full relative"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                <div className="absolute top-0 right-0 bottom-0 w-20 bg-white/20 blur-sm -skew-x-12 animate-[shimmer_2s_infinite]" />
              </motion.div>
            </div>
            <p className="text-xs text-muted-foreground text-right font-mono">
              {profile.xpToNextLevel - profile.xp} XP al prossimo livello
            </p>
          </div>
        </CardContent>
      </Card>

      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => !updateProfileMutation.isPending && setIsEditModalOpen(false)}
        title="Modifica Profilo"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome Trader</label>
            <Input 
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Il tuo nome"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Avatar URL (opzionale)</label>
            <Input 
              value={editAvatarUrl}
              onChange={(e) => setEditAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={updateProfileMutation.isPending}>
              Annulla
            </Button>
            <Button type="submit" isLoading={updateProfileMutation.isPending}>
              Salva Modifiche
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
