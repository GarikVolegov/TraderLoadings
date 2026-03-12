import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { journalEntriesTable, journalImagesTable } from "@workspace/db";
import {
  CreateJournalEntryBody,
  UpdateJournalEntryBody,
  UpdateJournalEntryParams,
  DeleteJournalEntryParams,
  GetJournalEntryParams,
  UploadJournalImageParams,
  DeleteJournalImageParams,
} from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

async function getEntryWithImages(id: number) {
  const [entry] = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.id, id));
  if (!entry) return null;

  const images = await db
    .select()
    .from(journalImagesTable)
    .where(eq(journalImagesTable.entryId, id));

  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    tradeDate: entry.tradeDate,
    result: entry.result,
    tags: entry.tags,
    images: images.map((img) => ({
      id: img.id,
      url: `/api/journal/image/${img.filePath}`,
    })),
    createdAt: entry.createdAt!.toISOString(),
    updatedAt: entry.updatedAt!.toISOString(),
  };
}

router.get("/journal", async (_req, res) => {
  const entries = await db
    .select()
    .from(journalEntriesTable)
    .orderBy(desc(journalEntriesTable.createdAt));

  const results = await Promise.all(entries.map((e) => getEntryWithImages(e.id)));
  res.json(results.filter(Boolean));
});

router.post("/journal", async (req, res) => {
  const body = CreateJournalEntryBody.parse(req.body);

  const [entry] = await db
    .insert(journalEntriesTable)
    .values({
      title: body.title,
      content: body.content,
      tradeDate: body.tradeDate,
      result: body.result,
      tags: body.tags ?? null,
    })
    .returning();

  const data = await getEntryWithImages(entry.id);
  res.status(201).json(data);
});

router.get("/journal/:id", async (req, res) => {
  const { id } = GetJournalEntryParams.parse({ id: Number(req.params.id) });
  const data = await getEntryWithImages(id);
  if (!data) { res.status(404).json({ error: "Not found" }); return; }
  res.json(data);
});

router.put("/journal/:id", async (req, res) => {
  const { id } = UpdateJournalEntryParams.parse({ id: Number(req.params.id) });
  const body = UpdateJournalEntryBody.parse(req.body);

  const [updated] = await db
    .update(journalEntriesTable)
    .set({
      title: body.title,
      content: body.content,
      tradeDate: body.tradeDate,
      result: body.result,
      tags: body.tags ?? null,
      updatedAt: new Date(),
    })
    .where(eq(journalEntriesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  const data = await getEntryWithImages(id);
  res.json(data);
});

router.delete("/journal/:id", async (req, res) => {
  const { id } = DeleteJournalEntryParams.parse({ id: Number(req.params.id) });

  const images = await db
    .select()
    .from(journalImagesTable)
    .where(eq(journalImagesTable.entryId, id));

  for (const img of images) {
    const filePath = path.join(UPLOADS_DIR, img.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, id));
  res.json({ success: true });
});

router.post(
  "/journal/:id/images",
  upload.single("image"),
  async (req, res) => {
    const { id } = UploadJournalImageParams.parse({ id: Number(req.params.id) });

    const entry = await db
      .select()
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.id, id));
    if (!entry.length) { res.status(404).json({ error: "Entry not found" }); return; }

    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

    const [img] = await db
      .insert(journalImagesTable)
      .values({ entryId: id, filePath: req.file.filename })
      .returning();

    res.json({ image: { id: img.id, url: `/api/journal/image/${img.filePath}` } });
  }
);

router.delete("/journal/:id/images/:imageId", async (req, res) => {
  const { id, imageId } = DeleteJournalImageParams.parse({
    id: Number(req.params.id),
    imageId: Number(req.params.imageId),
  });

  const [img] = await db
    .select()
    .from(journalImagesTable)
    .where(eq(journalImagesTable.id, imageId));

  if (!img || img.entryId !== id) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, img.filePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await db.delete(journalImagesTable).where(eq(journalImagesTable.id, imageId));
  res.json({ success: true });
});

router.get("/journal/image/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Not found" }); return; }
  res.sendFile(filePath);
});

export default router;
