import { Router } from "express";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";

export const subscriptionsRouter = Router();

subscriptionsRouter.get("/packages", async (_req, res, next) => {
  try {
    const result = await query(
      `select id, code, name_ar, price_sar, billing_period, max_active_work_orders, max_users
       from subscription_packages where is_active = true order by price_sar asc`
    );
    res.json({ packages: result.rows });
  } catch (err) {
    next(err);
  }
});

subscriptionsRouter.get("/current", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `select ws.id, ws.status, ws.current_period_start, ws.current_period_end, sp.name_ar, sp.code
       from workshop_subscriptions ws
       join subscription_packages sp on sp.id = ws.package_id
       where ws.workshop_id = $1
       order by ws.created_at desc limit 1`,
      [req.user!.workshopId]
    );
    res.json({ subscription: result.rows[0] ?? null });
  } catch (err) {
    next(err);
  }
});
