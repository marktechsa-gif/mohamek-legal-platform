import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { listActivePackages, subscribeUserToPackage } from "../services/subscriptionService";

export const subscriptionsRouter = Router();

subscriptionsRouter.get("/packages", async (_req, res, next) => {
  try {
    const packages = await listActivePackages();
    res.json({ packages });
  } catch (err) {
    next(err);
  }
});

const subscribeSchema = z.object({
  packageId: z.string().uuid(),
});

subscriptionsRouter.post("/subscribe", requireAuth, async (req, res, next) => {
  try {
    const body = subscribeSchema.parse(req.body);
    const subscription = await subscribeUserToPackage(req.user!.id, body.packageId);
    res.status(201).json({ subscription });
  } catch (err) {
    next(err);
  }
});
