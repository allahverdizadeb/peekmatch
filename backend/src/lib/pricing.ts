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

export function unlocksReport(owned: number): boolean {
  return owned >= 1;
}
export function unlocksCv(owned: number): boolean {
  return owned >= 2;
}
export function unlocksInterview(owned: number): boolean {
  return owned >= 3;
}
