export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="5" width="14" height="19" rx="3" fill="#DCEFEC" stroke="#0F9D91" strokeWidth="1.6" />
      <rect x="12" y="9" width="16" height="19" rx="3" fill="#0F9D91" />
      <path d="M16 19.5l2.6 2.6 5-5.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5 font-bold tracking-tight" style={{ fontSize: size }}>
      <LogoMark size={size * 1.35} />
      <span>
        Peek<span className="text-teal">Match</span>
      </span>
    </div>
  );
}
