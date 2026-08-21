import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wantsRouter from "./wants";

const router: IRouter = Router();

router.use(healthRouter);
router.use(wantsRouter);

export default router;
