import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, userSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `bg-${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function getOrCreateSettings() {
  const [existing] = await db.select().from(userSettingsTable).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(userSettingsTable).values({ backgroundType: "default" }).returning();
  return created;
}

router.get("/settings", async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json(settings);
});

router.put("/settings", async (req, res) => {
  const { backgroundUrl, backgroundType } = req.body;
  const settings = await getOrCreateSettings();
  const [updated] = await db.update(userSettingsTable)
    .set({ backgroundUrl: backgroundUrl ?? null, backgroundType: backgroundType || "default" })
    .where(eq(userSettingsTable.id, settings.id))
    .returning();
  res.json(updated);
});

router.post("/settings/background", upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No image uploaded" });
    return;
  }
  const url = `/api/uploads/${req.file.filename}`;
  const settings = await getOrCreateSettings();
  await db.update(userSettingsTable)
    .set({ backgroundUrl: url, backgroundType: "custom" })
    .where(eq(userSettingsTable.id, settings.id));
  res.json({ url });
});

export default router;
