import { prisma } from '../db.js';

export type PackageId = 1 | 2;

// Package 1 unlocks the full report + CV Change Plan + Evidence Chain (previously split across two
// separate report / CV-and-letter tiers) — merged into one, since a report you can't act on isn't a
// meaningful standalone purchase. Package 2 adds the Interview Playbook on top.
export const PACKAGES: Record<PackageId, { name: string; priceUsd: number }> = {
  1: { name: 'Müraciət Paketi', priceUsd: 0.9 },
  2: { name: 'Müsahibəyə Hazır Paketi', priceUsd: 2.9 },
};

/** Highest package a set of paid orders unlocks. Packages are cumulative — owning 2 implies 1.
 * Any stale `package: 3` row from before the 3-tier -> 2-tier restructure is defensively capped to
 * 2 (the new top tier). Other unrecognized numbers are ignored rather than treated as an unlock. */
export function highestOwnedPackage(paidPackages: number[]): PackageId | 0 {
  if (paidPackages.includes(2) || paidPackages.includes(3)) return 2;
  if (paidPackages.includes(1)) return 1;
  return 0;
}

export async function ownedPackages(analysisId: string): Promise<number[]> {
  const orders = await prisma.order.findMany({ where: { analysisId, status: 'paid' } });
  return orders.map((o) => o.package);
}

/** Price to charge when upgrading from `owned` to `pkg` — the gap between tiers, computed in
 * integer cents to avoid float artifacts (e.g. 2.90 - 0.90 in raw floats). */
export function upgradePriceUsd(pkg: PackageId, owned: PackageId | 0): number {
  const baseCents = Math.round(PACKAGES[pkg].priceUsd * 100);
  const ownedCents = owned === 0 ? 0 : Math.round(PACKAGES[owned].priceUsd * 100);
  return Math.max(0, baseCents - ownedCents) / 100;
}

/** Gates: report, CV Change Plan, and Evidence Chain all unlock together at package 1+. */
export function unlocksApplication(owned: number): boolean {
  return owned >= 1;
}
export function unlocksInterview(owned: number): boolean {
  return owned >= 2;
}
