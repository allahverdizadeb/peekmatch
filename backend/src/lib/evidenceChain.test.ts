import { describe, it, expect } from 'vitest';
import { buildEvidenceChain } from './evidenceChain.js';

const requirements = [
  { title: 'Power BI', category: 'Texniki bacarıqlar', importance: 'kritik' as const, status: 'missing' as const, evidence: '' },
  { title: 'SQL', category: 'Texniki bacarıqlar', importance: 'əsas' as const, status: 'partial' as const, evidence: 'Qismən istifadə' },
];

describe('buildEvidenceChain', () => {
  it('links a requirement to a CV Change Plan card that lists it in relatedRequirements', () => {
    const cards = [{ section: 'Skills', relatedRequirements: ['Power BI'] }];
    const chain = buildEvidenceChain(requirements, cards, []);
    expect(chain.find((c) => c.requirement === 'Power BI')?.relatedChangeSection).toBe('Skills');
    expect(chain.find((c) => c.requirement === 'SQL')?.relatedChangeSection).toBeNull();
  });

  it('links a requirement to an interview question whose relatedRequirement matches', () => {
    const questions = [{ question: 'Tell me about your Power BI experience.', relatedRequirement: 'Power BI' }];
    const chain = buildEvidenceChain(requirements, [], questions);
    expect(chain.find((c) => c.requirement === 'Power BI')?.relatedInterviewQuestion).toBe('Tell me about your Power BI experience.');
  });

  it('matches case-insensitively and via substring, since AI-generated titles are not guaranteed byte-identical', () => {
    const cards = [{ section: 'Skills', relatedRequirements: ['power bi (Microsoft)'] }];
    const chain = buildEvidenceChain(requirements, cards, []);
    expect(chain.find((c) => c.requirement === 'Power BI')?.relatedChangeSection).toBe('Skills');
  });

  it('returns null (not undefined or a crash) for a requirement with no related change or question', () => {
    const chain = buildEvidenceChain(requirements, [], []);
    expect(chain).toHaveLength(2);
    for (const link of chain) {
      expect(link.relatedChangeSection).toBeNull();
      expect(link.relatedInterviewQuestion).toBeNull();
    }
  });

  it('preserves every requirement field (importance/status/evidence) unchanged in the chain', () => {
    const chain = buildEvidenceChain(requirements, [], []);
    expect(chain[0]).toMatchObject({ requirement: 'Power BI', importance: 'kritik', status: 'missing', evidence: '' });
  });
});
