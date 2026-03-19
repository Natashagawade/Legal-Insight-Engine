import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import analysesRouter from "./analyses";
import generalRouter from "./general";

const router: IRouter = Router();

router.use(healthRouter);
router.use(documentsRouter);
router.use(analysesRouter);
router.use(generalRouter);

export default router;
