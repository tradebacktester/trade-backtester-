import { Router, type IRouter } from "express";
import healthRouter from "./health";
import strategiesRouter from "./strategies";
import backtestsRouter from "./backtests";
import chartRouter from "./chart";
import newsRouter from "./news";
import aiRouter from "./ai";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(strategiesRouter);
router.use(backtestsRouter);
router.use(chartRouter);
router.use(newsRouter);
router.use(aiRouter);
router.use(authRouter);
router.use(adminRouter);

export default router;
