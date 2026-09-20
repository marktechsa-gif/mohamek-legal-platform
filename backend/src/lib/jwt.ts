import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthUser } from "../types";

export function signAuthToken(user: AuthUser): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(user, env.JWT_SECRET, options);
}
