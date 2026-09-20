import { Router } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { ApiError } from "../middleware/errorHandler";

export const vehiclesRouter = Router({ mergeParams: true });

const createVehicleSchema = z.object({
  plateNumber: z.string().min(1),
  vin: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  modelYear: z.number().int().optional(),
  currentOdometer: z.number().int().optional(),
});

vehiclesRouter.post("/", async (req, res, next) => {
  try {
    const { customerId } = req.params as { customerId: string };
    const body = createVehicleSchema.parse(req.body);

    const customerResult = await query(`select id from customers where id = $1 and workshop_id = $2`, [
      customerId,
      req.user!.workshopId,
    ]);
    if (customerResult.rows.length === 0) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND");
    }

    const result = await query<{ id: string }>(
      `insert into vehicles (workshop_id, customer_id, plate_number, vin, make, model, model_year, current_odometer)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        req.user!.workshopId,
        customerId,
        body.plateNumber,
        body.vin ?? null,
        body.make ?? null,
        body.model ?? null,
        body.modelYear ?? null,
        body.currentOdometer ?? null,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

vehiclesRouter.get("/", async (req, res, next) => {
  try {
    const { customerId } = req.params as { customerId: string };
    const result = await query(
      `select id, plate_number, vin, make, model, model_year, current_odometer
       from vehicles where customer_id = $1 and workshop_id = $2 order by created_at desc`,
      [customerId, req.user!.workshopId]
    );
    res.json({ vehicles: result.rows });
  } catch (err) {
    next(err);
  }
});
