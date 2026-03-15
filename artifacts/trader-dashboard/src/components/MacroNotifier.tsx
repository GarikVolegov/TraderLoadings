import { useEffect, useRef } from "react";
import { useGetEconomicCalendar, useGetUserSettings } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function MacroNotifier() {
  const { data: settings } = useGetUserSettings();
  const { data: events } = useGetEconomicCalendar();
  const { toast } = useToast();
  const firedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!events || !settings || firedRef.current) return;

    const today = new Date().toISOString().slice(0, 10);
    const highToday = events.filter(
      (e) => e.impact === "High" && e.date && e.date.startsWith(today)
    );

    if (highToday.length === 0) return;

    const preMins = settings.preMacroMinutes ?? 15;
    const notifTime = new Date(Date.now() + preMins * 60_000);
    const delay = notifTime.getTime() - Date.now();

    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      const names = highToday.map((e) => `${e.country}: ${e.title}`).join(", ");
      const body = `${highToday.length} event${highToday.length > 1 ? "i" : "o"} ad alto impatto oggi: ${names}`;

      const canNotify = "Notification" in window && Notification.permission === "granted";
      if (canNotify) {
        new Notification("📅 Evento macro – Attenzione", {
          body,
          icon: "/favicon.ico",
          tag: "macro-daily",
        });
      } else {
        toast({
          title: "📅 Evento macro – Attenzione",
          description: body,
          duration: 10000,
        });
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [events, settings, toast]);

  return null;
}
