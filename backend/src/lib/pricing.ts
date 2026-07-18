import { prisma } from '../db.js';

export type PackageId = 1 | 2 | 3;

export const PACKAGES: Record<PackageId, { name: string; priceUsd: number }> = {
  1: { name: 'Tam uyğunluq hesabatı', priceUsd: 0.49 },
  2: { name: 'Vakansiyaya uyğun CV və cover letter', priceUsd: 0.99 },
  3: { name: 'Tam müraciət və müsahibə paketi', priceUsd: 5.9 },
};

/** Highest package a set of paid orders unlocks. Packages are cumulative — owning 3 implies 1 and 2. */
export function highestOwnedPackage(paidPackages: number[]): PackageId | 0 {
  if (paidPackages.includes(3)) return 3;
  if (paidPackages.includes(2)) return 2;
  if (paidPackages.includes(1)) return 1;
  return 0;
}

export async function ownedPackages(analysisId: string): Promise<number[]> {
  const orders = await prisma.order.findMany({ where: { analysisId, status: 'paid' } });
  return orders.map((o) => o.package);
}

/** Price to charge when upgrading from `owned` to `pkg` — the gap between tiers, computed in
 * integer cents to avoid float artifacts (e.g. 5.90 - 0.99 in raw floats). */
export function upgradePriceUsd(pkg: PackageId, owned: PackageId | 0): number {
  const baseCents = Math.round(PACKAGES[pkg].priceUsd * 100);
  const ownedCents = owned === 0 ? 0 : Math.round(PACKAGES[owned].priceUsd * 100);
  return Math.max(0, baseCents - ownedCents) / 100;
}

export function unlocksReport(owned: number): boolean {
  return owned >= 1;
}
export function unlocksCv(owned: number): boolean {
  return owned >= 2;
}
export function unlocksInterview(owned: number): boolean {
  return owned >= 3;
}
