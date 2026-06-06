import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, Reward } from '../api';
import { formatMoney } from '../i18n';
import { Avatar } from '../components/Avatar';
import { Sheet, ConfirmDialog } from '../components/Sheet';
import { PhotoPicker } from '../components/PhotoPicker';

export function Rewards() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const [removing, setRemoving] = useState<Reward | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.listRewards();
      setRewards(res.rewards);
      setCanManage(res.canManage);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function confirmRemove() {
    if (!removing) return;
    const id = removing.id;
    setRewards(rs => rs.filter(r => r.id !== id));
    try { await api.deleteReward(id); } catch { load(); }
  }

  const buyerSide = user?.role === 'buyer' || user?.role === 'partner';

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-4">
      <div className="flex items-center gap-3 px-1">
        <button onClick={() => navigate('/profile')} className="rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 spring">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h1 className="font-display text-2xl font-semibold flex-1">{t('rewards.title')}</h1>
        {canManage && (
          <button className="btn-primary" onClick={() => setEditing('new')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg>
            <span className="hidden sm:inline">{t('rewards.add')}</span>
          </button>
        )}
      </div>

      <p className="muted text-sm px-1">{t('rewards.subtitle')}</p>

      {loading ? (
        <div className="card text-center muted">{t('common.loading')}</div>
      ) : rewards.length === 0 ? (
        <div className="card text-center py-10">
          <div className="font-display text-lg font-semibold mb-1">{t('rewards.empty')}</div>
          <div className="muted text-sm">{canManage ? t('rewards.emptyHint') : t('rewards.emptyBuyer')}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {rewards.map(r => (
            <RewardCard
              key={r.id}
              reward={r}
              lang={i18n.language}
              buyerSide={buyerSide}
              canManage={canManage}
              onEdit={() => setEditing(r)}
              onRemove={() => setRemoving(r)}
            />
          ))}
        </div>
      )}

      {editing && (
        <RewardSheet
          reward={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={t('rewards.removeTitle')}
        message={removing ? `${removing.title} — ${t('rewards.removeConfirm')}` : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
      />
    </div>
  );
}

const MEDAL = ['🥇', '🥈', '🥉'];

function RewardCard({ reward, lang, buyerSide, canManage, onEdit, onRemove }: {
  reward: Reward; lang: string; buyerSide: boolean; canManage: boolean; onEdit: () => void; onRemove: () => void;
}) {
  const { t } = useTranslation();
  const periodText = reward.start_date || reward.end_date
    ? `${reward.start_date || '…'} → ${reward.end_date || '…'}`
    : t('rewards.allTime');

  return (
    <div className="card !p-0 overflow-hidden">
      {reward.photo_url && <img src={reward.photo_url} alt="" className="w-full max-h-44 object-cover" />}
      <div className="p-4">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg font-semibold">{reward.title}</div>
            <div className="text-xs muted mt-0.5">
              {t(`rewards.criteria.${reward.criteria}`)} · {t('rewards.topN', { count: reward.top_n })} · {periodText}
            </div>
          </div>
          {canManage && (
            <div className="flex gap-1 shrink-0">
              <button className="btn-ghost text-xs !py-1 !px-2.5" onClick={onEdit}>{t('common.edit')}</button>
              <button className="btn-ghost text-xs !py-1 !px-2.5 hover:!text-red-500" onClick={onRemove}>{t('common.delete')}</button>
            </div>
          )}
        </div>

        {reward.description && <div className="muted text-sm mt-2 whitespace-pre-wrap">{reward.description}</div>}

        {/* Buyer's standing */}
        {buyerSide && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            {reward.qualifying ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full pill-green">{t('rewards.youQualify', { rank: reward.myRank })}</span>
            ) : reward.myRank ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full pill-gold">{t('rewards.yourRank', { rank: reward.myRank })}</span>
            ) : (
              <span className="text-xs muted">{t('rewards.notRanked')}</span>
            )}
            {(reward.myTotal ?? 0) > 0 && <span className="text-xs muted">{formatMoney(reward.myTotal ?? 0, lang)}</span>}
          </div>
        )}

        {/* Leaderboard */}
        <div className="mt-3">
          <div className="text-xs muted mb-1.5">{t('rewards.leaders')}</div>
          {reward.leaders.length === 0 ? (
            <div className="text-sm muted py-2">{t('rewards.noLeaders')}</div>
          ) : (
            <div className="space-y-1">
              {reward.leaders.map(l => (
                <div key={l.rank} className="flex items-center gap-2.5 p-1.5 rounded-glass" style={l.rank <= 3 ? { background: 'rgb(var(--accent-500) / 0.07)' } : undefined}>
                  <div className="w-6 text-center text-sm font-semibold">{MEDAL[l.rank - 1] || l.rank}</div>
                  <Avatar src={l.user?.avatar_url || null} name={l.user?.name || '?'} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{l.user?.name || '—'}</div>
                    {l.user?.nickname && <div className="text-[11px] muted truncate">@{l.user.nickname}</div>}
                  </div>
                  <div className="text-sm font-semibold whitespace-nowrap" style={{ color: 'rgb(var(--accent-700))' }}>{formatMoney(l.total, lang)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RewardSheet({ reward, onClose, onSaved }: { reward: Reward | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(reward?.title || '');
  const [description, setDescription] = useState(reward?.description || '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(reward?.photo_url || null);
  const [criteria, setCriteria] = useState<'volume' | 'paid'>(reward?.criteria || 'volume');
  const [topN, setTopN] = useState(String(reward?.top_n ?? 3));
  const [startDate, setStartDate] = useState(reward?.start_date || '');
  const [endDate, setEndDate] = useState(reward?.end_date || '');
  const [saving, setSaving] = useState(false);

  const valid = title.trim().length > 0 && Number(topN) >= 1 && Number(topN) <= 50;

  async function submit() {
    if (!valid) return;
    setSaving(true);
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      photo_url: photoUrl,
      criteria,
      top_n: Number(topN),
      start_date: startDate || null,
      end_date: endDate || null,
      period_type: 'custom' as const,
    };
    try {
      if (reward) await api.updateReward(reward.id, body);
      else await api.createReward(body);
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Sheet open onClose={onClose} title={reward ? t('rewards.editTitle') : t('rewards.add')} maxWidth="480px"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={!valid || saving} onClick={submit}>{saving ? t('common.saving') : t('common.save')}</button>
      </>}
    >
      <div className="space-y-3">
        <div><div className="label">{t('rewards.titleField')}</div><input className="input" value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div>
          <div className="label">{t('rewards.criteriaField')}</div>
          <div className="flex gap-2">
            {(['volume', 'paid'] as const).map(c => (
              <button key={c} onClick={() => setCriteria(c)}
                className={`flex-1 px-3 py-2 rounded-btn text-sm spring ${criteria === c ? 'font-semibold' : 'muted'}`}
                style={criteria === c ? { background: 'rgb(var(--accent-500) / 0.16)', color: 'rgb(var(--accent-700))' } : undefined}>
                {t(`rewards.criteria.${c}`)}
              </button>
            ))}
          </div>
        </div>
        <div><div className="label">{t('rewards.topNField')}</div><input className="input" type="number" min="1" max="50" value={topN} onChange={e => setTopN(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><div className="label">{t('rewards.startDate')}</div><input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div><div className="label">{t('rewards.endDate')}</div><input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        </div>
        <div><div className="label">{t('rewards.description')}</div><textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div><div className="label">{t('rewards.photo')}</div><PhotoPicker url={photoUrl} onChange={setPhotoUrl} kind="reward" /></div>
      </div>
    </Sheet>
  );
}
