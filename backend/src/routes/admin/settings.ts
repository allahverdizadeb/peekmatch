import { Router } from 'express';
import { prisma } from '../../db.js';

export const settingsRouter = Router();

settingsRouter.get('/', async (req, res) => {
  const user = await prisma.superadminUser.findUnique({ where: { id: req.superadmin!.userId } });
  if (!user) return res.status(401).json({ error: 'Sessiya etibarsızdır.', code: 'unauthenticated' });
  res.json({
    email: user.email,
    lastLoginAt: user.lastLoginAt,
    passwordChangedAt: user.passwordChangedAt,
    security: {
      encryptedSession: true,
      auditLog: true,
      maskedData: true,
      twoFactor: false, // deliberately not implemented — single-Superadmin launch scope
    },
    dataRetention: {
      analysisRetentionHours: 24,
      entitlementWindowHours: 24,
      analyticsRetentionNote: 'CV və vakansiya mətni heç vaxt saxlanılmır — yalnız məxfiliyə uyğun, şəxsi məlumat olmayan hadisə qeydləri saxlanılır.',
    },
  });
});
