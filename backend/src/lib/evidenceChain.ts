import type { Importance, ReqStatus } from './scoring.js';

/** Per-requirement trace: vacancy requirement -> CV evidence -> match status -> the CV Change Plan
 * card that addresses it (if any) -> the Interview Playbook question that probes it (if any).
 * Pure derivation from data already generated and stored (resultJson / cvChangePlanJson /
 * interviewPrepJson) — no AI call, just string-matching requirement titles that all three AI
 * generations were given the same source list of. This is what makes PeekMatch's recommendations
 * traceable end-to-end rather than three disconnected documents. */
export interface EvidenceChainLink {
  requirement: string;
  category: string;
  importance: Importance;
  status: ReqStatus;
  evidence: string;
  relatedChangeSection: string | null;
  relatedInterviewQuestion: string | null;
}

interface ChainRequirement {
  title: string;
  category: string;
  importance: Importance;
  status: ReqStatus;
  evidence: string;
}
interface ChainCard {
  section: string;
  relatedRequirements: string[];
}
interface ChainQuestion {
  question: string;
  relatedRequirement: string;
}

function titleMatches(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function buildEvidenceChain(
  requirements: ChainRequirement[],
  cvChangeCards: ChainCard[],
  interviewQuestions: ChainQuestion[],
): EvidenceChainLink[] {
  return requirements.map((r) => {
    const relatedCard = cvChangeCards.find((c) => c.relatedRequirements.some((rr) => titleMatches(rr, r.title)));
    const relatedQuestion = interviewQuestions.find((q) => titleMatches(q.relatedRequirement, r.title));
    return {
      requirement: r.title,
      category: r.category,
      importance: r.importance,
      status: r.status,
      evidence: r.evidence,
      relatedChangeSection: relatedCard?.section ?? null,
      relatedInterviewQuestion: relatedQuestion?.question ?? null,
    };
  });
}
