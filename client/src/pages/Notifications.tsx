import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, Notification } from '../api';
import { formatMoney } from '../i18n';

/** Build the localized message for a notification from its type + data. */
function useNotifText() {
  const { t, i18n } = useTranslation();
  return (n: Notification): string => {
    const d = n.data || {};
    const name = (d.name as string) || (d.nickname as string) || '';
    const total = typeof d.total === 'number' ? formatMoney(d.total, i18n.language) : '';
    const vars = { name, total, title: n.body || '' };
    // i18n key mirrors the server's notification `type`.
    const text = t(`notif.${n.type}`, { ...vars, defaultValue: '' });
    if (text) return text;
    return n.body || t('notif.generic');
  };
}

const ICON: Record<string, string> = {
  connection: 'M16 11a4 4 0 1 0-8 0M3 21c0-4 4-6 9-6s9 2 9 6',
  message: 'M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5A8 8 0 1 1 21 12z',
  tx: 'M4 7h16M4 12h16M4 17h10',
  reward: 'M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z',
};

function iconFor(type: string): string {
  if (type.startsWith('connection')) return ICON.connection;
  if (type.startsWith('message')) return ICON.message;
  if (type.startsWith('tx')) return ICON.tx;
  if (type.startsWith('reward')) return ICON.reward;
  return ICON.message;
}

export function Notifications() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const text = useNotifText();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.listNotifications();
        setItems(res.notifications);
        // Mark everything read once viewed so the badge clears.
        if (res.unread > 0) {
          await api.markAllRead();
          setItems(res.notifications.map(n => ({ ...n, is_read: true })));
        }
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-4">
      <div className="flex items-center gap-3 px-1">
        <button onClick={() => navigate(-1)} className="rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 spring">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h1 className="font-display text-2xl font-semibold flex-1">{t('notif.title')}</h1>
      </div>

      {loading ? (
        <div className="card text-center muted">{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-10">
          <div className="font-display text-lg font-semibold mb-1">{t('notif.empty')}</div>
          <div className="muted text-sm">{t('notif.emptyHint')}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <div key={n.id} className="card !p-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgb(var(--accent-500) / 0.14)', color: 'rgb(var(--accent-700))' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><path d={iconFor(n.type)} /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">{text(n)}</div>
                <div className="text-[11px] muted mt-0.5">{new Date(n.created_at + 'Z').toLocaleString(i18n.language)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
