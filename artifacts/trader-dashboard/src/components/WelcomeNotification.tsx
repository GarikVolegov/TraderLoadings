import { useEffect, useRef } from "react";
import { useGetMissions, useGetChecklist } from "@workspace/api-client-react";
import { useLoading } from "@/contexts/LoadingContext";

export function WelcomeNotification() {
  const { isLoading } = useLoading();
  const firedRef = useRef(false);
  const { data: missions } = useGetMissions();
  const { data: checklist } = useGetChecklist();

  useEffect(() => {
    if (isLoading || firedRef.current) return;
    if (!missions || !checklist) return;
    firedRef.current = true;

    if (!("Notification" in window)) return;

    const fire = () => {
      if (Notification.permission !== "granted") return;

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

      new Notification("TraderLoading", {
        body: lines.join("\n"),
        icon: "/favicon.ico",
        tag: "welcome-summary",
      });
    };

    if (Notification.permission === "default") {
      Notification.requestPermission().then(fire);
    } else {
      fire();
    }
  }, [isLoading, missions, checklist]);

  return null;
}
