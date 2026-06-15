import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, ChatData, mediaUrl, Payment, TimelineItem, Transaction } from '../api';
import { formatMoney } from '../i18n';
import { Avatar } from '../components/Avatar';
import { TransactionSheet } from '../components/TransactionSheet';
import { TransactionCard } from '../components/TransactionCard';
import { PaymentCard } from '../components/PaymentCard';
import { PaymentSheet } from '../components/PaymentSheet';

export function Chat() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { otherId: otherIdParam } = useParams();
  const otherId = Number(otherIdParam);

  const [data, setData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [busyTx, setBusyTx] = useState<number | null>(null);
  const [busyPay, setBusyPay] = useState<number | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getChat(otherId);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [otherId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [data?.timeline.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await api.sendMessage(otherId, body);
      setText('');
      setData(d => d ? { ...d, timeline: [...d.timeline, { kind: 'message', at: res.message.created_at, message: res.message }] } : d);
    } finally {
      setSending(false);
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!f || imgBusy) return;
    setImgBusy(true);
    try {
      const up = await api.uploadImage(f, 'chat');
      const res = await api.sendMessage(otherId, text.trim(), up.url);
      setText('');
      setData(d => d ? { ...d, timeline: [...d.timeline, { kind: 'message', at: res.message.created_at, message: res.message }] } : d);
    } finally {
      setImgBusy(false);
    }
  }

  function onPaymentCreated(pay: Payment, debt: number) {
    setData(d => d ? {
      ...d,
      debt,
      timeline: [...d.timeline, { kind: 'payment', at: pay.created_at, payment: pay }],
    } : d);
  }

  async function doPaymentAction(pay: Payment, action: 'confirm' | 'reject') {
    setBusyPay(pay.id);
    try {
      const res = await api.paymentAction(pay.id, action);
      setData(d => d ? {
        ...d,
        debt: res.debt,
        timeline: d.timeline.map(it =>
          it.kind === 'payment' && it.payment.id === pay.id
            ? { ...it, payment: res.payment }
            : it,
        ),
      } : d);
    } finally {
      setBusyPay(null);
    }
  }

  function onCreated(tx: Transaction, debt: number) {
    setData(d => d ? {
      ...d,
      debt,
      timeline: [...d.timeline, { kind: 'transaction', at: tx.created_at, transaction: tx }],
    } : d);
  }

  async function doAction(tx: Transaction, action: 'accept' | 'deliver' | 'pay' | 'reject') {
    setBusyTx(tx.id);
    try {
      const res = await api.txAction(tx.id, action);
      setData(d => d ? {
        ...d,
        debt: res.debt,
        timeline: d.timeline.map(it =>
          it.kind === 'transaction' && it.transaction.id === tx.id
            ? { ...it, transaction: res.transaction }
            : it,
        ),
      } : d);
    } finally {
      setBusyTx(null);
    }
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto py-10 text-center muted">{t('common.loading')}</div>;
  }
  if (!data || !data.other) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center">
        <div className="card py-8">
          <div className="font-semibold mb-2">{t('chat.notFound')}</div>
          <button className="btn-ghost" onClick={() => navigate(-1)}>{t('common.back')}</button>
        </div>
      </div>
    );
  }

  const other = data.other;

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
      {/* Header */}
      <div className="card !p-3 flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 spring shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <Avatar src={other.avatar_url} name={other.name} size={42} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{other.name}</div>
          <div className="text-xs muted truncate">@{other.nickname}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] muted leading-none mb-1">{t('contacts.debt')}</div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${data.debt > 0 ? 'pill-red' : 'pill-green'}`}>
            {formatMoney(data.debt, i18n.language)}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 px-1 py-2">
        {data.timeline.length === 0 ? (
          <div className="text-center muted text-sm py-10">{t('chat.empty')}</div>
        ) : (
          data.timeline.map((it: TimelineItem, idx) =>
            it.kind === 'message' ? (
              <MessageBubble key={`m${it.message.id}`} mine={it.message.sender_id === user?.id} body={it.message.body} image_url={it.message.image_url} at={it.message.created_at} />
            ) : it.kind === 'transaction' ? (
              <TransactionCard
                key={`t${it.transaction.id}-${idx}`}
                tx={it.transaction}
                iAmSeller={data.iAmSeller}
                mine={it.transaction.created_by === user?.id}
                busy={busyTx === it.transaction.id}
                onAction={(a) => doAction(it.transaction, a)}
              />
            ) : (
              <PaymentCard
                key={`p${it.payment.id}-${idx}`}
                pay={it.payment}
                iAmSeller={data.iAmSeller}
                mine={it.payment.created_by === user?.id}
                busy={busyPay === it.payment.id}
                onAction={(a) => doPaymentAction(it.payment, a)}
              />
            ),
          )
        )}
      </div>

      {/* Pay button — buyer side only */}
      {!data.iAmSeller && (
        <button
          onClick={() => setPayOpen(true)}
          className="card !py-2.5 mt-2 flex items-center justify-center gap-2 font-semibold spring"
          style={{ color: 'rgb(21 128 61)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M2 7h20v10H2zM2 11h20" /></svg>
          {t('pay.makeTitle')}
        </button>
      )}

      {/* Composer */}
      <div className="card !p-2 flex items-center gap-2 mt-2">
        <button
          onClick={() => setTxOpen(true)}
          className="rounded-full w-10 h-10 flex items-center justify-center shrink-0 spring text-white"
          style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)), rgb(var(--accent-600)))' }}
          aria-label={t('tx.newTitle')}
          title={t('tx.newTitle')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-5 h-5"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={imgBusy}
          className="rounded-full w-10 h-10 flex items-center justify-center shrink-0 spring hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
          aria-label={t('chat.attachImage')}
          title={t('chat.attachImage')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-7 7" /></svg>
        </button>
        <input
          className="input flex-1"
          placeholder={t('chat.messagePh')}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
        />
        <button className="btn-primary shrink-0" disabled={!text.trim() || sending} onClick={send}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
      </div>

      <TransactionSheet
        open={txOpen}
        onClose={() => setTxOpen(false)}
        otherId={otherId}
        iAmSeller={data.iAmSeller}
        onCreated={onCreated}
      />

      <PaymentSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        otherId={otherId}
        debt={data.debt}
        payInfo={data.payInfo}
        onCreated={onPaymentCreated}
      />
    </div>
  );
}

function MessageBubble({ mine, body, image_url, at }: { mine: boolean; body: string; image_url?: string | null; at: string }) {
  const { i18n } = useTranslation();
  const [zoom, setZoom] = useState(false);
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-3.5 py-2 rounded-glass ${mine ? 'text-white' : 'glass'}`}
        style={mine ? { background: 'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))' } : undefined}
      >
        {image_url && (
          <button type="button" onClick={() => setZoom(true)} className="block mb-1.5 overflow-hidden rounded-glass">
            <img src={mediaUrl(image_url)} alt="" className="max-w-full max-h-64 object-cover rounded-glass" />
          </button>
        )}
        {body && <div className="text-sm whitespace-pre-wrap break-words">{body}</div>}
        <div className={`text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'muted'}`}>
          {new Date(at + 'Z').toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {zoom && image_url && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setZoom(false)}>
          <img src={mediaUrl(image_url)} alt="" className="max-w-full max-h-full object-contain rounded-glass" />
        </div>
      )}
    </div>
  );
}
