import { Router, type IRouter } from "express";
import { db, chatMessagesTable, userPublicKeysTable, friendshipsTable } from "@workspace/db";
import { eq, or, and, desc, sql, lt } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return null;
  }
  return userId;
}

async function areFriends(userId: string, friendId: string): Promise<boolean> {
  const result = await db
    .select({ id: friendshipsTable.id })
    .from(friendshipsTable)
    .where(
      and(
        or(
          and(eq(friendshipsTable.userId, userId), eq(friendshipsTable.friendId, friendId)),
          and(eq(friendshipsTable.userId, friendId), eq(friendshipsTable.friendId, userId))
        ),
        eq(friendshipsTable.status, "accepted")
      )
    )
    .limit(1);
  return result.length > 0;
}

router.post("/chat/keys", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const { publicKeyJwk } = req.body;
    if (!publicKeyJwk || typeof publicKeyJwk !== "object") {
      res.status(400).json({ error: "publicKeyJwk richiesto" });
      return;
    }

    const existing = await db
      .select()
      .from(userPublicKeysTable)
      .where(eq(userPublicKeysTable.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(userPublicKeysTable)
        .set({ publicKeyJwk: JSON.stringify(publicKeyJwk) })
        .where(eq(userPublicKeysTable.userId, userId))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(userPublicKeysTable)
        .values({ userId, publicKeyJwk: JSON.stringify(publicKeyJwk) })
        .returning();
      res.json(created);
    }
  } catch (err) {
    console.error("chat/keys POST error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/chat/keys/:userId", async (req, res) => {
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  try {
    const targetUserId = req.params.userId;

    const friends = await areFriends(currentUserId, targetUserId);
    if (!friends) {
      res.status(403).json({ error: "Non sei amico di questo utente" });
      return;
    }

    const [key] = await db
      .select()
      .from(userPublicKeysTable)
      .where(eq(userPublicKeysTable.userId, targetUserId))
      .limit(1);

    if (!key) {
      res.status(404).json({ error: "Chiave pubblica non trovata" });
      return;
    }

    res.json({ userId: key.userId, publicKeyJwk: JSON.parse(key.publicKeyJwk) });
  } catch (err) {
    console.error("chat/keys GET error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/chat/messages", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const { receiverId, ciphertext, iv } = req.body;
    if (!receiverId || typeof receiverId !== "string" || !ciphertext || typeof ciphertext !== "string" || !iv || typeof iv !== "string") {
      res.status(400).json({ error: "Campi mancanti" });
      return;
    }

    const friends = await areFriends(userId, receiverId);
    if (!friends) {
      res.status(403).json({ error: "Non sei amico di questo utente" });
      return;
    }

    const [message] = await db
      .insert(chatMessagesTable)
      .values({ senderId: userId, receiverId, ciphertext, iv })
      .returning();

    res.status(201).json(message);
  } catch (err) {
    console.error("chat/messages POST error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/chat/messages/:friendId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const friendId = req.params.friendId;
    const cursorParam = req.query.cursor as string | undefined;
    const cursor = cursorParam ? parseInt(cursorParam) : undefined;
    const limit = 50;

    const conditions = [
      or(
        and(eq(chatMessagesTable.senderId, userId), eq(chatMessagesTable.receiverId, friendId)),
        and(eq(chatMessagesTable.senderId, friendId), eq(chatMessagesTable.receiverId, userId))
      ),
    ];

    if (cursor && !isNaN(cursor)) {
      conditions.push(lt(chatMessagesTable.id, cursor));
    }

    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(and(...conditions))
      .orderBy(desc(chatMessagesTable.id))
      .limit(limit);

    await db
      .update(chatMessagesTable)
      .set({ read: "true" })
      .where(
        and(
          eq(chatMessagesTable.senderId, friendId),
          eq(chatMessagesTable.receiverId, userId),
          eq(chatMessagesTable.read, "false")
        )
      );

    res.json({
      messages: messages.reverse(),
      nextCursor: messages.length === limit ? messages[0]?.id : null,
    });
  } catch (err) {
    console.error("chat/messages GET error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/chat/unread", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.receiverId, userId),
          eq(chatMessagesTable.read, "false")
        )
      );

    res.json({ count: result[0]?.count ?? 0 });
  } catch (err) {
    console.error("chat/unread error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
