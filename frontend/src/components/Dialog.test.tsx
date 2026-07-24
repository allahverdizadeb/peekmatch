// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { Dialog } from './Dialog';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('Dialog', () => {
  it('renders its content, with the correct dialog role/aria wiring, as a child of document.body (portalled)', () => {
    render(
      <Dialog titleId="t" closing={false} onRequestClose={() => {}}>
        <h2 id="t">Title</h2>
        <button>Action</button>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('t');
    // Portalled directly to document.body — not nested inside whatever arbitrary tree rendered it,
    // so no ancestor (e.g. an animated route wrapper) can ever redefine its containing block. See
    // the root-cause writeup in Dialog.tsx.
    expect(dialog.closest('body')).toBe(document.body);
    expect(screen.getByText('Action')).toBeTruthy();
  });

  it(
    'regression guard: the scrollable-centered-dialog structure is present — an overlay with ' +
      'overflow-y-auto, a min-h-full centering wrapper, and a height-capped, independently-scrollable ' +
      'dialog box. This is the actual fix for the reported bug (a dialog taller than the viewport used ' +
      'to render starting above y:0 with no way to scroll to the clipped top) — losing any one of these ' +
      'three pieces reintroduces it.',
    () => {
      render(
        <Dialog titleId="t" closing={false} onRequestClose={() => {}}>
          <h2 id="t">Title</h2>
        </Dialog>,
      );
      const dialog = screen.getByRole('dialog');

      const overlay = dialog.closest('.fixed.inset-0') as HTMLElement | null;
      expect(overlay, 'overlay (fixed inset-0) must exist as an ancestor').not.toBeNull();
      expect(overlay!.className).toMatch(/overflow-y-auto/);
      // items-center centering must NOT be on the scrolling overlay itself (that reintroduces the
      // clipping bug) — it belongs on an inner wrapper with min-h-full so it can grow past the
      // viewport instead of clipping the dialog inside it.
      expect(overlay!.className).not.toMatch(/items-center/);

      const wrapper = overlay!.firstElementChild as HTMLElement;
      expect(wrapper.className).toMatch(/min-h-full/);
      expect(wrapper.className).toMatch(/items-center/);
      expect(wrapper.className).toMatch(/justify-center/);

      expect(dialog.className).toMatch(/dialog-max-height/);
      expect(dialog.className).toMatch(/overflow-y-auto/);
    },
  );

  it('data-state reflects the closing prop on both the backdrop and the dialog box, for the CSS exit animation', () => {
    const { rerender } = render(
      <Dialog titleId="t" closing={false} onRequestClose={() => {}}>
        <h2 id="t">Title</h2>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.closest('.fixed.inset-0') as HTMLElement;
    expect(overlay.getAttribute('data-state')).toBe('open');
    expect(dialog.getAttribute('data-state')).toBe('open');

    rerender(
      <Dialog titleId="t" closing={true} onRequestClose={() => {}}>
        <h2 id="t">Title</h2>
      </Dialog>,
    );
    expect(overlay.getAttribute('data-state')).toBe('closed');
    expect(dialog.getAttribute('data-state')).toBe('closed');
  });

  it('clicking the backdrop calls onRequestClose; clicking inside the dialog box does not', () => {
    let closeCalls = 0;
    render(
      <Dialog titleId="t" closing={false} onRequestClose={() => closeCalls++}>
        <h2 id="t">Title</h2>
        <button>Inside</button>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.closest('.fixed.inset-0') as HTMLElement;

    screen.getByText('Inside').click();
    expect(closeCalls, 'a click inside the dialog must not close it').toBe(0);

    overlay.click();
    expect(closeCalls, 'a click on the backdrop must close it').toBe(1);
  });
});
