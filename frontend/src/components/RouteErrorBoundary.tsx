import { Component, type ReactNode } from 'react';

/** Catches render/chunk-load errors in a lazy-loaded route subtree (React error boundaries must be
 * class components — there's no hooks equivalent). Deliberately does not depend on LanguageContext
 * or any other provider: if something is broken badly enough to reach here, the fallback UI must
 * not risk depending on the same tree that just failed. Reload is the only realistic recovery for
 * a stale chunk-load error (a new deploy shipped after this tab's HTML was loaded). */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[RouteErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-[420px] mx-auto px-6 py-20 text-center">
          <p className="text-[15px] text-text2 mb-4">
            Səhifə yüklənə bilmədi. Zəhmət olmasa yenidən cəhd edin.
            <br />
            The page failed to load. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-full bg-teal text-white font-semibold text-[13.5px]"
          >
            Yenilə / Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
