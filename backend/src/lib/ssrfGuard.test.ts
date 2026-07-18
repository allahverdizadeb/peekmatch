import { describe, it, expect } from 'vitest';
import { isPrivateOrReservedIp } from './ssrfGuard.js';

describe('isPrivateOrReservedIp — IPv4', () => {
  it('blocks loopback', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('127.255.255.254')).toBe(true);
  });

  it('blocks the cloud metadata endpoint address (169.254.169.254) and the whole link-local range', () => {
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.0.1')).toBe(true);
  });

  it('blocks all three RFC1918 private ranges', () => {
    expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.255.255.255')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.31.255.255')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.255.255')).toBe(true);
  });

  it('does NOT block the public internet adjacent to a private range — boundary correctness matters, not just "roughly private"', () => {
    expect(isPrivateOrReservedIp('172.15.255.255')).toBe(false); // just below 172.16.0.0/12
    expect(isPrivateOrReservedIp('172.32.0.0')).toBe(false); // just above 172.16.0.0/12
    expect(isPrivateOrReservedIp('11.0.0.1')).toBe(false); // just above 10.0.0.0/8
    expect(isPrivateOrReservedIp('192.167.255.255')).toBe(false); // just below 192.168.0.0/16
  });

  it('allows well-known real public DNS resolver IPs', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
  });

  it('blocks 0.0.0.0/8 and multicast/reserved space', () => {
    expect(isPrivateOrReservedIp('0.0.0.0')).toBe(true);
    expect(isPrivateOrReservedIp('224.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('255.255.255.255')).toBe(true);
  });
});

describe('isPrivateOrReservedIp — IPv6', () => {
  it('blocks loopback and unspecified', () => {
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('::')).toBe(true);
  });

  it('blocks link-local (fe80::/10) and unique-local (fc00::/7)', () => {
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
    expect(isPrivateOrReservedIp('fd12:3456:789a::1')).toBe(true);
  });

  it('unwraps IPv4-mapped IPv6 addresses and checks the embedded IPv4', () => {
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:8.8.8.8')).toBe(false);
  });

  it('allows a real public IPv6 address', () => {
    expect(isPrivateOrReservedIp('2606:4700:4700::1111')).toBe(false); // Cloudflare DNS
  });
});
