import { Link } from 'react-router-dom';
import clsx from 'clsx';

export function AlertCard({
  severity,
  title,
  body,
  link,
}: {
  severity: 'negative' | 'warning' | 'positive';
  title: string;
  body: string;
  link?: string;
}) {
  const cls = severity === 'negative' ? 'border-danger/30 bg-danger-bg' : severity === 'positive' ? 'border-success/30 bg-success-bg' : 'border-warning/30 bg-warning-bg';
  const textCls = severity === 'negative' ? 'text-danger' : severity === 'positive' ? 'text-success' : 'text-warning';
  const content = (
    <div className={clsx('border rounded-rk p-3.5', cls)}>
      <div className={clsx('text-[12.5px] font-bold mb-1', textCls)}>{title}</div>
      <div className="text-[12.5px] text-text2 leading-relaxed">{body}</div>
    </div>
  );
  return link ? (
    <Link to={link} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

export function InsightCard({ kind, text, metric }: { kind: 'fakt' | 'ferziyye' | 'tovsiye'; text: string; metric?: string }) {
  const labelMap = { fakt: 'Fakt', ferziyye: 'Fərziyyə', tovsiye: 'Tövsiyə' };
  const toneMap = { fakt: 'text-teal bg-[var(--color-sa-active-bg)]', ferziyye: 'text-warning bg-warning-bg', tovsiye: 'text-premium bg-premium-bg' };
  return (
    <div className="border border-border rounded-rk p-3.5">
      <span className={clsx('inline-block text-[10.5px] font-extrabold tracking-wide uppercase px-2 py-0.5 rounded-full mb-2', toneMap[kind])}>
        {labelMap[kind]}
      </span>
      <p className="text-[12.5px] text-text2 leading-relaxed">{text}</p>
      {metric && <p className="text-[11px] text-muted mt-1.5">Göstərici: {metric}</p>}
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-rl bg-bg2 animate-pulse" />
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-danger/30 bg-danger-bg rounded-rk p-4 text-[13px] text-danger flex items-center justify-between gap-3">
      <span>{message}</span>
      <button onClick={onRetry} className="underline font-semibold whitespace-nowrap">
        Yenidən cəhd et
      </button>
    </div>
  );
}

export function EmptyBlock({ title, body }: { title: string; body?: string }) {
  return (
    <div className="border border-dashed border-border rounded-rk py-10 text-center">
      <p className="text-[13.5px] font-semibold text-navy mb-1">{title}</p>
      {body && <p className="text-[12.5px] text-text2">{body}</p>}
    </div>
  );
}

export function ProviderNotConnectedNote() {
  return (
    <div className="bg-warning-bg text-warning text-[12.5px] font-medium rounded-rk px-3.5 py-2 mb-4">
      Ödəniş provayderi (Payriff) qoşulmayıb — maliyyə göstəriciləri real inteqrasiya aktivləşənə qədər əlçatan deyil.
    </div>
  );
}

export function SampleDataBanner() {
  return (
    <div className="bg-warning-bg text-warning text-[12.5px] font-medium rounded-rk px-3.5 py-2 mb-4">
      Dizayn nümunə məlumatı — real PeekMatch göstəriciləri deyil.
    </div>
  );
}
