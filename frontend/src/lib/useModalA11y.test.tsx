// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useModalA11y } from './useModalA11y';

function TestModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useModalA11y(onClose);
  return (
    <div>
      <button data-testid="trigger">outside trigger</button>
      <div ref={dialogRef} role="dialog" tabIndex={-1}>
        <button data-testid="first-action">confirm</button>
      </div>
    </div>
  );
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('useModalA11y', () => {
  it('moves focus into the dialog on mount (to the first focusable element)', () => {
    render(<TestModal onClose={() => {}} />);
    expect(document.activeElement).toBe(document.querySelector('[data-testid="first-action"]'));
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<TestModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks background scroll while mounted', () => {
    render(<TestModal onClose={() => {}} />);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores focus to whatever had it before, and unlocks scroll, on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open modal';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(<TestModal onClose={() => {}} />);
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement, 'focus must return to the element that opened the modal').toBe(trigger);
    expect(document.body.style.overflow).toBe('');

    trigger.remove();
  });
});
