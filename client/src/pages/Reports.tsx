import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, StatsReport } from '../api';
import { formatMoney } from '../i18n';
import { Avatar } from '../components/Avatar';

export function Reports() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<StatsReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setData(await api.statsReport()); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="max-w-4xl mx-auto py-10 text-center muted">{t('common.loading')}</div>;
  if (!data) return <div className="max-w-4xl mx-auto py-10 text-center muted">{t('common.error')}</div>;

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-4">
      <h1 className="font-display text-2xl font-semibold px-1">{t('nav.reports')}</h1>

      {/* 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label={t('home.turnover')} value={data.cards.turnover} lang={i18n.language} tone="accent" />
        <Card label={t('home.paid')} value={data.cards.paid} lang={i18n.language} tone="green" />
        <Card label={data.sellerSide ? t('home.receivable') : t('home.myDebt')} value={data.cards.debt} lang={i18n.language} tone="red" />
        <Card label={t('reports.returns')} value={data.cards.returns} lang={i18n.language} tone="gold" />
      </div>

      {/* Counts */}
      <div className="card grid grid-cols-3 gap-3 text-center">
        <Count label={t('tx.type.delivery')} n={data.counts.delivery} />
        <Count label={t('tx.type.order')} n={data.counts.order} />
        <Count label={t('tx.type.return')} n={data.counts.return} />
      </div>

      {/* 6-month chart */}
      <div className="card">
        <div className="font-semibold mb-3">{t('reports.monthly')}</div>
        <BarChart data={data.monthly} lang={i18n.language} />
      </div>

      {/* Top partners */}
      <div className="card">
        <div className="font-semibold mb-3">{data.sellerSide ? t('reports.topClients') : t('reports.topSellers')}</div>
        {data.topPartners.length === 0 ? (
          <div className="muted text-sm text-center py-3">{t('common.empty')}</div>
        ) : (
          <div className="space-y-1">
            {data.topPartners.map((p, i) => p.user && (
              <button key={p.user.id} onClick={() => navigate(`/chat/${p.user!.id}`)} className="w-full flex items-center gap-3 p-2 rounded-glass hover:bg-black/5 dark:hover:bg-white/5 spring text-left">
                <span className="w-5 text-center font-semibold muted text-sm">{i + 1}</span>
                <Avatar src={p.user.avatar_url} name={p.user.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate text-sm">{p.user.name}</div>
                  <div className="text-xs muted truncate">@{p.user.nickname}</div>
                </div>
                <span className="font-display font-semibold text-sm" style={{ color: 'rgb(var(--accent-700))' }}>{formatMoney(p.total, i18n.language)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Top products */}
      <div className="card">
        <div className="font-semibold mb-3">{t('reports.topProducts')}</div>
        {data.topProducts.length === 0 ? (
          <div className="muted text-sm text-center py-3">{t('common.empty')}</div>
        ) : (
          <div className="space-y-1">
            {data.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 p-2">
                <span className="w-5 text-center font-semibold muted text-sm">{i + 1}</span>
                <div className="min-w-0 flex-1 font-medium truncate text-sm">{p.name}</div>
                <span className="text-xs muted whitespace-nowrap">{p.qty}</span>
                <span className="font-display font-semibold text-sm w-28 text-right" style={{ color: 'rgb(var(--accent-700))' }}>{formatMoney(p.total, i18n.language)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, lang, tone }: { label: string; value: number; lang: string; tone: 'red' | 'green' | 'accent' | 'gold' }) {
  const color = tone === 'red' ? 'rgb(220 38 38)' : tone === 'green' ? 'rgb(22 163 74)' : tone === 'gold' ? 'rgb(161 98 7)' : 'rgb(var(--accent-700))';
  return (
    <div className="card !p-3 text-center">
      <div className="text-[11px] muted mb-1 leading-tight">{label}</div>
      <div className="font-display font-semibold text-sm sm:text-base break-words" style={{ color }}>{formatMoney(value, lang)}</div>
    </div>
  );
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <div>
      <div className="font-display text-2xl font-semibold" style={{ color: 'rgb(var(--accent-700))' }}>{n}</div>
      <div className="text-xs muted">{label}</div>
    </div>
  );
}

function BarChart({ data, lang }: { data: { month: string; total: number }[]; lang: string }) {
  const max = useMemo(() => Math.max(1, ...data.map(d => d.total)), [data]);
  const monthName = (m: string) => {
    const [y, mm] = m.split('-').map(Number);
    return new Date(y, mm - 1, 1).toLocaleDateString(lang, { month: 'short' });
  };
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map(d => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={formatMoney(d.total, lang)}>
          <div className="text-[9px] muted">{d.total > 0 ? Math.round(d.total / 1000) + 'k' : ''}</div>
          <div
            className="w-full rounded-t-lg spring"
            style={{
              height: `${Math.max(2, (d.total / max) * 100)}%`,
              background: 'linear-gradient(to top, rgb(var(--accent-500)), rgb(var(--accent-400)))',
              minHeight: 4,
            }}
          />
          <div className="text-[10px] muted">{monthName(d.month)}</div>
        </div>
      ))}
    </div>
  );
}
