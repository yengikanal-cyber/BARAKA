import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from './Avatar';

type NavItem = { to: string; label: string; icon: ReactNode };

function HomeIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>; }
function UsersIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M22 19c0-2.6-2-4.5-5-4.5"/></svg>; }
function CatalogIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/></svg>; }
function ReportIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M4 19V5M4 19h16M8 16V10M12 16V7M16 16v-4"/></svg>; }
function ChatIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5A8 8 0 1 1 21 12z"/></svg>; }
function UserIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>; }

function navFor(role: string, t: (k: string) => string): NavItem[] {
  switch (role) {
    case 'manufacturer':
      return [
        { to: '/', label: t('nav.home'), icon: <HomeIcon /> },
        { to: '/clients', label: t('nav.clients'), icon: <UsersIcon /> },
        { to: '/catalog', label: t('nav.catalog'), icon: <CatalogIcon /> },
        { to: '/reports', label: t('nav.reports'), icon: <ReportIcon /> },
        { to: '/profile', label: t('nav.profile'), icon: <UserIcon /> },
      ];
    case 'accountant':
      return [
        { to: '/', label: t('nav.home'), icon: <HomeIcon /> },
        { to: '/clients', label: t('nav.clients'), icon: <UsersIcon /> },
        { to: '/reports', label: t('nav.reports'), icon: <ReportIcon /> },
        { to: '/profile', label: t('nav.profile'), icon: <UserIcon /> },
      ];
    case 'staff':
      return [
        { to: '/', label: t('nav.home'), icon: <HomeIcon /> },
        { to: '/clients', label: t('nav.myClients'), icon: <UsersIcon /> },
        { to: '/reports', label: t('nav.reports'), icon: <ReportIcon /> },
        { to: '/profile', label: t('nav.profile'), icon: <UserIcon /> },
      ];
    case 'buyer':
    case 'partner':
      return [
        { to: '/', label: t('nav.home'), icon: <HomeIcon /> },
        { to: '/sellers', label: t('nav.sellers'), icon: <UsersIcon /> },
        { to: '/reports', label: t('nav.reports'), icon: <ReportIcon /> },
        { to: '/messages', label: t('nav.messages'), icon: <ChatIcon /> },
        { to: '/profile', label: t('nav.profile'), icon: <UserIcon /> },
      ];
    default:
      return [{ to: '/profile', label: t('nav.profile'), icon: <UserIcon /> }];
  }
}

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const loc = useLocation();
  if (!user) return <>{children}</>;
  const items = navFor(user.role, t);

  return (
    <div className="min-h-screen">
      {/* Desktop top bar */}
      <header className="hidden md:block sticky top-0 z-30">
        <div className="glass-strong mx-3 mt-3 px-5 py-3 flex items-center gap-4">
          <div className="font-display font-bold text-lg" style={{ color: 'rgb(var(--accent-600))' }}>
            {t('app.name')}
          </div>
          <div className="flex-1" />
          <div className="text-sm muted hidden lg:block">@{user.nickname} · {t(`roles.${user.role}`)}</div>
          <Avatar src={user.avatar_url || undefined} name={user.name} size={36} />
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 px-3 pt-3">
        <div className="glass-strong px-4 py-3 flex items-center gap-3">
          <div className="font-display font-bold text-lg" style={{ color: 'rgb(var(--accent-600))' }}>
            {t('app.name')}
          </div>
          <div className="flex-1" />
          <Avatar src={user.avatar_url || undefined} name={user.name} size={32} />
        </div>
      </header>

      <div className="flex md:gap-4 md:px-3 mt-3">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-60 shrink-0 sticky top-20 self-start">
          <nav className="glass p-2 flex flex-col gap-1">
            {items.map(it => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-btn spring ${
                    isActive
                      ? 'bg-accent-500/15 text-accent-700 dark:text-accent-200 font-medium'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`
                }
              >
                {it.icon}
                <span>{it.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 px-3 md:px-0 pb-28 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden fixed bottom-3 left-3 right-3 z-30 glass-strong px-1.5 py-1.5 flex items-stretch justify-around"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        {items.map(it => {
          const active = it.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(it.to);
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-btn spring text-[10.5px] ${
                active
                  ? 'text-accent-700 dark:text-accent-200 font-semibold'
                  : 'muted'
              }`}
              style={active ? { background: 'rgb(var(--accent-500) / 0.14)' } : undefined}
            >
              {it.icon}
              <span>{it.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
