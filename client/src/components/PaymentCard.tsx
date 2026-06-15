import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mediaUrl, Payment } from '../api';
import { formatMoney } from '../i18n';

const STATUS_PILL: Record<string, string> = {
  pending: 'pill-gold',
  confirmed: 'pill-green',
  rejected: 'pill-red',
};

const METHOD_ICON: Record<string, string> = {
  bank: 'M3 21h18M4 10h16M5 10V7l7-4 7 4v3M6 10v8M10 10v8M14 10v8M18 10v8',
  card: 'M2 7h20v10H2zM2 11h20',
  cash: 'M2 6h20v12H2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
};

/** A payment entry in the chat timeline. Seller sees confirm/reject when pending. */
export function PaymentCard({
  pay, iAmSeller, mine, busy, onAction,
}: {
  pay: Payment;
  iAmSeller: boolean;
  mine: boolean;
  busy: boolean;
  onAction: (a: 'confirm' | 'reject') => void;
}) {
  const { t, i18n } = useTranslation();
  const [zoom, setZoom] = useState(false);
  const canAct = iAmSeller && pay.status === 'pending';

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="card !p-3 max-w-[88%] w-full sm:w-[360px]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgb(34 197 94 / 0.14)', color: 'rgb(21 128 61)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d={METHOD_ICON[pay.method]} /></svg>
          </div>
          <div className="font-semibold flex-1">{t('pay.title')} · {t(`pay.method.${pay.method}`)}</div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_PILL[pay.status] || 'pill-blue'}`}>
            {t(`pay.status.${pay.status}`)}
          </span>
        </div>

        {pay.receipt_url && (
          <button type="button" onClick={() => setZoom(true)} className="block w-full mb-2 overflow-hidden rounded-glass border border-black/5 dark:border-white/10">
            <img src={mediaUrl(pay.receipt_url)} alt={t('pay.receipt')} className="w-full max-h-52 object-cover" />
          </button>
        )}

        {pay.note && <div className="text-xs muted mb-2 italic">{pay.note}</div>}

        <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-2">
          <span className="text-xs muted">{new Date(pay.created_at + 'Z').toLocaleString(i18n.language)}</span>
          <span className="font-display font-semibold" style={{ color: 'rgb(21 128 61)' }}>
            {formatMoney(pay.amount, i18n.language)}
          </span>
        </div>

        {canAct && (
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <button disabled={busy} onClick={() => onAction('confirm')} className="text-xs !py-1.5 !px-3 btn-primary">
              {t('pay.confirm')}
            </button>
            <button disabled={busy} onClick={() => onAction('reject')} className="text-xs !py-1.5 !px-3 btn-danger">
              {t('pay.reject')}
            </button>
          </div>
        )}
      </div>

      {zoom && pay.receipt_url && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setZoom(false)}>
          <img src={mediaUrl(pay.receipt_url)} alt="" className="max-w-full max-h-full object-contain rounded-glass" />
        </div>
      )}
    </div>
  );
}
