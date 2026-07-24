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

function TestModalMultiFocus({ onClose }: { onClose: () => void }) {
  const dialogRef = useModalA11y(onClose);
  return (
    <div ref={dialogRef} role="dialog" tabIndex={-1}>
      <button>First</button>
      <button>Middle</button>
      <button>Last</button>
    </div>
  );
}

function setupRootEl() {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  document.getElementById('root')?.remove();
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

  it('marks #root inert while mounted, and removes it on unmount', () => {
    setupRootEl();
    const { unmount } = render(<TestModal onClose={() => {}} />);
    expect(document.getElementById('root')?.hasAttribute('inert')).toBe(true);
    unmount();
    expect(document.getElementById('root')?.hasAttribute('inert')).toBe(false);
  });

  it('Tab from the last focusable element wraps to the first (focus trap)', () => {
    render(<TestModalMultiFocus onClose={() => {}} />);
    const buttons = document.querySelectorAll('[role="dialog"] button');
    (buttons[buttons.length - 1] as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement?.textContent).toBe('First');
  });

  it('Shift+Tab from the first focusable element wraps to the last (reverse focus trap)', () => {
    render(<TestModalMultiFocus onClose={() => {}} />);
    (document.querySelector('[role="dialog"] button') as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement?.textContent).toBe('Last');
  });

  it('Tab from a middle element is left alone — only the boundary elements wrap', () => {
    render(<TestModalMultiFocus onClose={() => {}} />);
    const buttons = document.querySelectorAll('[role="dialog"] button');
    (buttons[1] as HTMLElement).focus();
    const notPrevented = fireEvent.keyDown(document, { key: 'Tab' });
    expect(notPrevented, 'native Tab behavior must not be hijacked for a non-boundary element').toBe(true);
  });
});
