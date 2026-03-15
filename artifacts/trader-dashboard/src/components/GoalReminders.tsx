import { useEffect, useRef } from "react";
import { useGetIdeas } from "@workspace/api-client-react";

export function GoalReminders() {
  const { data: ideas } = useGetIdeas();
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!ideas) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const goals = ideas.filter((i) => i.type === "goal" && !i.completed && i.reminderTime);

    const now = new Date();
    for (const goal of goals) {
      const [h, m] = goal.reminderTime!.split(":").map(Number);
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      const delay = target.getTime() - now.getTime();
      if (delay <= 0) continue;

      const timer = setTimeout(() => {
        new Notification("Promemoria Obiettivo", {
          body: goal.content,
          icon: "/favicon.ico",
          tag: `goal-reminder-${goal.id}`,
        });
      }, delay);
      timersRef.current.push(timer);
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [ideas]);

  return null;
}
