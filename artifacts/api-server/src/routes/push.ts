import { Router, type IRouter } from "express";
import webpush from "web-push";
import { db, pushSubscriptionsTable, userSettingsTable, profileTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { getUserId, getOrCreateProfile } from "./profile.js";

const router: IRouter = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@traderloading.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface NotificationPrefs {
  sessions: boolean;
  messages: boolean;
  social: boolean;
  goals: boolean;
  dailyReminder: boolean;
  macroEvents: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  sessions: true,
  messages: true,
  social: true,
  goals: true,
  dailyReminder: true,
  macroEvents: true,
};

function parsePrefs(raw: string | null): NotificationPrefs {
  if (!raw) return { ...DEFAULT_NOTIF_PREFS };
  try {
    return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIF_PREFS };
  }
}

async function getUserPrefs(userId: string | null): Promise<NotificationPrefs> {
  const where = userId ? eq(userSettingsTable.userId, userId) : isNull(userSettingsTable.userId);
  const [settings] = await db.select({ notificationPrefs: userSettingsTable.notificationPrefs })
    .from(userSettingsTable).where(where).limit(1);
  return parsePrefs(settings?.notificationPrefs ?? null);
}

export async function sendPushToUser(
  targetUserId: string | null,
  payload: { title: string; body: string; tag?: string; data?: Record<string, unknown> },
  prefKey?: keyof NotificationPrefs
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  if (prefKey) {
    const prefs = await getUserPrefs(targetUserId);
    if (!prefs[prefKey]) return;
  }

  const where = targetUserId
    ? eq(pushSubscriptionsTable.userId, targetUserId)
    : isNull(pushSubscriptionsTable.userId);

  const subs = await db.select().from(pushSubscriptionsTable).where(where);
  if (subs.length === 0) return;

  const pushPayload = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.id, sub.id));
        }
      }
    })
  );
}

router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY || null });
});

router.post("/push/subscribe", async (req, res) => {
  const userId = getUserId(req);
  const { endpoint, keys } = req.body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "endpoint e keys richiesti" });
    return;
  }

  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { userId, p256dh: keys.p256dh, auth: keys.auth },
      });

    res.json({ ok: true });
  } catch (err) {
    console.error("push/subscribe error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/push/unsubscribe", async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    res.status(400).json({ error: "endpoint richiesto" });
    return;
  }
  await db.delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));
  res.json({ ok: true });
});

router.get("/push/preferences", async (req, res) => {
  const userId = getUserId(req);
  const prefs = await getUserPrefs(userId);
  res.json(prefs);
});

router.put("/push/preferences", async (req, res) => {
  const userId = getUserId(req);
  const incoming = req.body as Partial<NotificationPrefs>;
  const current = await getUserPrefs(userId);
  const merged: NotificationPrefs = { ...current, ...incoming };

  const where = userId ? eq(userSettingsTable.userId, userId) : isNull(userSettingsTable.userId);
  const [existing] = await db.select({ id: userSettingsTable.id }).from(userSettingsTable).where(where).limit(1);

  if (existing) {
    await db.update(userSettingsTable)
      .set({ notificationPrefs: JSON.stringify(merged) })
      .where(eq(userSettingsTable.id, existing.id));
  } else {
    await db.insert(userSettingsTable)
      .values({ userId, notificationPrefs: JSON.stringify(merged), backgroundType: "default", fontChoice: "inter", backgroundDarkness: 60 });
  }

  res.json(merged);
});

export default router;
