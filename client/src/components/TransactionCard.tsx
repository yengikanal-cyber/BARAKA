import { useTranslation } from 'react-i18next';
import { Transaction } from '../api';
import { formatMoney } from '../i18n';

const STATUS_PILL: Record<string, string> = {
  pending: 'pill-gold',
  accepted: 'pill-blue',
  delivered: 'pill-purple',
  paid: 'pill-green',
  rejected: 'pill-red',
};

const TYPE_ICON: Record<string, string> = {
  delivery: 'M3 7h13v8H3zM16 10h4l1 3v2h-5z',
  order: 'M6 2l1.5 3h9L18 2M3 6h18l-2 13H5z',
  return: 'M9 14l-4-4 4-4M5 10h9a6 6 0 0 1 0 12h-3',
};

type Action = 'accept' | 'deliver' | 'pay' | 'reject';

/** Actions available to the SELLER for a given type+status. */
function actionsFor(type: string, status: string): Action[] {
  if (type === 'delivery') {
    if (status === 'pending') return ['deliver'];
  } else if (type === 'order') {
    if (status === 'pending') return ['accept', 'reject'];
    if (status === 'accepted') return ['deliver'];
  } else if (type === 'return') {
    if (status === 'pending') return ['accept', 'reject'];
  }
  return [];
}

export function TransactionCard({
  tx, iAmSeller, mine, busy, onAction,
}: {
  tx: Transaction;
  iAmSeller: boolean;
  mine: boolean;
  busy: boolean;
  onAction: (a: Action) => void;
}) {
  const { t, i18n } = useTranslation();
  const actions = iAmSeller ? actionsFor(tx.type, tx.status) : [];

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="card !p-3 max-w-[88%] w-full sm:w-[400px]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgb(var(--accent-500) / 0.14)', color: 'rgb(var(--accent-700))' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d={TYPE_ICON[tx.type]} /></svg>
          </div>
          <div className="font-semibold flex-1">{t(`tx.type.${tx.type}`)}</div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_PILL[tx.status] || 'pill-blue'}`}>
            {t(`tx.status.${tx.status}`)}
          </span>
        </div>

        <div className="space-y-1 mb-2">
          {tx.items.map(it => (
            <div key={it.id} className="flex items-baseline gap-2 text-sm">
              <span className="flex-1 truncate">{it.name}</span>
              <span className="muted whitespace-nowrap">{it.quantity} {t(`units.${it.unit}`)} × {formatMoney(it.price, i18n.language)}</span>
            </div>
          ))}
        </div>

        {tx.note && <div className="text-xs muted mb-2 italic">{tx.note}</div>}

        <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-2">
          <span className="text-xs muted">{new Date(tx.created_at + 'Z').toLocaleString(i18n.language)}</span>
          <span className="font-display font-semibold" style={{ color: 'rgb(var(--accent-700))' }}>
            {formatMoney(tx.total, i18n.language)}
          </span>
        </div>

        {actions.length > 0 && (
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {actions.map(a => (
              <button
                key={a}
                disabled={busy}
                onClick={() => onAction(a)}
                className={`text-xs !py-1.5 !px-3 ${a === 'reject' ? 'btn-danger' : 'btn-primary'}`}
              >
                {t(`tx.action.${a}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
