import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, Partner } from '../api';
import { Avatar } from '../components/Avatar';
import { Sheet, ConfirmDialog } from '../components/Sheet';

export function Partners() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [owner, setOwner] = useState<{ id: number; name: string; nickname: string; avatar_url: string | null } | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<Partner | null>(null);

  useEffect(() => {
    if (user && user.role !== 'buyer' && user.role !== 'partner') navigate('/profile', { replace: true });
  }, [user, navigate]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.listPartners();
      setPartners(res.partners);
      setOwner(res.owner);
      setCanManage(res.canManage);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function confirmRemove() {
    if (!removing) return;
    const id = removing.id;
    setPartners(ps => ps.filter(p => p.id !== id));
    try { await api.removePartner(id); } catch { load(); }
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-4">
      <div className="flex items-center gap-3 px-1">
        <button onClick={() => navigate('/profile')} className="rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 spring">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h1 className="font-display text-2xl font-semibold flex-1">{t('partners.title')}</h1>
        {canManage && (
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg>
            <span className="hidden sm:inline">{t('partners.add')}</span>
          </button>
        )}
      </div>

      <p className="muted text-sm px-1">{t('partners.subtitle')}</p>

      {/* Owner card (shown to partners) */}
      {owner && user?.role === 'partner' && (
        <div className="card !p-3 flex items-center gap-3">
          <Avatar src={owner.avatar_url} name={owner.name} size={46} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{owner.name}</div>
            <div className="text-xs muted truncate">@{owner.nickname}</div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full pill-green">{t('partners.owner')}</span>
        </div>
      )}

      {loading ? (
        <div className="card text-center muted">{t('common.loading')}</div>
      ) : partners.length === 0 ? (
        <div className="card text-center py-10">
          <div className="font-display text-lg font-semibold mb-1">{t('partners.empty')}</div>
          {canManage && <div className="muted text-sm">{t('partners.emptyHint')}</div>}
        </div>
      ) : (
        <div className="space-y-2">
          {partners.map(p => (
            <div key={p.id} className="card !p-3 flex items-center gap-3">
              <Avatar src={p.avatar_url} name={p.name} size={46} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs muted truncate">{p.email}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full pill-blue mt-1 inline-block">{t('roles.partner')}</span>
              </div>
              {canManage && (
                <button className="btn-ghost text-xs !py-1 !px-2.5 hover:!text-red-500 shrink-0" onClick={() => setRemoving(p)}>{t('common.delete')}</button>
              )}
            </div>
          ))}
        </div>
      )}

      <AddPartnerSheet open={addOpen} onClose={() => setAddOpen(false)} onAdded={(p) => setPartners(ps => [...ps, p])} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={t('partners.removeTitle')}
        message={removing ? `${removing.name} — ${t('partners.removeConfirm')}` : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
      />
    </div>
  );
}

function AddPartnerSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (p: Partner) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (open) { setName(''); setEmail(''); setPassword(''); setPhone(''); setErr(null); } }, [open]);

  const valid = name.trim() && /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  async function submit() {
    if (!valid) return;
    setSaving(true); setErr(null);
    try {
      const res = await api.addPartner({ name: name.trim(), email: email.trim(), password, phone: phone.trim() || null });
      onAdded(res.partner);
      onClose();
    } catch (e: any) {
      setErr(e?.message === 'email_taken' ? t('auth.errors.email_taken') : t('auth.errors.generic'));
    } finally { setSaving(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('partners.add')} maxWidth="460px"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={!valid || saving} onClick={submit}>{saving ? t('common.saving') : t('common.save')}</button>
      </>}
    >
      <div className="space-y-3">
        <div><div className="label">{t('auth.name')}</div><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><div className="label">{t('auth.email')}</div><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><div className="label">{t('auth.password')}</div><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} /><div className="text-xs muted mt-1">{t('auth.passwordHint')}</div></div>
        <div><div className="label">{t('profile.phone')}</div><input className="input" value={phone} onChange={e => setPhone(e.target.value)} /></div>
        {err && <div className="text-sm text-red-500">{err}</div>}
        <div className="text-xs muted">{t('partners.credHint')}</div>
      </div>
    </Sheet>
  );
}
