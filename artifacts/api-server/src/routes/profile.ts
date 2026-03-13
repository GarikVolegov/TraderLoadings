import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { profileTable } from "@workspace/db";
import { UpdateProfileBody, UpdateProfileResponse, GetProfileResponse } from "@workspace/api-zod";
import { eq, isNull } from "drizzle-orm";

const router: IRouter = Router();

const XP_PER_LEVEL = 500;

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
});

export { getOrCreateProfile, computeLevel, getUserId };
export default router;
