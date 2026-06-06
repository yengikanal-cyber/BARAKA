import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

/**
 * Bell button shown in the top bar. Polls the unread notification count every
 * 30s and refreshes whenever the route changes (e.g. after viewing the
 * notifications page, which marks everything read).
 */
export function NotificationBell({ size = 38 }: { size?: number }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);

  async function refresh() {
    try {
      const res = await api.unreadCount();
      setUnread(res.unread);
    } catch { /* ignore transient errors */ }
  }

  useEffect(() => { refresh(); }, [loc.pathname]);
  useEffect(() => {
    const h = setInterval(refresh, 30000);
    return () => clearInterval(h);
  }, []);

  return (
    <button
      onClick={() => navigate('/notifications')}
      aria-label="notifications"
      className="relative rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 spring shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
