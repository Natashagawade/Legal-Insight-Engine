import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import analysesRouter from "./analyses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(documentsRouter);
router.use(analysesRouter);

export default router;
