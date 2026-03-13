import { Router, type IRouter } from "express";
import { db, ideasTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/ideas", async (_req, res) => {
  const ideas = await db.select().from(ideasTable).orderBy(desc(ideasTable.createdAt));
  res.json(ideas);
});

router.post("/ideas", async (req, res) => {
  const { type, content } = req.body;
  if (!type || !content) {
    res.status(400).json({ error: "type and content are required" });
    return;
  }
  const [idea] = await db.insert(ideasTable).values({ type, content }).returning();
  res.status(201).json(idea);
});

router.put("/ideas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { content, completed } = req.body;
  const [idea] = await db.update(ideasTable).set({ content, completed }).where(eq(ideasTable.id, id)).returning();
  if (!idea) { res.status(404).json({ error: "Not found" }); return; }
  res.json(idea);
});

router.delete("/ideas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(ideasTable).where(eq(ideasTable.id, id));
  res.json({ success: true });
});

export default router;
