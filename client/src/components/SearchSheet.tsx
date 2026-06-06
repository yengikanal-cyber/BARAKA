import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, SearchResult } from '../api';
import { Avatar } from './Avatar';
import { Sheet } from './Sheet';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful connect so the parent can refresh its list. */
  onConnected: () => void;
};

export function SearchSheet({ open, onClose, onConnected }: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  // Live search (debounced) from 1 char
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 1) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const id = ++reqId.current;
    const handle = setTimeout(async () => {
      try {
        const res = await api.searchUsers(term);
        if (id === reqId.current) setResults(res.results);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [q, open]);

  async function connect(r: SearchResult) {
    setAdding(r.id);
    try {
      await api.addConnection(r.id);
      setResults(rs => rs.map(x => x.id === r.id ? { ...x, connected: true } : x));
      onConnected();
    } catch (e: any) {
      if (e?.message === 'already_connected') {
        setResults(rs => rs.map(x => x.id === r.id ? { ...x, connected: true } : x));
      }
    } finally {
      setAdding(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('contacts.searchTitle')} maxWidth="480px">
      <div className="relative mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 muted pointer-events-none">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
        </svg>
        <input
          ref={inputRef}
          className="input !pl-9"
          placeholder={t('contacts.searchPh')}
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="min-h-[120px]">
        {loading && results.length === 0 ? (
          <div className="text-center muted text-sm py-8">{t('common.loading')}</div>
        ) : q.trim().length < 1 ? (
          <div className="text-center muted text-sm py-8">{t('contacts.searchHint')}</div>
        ) : results.length === 0 ? (
          <div className="text-center muted text-sm py-8">{t('contacts.searchEmpty')}</div>
        ) : (
          <div className="space-y-1.5">
            {results.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2 rounded-glass hover:bg-black/5 dark:hover:bg-white/5 spring">
                <Avatar src={r.avatar_url} name={r.name} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs muted truncate">@{r.nickname}{r.phone ? ` · ${r.phone}` : ''}</div>
                </div>
                {r.connected ? (
                  <span className="text-xs px-2.5 py-1 rounded-full pill-green whitespace-nowrap">
                    {t('contacts.connected')}
                  </span>
                ) : (
                  <button
                    className="btn-primary text-xs !py-1.5 !px-3"
                    disabled={adding === r.id}
                    onClick={() => connect(r)}
                  >
                    {adding === r.id ? t('common.saving') : t('contacts.add')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
