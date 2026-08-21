import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import wantsRouter from "./wants";
import productsRouter from "./products";
import reviewsRouter from "./reviews";
import profileRouter from "./profile";
import mediaRouter from "./media";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(wantsRouter);
router.use(productsRouter);
router.use(reviewsRouter);
router.use(profileRouter);
router.use(mediaRouter);

export default router;
