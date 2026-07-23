import { Router } from 'express';
import { prisma } from '../../db.js';
import { formatBakuDateTime } from '../../lib/dateRange.js';

export const auditRouter = Router();

auditRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 25;
  const [rows, total] = await Promise.all([
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.adminAuditLog.count(),
  ]);
  res.json({
    page,
    pageSize,
    total,
    rows: rows.map((r) => ({
      id: r.id,
      time: formatBakuDateTime(r.createdAt),
      action: r.action,
      status: r.status,
      actorEmail: r.actorEmail,
      requestIdMasked: r.requestIdHash ? `${r.requestIdHash.slice(0, 8)}…` : null,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
    })),
  });
});
