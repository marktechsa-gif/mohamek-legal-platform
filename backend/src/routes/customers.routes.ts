import { Router } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { vehiclesRouter } from "./vehicles.routes";

export const customersRouter = Router();

customersRouter.use(requireAuth);

const createCustomerSchema = z.object({
  kind: z.enum(["individual", "company", "fleet"]).default("individual"),
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional(),
});

customersRouter.post("/", async (req, res, next) => {
  try {
    const body = createCustomerSchema.parse(req.body);
    const result = await query<{ id: string }>(
      `insert into customers (workshop_id, kind, name, phone, email)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [req.user!.workshopId, body.kind, body.name, body.phone, body.email ?? null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/", async (req, res, next) => {
  try {
    const result = await query(
      `select id, kind, name, phone, email, created_at
       from customers where workshop_id = $1 order by created_at desc`,
      [req.user!.workshopId]
    );
    res.json({ customers: result.rows });
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/:customerId", async (req, res, next) => {
  try {
    const result = await query(
      `select id, kind, name, phone, email, created_at
       from customers where id = $1 and workshop_id = $2`,
      [req.params.customerId, req.user!.workshopId]
    );
    const customer = result.rows[0];
    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND");
    }
    res.json({ customer });
  } catch (err) {
    next(err);
  }
});

customersRouter.use("/:customerId/vehicles", vehiclesRouter);
