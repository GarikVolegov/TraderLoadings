import { useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { CheckCircle2, Circle, Target, Zap, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMissions, useCompleteMission, getGetMissionsQueryKey, getGetProfileQueryKey } from "@workspace/api-client-react";

export function MissionsWidget() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: missions, isLoading } = useGetMissions();

  const completeMutation = useCompleteMission({
    mutation: {
      onSuccess: (data) => {
        // Invalidate to refresh lists
        queryClient.invalidateQueries({ queryKey: getGetMissionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        
        toast({
          title: "Missione Completata!",
          description: `Hai guadagnato ${data.mission.xpReward} XP.`,
          className: "bg-card border-primary text-foreground",
        });

        if (data.levelUp) {
          fireConfetti();
          toast({
            title: "🎉 LIVELLO SUPERATO! 🎉",
            description: `Complimenti! Hai raggiunto il livello ${data.profile.level}.`,
            className: "bg-primary text-primary-foreground border-none shadow-[0_0_30px_rgba(34,197,94,0.5)] font-bold",
            duration: 6000,
          });
        }
      }
    }
  });

  const fireConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#22c55e', '#3b82f6', '#10b981']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#22c55e', '#3b82f6', '#10b981']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const handleComplete = (id: number) => {
    completeMutation.mutate({ id });
  };

  const totalEarnedXp = missions 
    ? missions.filter(m => m.completed).reduce((sum, m) => sum + m.xpReward, 0)
    : 0;

  return (
    <Card className="h-full relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50 bg-secondary/10">
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-accent" />
          Missioni Giornaliere
        </CardTitle>
        <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary font-mono">+{totalEarnedXp} XP Oggi</span>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !missions || missions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-medium">
            Nessuna missione disponibile oggi.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {missions.map((mission, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={mission.id} 
                className={`p-4 md:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-colors hover:bg-secondary/20 ${mission.completed ? 'opacity-60 grayscale' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {mission.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h4 className={`text-lg font-semibold ${mission.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {mission.title}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                      {mission.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-end sm:justify-start">
                  <div className="flex items-center justify-center bg-secondary/80 border border-border px-3 py-1 rounded-md font-mono text-sm font-bold text-accent">
                    {mission.xpReward} XP
                  </div>
                  
                  {!mission.completed && (
                    <Button 
                      size="sm"
                      onClick={() => handleComplete(mission.id)}
                      disabled={completeMutation.isPending}
                      className="group"
                    >
                      Completa
                      <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
