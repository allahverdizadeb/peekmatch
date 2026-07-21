// Tracks one explicit, honest user action: "I've reviewed this interview question" — a per-question
// completion signal for the Interview Playbook tab (Workspace.tsx's QuestionCard/Accordion progress
// counts). Client-only (localStorage, keyed by analysisId), same rationale as lib/localCardState.ts:
// there's no natural backend entity to persist a single click against.
const QUESTION_PREFIX = 'peekmatch:journey:question:';

function questionKey(analysisId: string, questionKey: string): string {
  return `${QUESTION_PREFIX}${analysisId}:${questionKey}`;
}

export function isQuestionReviewed(analysisId: string, questionId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(questionKey(analysisId, questionId)) === '1';
}

export function toggleQuestionReviewed(analysisId: string, questionId: string): boolean {
  const next = !isQuestionReviewed(analysisId, questionId);
  if (typeof window === 'undefined') return next;
  localStorage.setItem(questionKey(analysisId, questionId), next ? '1' : '0');
  return next;
}

export function countReviewedQuestions(analysisId: string, questionIds: string[]): number {
  return questionIds.filter((id) => isQuestionReviewed(analysisId, id)).length;
}
