import { Router, type IRouter } from "express";
import healthRouter from "./health";
import strategiesRouter from "./strategies";
import backtestsRouter from "./backtests";
import chartRouter from "./chart";
import marketRouter from "./market";
import newsRouter from "./news";
import aiRouter from "./ai";
import authRouter from "./auth";
import googleAuthRouter from "./google-auth";
import adminRouter from "./admin";
import communityRouter from "./community";
import subscriptionRouter from "./subscription";
import toolsRouter from "./tools";
import superpowersRouter from "./superpowers";
import socialRouter from "./social";
import journalRouter from "./journal";
import paperRouter from "./paper";
import alertsRouter from "./alerts";
import tradingOsRouter from "./trading-os";
import academyRouter from "./academy";
import usersRouter from "./users";
import footprintRouter from "./footprint";
import watchlistRouter from "./watchlist";
import brokerageRouter from "./brokerage";
import psychAlertsRouter from "./psych-alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
// superpowersRouter must be mounted BEFORE strategiesRouter so that
// GET /strategies/dna is matched here (literal) and not swallowed by
// GET /strategies/:id (param) in strategiesRouter.
router.use(superpowersRouter);
router.use(strategiesRouter);
router.use(backtestsRouter);
router.use(journalRouter);
router.use(chartRouter);
router.use(newsRouter);
router.use(aiRouter);
router.use(authRouter);
router.use(googleAuthRouter);
router.use(adminRouter);
router.use(communityRouter);
router.use(subscriptionRouter);
router.use(toolsRouter);
router.use(socialRouter);
router.use(paperRouter);
router.use(alertsRouter);
router.use(tradingOsRouter);
router.use(academyRouter);
router.use(usersRouter);
router.use(footprintRouter);
router.use(watchlistRouter);
router.use(brokerageRouter);
router.use(psychAlertsRouter);

export default router;
