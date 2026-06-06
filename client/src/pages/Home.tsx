import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, Contact } from '../api';
import { formatMoney } from '../i18n';
import { Avatar } from '../components/Avatar';

type Summary = { debt: number; turnover: number; paid: number; contacts: number };

export function Home() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const buyerSide = user?.role === 'buyer' || user?.role === 'partner';

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([api.statsSummary(), api.listContacts()]);
        setSummary(s);
        setContacts(c.contacts);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!user) return null;

  const debtLabel = buyerSide ? t('home.myDebt') : t('home.receivable');

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-4">
      {/* Greeting */}
      <div className="card flex items-center gap-4">
        <Avatar src={user.avatar_url} name={user.name} size={56} />
        <div className="min-w-0">
          <div className="text-sm muted">{t('home.hello')},</div>
          <div className="font-display text-2xl font-semibold leading-tight truncate">{user.name}</div>
          <div className="text-sm muted mt-0.5">@{user.nickname} · {t(`roles.${user.role}`)}</div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={debtLabel} value={summary?.debt} loading={loading} lang={i18n.language} tone="red" />
        <StatCard label={t('home.turnover')} value={summary?.turnover} loading={loading} lang={i18n.language} tone="accent" />
        <StatCard label={t('home.paid')} value={summary?.paid} loading={loading} lang={i18n.language} tone="green" />
      </div>

      {/* Recent contacts */}
      <div className="card">
        <div className="flex items-center mb-3">
          <div className="font-semibold flex-1">{buyerSide ? t('nav.sellers') : t('nav.clients')}</div>
          <button className="text-sm spring" style={{ color: 'rgb(var(--accent-600))' }} onClick={() => navigate(buyerSide ? '/sellers' : '/clients')}>
            {t('home.viewAll')}
          </button>
        </div>
        {loading ? (
          <div className="muted text-sm text-center py-4">{t('common.loading')}</div>
        ) : contacts.length === 0 ? (
          <div className="muted text-sm text-center py-4">{t('contacts.empty')}</div>
        ) : (
          <div className="space-y-1">
            {contacts.slice(0, 6).map(c => (
              <button key={c.connection_id} onClick={() => navigate(`/chat/${c.other_id}`)} className="w-full flex items-center gap-3 p-2 rounded-glass hover:bg-black/5 dark:hover:bg-white/5 spring text-left">
                <Avatar src={c.avatar_url} name={c.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs muted truncate">@{c.nickname}</div>
                </div>
                {c.debt > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full pill-red whitespace-nowrap">
                    {formatMoney(c.debt, i18n.language)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, lang, tone }: {
  label: string; value?: number; loading: boolean; lang: string; tone: 'red' | 'green' | 'accent';
}) {
  const color = tone === 'red' ? 'rgb(220 38 38)' : tone === 'green' ? 'rgb(22 163 74)' : 'rgb(var(--accent-700))';
  return (
    <div className="card !p-3 text-center">
      <div className="text-[11px] muted mb-1 leading-tight">{label}</div>
      <div className="font-display font-semibold text-sm sm:text-base leading-tight break-words" style={{ color }}>
        {loading ? '…' : formatMoney(value ?? 0, lang)}
      </div>
    </div>
  );
}
