import { useEffect, useRef } from "react";
import { useGetMissions, useGetChecklist } from "@workspace/api-client-react";
import { useLoading } from "@/contexts/LoadingContext";
import { useToast } from "@/hooks/use-toast";

export function WelcomeNotification() {
  const { isLoading } = useLoading();
  const firedRef = useRef(false);
  const { data: missions } = useGetMissions();
  const { data: checklist } = useGetChecklist();
  const { toast } = useToast();

  useEffect(() => {
    if (isLoading || firedRef.current) return;
    if (!missions || !checklist) return;
    firedRef.current = true;

    const totalMissions = missions.length;
    const doneMissions = missions.filter((m) => m.completed).length;
    const pendingMissions = totalMissions - doneMissions;

    const totalChecklist = checklist.length;
    const doneChecklist = checklist.filter((c) => c.completed).length;

    const lines: string[] = [];
    if (totalMissions > 0) {
      lines.push(
        pendingMissions === 0
          ? `Missioni: ${doneMissions}/${totalMissions} completate`
          : `Missioni: ${pendingMissions} da completare (${doneMissions}/${totalMissions})`
      );
    }
    if (totalChecklist > 0) {
      lines.push(`Checklist: ${doneChecklist}/${totalChecklist}`);
    }

    if (lines.length === 0) return;

    const summary = lines.join(" | ");

    const showBrowserNotification = () => {
      new Notification("TraderLoading", {
        body: lines.join("\n"),
        icon: "/favicon.ico",
        tag: "welcome-summary",
      });
    };

    const showToast = () => {
      toast({
        title: "Riepilogo di oggi",
        description: summary,
        duration: 6000,
      });
    };

    if (!("Notification" in window)) {
      showToast();
      return;
    }

    if (Notification.permission === "granted") {
      showBrowserNotification();
    } else if (Notification.permission === "default") {
      showToast();
      toast({
        title: "Attiva le notifiche",
        description:
          "Consenti le notifiche del browser per ricevere promemoria sui tuoi obiettivi e aggiornamenti sulle sessioni di trading.",
        duration: 8000,
      });
      setTimeout(() => {
        Notification.requestPermission();
      }, 2000);
    } else {
      showToast();
    }
  }, [isLoading, missions, checklist, toast]);

  return null;
}
