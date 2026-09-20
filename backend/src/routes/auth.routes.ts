import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { signAuthToken } from "../lib/jwt";
import { ApiError } from "../middleware/errorHandler";
import { registerWorkshop } from "../services/workshopService";
import type { AuthUser, UserRole } from "../types";

export const authRouter = Router();

const registerWorkshopSchema = z.object({
  workshopName: z.string().min(2),
  commercialRegistrationNumber: z.string().optional(),
  city: z.string().optional(),
  ownerFullName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
});

authRouter.post("/register-workshop", async (req, res, next) => {
  try {
    const body = registerWorkshopSchema.parse(req.body);
    const user = await registerWorkshop(body);
    const token = signAuthToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const result = await query<{
      id: string;
      email: string;
      password_hash: string;
      workshop_id: string;
      role: UserRole;
      is_active: boolean;
    }>(
      `select id, email, password_hash, workshop_id, role, is_active from users where email = $1`,
      [body.email]
    );
    const user = result.rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(body.password, user.password_hash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS");
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      workshopId: user.workshop_id,
      role: user.role,
    };
    const token = signAuthToken(authUser);

    res.json({ token, user: authUser });
  } catch (err) {
    next(err);
  }
});
