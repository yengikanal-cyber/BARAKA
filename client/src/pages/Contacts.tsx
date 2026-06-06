import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, Contact } from '../api';
import { formatMoney } from '../i18n';
import { Avatar } from '../components/Avatar';
import { SearchSheet } from '../components/SearchSheet';

type Filter = 'all' | 'debtors';

export function Contacts() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [searchOpen, setSearchOpen] = useState(false);

  // Buyer-side users connect to manufacturers ("Sotuvchilar"); others to clients.
  const buyerSide = user?.role === 'buyer' || user?.role === 'partner';
  const titleKey = buyerSide ? 'nav.sellers' : (user?.role === 'staff' ? 'nav.myClients' : 'nav.clients');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listContacts();
      setContacts(res.contacts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(
    () => filter === 'debtors' ? contacts.filter(c => c.debt > 0) : contacts,
    [contacts, filter],
  );

  const empty = !loading && shown.length === 0;

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-4">
      <div className="flex items-center gap-3 px-1">
        <h1 className="font-display text-2xl font-semibold flex-1">{t(titleKey)}</h1>
        <button className="btn-primary" onClick={() => setSearchOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg>
          <span className="hidden sm:inline">{t('contacts.add')}</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="card !p-2">
        <div className="flex gap-2">
          {(['all', 'debtors'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-btn text-sm whitespace-nowrap spring ${filter === f ? 'font-semibold' : 'muted'}`}
              style={filter === f ? { background: 'rgb(var(--accent-500) / 0.16)', color: 'rgb(var(--accent-700))' } : undefined}
            >
              {f === 'all' ? t('contacts.filterAll') : t('contacts.filterDebtors')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card text-center muted">{t('common.loading')}</div>
      ) : empty ? (
        <div className="card text-center py-10">
          <div className="font-display text-lg font-semibold mb-1">
            {filter === 'debtors' ? t('contacts.noDebtors') : t('contacts.empty')}
          </div>
          {filter !== 'debtors' && <div className="muted text-sm">{t('contacts.emptyHint')}</div>}
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map(c => (
            <button
              key={c.connection_id}
              onClick={() => navigate(`/chat/${c.other_id}`)}
              className="card !p-3 w-full flex items-center gap-3 text-left hover:scale-[1.01] spring"
            >
              <Avatar src={c.avatar_url} name={c.name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs muted truncate">@{c.nickname}{c.phone ? ` · ${c.phone}` : ''}</div>
              </div>
              {c.debt > 0 ? (
                <div className="text-right shrink-0">
                  <div className="text-[10px] muted leading-none mb-1">{t('contacts.debt')}</div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full pill-red whitespace-nowrap">
                    {formatMoney(c.debt, i18n.language)}
                  </span>
                </div>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 muted shrink-0"><path d="M9 6l6 6-6 6" /></svg>
              )}
            </button>
          ))}
        </div>
      )}

      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} onConnected={load} />
    </div>
  );
}
