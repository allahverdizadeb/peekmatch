import crypto from 'node:crypto';
import { prisma } from '../db.js';

/** Deterministic, one-way short reference for an internal id that only ever needs to be DISPLAYED
 * in the Superadmin UI, never looked up FROM the reference (e.g. an analysis id shown inside a
 * Payments/Sales table row). Stable across calls for the same id — no stored column needed. Never a
 * raw UUID reaches the browser, per the Superadmin privacy requirements. */
export function toPublicRef(prefix: string, id: string): string {
  const hash = crypto.createHash('sha256').update(id).digest('hex').slice(0, 8).toUpperCase();
  return `${prefix}-${hash}`;
}

/** Masks an already-public reference for table/list display: "PM-7F3A9C21B4" -> "PM-7F3A••••". The
 * full value is only ever shown in a single-record detail view (e.g. the payment detail drawer),
 * which is already access-controlled and needs the real value to perform its own lookup. */
export function maskReference(ref: string): string {
  const dash = ref.indexOf('-');
  if (dash === -1) return ref;
  const prefix = ref.slice(0, dash);
  const body = ref.slice(dash + 1);
  return `${prefix}-${body.slice(0, 4)}••••`;
}

// No 0/O/1/I — avoids visual ambiguity in a reference a human might read aloud or type.
const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomRefBody(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return out;
}

/** Generates a fresh, unique, DB-lookup-capable public reference (used for Order.publicReference,
 * which powers the deep-linkable /superadmin/payments/:reference route). Retries on the
 * astronomically unlikely collision case. */
export async function generateUniqueReference(
  prefix: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}-${randomRefBody()}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error('Failed to generate a unique public reference after 5 attempts.');
}

/** Lazily backfills Order.publicReference on first admin-facing read — this product is pre-launch
 * with very few (often zero) existing Order rows, so a one-off data-migration script would be
 * overkill; self-healing on read is simpler and just as safe. New orders get one at creation time
 * instead (see routes/orders.ts), so this path is really only ever hit for pre-existing rows. */
export async function ensureOrderPublicReference(order: { id: string; publicReference: string | null }): Promise<string> {
  if (order.publicReference) return order.publicReference;
  const ref = await generateUniqueReference('PM', async (candidate) => {
    const existing = await prisma.order.findUnique({ where: { publicReference: candidate } });
    return existing !== null;
  });
  await prisma.order
    .update({ where: { id: order.id }, data: { publicReference: ref } })
    .catch((err) => console.error('[masking] publicReference backfill failed', err instanceof Error ? err.message : err));
  return ref;
}
