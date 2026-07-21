import { useState } from 'react';
import clsx from 'clsx';
import { Copy, Check, Pencil, ChevronDown, ChevronUp, PenLine, CirclePlus, CircleHelp, MinusCircle } from 'lucide-react';
import { Card, Badge, Button } from './ui';
import { PriorityChip, priorityBorderClass, type PriorityLevel } from './PriorityChip';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { track } from '../lib/analytics';
import { getCardState, setCardState } from '../lib/localCardState';
import type { CvChangeCard as CvChangeCardData } from '../lib/api';

// Visual differentiation between the four change types goes beyond the text label: each gets its
// own icon + tone, applied to both the header badge and (via priorityBorderClass reuse pattern) a
// left-border accent strip, so the card's purpose is legible at a glance without reading text.
const CHANGE_TYPE_STYLE: Record<CvChangeCardData['changeType'], { icon: typeof PenLine; text: string; bg: string; border: string }> = {
  rewrite: { icon: PenLine, text: 'text-navy', bg: 'bg-bg2', border: 'border-l-navy' },
  add: { icon: CirclePlus, text: 'text-teal', bg: 'bg-success-bg', border: 'border-l-teal' },
  clarify: { icon: CircleHelp, text: 'text-info', bg: 'bg-info-bg', border: 'border-l-info' },
  remove: { icon: MinusCircle, text: 'text-muted', bg: 'bg-bg2', border: 'border-l-border-strong' },
};

/** One CV Change Plan card — shared between the single unlocked example on the free Results page
 * and the full plan in the paid Workspace tab. Short by default (section/type badges, the one-line
 * "what to change", the one-line "why", and the copy-ready recommended text) with the current CV
 * text / related requirements / cited evidence tucked behind a single "Ətraflı" toggle — kept out
 * of the default view so a page of 6-10 cards stays scannable rather than reading like a report.
 * Completion/edit state is client-only (localCardState.ts) — there's no backend entity per
 * interaction. */
export function CvChangeCard({
  card,
  analysisId,
  cardIndex,
  onChange,
}: {
  card: CvChangeCardData;
  analysisId: string;
  cardIndex: number;
  /** Notified after completed/edited state changes, so a parent showing an aggregate (e.g. a "X of
   * Y completed" progress bar) can recompute it — this component owns its own localStorage-backed
   * state and doesn't lift it up otherwise. */
  onChange?: () => void;
}) {
  const { t } = useLanguage();
  const [state, setState] = useState(() => getCardState(analysisId, cardIndex));
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const displayText = state.editedText ?? card.recommendedText;
  const hasDetails = Boolean(card.currentText) || card.relatedRequirements.length > 0 || card.evidenceFromCv.length > 0;

  function copy() {
    navigator.clipboard.writeText(displayText);
    setCopied(true);
    track({ name: 'cv_change_copied', metadata: { changeType: card.changeType, priority: card.priority } }, analysisId);
    setTimeout(() => setCopied(false), 1800);
  }

  function toggleComplete() {
    setState(setCardState(analysisId, cardIndex, { completed: !state.completed }));
    onChange?.();
  }

  function startEdit() {
    setDraft(displayText);
    setEditing(true);
  }

  function saveEdit() {
    setState(setCardState(analysisId, cardIndex, { editedText: draft }));
    setEditing(false);
    onChange?.();
  }

  const changeStyle = CHANGE_TYPE_STYLE[card.changeType];
  const ChangeIcon = changeStyle.icon;

  return (
    <Card className={clsx('p-5', priorityBorderClass(card.priority as PriorityLevel), state.completed && 'opacity-60')}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityChip level={card.priority as PriorityLevel} label={t.workspace.importanceLabel[card.priority]} />
          <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold', changeStyle.bg, changeStyle.text)}>
            <ChangeIcon className="w-3.5 h-3.5 flex-none" aria-hidden="true" />
            {t.cvChangePlan.changeTypeLabel[card.changeType]}
          </span>
          {state.completed && <Badge tone="success">{t.cvChangePlan.completedBadge}</Badge>}
        </div>
        <span className="text-[13px] font-semibold text-text2">{card.section}</span>
      </div>

      {card.whatToChange && <p className="text-[14px] font-semibold text-navy mb-1.5">{card.whatToChange}</p>}
      {card.problem && <p className="text-[13px] text-text2 mb-3">{card.problem}</p>}

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11.5px] font-semibold text-success">{t.cvChangePlan.recommendedTextLabel}</div>
          {!editing && (
            <button className="text-[12px] font-semibold text-teal flex items-center gap-1" onClick={startEdit}>
              <Pencil className="w-3 h-3" />
              {t.cvChangePlan.editButton}
            </button>
          )}
        </div>
        {editing ? (
          <div>
            <textarea
              className="w-full border border-border rounded-rk p-2.5 text-[13.5px] focus-ring"
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={saveEdit}>
                {t.cvChangePlan.saveEditButton}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                {t.common.change}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[13.5px] leading-relaxed bg-success-bg rounded-rk p-2.5 whitespace-pre-wrap">{displayText}</p>
        )}
      </div>

      {hasDetails && (
        <div className="mb-1">
          <button
            type="button"
            className="text-[12px] font-semibold text-teal hover:text-teal-h flex items-center gap-1 focus-ring rounded-rk"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((v) => !v)}
          >
            {detailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {t.cvChangePlan.detailsToggleLabel}
          </button>
          {detailsOpen && (
            <div className="grid gap-3 mt-3">
              {card.currentText && (
                <div>
                  <div className="text-[11.5px] font-semibold text-muted mb-1">{t.cvChangePlan.currentTextLabel}</div>
                  <p className="text-[13px] text-text2 italic bg-bg rounded-rk p-2.5">"{card.currentText}"</p>
                </div>
              )}
              {card.relatedRequirements.length > 0 && (
                <div>
                  <div className="text-[11.5px] font-semibold text-muted mb-1">{t.cvChangePlan.relatedRequirementsLabel}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {card.relatedRequirements.map((r, i) => (
                      <span key={i} className="text-[12px] bg-bg2 rounded-full px-2.5 py-1 text-text2">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {card.evidenceFromCv.length > 0 && (
                <div>
                  <div className="text-[11.5px] font-semibold text-muted mb-1">{t.cvChangePlan.evidenceLabel}</div>
                  <ul className="grid gap-1">
                    {card.evidenceFromCv.map((e, i) => (
                      <li key={i} className="text-[12.5px] text-text2">
                        • {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-3 border-t border-border mt-3">
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t.cvChangePlan.copiedButton : t.cvChangePlan.copyButton}
        </Button>
        <Button size="sm" variant={state.completed ? 'primary' : 'secondary'} onClick={toggleComplete}>
          <Check className="w-3.5 h-3.5" />
          {t.cvChangePlan.markCompleteButton}
        </Button>
      </div>
    </Card>
  );
}
