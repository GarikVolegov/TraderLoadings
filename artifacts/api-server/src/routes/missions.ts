import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { missionsTable, profileTable } from "@workspace/db";
import { GetMissionsResponse, CompleteMissionParams, CompleteMissionResponse } from "@workspace/api-zod";
import { eq, and, isNull } from "drizzle-orm";
import { getOrCreateProfile, computeLevel, getUserId } from "./profile.js";

const router: IRouter = Router();

const DAILY_MISSIONS = [
  { title: "Analisi Pre-Mercato", description: "Studia i livelli chiave prima dell'apertura della sessione di Londra", xpReward: 100 },
  { title: "Rispetta lo Stop Loss", description: "Esegui un trade rispettando il tuo stop loss calcolato", xpReward: 150 },
  { title: "Journaling del Trade", description: "Registra almeno un trade con entry, exit e motivazione", xpReward: 75 },
  { title: "Sessione Asiatica", description: "Monitora la sessione asiatica e identifica i range di prezzo", xpReward: 50 },
  { title: "Gestione del Rischio", description: "Usa il calcolatore di lotti per ogni trade della giornata", xpReward: 125 },
];

async function ensureTodayMissions(userId: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const userFilter = userId ? eq(missionsTable.userId, userId) : isNull(missionsTable.userId);
  const existing = await db.select().from(missionsTable).where(and(eq(missionsTable.missionDate, today), userFilter));

  if (existing.length === 0) {
    await db.insert(missionsTable).values(
      DAILY_MISSIONS.map((m) => ({
        ...m,
        completed: false,
        missionDate: today,
        userId,
      }))
    );
    return await db.select().from(missionsTable).where(and(eq(missionsTable.missionDate, today), userFilter));
  }

  return existing;
}

router.get("/missions", async (req, res) => {
  const userId = getUserId(req);
  const missions = await ensureTodayMissions(userId);

  const data = GetMissionsResponse.parse(
    missions.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      xpReward: m.xpReward,
      completed: m.completed,
      completedAt: m.completedAt ? m.completedAt.toISOString() : null,
    }))
  );
  res.json(data);
});

router.post("/missions/:id/complete", async (req, res) => {
  const userId = getUserId(req);
  const { id } = CompleteMissionParams.parse({ id: Number(req.params.id) });

  const today = new Date().toISOString().slice(0, 10);
  const userFilter = userId ? eq(missionsTable.userId, userId) : isNull(missionsTable.userId);
  const [mission] = await db
    .select()
    .from(missionsTable)
    .where(and(eq(missionsTable.id, id), eq(missionsTable.missionDate, today), userFilter));

  if (!mission) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }

  if (mission.completed) {
    res.status(400).json({ error: "Mission already completed" });
    return;
  }

  const [updatedMission] = await db
    .update(missionsTable)
    .set({ completed: true, completedAt: new Date() })
    .where(eq(missionsTable.id, id))
    .returning();

  const profile = await getOrCreateProfile(userId);
  const newXp = profile.xp + mission.xpReward;
  const oldLevel = computeLevel(profile.xp).level;

  const [updatedProfile] = await db
    .update(profileTable)
    .set({ xp: newXp })
    .where(eq(profileTable.id, profile.id))
    .returning();

  const { level, xpToNextLevel } = computeLevel(newXp);
  const levelUp = level > oldLevel;

  const data = CompleteMissionResponse.parse({
    mission: {
      id: updatedMission.id,
      title: updatedMission.title,
      description: updatedMission.description,
      xpReward: updatedMission.xpReward,
      completed: updatedMission.completed,
      completedAt: updatedMission.completedAt ? updatedMission.completedAt.toISOString() : null,
    },
    profile: {
      id: updatedProfile.id,
      name: updatedProfile.name,
      avatarUrl: updatedProfile.avatarUrl ?? null,
      xp: updatedProfile.xp,
      level,
      xpToNextLevel,
    },
    levelUp,
  });

  res.json(data);
});

export default router;
