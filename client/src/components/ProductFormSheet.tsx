import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Product, Unit, UNITS } from '../api';
import { Sheet } from './Sheet';
import { PhotoPicker } from './PhotoPicker';

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: Product | null;
  onSaved: (p: Product) => void;
};

export function ProductFormSheet({ open, onClose, initial, onSaved }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [price, setPrice] = useState<string>('');
  const [unit, setUnit] = useState<Unit>('dona');
  const [category, setCategory] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [inStock, setInStock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setPrice(String(initial.price));
      setUnit(initial.unit);
      setCategory(initial.category ?? '');
      setPhoto(initial.photo_url);
      setInStock(initial.in_stock);
    } else {
      setName(''); setPrice(''); setUnit('dona');
      setCategory(''); setPhoto(null); setInStock(true);
    }
    setErr(null);
  }, [open, initial]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const p = parseFloat(price.replace(/\s+/g, '').replace(',', '.'));
    if (!name.trim() || !Number.isFinite(p) || p < 0) {
      setErr('invalid_input'); return;
    }
    setBusy(true);
    setErr(null);
    try {
      const body = {
        name: name.trim(),
        price: p,
        unit,
        category: category.trim() || null,
        photo_url: photo,
        in_stock: inStock,
      };
      const res = initial
        ? await api.updateProduct(initial.id, body)
        : await api.createProduct(body);
      onSaved(res.product);
      onClose();
    } catch (ex: any) {
      setErr(ex.message || 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? t('catalog.editProduct') : t('catalog.addProduct')}
      maxWidth="520px"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="product-form" className="btn-primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">{t('catalog.photo')}</label>
          <PhotoPicker url={photo} kind="product" onChange={setPhoto} size={96} />
        </div>
        <div>
          <label className="label">{t('catalog.name')}</label>
          <input className="input" required value={name} onChange={e => setName(e.target.value)} placeholder={t('catalog.namePh') as string} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('catalog.price')}</label>
            <input
              className="input"
              required
              inputMode="decimal"
              value={price}
              onChange={e => setPrice(e.target.value.replace(/[^\d.,\s]/g, ''))}
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">{t('catalog.unit')}</label>
            <select className="input" value={unit} onChange={e => setUnit(e.target.value as Unit)}>
              {UNITS.map(u => (
                <option key={u} value={u}>{t(`units.${u}`)}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t('catalog.category')}</label>
          <input className="input" value={category} onChange={e => setCategory(e.target.value)} placeholder={t('catalog.categoryPh') as string} />
        </div>

        <label className="flex items-center gap-3 select-none cursor-pointer">
          <button
            type="button"
            onClick={() => setInStock(v => !v)}
            className="relative w-11 h-6 rounded-full spring"
            style={{ background: inStock ? 'rgb(var(--accent-500))' : 'rgb(var(--text-muted) / 0.4)' }}
            aria-pressed={inStock}
          >
            <span
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md spring"
              style={{ left: inStock ? '22px' : '2px' }}
            />
          </button>
          <span className="text-sm">{inStock ? t('catalog.inStock') : t('catalog.outOfStock')}</span>
        </label>

        {err && <div className="pill-red px-3 py-2 rounded-btn text-sm">{t(`auth.errors.${err}`, { defaultValue: t('common.error') })}</div>}
      </form>
    </Sheet>
  );
}
