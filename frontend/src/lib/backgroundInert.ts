/** Reference-counted `inert` toggle on the app root, mirroring bodyScrollLock.ts's counting
 * strategy (see that file's comment for why a plain snapshot/restore per instance is unsafe with
 * more than one dialog open). While at least one dialog is open, `#root` (everything the page
 * itself renders) is marked `inert` — screen readers and keyboard navigation skip it entirely,
 * not just visually hidden content, so background content is genuinely unreachable rather than
 * merely obscured. Only possible because dialogs are portaled to `document.body` (see
 * components/Dialog.tsx) and are therefore NOT inside `#root` themselves — inerting `#root` while
 * a dialog renders as its sibling cannot accidentally inert the dialog too. */
let lockCount = 0;

function getRoot(): HTMLElement | null {
  return document.getElementById('root');
}

export function lockBackgroundInert(): void {
  if (lockCount === 0) {
    getRoot()?.setAttribute('inert', '');
  }
  lockCount++;
}

export function unlockBackgroundInert(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    getRoot()?.removeAttribute('inert');
  }
}
