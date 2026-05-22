import { Router, type IRouter } from "express";
import healthRouter from "./health";
import strategiesRouter from "./strategies";
import backtestsRouter from "./backtests";

const router: IRouter = Router();

router.use(healthRouter);
router.use(strategiesRouter);
router.use(backtestsRouter);

export default router;
