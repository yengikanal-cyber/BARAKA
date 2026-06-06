import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api, Product } from '../api';
import { formatMoney } from '../i18n';
import { ProductFormSheet } from '../components/ProductFormSheet';
import { ConfirmDialog } from '../components/Sheet';

export function Catalog() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const canEdit = user?.role === 'manufacturer';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listProducts(category ? { category } : {});
      setProducts(res.products);
      setCategories(res.categories);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  function onAdded(p: Product) {
    setProducts(ps => [p, ...ps]);
    if (p.category && !categories.includes(p.category)) {
      setCategories(c => [...c, p.category!].sort());
    }
  }
  function onEdited(p: Product) {
    setProducts(ps => ps.map(x => x.id === p.id ? p : x));
    if (p.category && !categories.includes(p.category)) {
      setCategories(c => [...c, p.category!].sort());
    }
  }

  async function toggleStock(p: Product) {
    // optimistic
    setProducts(ps => ps.map(x => x.id === p.id ? { ...x, in_stock: !x.in_stock } : x));
    try {
      const res = await api.toggleStock(p.id);
      setProducts(ps => ps.map(x => x.id === res.product.id ? res.product : x));
    } catch {
      // rollback
      setProducts(ps => ps.map(x => x.id === p.id ? p : x));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    setProducts(ps => ps.filter(x => x.id !== id));
    try { await api.deleteProduct(id); } catch { load(); }
  }

  const empty = useMemo(() => !loading && products.length === 0, [loading, products]);

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-4">
      <div className="flex items-center gap-3 px-1">
        <h1 className="font-display text-2xl font-semibold flex-1">{t('catalog.title')}</h1>
        {canEdit && (
          <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>
            <span className="hidden sm:inline">{t('catalog.addProduct')}</span>
          </button>
        )}
      </div>

      {/* Category filter */}
      {(categories.length > 0 || category) && (
        <div className="card !p-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setCategory(null)}
              className={`px-3 py-1.5 rounded-btn text-sm whitespace-nowrap spring ${category === null ? 'font-semibold' : 'muted'}`}
              style={category === null ? { background: 'rgb(var(--accent-500) / 0.16)', color: 'rgb(var(--accent-700))' } : undefined}
            >
              {t('catalog.filterAll')}
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-btn text-sm whitespace-nowrap spring ${category === c ? 'font-semibold' : 'muted'}`}
                style={category === c ? { background: 'rgb(var(--accent-500) / 0.16)', color: 'rgb(var(--accent-700))' } : undefined}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card text-center muted">{t('common.loading')}</div>
      ) : empty ? (
        <div className="card text-center py-10">
          <div className="font-display text-lg font-semibold mb-1">{t('catalog.empty')}</div>
          {canEdit && <div className="muted text-sm">{t('catalog.emptyHint')}</div>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map(p => (
            <div key={p.id} className="card !p-3 flex gap-3">
              <div
                className="shrink-0 overflow-hidden rounded-glass"
                style={{ width: 84, height: 84, background: 'rgb(var(--accent-500) / 0.08)' }}
              >
                {p.photo_url ? (
                  <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center muted">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-7 h-7"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-7 7"/></svg>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col">
                <div className="flex items-start gap-2">
                  <div className="font-semibold truncate flex-1">{p.name}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${p.in_stock ? 'pill-green' : 'pill-red'}`}>
                    {p.in_stock ? '🟢' : '🔴'} {p.in_stock ? t('catalog.inStock') : t('catalog.outOfStock')}
                  </span>
                </div>
                {p.category && <div className="text-xs muted mt-0.5">{p.category}</div>}
                <div className="mt-1 font-display font-semibold" style={{ color: 'rgb(var(--accent-700))' }}>
                  {formatMoney(p.price, i18n.language)} <span className="text-xs muted font-normal">/ {t(`units.${p.unit}`)}</span>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <button className="btn-ghost text-xs !py-1 !px-2.5" onClick={() => toggleStock(p)}>{t('catalog.toggleStock')}</button>
                    <button className="btn-ghost text-xs !py-1 !px-2.5" onClick={() => { setEditing(p); setFormOpen(true); }}>{t('common.edit')}</button>
                    <button className="btn-ghost text-xs !py-1 !px-2.5 hover:!text-red-500" onClick={() => setDeleting(p)}>{t('common.delete')}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProductFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        onSaved={editing ? onEdited : onAdded}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={t('catalog.deleteProduct')}
        message={deleting ? `"${deleting.name}" — ${t('catalog.deleteConfirm')}` : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
      />

      <style>{`.no-scrollbar::-webkit-scrollbar { display:none; } .no-scrollbar { scrollbar-width: none; }`}</style>
    </div>
  );
}
