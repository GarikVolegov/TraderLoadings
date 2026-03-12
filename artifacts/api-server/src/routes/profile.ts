import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { profileTable } from "@workspace/db";
import { UpdateProfileBody, UpdateProfileResponse, GetProfileResponse } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const XP_PER_LEVEL = 500;

function computeLevel(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;
  return { level, xpToNextLevel };
}

async function getOrCreateProfile() {
  const profiles = await db.select().from(profileTable).limit(1);
  if (profiles.length > 0) return profiles[0];

  const [created] = await db.insert(profileTable).values({
    name: "Trader",
    avatarUrl: null,
    xp: 0,
    level: 1,
  }).returning();
  return created;
}

router.get("/profile", async (_req, res) => {
  const profile = await getOrCreateProfile();
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
  const body = UpdateProfileBody.parse(req.body);
  const profile = await getOrCreateProfile();

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

export { getOrCreateProfile, computeLevel };
export default router;
