import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdminKey } from '../middleware/adminAuth.js';

export const suggestionsRouter = Router();

// Public submission ("Təklif ver" widget) was removed from the product. This admin-only read
// endpoint is kept because AdminGate.tsx validates the ADMIN_KEY by calling it, and Admin.tsx
// still shows historical feedback — removing it would break admin login entirely, which is a
// separate feature from the removed widget. The underlying Suggestion table/rows are untouched.
suggestionsRouter.get('/', requireAdminKey, async (_req, res) => {
  const list = await prisma.suggestion.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(list);
});
