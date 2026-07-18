/** SSRF protection for any server-side fetch of a user-supplied URL (currently: vacancy URL
 * extraction). A user can submit ANY URL; without this, the server would happily fetch
 * http://127.0.0.1:4000/api/health, cloud metadata endpoints (http://169.254.169.254/...), or
 * other internal-network addresses on the user's behalf. Protocol restriction alone (http/https
 * only) does not prevent this — the host/IP itself must be checked. */

const IPV4_PRIVATE_RANGES: [number, number][] = [
  [ipToInt('0.0.0.0'), ipToInt('0.255.255.255')], // "this" network
  [ipToInt('10.0.0.0'), ipToInt('10.255.255.255')], // RFC1918
  [ipToInt('100.64.0.0'), ipToInt('100.127.255.255')], // carrier-grade NAT
  [ipToInt('127.0.0.0'), ipToInt('127.255.255.255')], // loopback
  [ipToInt('169.254.0.0'), ipToInt('169.254.255.255')], // link-local (cloud metadata: 169.254.169.254)
  [ipToInt('172.16.0.0'), ipToInt('172.31.255.255')], // RFC1918
  [ipToInt('192.0.0.0'), ipToInt('192.0.0.255')], // IETF protocol assignments
  [ipToInt('192.168.0.0'), ipToInt('192.168.255.255')], // RFC1918
  [ipToInt('198.18.0.0'), ipToInt('198.19.255.255')], // benchmarking
  [ipToInt('224.0.0.0'), ipToInt('255.255.255.255')], // multicast + reserved
];

function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return false;
  const parts = ip.split('.').map(Number);
  if (parts.some((p) => p > 255)) return false;
  const n = ipToInt(ip);
  return IPV4_PRIVATE_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // unique local fc00::/7
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 address — unwrap and check the embedded IPv4.
    const v4 = lower.slice('::ffff:'.length);
    return isPrivateIPv4(v4);
  }
  return false;
}

/** True if `ip` (either family) is a private, loopback, link-local, or otherwise non-public
 * address that a server should never fetch on a user's behalf. */
export function isPrivateOrReservedIp(ip: string): boolean {
  return ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

export class SsrfBlockedError extends Error {
  constructor(host: string) {
    super(`Blocked fetch to non-public address: ${host}`);
  }
}
