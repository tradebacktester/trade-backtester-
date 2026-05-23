import { Router, type IRouter } from "express";
import healthRouter from "./health";
import strategiesRouter from "./strategies";
import backtestsRouter from "./backtests";
import chartRouter from "./chart";

const router: IRouter = Router();

router.use(healthRouter);
router.use(strategiesRouter);
router.use(backtestsRouter);
router.use(chartRouter);

export default router;
