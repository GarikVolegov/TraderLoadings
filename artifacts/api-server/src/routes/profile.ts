import { Router, type IRouter, type Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { profileTable } from "@workspace/db";
import { UpdateProfileBody, UpdateProfileResponse, GetProfileResponse } from "@workspace/api-zod";
import { eq, isNull, and, ne, sql } from "drizzle-orm";

const router: IRouter = Router();

const XP_PER_LEVEL = 500;

const AVATARS_DIR = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${unique}${path.extname(file.originalname)}`);
  },
});
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Solo immagini JPG, PNG, WebP e GIF sono consentite"));
    }
  },
});

function computeLevel(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;
  return { level, xpToNextLevel };
}

function getUserId(req: Request): string | null {
  return req.user?.id ?? null;
}

async function getOrCreateProfile(userId: string | null) {
  const where = userId ? eq(profileTable.userId, userId) : isNull(profileTable.userId);
  const profiles = await db.select().from(profileTable).where(where).limit(1);
  if (profiles.length > 0) return profiles[0];

  const [created] = await db.insert(profileTable).values({
    name: "Trader",
    avatarUrl: null,
    xp: 0,
    level: 1,
    userId,
  }).returning();
  return created;
}

async function isNameTaken(name: string, excludeProfileId: number, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const existing = await db.select({ id: profileTable.id })
    .from(profileTable)
    .where(
      and(
        sql`lower(${profileTable.name}) = lower(${name})`,
        ne(profileTable.id, excludeProfileId),
        sql`${profileTable.userId} IS NOT NULL`
      )
    )
    .limit(1);
  return existing.length > 0;
}

router.get("/profile", async (req, res) => {
  const userId = getUserId(req);
  const profile = await getOrCreateProfile(userId);
  const { level, xpToNextLevel } = computeLevel(profile.xp);

  const data = GetProfileResponse.parse({
    id: profile.id,
    name: profile.name,
    avatarUrl: profile.avatarUrl ?? null,
    xp: profile.xp,
    level,
    xpToNextLevel,
  });
  res.json(data);
});

router.put("/profile", async (req, res) => {
  const userId = getUserId(req);
  const body = UpdateProfileBody.parse(req.body);
  const profile = await getOrCreateProfile(userId);

  if (userId && body.name !== profile.name) {
    const taken = await isNameTaken(body.name, profile.id, userId);
    if (taken) {
      res.status(409).json({ error: "Nome già in uso da un altro utente" });
      return;
    }
  }

  try {
    const [updated] = await db.update(profileTable)
      .set({ name: body.name, avatarUrl: body.avatarUrl ?? null })
      .where(eq(profileTable.id, profile.id))
      .returning();

    const { level, xpToNextLevel } = computeLevel(updated.xp);
    const data = UpdateProfileResponse.parse({
      id: updated.id,
      name: updated.name,
      avatarUrl: updated.avatarUrl ?? null,
      xp: updated.xp,
      level,
      xpToNextLevel,
    });
    res.json(data);
  } catch (err: any) {
    if (err?.code === "23505" && err?.constraint?.includes("profile_name")) {
      res.status(409).json({ error: "Nome già in uso da un altro utente" });
      return;
    }
    throw err;
  }
});

router.get("/profile/check-name", async (req, res) => {
  const name = String(req.query.name || "").trim();
  if (!name) {
    res.json({ available: false });
    return;
  }

  const userId = getUserId(req);
  if (!userId) {
    res.json({ available: true });
    return;
  }

  const profile = await getOrCreateProfile(userId);
  const taken = await isNameTaken(name, profile.id, userId);
  res.json({ available: !taken });
});

router.post("/profile/avatar", avatarUpload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nessuna immagine caricata" });
    return;
  }

  const userId = getUserId(req);
  const profile = await getOrCreateProfile(userId);
  const avatarUrl = `/api/uploads/avatars/${req.file.filename}`;

  await db.update(profileTable)
    .set({ avatarUrl })
    .where(eq(profileTable.id, profile.id));

  res.json({ avatarUrl });
});

router.post("/profile/avatar/generate", async (req, res) => {
  const userId = getUserId(req);
  const profile = await getOrCreateProfile(userId);

  const seed = crypto.createHash("md5")
    .update(`${userId || "guest"}-${Date.now()}-${Math.random()}`)
    .digest("hex")
    .substring(0, 8);

  const styles = [
    "cyberpunk neon trader with glowing visor",
    "futuristic holographic warrior with energy shield",
    "dark fantasy mage with glowing arcane runes",
    "steampunk inventor with brass goggles and gears",
    "sci-fi space commander with starfield background",
    "neon samurai with energy katana",
    "crystal elemental being radiating light",
    "shadowy rogue with glowing emerald eyes",
    "mythical phoenix knight with flaming armor",
    "techno-organic cyborg with circuit patterns",
    "arctic wolf warrior with ice blue markings",
    "golden dragon scale armored paladin",
  ];
  const styleIndex = parseInt(seed, 16) % styles.length;
  const style = styles[styleIndex];

  const prompt = `Professional square avatar portrait, ${style}, unique seed identifier ${seed}, dark moody background with vibrant accent lighting, highly detailed digital art, single character bust portrait facing camera, sharp focus, cinematic lighting`;

  const filename = `ai-avatar-${seed}.png`;
  const outputPath = path.join(AVATARS_DIR, filename);

  try {
    const { generateImageBuffer } = await import("@workspace/integrations-openai-ai-server/image");
    const buffer = await generateImageBuffer(prompt, "512x512");
    fs.writeFileSync(outputPath, buffer);

    const avatarUrl = `/api/uploads/avatars/${filename}`;
    await db.update(profileTable)
      .set({ avatarUrl })
      .where(eq(profileTable.id, profile.id));

    res.json({ avatarUrl });
  } catch (err) {
    console.warn("AI avatar generation failed:", err);
    res.status(500).json({ error: "Generazione avatar fallita. Riprova." });
  }
});

export { getOrCreateProfile, computeLevel, getUserId };
export default router;
