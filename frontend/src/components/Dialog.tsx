import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useModalA11y } from '../lib/useModalA11y';

/** Shared full-screen dialog shell — every modal in the app (DeleteConfirmDialog,
 * NewAnalysisConfirmModal, and any future one) should render its content through this rather than
 * hand-rolling the overlay/centering/scroll/focus wiring again.
 *
 * Two compounding root causes were found and fixed here:
 *
 * 1. The old per-modal markup was `fixed inset-0 flex items-center justify-center`, which has no
 *    escape hatch once the dialog's own content is taller than the viewport — flexbox centers it
 *    symmetrically around the midpoint regardless of whether that pushes the top half above
 *    `y: 0`, the overlay itself had no `overflow-y`, and body scroll was separately locked, so the
 *    clipped top portion (title, icon) was **permanently unreachable**, not just visually cut off.
 *    Fixed by the standard "scrollable centered dialog" pattern below.
 *
 * 2. A deeper, app-wide regression: `App.tsx`'s route-transition wrapper (`.route-fade`) plays a
 *    CSS `animation` whose keyframes include `transform`. Per the CSS containing-block spec, any
 *    ancestor with a non-`none` *computed* transform becomes the containing block for
 *    `position: fixed` descendants instead of the viewport — and browsers keep reporting a
 *    non-`none` transform (an identity matrix) for an element that has ever run a
 *    transform-touching animation, even long after it finishes. Confirmed live: with `.route-fade`
 *    present, the modal overlay's own computed height was 69px (the transformed ancestor's own
 *    content box) instead of the viewport's 600px — no amount of internal overlay/dialog CSS can
 *    fix a `fixed` element whose containing block isn't the viewport at all. Fixed by rendering
 *    this dialog through a **portal to `document.body`**, so its DOM subtree has no ancestor from
 *    the routed React tree — immune to this bug and any future ancestor transform/filter/
 *    perspective/contain anywhere in the app, not just today's `.route-fade`.
 *
 * The scrollable-centered-dialog pattern itself: the OVERLAY (not the dialog) is the scroll
 * container (`overflow-y: auto`), and a `min-h-full` flex wrapper centers the dialog via
 * `items-center` when it fits — but because the wrapper's height is a *minimum*, not a fixed
 * height, a dialog taller than the viewport simply grows the wrapper instead of being clipped, and
 * the overlay's own scrolling reveals the rest (including the top) with zero negative offset.
 * `.dialog-max-height` is a second, defensive layer for the pathological case where even that
 * scroll would need to be very long — it caps the dialog's own height and lets it scroll
 * internally instead. */
export function Dialog({
  titleId,
  descriptionId,
  closing,
  onRequestClose,
  maxWidthClassName = 'max-w-[440px]',
  children,
}: {
  /** id of the element containing the dialog's title — wired to aria-labelledby. */
  titleId: string;
  /** id of the element containing the dialog's supporting text, if any — wired to aria-describedby. */
  descriptionId?: string;
  closing: boolean;
  onRequestClose: () => void;
  maxWidthClassName?: string;
  children: ReactNode;
}) {
  const dialogRef = useModalA11y(onRequestClose);

  return createPortal(
    <div
      className="motion-backdrop fixed inset-0 z-50 overflow-y-auto bg-navy/40 backdrop-blur-sm"
      data-state={closing ? 'closed' : 'open'}
      onClick={onRequestClose}
    >
      {/* min-h-full (not h-full): lets this wrapper grow taller than the viewport when the dialog
          needs more room, instead of forcing the dialog to overflow it. items-center then centers
          the dialog only when there's genuine extra space to center within. Safe top/bottom
          padding (py-8) keeps the dialog off the viewport edges in both the fits and scrolls cases;
          px-6 mirrors the horizontal inset the old inline padding had. */}
      <div className="min-h-full flex items-center justify-center px-6 py-8">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          className={clsx(
            'motion-dialog dialog-max-height overflow-y-auto bg-white border border-border rounded-rl shadow-sh-lg p-7 w-full text-center focus:outline-none',
            maxWidthClassName,
          )}
          data-state={closing ? 'closed' : 'open'}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
