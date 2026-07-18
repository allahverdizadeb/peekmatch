import type { Request, Response, NextFunction } from 'express';

/** Lightweight shared-secret gate for the admin-only endpoints — not a real auth system.
 * Checked against ADMIN_KEY via an `x-admin-key` header or `adminKey` query param. */
export function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const key = (req.header('x-admin-key') || (req.query.adminKey as string | undefined)) ?? '';
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
