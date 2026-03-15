import { useEffect, useRef } from "react";
import { useGetUserSettings, useGetMissions } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function DailyAlarmNotifier() {
  const { data: settings } = useGetUserSettings();
  const { data: missions } = useGetMissions();
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedTodayRef = useRef<string | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!settings?.dailyReminderTime) return;

    const [h, m] = settings.dailyReminderTime.split(":").map(Number);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    const delay = target.getTime() - now.getTime();
    if (delay <= 0 || firedTodayRef.current === today) return;

    timerRef.current = setTimeout(() => {
      firedTodayRef.current = today;

      const pending = missions?.filter((ms) => !ms.completed).length ?? 0;
      const total = missions?.length ?? 0;
      const body = total > 0
        ? `Missioni oggi: ${pending} da completare su ${total}.`
        : "Inizia le tue missioni di oggi!";

      const fireNotif = () => {
        new Notification("⏰ Promemoria giornaliero", {
          body,
          icon: "/favicon.ico",
          tag: "daily-alarm",
        });
      };

      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          fireNotif();
        } else {
          toast({ title: "⏰ Promemoria giornaliero", description: body, duration: 8000 });
        }
      } else {
        toast({ title: "⏰ Promemoria giornaliero", description: body, duration: 8000 });
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [settings?.dailyReminderTime, missions, toast]);

  return null;
}
