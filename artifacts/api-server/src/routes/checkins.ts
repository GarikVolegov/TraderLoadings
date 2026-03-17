import { Router, type IRouter } from "express";
import { db, checkinsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { getUserId } from "./profile.js";
import { sendPushToUser } from "./push.js";

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

  const SESSION_QUOTES = [
    "Disciplina è fare ciò che devi fare, anche quando non ne hai voglia.",
    "Ogni trade è una decisione, non una scommessa.",
    "Proteggi il capitale. Le opportunità torneranno sempre.",
    "Il mercato premia la pazienza e punisce l'impulsività.",
    "Un trader disciplinato batte sempre uno intelligente.",
    "Non è il trade che perdi a fermarti — è perdere la testa.",
    "La coerenza nel metodo produce coerenza nei risultati.",
    "Aspetta il setup perfetto. Il mercato apre ogni giorno.",
    "Gestire il rischio è l'unica cosa che controlli davvero.",
    "Ogni sessione è un'opportunità per migliorare il tuo processo.",
  ];
  const quote = SESSION_QUOTES[Math.floor(Math.random() * SESSION_QUOTES.length)];

  sendPushToUser(
    userId,
    {
      title: `📈 Sessione ${sessionName} aperta`,
      body: quote,
      tag: `session-${today}`,
      data: { url: "/" },
    },
    "sessions"
  ).catch(() => {});
});

export default router;
