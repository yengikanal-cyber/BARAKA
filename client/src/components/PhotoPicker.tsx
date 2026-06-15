import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, mediaUrl } from '../api';

type Props = {
  url: string | null;
  kind: 'product' | 'story' | 'reward' | 'chat' | 'receipt';
  onChange: (url: string | null) => void;
  size?: number;
  rounded?: 'lg' | 'full';
};

export function PhotoPicker({ url, kind, onChange, size = 96, rounded = 'lg' }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.uploadImage(f, kind);
      onChange(res.url);
    } catch (ex: any) {
      setErr(ex.message || 'error');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  const roundedCls = rounded === 'full' ? 'rounded-full' : 'rounded-glass';

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={`relative overflow-hidden ${roundedCls} border border-black/10 dark:border-white/10 spring`}
          style={{ width: size, height: size }}
        >
          {url ? (
            <img src={mediaUrl(url)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'rgb(var(--accent-500) / 0.10)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-7 h-7 muted">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <circle cx="9" cy="11" r="2" />
                <path d="M21 17l-5-5-7 7" />
              </svg>
            </div>
          )}
        </button>
        <div className="flex flex-col gap-1.5">
          <button type="button" className="btn-ghost text-sm" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? t('common.loading') : (url ? t('photo.change') : t('photo.upload'))}
          </button>
          {url && (
            <button type="button" className="text-xs muted hover:text-red-500 spring text-left px-2" onClick={() => onChange(null)}>
              {t('photo.remove')}
            </button>
          )}
        </div>
      </div>
      {err && <div className="text-xs text-red-500 mt-1">{t('common.error')}</div>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pickFile} />
    </div>
  );
}
