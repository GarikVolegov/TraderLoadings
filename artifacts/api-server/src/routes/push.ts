import { Router, type IRouter } from "express";
import webpush from "web-push";
import { db, pushSubscriptionsTable, userSettingsTable } from "@workspace/db";
import { eq, isNull, sql } from "drizzle-orm";
import { getUserId } from "./profile.js";

const router: IRouter = Router();

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_EMAIL       = process.env.VAPID_EMAIL || "mailto:noreply@traderloading.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface TradingSessionConfig {
  name: string;
  openUTC: string;
  closeUTC: string;
  enabled: boolean;
}

// ─── Disciplinary quotes (Italian) ───────────────────────────────────────────

const SESSION_QUOTES = [
  "La disciplina batte il talento quando il talento non è disciplinato.",
  "Ogni sessione è un'opportunità — non sprecarne nemmeno una.",
  "Il mercato premia chi rispetta il piano. Segui il tuo.",
  "Controlla il rischio prima ancora di pensare al profitto.",
  "Un trader di successo non insegue il mercato: lo attende.",
  "La pazienza è il tuo capitale più prezioso. Usala bene.",
  "Non è la singola operazione che fa la differenza — è la coerenza.",
  "Opera solo secondo le tue regole. Il mercato ha già le sue.",
  "La mente calma è il tuo vantaggio competitivo più grande.",
  "Ogni errore gestito bene è una lezione che vale oro.",
  "Il piano di trading esiste per essere rispettato, non ignorato.",
  "Proteggi il capitale prima di tutto. Il profitto viene dopo.",
  "Sii presente, concentrato e paziente: il setup giusto arriverà.",
  "La gestione del rischio non è un'opzione — è la sopravvivenza.",
  "I migliori trader vincono perdendo poco e incassando il giusto.",
];

function randomQuote(): string {
  return SESSION_QUOTES[Math.floor(Math.random() * SESSION_QUOTES.length)];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePrefs(raw: string | null): NotificationPrefs {
  if (!raw) return { ...DEFAULT_NOTIF_PREFS };
  try { return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) }; }
  catch { return { ...DEFAULT_NOTIF_PREFS }; }
}

async function getUserPrefs(userId: string | null): Promise<NotificationPrefs> {
  const where = userId ? eq(userSettingsTable.userId, userId) : isNull(userSettingsTable.userId);
  const [settings] = await db
    .select({ notificationPrefs: userSettingsTable.notificationPrefs })
    .from(userSettingsTable).where(where).limit(1);
  return parsePrefs(settings?.notificationPrefs ?? null);
}

// ─── Core push sender ─────────────────────────────────────────────────────────

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

// ─── Session open scheduler ───────────────────────────────────────────────────
// Runs every 60s. For each subscribed user, checks whether any of their trading
// sessions just opened (within ±30s of the open UTC time). Sends at most one
// push per user per session per calendar day to avoid duplicates.

const _sentToday = new Map<string, string>(); // key → ISO date string

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseUTCTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

async function checkSessionsForUser(
  userId: string,
  sessions: TradingSessionConfig[],
  nowH: number,
  nowM: number,
  today: string
): Promise<void> {
  for (const session of sessions) {
    if (!session.enabled) continue;
    const { h, m } = parseUTCTime(session.openUTC);
    if (h !== nowH || m !== nowM) continue;

    const dedupeKey = `${userId}:${session.name}`;
    if (_sentToday.get(dedupeKey) === today) continue;

    _sentToday.set(dedupeKey, today);

    const prefs = await getUserPrefs(userId);
    if (!prefs.sessions) continue;

    await sendPushToUser(
      userId,
      {
        title: `📈 Sessione ${session.name} aperta`,
        body: randomQuote(),
        tag: `session-${session.name.toLowerCase().replace(/\s+/g, "-")}`,
        data: { url: "" },
      }
    );
  }
}

export function startSessionScheduler(): void {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("[push] VAPID keys missing — session scheduler disabled");
    return;
  }

  console.log("[push] Session scheduler started");

  setInterval(async () => {
    try {
      const now = new Date();
      const nowH = now.getUTCHours();
      const nowM = now.getUTCMinutes();
      const today = todayUTC();

      // Get all distinct userIds with active push subscriptions
      const rows = await db
        .selectDistinct({ userId: pushSubscriptionsTable.userId })
        .from(pushSubscriptionsTable);

      await Promise.allSettled(
        rows.map(async ({ userId }) => {
          if (!userId) return;
          const where = eq(userSettingsTable.userId, userId);
          const [settings] = await db
            .select({ tradingSessions: userSettingsTable.tradingSessions })
            .from(userSettingsTable).where(where).limit(1);

          let sessions: TradingSessionConfig[] = [];
          try {
            if (settings?.tradingSessions) {
              sessions = JSON.parse(settings.tradingSessions);
            }
          } catch { return; }

          if (sessions.length === 0) return;
          await checkSessionsForUser(userId, sessions, nowH, nowM, today);
        })
      );
    } catch (err) {
      console.error("[push] scheduler error:", err);
    }
  }, 60_000);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

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
  if (!endpoint) { res.status(400).json({ error: "endpoint richiesto" }); return; }
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
  const [existing] = await db.select({ id: userSettingsTable.id })
    .from(userSettingsTable).where(where).limit(1);

  if (existing) {
    await db.update(userSettingsTable)
      .set({ notificationPrefs: JSON.stringify(merged) })
      .where(eq(userSettingsTable.id, existing.id));
  } else {
    await db.insert(userSettingsTable).values({
      userId,
      notificationPrefs: JSON.stringify(merged),
      backgroundType: "default",
      fontChoice: "inter",
      backgroundDarkness: 60,
    });
  }

  res.json(merged);
});

export default router;
