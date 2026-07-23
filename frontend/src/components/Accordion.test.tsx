// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { Accordion } from './Accordion';

afterEach(cleanup);

const ITEMS = [
  { key: 'a', title: 'Question A', content: 'Answer A' },
  { key: 'b', title: 'Question B', content: 'Answer B' },
];

describe('Accordion', () => {
  it('starts fully collapsed by default (aria-expanded=false, content inert)', () => {
    render(<Accordion items={ITEMS} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    const panel = document.getElementById(buttons[0].getAttribute('aria-controls')!);
    expect(panel?.getAttribute('data-state')).toBe('closed');
  });

  it('opens a section on click — aria-expanded flips, content is no longer inert, and content is present in the DOM (not unmounted, so it can transition height)', () => {
    render(<Accordion items={ITEMS} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
    const panel = document.getElementById(buttons[0].getAttribute('aria-controls')!);
    expect(panel?.getAttribute('data-state')).toBe('open');
    expect(panel?.hasAttribute('inert')).toBe(false);
    expect(screen.getByText('Answer A')).toBeTruthy();
  });

  it('is single-open by default — opening a second section closes the first', () => {
    render(<Accordion items={ITEMS} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('allowMultiple lets more than one section stay open at once', () => {
    render(<Accordion items={ITEMS} allowMultiple />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking an open section again collapses it', () => {
    render(<Accordion items={ITEMS} defaultOpenKey="a" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(buttons[0]);
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('opening one item only reveals its own answer, not a sibling\'s', () => {
    render(<Accordion items={ITEMS} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(screen.getByText('Answer A')).toBeTruthy();
    const panelB = document.getElementById(buttons[1].getAttribute('aria-controls')!);
    expect(panelB?.getAttribute('data-state')).toBe('closed');
  });

  it('the header control is a native <button> — Enter/Space activation and focusability come from HTML semantics, not custom key handling', () => {
    render(<Accordion items={ITEMS} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].tagName).toBe('BUTTON');
    expect(buttons[0].getAttribute('type')).toBe('button');
  });

  it(
    'regression guard: the collapsible panel\'s answer content is never a direct child of the ' +
      'grid-collapse element — padding/margin on that direct child would render as visible height ' +
      'even when the row is collapsed to 0fr, since a box\'s own padding/margin is not clipped by ' +
      'its own overflow:hidden (this was the actual bug: a sliver of answer text stayed visible, ' +
      'and the fix was moving the padded content one level deeper so it becomes clippable content ' +
      'instead of the collapsing box\'s own box-model spacing)',
    () => {
      render(<Accordion items={ITEMS} />);
      const buttons = screen.getAllByRole('button');
      const panel = document.getElementById(buttons[0].getAttribute('aria-controls')!)!;
      const directChild = panel.firstElementChild!;

      expect(directChild, 'the grid item must exist').toBeTruthy();
      expect(
        directChild.className,
        'the grid item itself (which gets overflow:hidden via .motion-collapse > *) must carry no padding/margin utility classes',
      ).not.toMatch(/\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-\d/);

      // The actual answer text must be nested inside that padding-free wrapper, not sitting
      // directly on it.
      expect(directChild.textContent).toContain('Answer A');
      expect(directChild.children.length, 'answer content must be nested one level deeper, inside a padded child').toBeGreaterThan(0);
    },
  );
});
