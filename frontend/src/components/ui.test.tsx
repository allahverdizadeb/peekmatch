// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { Button } from './ui';

afterEach(cleanup);

describe('Button loading/disabled state', () => {
  it('is disabled while loading, even without an explicit disabled prop', () => {
    render(<Button loading>Submit</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('is enabled by default', () => {
    render(<Button>Submit</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('respects an explicit disabled prop independent of loading', () => {
    render(<Button disabled>Submit</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('still renders its label while loading — loading adds a spinner, it does not replace the content', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button').textContent).toContain('Submit');
  });
});
