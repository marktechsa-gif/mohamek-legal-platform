import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthUser } from "../types";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * يستخرج هوية المستخدم و workshopId من الـ JWT فقط. هذا هو أساس عزل
 * المستأجرين: لا يوجد أي مسار في هذا الباك-إند يقبل workshop_id من body أو
 * query المستخدم — كل استعلام يُقيَّد بـ req.user.workshopId حصرًا.
 * راجع database/README.md قسم "العزل بين المستأجرين".
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_authorization_header" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "invalid_or_expired_token" });
  }
}
