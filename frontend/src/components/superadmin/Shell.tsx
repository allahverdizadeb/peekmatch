import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Filter as FilterIcon,
  ShoppingCart,
  Package as PackageIcon,
  CreditCard,
  FileSearch,
  HeartPulse,
  Settings as SettingsIcon,
  Menu,
  X,
  Download,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import { useSuperadminAuth } from '../../lib/superadminAuthContext';
import { useSuperadminFilters } from '../../lib/useSuperadminFilters';
import { logout } from '../../lib/superadminApi';
import { Logo } from '../Logo';

const NAV_ITEMS = [
  { to: '/superadmin/overview', label: 'Ümumi baxış', icon: LayoutDashboard },
  { to: '/superadmin/traffic', label: 'Trafik', icon: Activity },
  { to: '/superadmin/funnel', label: 'Funnel', icon: FilterIcon },
  { to: '/superadmin/sales', label: 'Satışlar', icon: ShoppingCart },
  { to: '/superadmin/packages', label: 'Paketlər', icon: PackageIcon },
  { to: '/superadmin/payments', label: 'Ödənişlər', icon: CreditCard },
  { to: '/superadmin/analysis', label: 'Analizlər', icon: FileSearch },
  { to: '/superadmin/health', label: 'Sistem sağlamlığı', icon: HeartPulse },
  { to: '/superadmin/settings', label: 'Tənzimləmələr', icon: SettingsIcon },
];

const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'today', label: 'Bu gün' },
  { value: 'yesterday', label: 'Dünən' },
  { value: '7d', label: 'Son 7 gün' },
  { value: '30d', label: 'Son 30 gün' },
  { value: 'this_month', label: 'Bu ay' },
  { value: 'last_month', label: 'Keçən ay' },
];

const COMPARE_OPTIONS: { value: string; label: string }[] = [
  { value: 'previous_period', label: 'Əvvəlki dövr' },
  { value: 'previous_day', label: 'Əvvəlki gün' },
  { value: 'previous_week', label: 'Əvvəlki həftə' },
  { value: 'previous_month', label: 'Əvvəlki ay' },
  { value: 'none', label: 'Yoxdur' },
];

function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { queryString } = useSuperadminFilters();
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose} />}
      <aside
        className={clsx(
          'w-[248px] flex-none bg-ink text-white flex flex-col fixed inset-y-0 left-0 z-50 transition-transform md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <Logo size={17} />
          <span className="text-[10.5px] font-bold tracking-wide text-white/50 border border-white/20 rounded px-1.5 py-0.5">ADMIN</span>
        </div>
        <nav className="flex-1 px-3 py-2 grid gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={`${item.to}${queryString ? `?${queryString}` : ''}`}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-rk text-[13.5px] font-medium transition-colors',
                  isActive ? 'bg-[var(--color-sa-active-bg)] text-teal font-semibold' : 'text-white/70 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon className="w-4 h-4 flex-none" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

function DateRangeSelector() {
  const { range, setRange } = useSuperadminFilters();
  return (
    <div className="flex items-center gap-1 bg-bg2 rounded-rk p-1 overflow-x-auto">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setRange(opt.value)}
          className={clsx(
            'px-3 py-1.5 rounded-[8px] text-[12.5px] font-semibold whitespace-nowrap transition-colors',
            range === opt.value ? 'bg-white text-navy shadow-sh-sm' : 'text-text2 hover:text-navy',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ComparisonSelector() {
  const { compare, setCompare } = useSuperadminFilters();
  return (
    <select
      value={compare}
      onChange={(e) => setCompare(e.target.value)}
      className="text-[12.5px] font-medium text-text2 bg-transparent border border-border rounded-rk px-2.5 py-1.5 focus-ring"
    >
      {COMPARE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function RefreshIndicator({ lastRefreshedAt, refreshing, onRefresh }: { lastRefreshedAt: Date | null; refreshing: boolean; onRefresh: () => void }) {
  const label = lastRefreshedAt
    ? `Yeniləndi: ${lastRefreshedAt.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}`
    : 'Yenilənir…';
  return (
    <button onClick={onRefresh} className="flex items-center gap-1.5 text-[12px] text-muted hover:text-navy transition-colors" disabled={refreshing}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-none', refreshing ? 'bg-warning' : 'bg-success')} aria-hidden="true" />
      <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
      {label}
    </button>
  );
}

function ProfileMenu() {
  const { me, signOutLocally } = useSuperadminAuth();
  const [open, setOpen] = useState(false);
  async function doLogout() {
    try {
      await logout();
    } catch {
      // proceed with local sign-out regardless — the cookie may already be gone
    }
    signOutLocally();
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-[12.5px] font-semibold text-navy">
        <span className="w-7 h-7 rounded-full bg-teal text-white flex items-center justify-center text-[11px] font-bold">
          {me?.email.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{me?.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-rk shadow-sh-lg py-1.5 z-50">
          <button
            onClick={doLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-danger hover:bg-danger-bg text-left"
          >
            <LogOut className="w-3.5 h-3.5" /> Çıxış
          </button>
        </div>
      )}
    </div>
  );
}

export function SuperadminShell({
  title,
  subtitle,
  lastRefreshedAt,
  refreshing,
  onRefresh,
  onExport,
  exportLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  lastRefreshedAt?: Date | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  exportLabel?: string;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="md:pl-[248px]">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-border">
          <div className="max-w-[1320px] mx-auto px-5 md:px-8 py-4">
            <div className="flex items-center gap-3 mb-1">
              <button className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Menyu">
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="font-display text-[22px] font-semibold text-navy">{title}</h1>
              {mobileOpen && (
                <button className="ml-auto md:hidden" onClick={() => setMobileOpen(false)} aria-label="Bağla">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            {subtitle && <p className="text-[13px] text-text2 mb-3">{subtitle}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <DateRangeSelector />
              <ComparisonSelector />
              {onRefresh && <RefreshIndicator lastRefreshedAt={lastRefreshedAt ?? null} refreshing={Boolean(refreshing)} onRefresh={onRefresh} />}
              {onExport && (
                <button
                  onClick={onExport}
                  className="flex items-center gap-1.5 text-[12.5px] font-semibold text-navy border border-border rounded-rk px-3 py-1.5 hover:bg-bg2 ml-auto"
                >
                  <Download className="w-3.5 h-3.5" /> {exportLabel ?? 'İxrac'}
                </button>
              )}
              <div className={clsx(!onExport && 'ml-auto')}>
                <ProfileMenu />
              </div>
            </div>
          </div>
        </header>
        <main key={location.pathname} className="max-w-[1320px] mx-auto px-5 md:px-8 py-6 route-fade">
          {children}
        </main>
      </div>
    </div>
  );
}
