import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import profileRouter from "./profile.js";
import missionsRouter from "./missions.js";
import journalRouter from "./journal.js";
import ideasRouter from "./ideas.js";
import checklistRouter from "./checklist.js";
import newsRouter from "./news.js";
import settingsRouter from "./settings.js";
import friendsRouter from "./friends.js";
import chatRouter from "./chat.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(missionsRouter);
router.use(journalRouter);
router.use(ideasRouter);
router.use(checklistRouter);
router.use(newsRouter);
router.use(settingsRouter);
router.use(friendsRouter);
router.use(chatRouter);

export default router;
