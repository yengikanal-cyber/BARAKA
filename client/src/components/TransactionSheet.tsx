import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, NewTxItem, Product, Transaction, TxType, UNITS } from '../api';
import { formatMoney } from '../i18n';
import { Sheet } from './Sheet';

type Line = NewTxItem & { key: string };

type Props = {
  open: boolean;
  onClose: () => void;
  otherId: number;
  iAmSeller: boolean;
  onCreated: (tx: Transaction, debt: number) => void;
};

let keySeq = 0;
const nextKey = () => `l${++keySeq}`;

export function TransactionSheet({ open, onClose, otherId, iAmSeller, onCreated }: Props) {
  const { t, i18n } = useTranslation();
  const types: TxType[] = iAmSeller ? ['delivery'] : ['order', 'return'];
  const [type, setType] = useState<TxType>(types[0]);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(types[0]);
    setLines([]);
    setNote('');
    setQuery('');
    setErr(null);
    // Load the relevant catalog (own for seller, the seller's for buyer).
    (async () => {
      try {
        const res = iAmSeller
          ? await api.listProducts()
          : await api.listProductsByManufacturer(otherId);
        setProducts(res.products);
      } catch { setProducts([]); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, otherId, iAmSeller]);

  const total = useMemo(() => lines.reduce((s, l) => s + l.price * l.quantity, 0), [lines]);

  function addProduct(p: Product) {
    setLines(ls => {
      const existing = ls.find(l => l.product_id === p.id);
      if (existing) return ls.map(l => l === existing ? { ...l, quantity: l.quantity + 1 } : l);
      return [...ls, { key: nextKey(), product_id: p.id, name: p.name, unit: p.unit, price: p.price, quantity: 1 }];
    });
  }
  function addManual() {
    setLines(ls => [...ls, { key: nextKey(), product_id: null, name: '', unit: 'dona', price: 0, quantity: 1 }]);
  }
  function update(key: string, patch: Partial<Line>) {
    setLines(ls => ls.map(l => l.key === key ? { ...l, ...patch } : l));
  }
  function remove(key: string) {
    setLines(ls => ls.filter(l => l.key !== key));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
  }, [products, query]);

  const valid = lines.length > 0 && lines.every(l => l.name.trim() && l.quantity > 0);

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setErr(null);
    try {
      const items: NewTxItem[] = lines.map(l => ({
        product_id: l.product_id ?? null,
        name: l.name.trim(),
        unit: l.unit,
        price: l.price,
        quantity: l.quantity,
      }));
      const res = await api.createTransaction({ otherId, type, items, note: note.trim() || null });
      onCreated(res.transaction, res.debt);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('tx.newTitle')}
      maxWidth="560px"
      footer={
        <>
          <div className="mr-auto font-display font-semibold">
            {t('tx.total')}: <span style={{ color: 'rgb(var(--accent-700))' }}>{formatMoney(total, i18n.language)}</span>
          </div>
          <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={!valid || saving} onClick={submit}>
            {saving ? t('common.saving') : t('tx.create')}
          </button>
        </>
      }
    >
      {/* Type selector */}
      {types.length > 1 && (
        <div className="flex gap-2 mb-3">
          {types.map(tp => (
            <button
              key={tp}
              onClick={() => setType(tp)}
              className={`px-3 py-1.5 rounded-btn text-sm spring ${type === tp ? 'font-semibold' : 'muted'}`}
              style={type === tp ? { background: 'rgb(var(--accent-500) / 0.16)', color: 'rgb(var(--accent-700))' } : undefined}
            >
              {t(`tx.type.${tp}`)}
            </button>
          ))}
        </div>
      )}

      {/* Selected lines */}
      {lines.length > 0 && (
        <div className="space-y-2 mb-3">
          {lines.map(l => (
            <div key={l.key} className="card !p-2.5 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {l.product_id == null ? (
                  <input
                    className="input !py-1.5 !text-sm mb-1"
                    placeholder={t('tx.itemName')}
                    value={l.name}
                    onChange={e => update(l.key, { name: e.target.value })}
                  />
                ) : (
                  <div className="font-medium truncate text-sm">{l.name}</div>
                )}
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min="0" step="any"
                    className="input !py-1 !px-2 !text-sm !w-24"
                    value={l.quantity}
                    onChange={e => update(l.key, { quantity: Number(e.target.value) })}
                  />
                  <select
                    className="input !py-1 !px-2 !text-sm !w-20"
                    value={l.unit}
                    onChange={e => update(l.key, { unit: e.target.value })}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{t(`units.${u}`)}</option>)}
                  </select>
                  <span className="muted text-sm">×</span>
                  <input
                    type="number" min="0" step="any"
                    className="input !py-1 !px-2 !text-sm !w-28"
                    value={l.price}
                    onChange={e => update(l.key, { price: Number(e.target.value) })}
                  />
                </div>
              </div>
              <button className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 spring" onClick={() => remove(l.key)} aria-label="remove">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {err && <div className="text-sm text-red-500 mb-2">{t('tx.createError')}</div>}

      {/* Catalog picker */}
      <div className="label">{t('tx.pickProducts')}</div>
      <input className="input mb-2" placeholder={t('common.search')} value={query} onChange={e => setQuery(e.target.value)} />
      <div className="max-h-56 overflow-y-auto space-y-1 mb-2">
        {filtered.length === 0 ? (
          <div className="muted text-sm text-center py-4">{t('tx.noProducts')}</div>
        ) : filtered.map(p => (
          <button key={p.id} onClick={() => addProduct(p)} className="w-full flex items-center gap-2 p-2 rounded-glass hover:bg-black/5 dark:hover:bg-white/5 spring text-left">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs muted">{formatMoney(p.price, i18n.language)} / {t(`units.${p.unit}`)}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4" style={{ color: 'rgb(var(--accent-600))' }}><path d="M12 5v14M5 12h14" /></svg>
          </button>
        ))}
      </div>
      <button className="btn-ghost text-sm w-full mb-3" onClick={addManual}>＋ {t('tx.addManual')}</button>

      {/* Note / reason */}
      <div className="label">{type === 'return' ? t('tx.reason') : t('tx.note')}</div>
      <textarea className="input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={type === 'return' ? t('tx.reasonPh') : t('tx.notePh')} />
    </Sheet>
  );
}
