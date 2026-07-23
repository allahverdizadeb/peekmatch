import { prisma } from '../db.js';

// Fixed allowlist, same pattern as routes/events.ts's EVENT_METADATA_KEYS — the audit log is a
// security record, so both the action name AND its metadata shape are closed sets, never free-form.
export type AuditAction =
  | 'login_succeeded'
  | 'login_failed'
  | 'logout'
  | 'session_expired'
  | 'password_changed'
  | 'sessions_revoked'
  | 'sales_csv_exported'
  | 'payments_csv_exported'
  | 'settings_changed'
  | 'payment_detail_viewed';

const AUDIT_METADATA_KEYS: Record<AuditAction, string[]> = {
  login_succeeded: [],
  login_failed: ['reason'],
  logout: [],
  session_expired: [],
  password_changed: [],
  sessions_revoked: ['count'],
  sales_csv_exported: ['range', 'rowCount'],
  payments_csv_exported: ['range', 'rowCount'],
  settings_changed: ['field'],
  payment_detail_viewed: ['reference'],
};

function sanitizeAuditMetadata(action: AuditAction, raw?: Record<string, unknown>): Record<string, string | number | boolean> {
  const allowed = AUDIT_METADATA_KEYS[action];
  const out: Record<string, string | number | boolean> = {};
  if (!raw) return out;
  for (const key of allowed) {
    const value = raw[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export async function recordAudit(params: {
  action: AuditAction;
  status: 'success' | 'failure';
  actorId?: string | null;
  actorEmail?: string | null;
  requestIdHash?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const metadata = sanitizeAuditMetadata(params.action, params.metadata);
  await prisma.adminAuditLog
    .create({
      data: {
        action: params.action,
        status: params.status,
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail ?? null,
        requestIdHash: params.requestIdHash ?? null,
        metadata: Object.keys(metadata).length ? JSON.stringify(metadata) : null,
      },
    })
    .catch((err) => console.error('[auditLog] write failed', err instanceof Error ? err.message : err));
}
