import { Router, type IRouter } from "express";
import { db, checklistItemsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/checklist", async (_req, res) => {
  const items = await db.select().from(checklistItemsTable).orderBy(asc(checklistItemsTable.order), asc(checklistItemsTable.createdAt));
  res.json(items);
});

router.post("/checklist", async (req, res) => {
  const { text } = req.body;
  if (!text) { res.status(400).json({ error: "text is required" }); return; }
  const all = await db.select().from(checklistItemsTable);
  const maxOrder = all.length > 0 ? Math.max(...all.map(i => i.order)) : -1;
  const [item] = await db.insert(checklistItemsTable).values({ text, order: maxOrder + 1 }).returning();
  res.status(201).json(item);
});

router.put("/checklist/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { text, completed } = req.body;
  const updateData: Partial<{ text: string; completed: boolean }> = {};
  if (text !== undefined) updateData.text = text;
  if (completed !== undefined) updateData.completed = completed;
  const [item] = await db.update(checklistItemsTable).set(updateData).where(eq(checklistItemsTable.id, id)).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});

router.delete("/checklist/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(checklistItemsTable).where(eq(checklistItemsTable.id, id));
  res.json({ success: true });
});

export default router;
