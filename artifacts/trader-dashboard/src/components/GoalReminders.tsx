import { useEffect, useRef } from "react";
import { useGetIdeas } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function GoalReminders() {
  const { data: ideas } = useGetIdeas();
  const { toast } = useToast();
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!ideas) return;

    const goals = ideas.filter((i) => i.type === "goal" && !i.completed && i.reminderTime);
    const canNotify = "Notification" in window && Notification.permission === "granted";

    const now = new Date();
    for (const goal of goals) {
      const [h, m] = goal.reminderTime!.split(":").map(Number);
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      const delay = target.getTime() - now.getTime();
      if (delay <= 0) continue;

      const timer = setTimeout(() => {
        if (canNotify) {
          new Notification("Promemoria Obiettivo", {
            body: goal.content,
            icon: "/favicon.ico",
            tag: `goal-reminder-${goal.id}`,
          });
        } else {
          toast({
            title: "Promemoria Obiettivo",
            description: goal.content,
            duration: 8000,
          });
        }
      }, delay);
      timersRef.current.push(timer);
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [ideas, toast]);

  return null;
}
