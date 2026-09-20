import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { signAuthToken } from "../lib/jwt";
import { ApiError } from "../middleware/errorHandler";

export const authRouter = Router();

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await query(`select id from users where email = $1`, [body.email]);
    if (existing.rows.length > 0) {
      throw new ApiError(409, "EMAIL_ALREADY_REGISTERED");
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const result = await query<{ id: string; email: string }>(
      `insert into users (full_name, email, phone, password_hash)
       values ($1, $2, $3, $4)
       returning id, email`,
      [body.fullName, body.email, body.phone ?? null, passwordHash]
    );

    const user = result.rows[0];
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

    const result = await query<{ id: string; email: string; password_hash: string }>(
      `select id, email, password_hash from users where email = $1`,
      [body.email]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS");
    }

    const token = signAuthToken({ id: user.id, email: user.email });

    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
});
