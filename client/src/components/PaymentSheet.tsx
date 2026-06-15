import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Payment, PayMethod, SellerPayInfo } from '../api';
import { formatMoney } from '../i18n';
import { Sheet } from './Sheet';
import { PhotoPicker } from './PhotoPicker';

/**
 * Buyer-side payment modal. Shows the current debt, lets the buyer pick a
 * method (bank / card / cash) and amount. For bank/card a receipt photo is
 * required; for cash the buyer just confirms ("To'lov qilindi"). The seller
 * later confirms to actually reduce the debt.
 */
export function PaymentSheet({
  open, onClose, otherId, debt, payInfo, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  otherId: number;
  debt: number;
  payInfo: SellerPayInfo | null;
  onCreated: (pay: Payment, debt: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [method, setMethod] = useState<PayMethod>('bank');
  const [amount, setAmount] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cashEnabled = payInfo?.cash_enabled ?? false;
  const amountNum = Number(amount.replace(/\s/g, ''));
  const needsReceipt = method === 'bank' || method === 'card';
  const valid = amountNum > 0 && (!needsReceipt || !!receipt);

  function reset() {
    setMethod('bank'); setAmount(''); setReceipt(null); setNote(''); setErr(null);
  }

  async function submit() {
    if (!valid || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await api.createPayment({
        otherId,
        amount: amountNum,
        method,
        receipt_url: needsReceipt ? receipt : null,
        note: note.trim() || null,
      });
      onCreated(res.payment, res.debt);
      reset();
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'error');
    } finally {
      setBusy(false);
    }
  }

  const methods: { key: PayMethod; disabled?: boolean }[] = [
    { key: 'bank' },
    { key: 'card' },
    { key: 'cash', disabled: !cashEnabled },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('pay.makeTitle')}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={!valid || busy} onClick={submit}>
            {method === 'cash' ? t('pay.cashDone') : t('pay.sendReceipt')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Current debt */}
        <div className="card !p-3 flex items-center justify-between">
          <span className="text-sm muted">{t('pay.currentDebt')}</span>
          <span className={`font-display font-semibold ${debt > 0 ? 'text-red-500' : ''}`}>
            {formatMoney(debt, i18n.language)}
          </span>
        </div>

        {/* Method selector */}
        <div>
          <label className="text-xs muted block mb-1.5">{t('pay.method.label')}</label>
          <div className="grid grid-cols-3 gap-2">
            {methods.map(m => (
              <button
                key={m.key}
                type="button"
                disabled={m.disabled}
                onClick={() => setMethod(m.key)}
                className={`py-2 rounded-glass text-sm spring border ${
                  method === m.key
                    ? 'text-white border-transparent'
                    : 'glass border-black/10 dark:border-white/10'
                } ${m.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                style={method === m.key ? { background: 'linear-gradient(135deg, rgb(var(--accent-400)), rgb(var(--accent-600)))' } : undefined}
              >
                {t(`pay.method.${m.key}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Seller pay details for bank/card */}
        {method === 'bank' && payInfo && (payInfo.bank_name || payInfo.bank_account) && (
          <div className="card !p-3 text-sm space-y-1">
            {payInfo.bank_name && <div><span className="muted">{t('pay.bankName')}: </span>{payInfo.bank_name}</div>}
            {payInfo.bank_account && <div><span className="muted">{t('pay.bankAccount')}: </span>{payInfo.bank_account}</div>}
          </div>
        )}
        {method === 'card' && payInfo && (payInfo.card_number || payInfo.card_holder) && (
          <div className="card !p-3 text-sm space-y-1">
            {payInfo.card_number && <div><span className="muted">{t('pay.cardNumber')}: </span>{payInfo.card_number}</div>}
            {payInfo.card_holder && <div><span className="muted">{t('pay.cardHolder')}: </span>{payInfo.card_holder}</div>}
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="text-xs muted block mb-1.5">{t('pay.amount')}</label>
          <input
            className="input w-full"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          />
        </div>

        {/* Receipt for bank/card */}
        {needsReceipt && (
          <div>
            <label className="text-xs muted block mb-1.5">{t('pay.receipt')}</label>
            <PhotoPicker url={receipt} kind="receipt" onChange={setReceipt} size={120} />
          </div>
        )}

        {/* Optional note */}
        <div>
          <label className="text-xs muted block mb-1.5">{t('tx.note')}</label>
          <input className="input w-full" placeholder={t('tx.notePh')} value={note} onChange={e => setNote(e.target.value)} />
        </div>

        {err && <div className="text-xs text-red-500">{t('pay.error')}</div>}
      </div>
    </Sheet>
  );
}
