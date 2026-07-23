import { describe, it, expect } from 'vitest';
import { toPublicRef, maskReference, generateUniqueReference } from './masking.js';

describe('toPublicRef', () => {
  it('is deterministic — the same raw id always produces the same reference', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(toPublicRef('AN', id)).toBe(toPublicRef('AN', id));
  });

  it('never contains the raw id substring', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(toPublicRef('AN', id)).not.toContain(id);
  });

  it('different ids produce different references (no accidental collisions for distinct input)', () => {
    expect(toPublicRef('AN', 'id-one')).not.toBe(toPublicRef('AN', 'id-two'));
  });
});

describe('maskReference', () => {
  it('shows only the prefix + first 4 body characters, replacing the rest with bullets', () => {
    expect(maskReference('PM-7F3A9C21B4')).toBe('PM-7F3A••••');
  });

  it('returns the input unchanged if it has no dash (defensive fallback)', () => {
    expect(maskReference('NODASH')).toBe('NODASH');
  });
});

describe('generateUniqueReference', () => {
  it('retries on collision and eventually returns a value not flagged as existing', async () => {
    let calls = 0;
    const ref = await generateUniqueReference('PM', async () => {
      calls++;
      return calls < 3; // first two candidates "already exist", third is free
    });
    expect(ref.startsWith('PM-')).toBe(true);
    expect(calls).toBe(3);
  });

  it('throws after repeated collisions rather than looping forever', async () => {
    await expect(generateUniqueReference('PM', async () => true)).rejects.toThrow();
  });
});
