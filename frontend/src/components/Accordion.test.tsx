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
});
