import { Router, type IRouter } from "express";
import { db, checkinsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { getUserId } from "./profile.js";

const router: IRouter = Router();

function userFilter(userId: string | null) {
  return userId ? eq(checkinsTable.userId, userId) : isNull(checkinsTable.userId);
}

router.get("/checkins/today", async (req, res) => {
  const userId = getUserId(req);
  const today = new Date().toISOString().slice(0, 10);
  const [checkin] = await db.select().from(checkinsTable)
    .where(and(userFilter(userId), eq(checkinsTable.date, today)))
    .limit(1);
  res.json(checkin || null);
});

router.post("/checkins", async (req, res) => {
  const userId = getUserId(req);
  const { mood, sessionName, note } = req.body;
  if (!mood || !sessionName) {
    res.status(400).json({ error: "mood and sessionName are required" });
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const [checkin] = await db.insert(checkinsTable)
    .values({ mood, sessionName, note: note || null, userId, date: today })
    .returning();
  res.status(201).json(checkin);
});

export default router;
