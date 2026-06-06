import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, ChatData, TimelineItem, Transaction } from '../api';
import { formatMoney } from '../i18n';
import { Avatar } from '../components/Avatar';
import { TransactionSheet } from '../components/TransactionSheet';
import { TransactionCard } from '../components/TransactionCard';

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
  const [busyTx, setBusyTx] = useState<number | null>(null);
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
              <MessageBubble key={`m${it.message.id}`} mine={it.message.sender_id === user?.id} body={it.message.body} at={it.message.created_at} />
            ) : (
              <TransactionCard
                key={`t${it.transaction.id}-${idx}`}
                tx={it.transaction}
                iAmSeller={data.iAmSeller}
                mine={it.transaction.created_by === user?.id}
                busy={busyTx === it.transaction.id}
                onAction={(a) => doAction(it.transaction, a)}
              />
            ),
          )
        )}
      </div>

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
      </div>

      <TransactionSheet
        open={txOpen}
        onClose={() => setTxOpen(false)}
        otherId={otherId}
        iAmSeller={data.iAmSeller}
        onCreated={onCreated}
      />
    </div>
  );
}

function MessageBubble({ mine, body, at }: { mine: boolean; body: string; at: string }) {
  const { i18n } = useTranslation();
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-3.5 py-2 rounded-glass ${mine ? 'text-white' : 'glass'}`}
        style={mine ? { background: 'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))' } : undefined}
      >
        <div className="text-sm whitespace-pre-wrap break-words">{body}</div>
        <div className={`text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'muted'}`}>
          {new Date(at + 'Z').toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
