// Per-card "completed" / "edited text" state for CV Change Plan cards. There's no natural backend
// entity to persist this against without a table per click, so it's kept client-side, keyed by
// analysisId + card index — resets if the browser storage is cleared.
export interface CardState {
  completed: boolean;
  editedText: string | null;
}

const DEFAULT_STATE: CardState = { completed: false, editedText: null };
const STORAGE_PREFIX = 'peekmatch:cardstate:';

function storageKey(analysisId: string, cardIndex: number): string {
  return `${STORAGE_PREFIX}${analysisId}:${cardIndex}`;
}

export function getCardState(analysisId: string, cardIndex: number): CardState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  const raw = localStorage.getItem(storageKey(analysisId, cardIndex));
  if (!raw) return DEFAULT_STATE;
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function setCardState(analysisId: string, cardIndex: number, patch: Partial<CardState>): CardState {
  const next = { ...getCardState(analysisId, cardIndex), ...patch };
  localStorage.setItem(storageKey(analysisId, cardIndex), JSON.stringify(next));
  return next;
}

export function countCompletedCards(analysisId: string, totalCards: number): number {
  let n = 0;
  for (let i = 0; i < totalCards; i++) if (getCardState(analysisId, i).completed) n++;
  return n;
}
