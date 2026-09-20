import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../types";

/**
 * يفرض صلاحيات الاستخدام المتقدمة المطلوبة في المواصفات: مدير عام، استقبال،
 * فني، محاسب، مشرف مستودع. يُستخدم بعد requireAuth دائمًا.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "missing_authorization_header" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "insufficient_role", allowedRoles });
    }
    next();
  };
}
