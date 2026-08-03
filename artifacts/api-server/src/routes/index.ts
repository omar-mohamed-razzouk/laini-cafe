import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth.js";
import healthRouter from "./health";
import authRouter from "./auth";
import downloadRouter from "./download";
import staffRouter from "./staff";
import tablesRouter from "./tables";
import roomsRouter from "./rooms";
import menuRouter from "./menu";
import bookingsRouter from "./bookings";
import sessionsRouter from "./sessions";
import ordersRouter from "./orders";
import invoicesRouter from "./invoices";
import expensesRouter from "./expenses";
import inventoryRouter from "./inventory";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import customersRouter from "./customers";
import adminRouter from "./admin";
import exportRouter from "./export";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(downloadRouter);

router.use(requireAuth);

router.use(staffRouter);
router.use(tablesRouter);
router.use(roomsRouter);
router.use(menuRouter);
router.use(bookingsRouter);
router.use(sessionsRouter);
router.use(ordersRouter);
router.use(invoicesRouter);
router.use(expensesRouter);
router.use(inventoryRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(customersRouter);
router.use(adminRouter);
router.use(exportRouter);

export default router;
