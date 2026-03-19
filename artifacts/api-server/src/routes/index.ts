import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import analysesRouter from "./analyses";
import generalRouter from "./general";
import academicRouter from "./academic";

const router: IRouter = Router();

router.use(healthRouter);
router.use(documentsRouter);
router.use(analysesRouter);
router.use(generalRouter);
router.use(academicRouter);

export default router;
