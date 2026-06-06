import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, AssignClient, TeamMember } from '../api';
import { Avatar } from '../components/Avatar';
import { Sheet, ConfirmDialog } from '../components/Sheet';

export function Team() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [assignFor, setAssignFor] = useState<TeamMember | null>(null);

  useEffect(() => {
    if (user && user.role !== 'manufacturer') navigate('/profile', { replace: true });
  }, [user, navigate]);

  async function load() {
    setLoading(true);
    try { setMembers((await api.listTeam()).members); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function confirmRemove() {
    if (!removing) return;
    const id = removing.id;
    setMembers(ms => ms.filter(m => m.id !== id));
    try { await api.removeTeamMember(id); } catch { load(); }
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-4">
      <div className="flex items-center gap-3 px-1">
        <button onClick={() => navigate('/profile')} className="rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 spring">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h1 className="font-display text-2xl font-semibold flex-1">{t('team.title')}</h1>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg>
          <span className="hidden sm:inline">{t('team.add')}</span>
        </button>
      </div>

      {loading ? (
        <div className="card text-center muted">{t('common.loading')}</div>
      ) : members.length === 0 ? (
        <div className="card text-center py-10">
          <div className="font-display text-lg font-semibold mb-1">{t('team.empty')}</div>
          <div className="muted text-sm">{t('team.emptyHint')}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="card !p-3 flex items-center gap-3">
              <Avatar src={m.avatar_url} name={m.name} size={46} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{m.name}</div>
                <div className="text-xs muted truncate">{m.email}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full pill-blue">{t(`roles.${m.role}`)}</span>
                  {m.role === 'staff' && (
                    <span className="text-[10px] muted">{t('team.assignedCount', { count: m.assignedCount })}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {m.role === 'staff' && (
                  <button className="btn-ghost text-xs !py-1 !px-2.5" onClick={() => setAssignFor(m)}>{t('team.assign')}</button>
                )}
                <button className="btn-ghost text-xs !py-1 !px-2.5 hover:!text-red-500" onClick={() => setRemoving(m)}>{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddMemberSheet open={addOpen} onClose={() => setAddOpen(false)} onAdded={(m) => setMembers(ms => [...ms, m])} />
      {assignFor && (
        <AssignSheet staff={assignFor} onClose={() => setAssignFor(null)} onChanged={load} />
      )}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={t('team.removeTitle')}
        message={removing ? `${removing.name} — ${t('team.removeConfirm')}` : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
      />
    </div>
  );
}

function AddMemberSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (m: TeamMember) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'staff' | 'accountant'>('staff');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setName(''); setEmail(''); setPassword(''); setPhone(''); setRole('staff'); setErr(null); }
  }, [open]);

  const valid = name.trim() && /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  async function submit() {
    if (!valid) return;
    setSaving(true); setErr(null);
    try {
      const res = await api.addTeamMember({ name: name.trim(), email: email.trim(), password, role, phone: phone.trim() || null });
      onAdded(res.member);
      onClose();
    } catch (e: any) {
      setErr(e?.message === 'email_taken' ? t('auth.errors.email_taken') : t('auth.errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('team.add')} maxWidth="460px"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={!valid || saving} onClick={submit}>{saving ? t('common.saving') : t('common.save')}</button>
      </>}
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['staff', 'accountant'] as const).map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={`flex-1 px-3 py-2 rounded-btn text-sm spring ${role === r ? 'font-semibold' : 'muted'}`}
              style={role === r ? { background: 'rgb(var(--accent-500) / 0.16)', color: 'rgb(var(--accent-700))' } : undefined}>
              {t(`roles.${r}`)}
            </button>
          ))}
        </div>
        <div><div className="label">{t('auth.name')}</div><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><div className="label">{t('auth.email')}</div><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><div className="label">{t('auth.password')}</div><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} /><div className="text-xs muted mt-1">{t('auth.passwordHint')}</div></div>
        <div><div className="label">{t('profile.phone')}</div><input className="input" value={phone} onChange={e => setPhone(e.target.value)} /></div>
        {err && <div className="text-sm text-red-500">{err}</div>}
        <div className="text-xs muted">{t('team.credHint')}</div>
      </div>
    </Sheet>
  );
}

function AssignSheet({ staff, onClose, onChanged }: { staff: TeamMember; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [clients, setClients] = useState<AssignClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try { setClients((await api.teamClients(staff.id)).clients); }
      finally { setLoading(false); }
    })();
  }, [staff.id]);

  async function toggle(c: AssignClient) {
    const next = !c.assigned;
    setBusy(c.connection_id);
    setClients(cs => cs.map(x => x.connection_id === c.connection_id ? { ...x, assigned: next } : x));
    try { await api.assignClient(staff.id, c.connection_id, next); onChanged(); }
    catch { setClients(cs => cs.map(x => x.connection_id === c.connection_id ? { ...x, assigned: c.assigned } : x)); }
    finally { setBusy(null); }
  }

  return (
    <Sheet open onClose={onClose} title={`${t('team.assign')} — ${staff.name}`} maxWidth="460px">
      {loading ? (
        <div className="text-center muted text-sm py-6">{t('common.loading')}</div>
      ) : clients.length === 0 ? (
        <div className="text-center muted text-sm py-6">{t('contacts.empty')}</div>
      ) : (
        <div className="space-y-1">
          {clients.map(c => (
            <button key={c.connection_id} onClick={() => toggle(c)} disabled={busy === c.connection_id}
              className="w-full flex items-center gap-3 p-2 rounded-glass hover:bg-black/5 dark:hover:bg-white/5 spring text-left">
              <Avatar src={c.avatar_url} name={c.name} size={38} />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate text-sm">{c.name}</div>
                <div className="text-xs muted truncate">@{c.nickname}</div>
              </div>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 spring ${c.assigned ? 'text-white' : 'border-black/20 dark:border-white/20'}`}
                style={c.assigned ? { background: 'rgb(var(--accent-600))', borderColor: 'rgb(var(--accent-600))' } : undefined}>
                {c.assigned && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M5 12l5 5L20 6" /></svg>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
