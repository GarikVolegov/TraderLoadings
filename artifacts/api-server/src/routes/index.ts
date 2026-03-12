import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import profileRouter from "./profile.js";
import missionsRouter from "./missions.js";
import journalRouter from "./journal.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(missionsRouter);
router.use(journalRouter);

export default router;
