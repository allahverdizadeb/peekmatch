import 'dotenv/config';
import { prisma } from '../db.js';
import { hashPassword } from '../lib/superadminAuth.js';

/** One-off account-creation script — run manually via `npm run admin:bootstrap`, never an HTTP
 * endpoint, so there is zero remote account-creation attack surface for the single Superadmin
 * account. Reads SUPERADMIN_EMAIL/SUPERADMIN_INITIAL_PASSWORD only when explicitly invoked — never
 * on ordinary server startup — and refuses to run at all if a SuperadminUser already exists, so it
 * can never silently overwrite an existing operator's password. */
async function main() {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const initialPassword = process.env.SUPERADMIN_INITIAL_PASSWORD;

  if (!email || !initialPassword) {
    console.error('SUPERADMIN_EMAIL and SUPERADMIN_INITIAL_PASSWORD must both be set to run this script.');
    process.exitCode = 1;
    return;
  }
  if (initialPassword.length < 12) {
    console.error('SUPERADMIN_INITIAL_PASSWORD must be at least 12 characters.');
    process.exitCode = 1;
    return;
  }

  const existingCount = await prisma.superadminUser.count();
  if (existingCount > 0) {
    console.error('A Superadmin account already exists — refusing to create a second one or overwrite the existing password.');
    console.error('To change the password, log in and use Settings → "Şifrəni dəyiş" instead of this script.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(initialPassword);
  await prisma.superadminUser.create({ data: { email, passwordHash } });

  console.log(`Superadmin account created for ${email}.`);
  console.log('IMPORTANT: remove SUPERADMIN_EMAIL and SUPERADMIN_INITIAL_PASSWORD from your environment now —');
  console.log('this script never reads them again after this point, so leaving the initial password sitting');
  console.log('in plaintext in your .env file is an unnecessary, avoidable exposure.');
}

main()
  .catch((err) => {
    console.error('Bootstrap failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
