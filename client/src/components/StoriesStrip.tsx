import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Story, StoryGroup } from '../api';
import { Avatar } from './Avatar';
import { Sheet } from './Sheet';
import { PhotoPicker } from './PhotoPicker';

export function StoriesStrip() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<{ group: StoryGroup; index: number } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    try {
      const res = await api.listStories();
      setGroups(res.groups);
      setCanCreate(res.canCreate);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading) return null;
  if (!canCreate && groups.length === 0) return null;

  return (
    <div className="card !py-3">
      <div className="flex gap-3 overflow-x-auto no-scrollbar">
        {canCreate && (
          <button onClick={() => setCreateOpen(true)} className="flex flex-col items-center gap-1.5 shrink-0 w-16 spring">
            <div className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-dashed" style={{ borderColor: 'rgb(var(--accent-500) / 0.5)', color: 'rgb(var(--accent-600))' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-6 h-6"><path d="M12 5v14M5 12h14" /></svg>
            </div>
            <span className="text-[10px] muted truncate w-full text-center">{t('stories.add')}</span>
          </button>
        )}
        {groups.map((g, gi) => g.manufacturer && (
          <button key={g.manufacturer.id} onClick={() => setViewer({ group: g, index: 0 })} className="flex flex-col items-center gap-1.5 shrink-0 w-16 spring">
            <div className="rounded-full p-[2.5px]" style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)), rgb(var(--accent-600)))' }}>
              <div className="rounded-full p-[2px] bg-white dark:bg-neutral-900">
                <Avatar src={g.manufacturer.avatar_url} name={g.manufacturer.name} size={48} />
              </div>
            </div>
            <span className="text-[10px] muted truncate w-full text-center">{g.manufacturer.name}</span>
            {gi < 0 && <span className="hidden" />}
          </button>
        ))}
      </div>

      {viewer && (
        <StoryViewer
          group={viewer.group}
          startIndex={viewer.index}
          canDelete={canCreate}
          onClose={() => setViewer(null)}
          onDeleted={(id) => {
            setGroups(gs => gs.map(g => ({ ...g, stories: g.stories.filter(s => s.id !== id) })).filter(g => g.stories.length));
            setViewer(null);
          }}
        />
      )}

      <CreateStorySheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => load()} />
    </div>
  );
}

function StoryViewer({ group, startIndex, canDelete, onClose, onDeleted }: {
  group: StoryGroup; startIndex: number; canDelete: boolean; onClose: () => void; onDeleted: (id: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [idx, setIdx] = useState(startIndex);
  const story: Story | undefined = group.stories[idx];

  useEffect(() => {
    if (!story) return;
    const h = setTimeout(() => { if (idx < group.stories.length - 1) setIdx(i => i + 1); else onClose(); }, 5000);
    return () => clearTimeout(h);
  }, [idx, story, group.stories.length, onClose]);

  if (!story) return null;

  return (
    <Sheet open onClose={onClose} title={group.manufacturer?.name} maxWidth="440px">
      {/* progress */}
      <div className="flex gap-1 mb-3">
        {group.stories.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
            <div className="h-full" style={{ width: i < idx ? '100%' : i === idx ? '100%' : '0%', background: 'rgb(var(--accent-500))' }} />
          </div>
        ))}
      </div>

      <div className="relative">
        {story.photo_url && (
          <img src={story.photo_url} alt="" className="w-full rounded-glass object-cover max-h-80 mb-3" />
        )}
        <div className="flex items-center gap-2 mb-1">
          {story.type === 'discount' && story.discount_percent != null && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full pill-red">-{story.discount_percent}%</span>
          )}
          <span className="text-[10px] muted">{new Date(story.created_at + 'Z').toLocaleString(i18n.language)}</span>
        </div>
        <div className="font-display text-lg font-semibold">{story.title}</div>
        {story.description && <div className="muted text-sm mt-1 whitespace-pre-wrap">{story.description}</div>}

        {/* tap zones */}
        <button className="absolute inset-y-0 left-0 w-1/3" aria-label="prev" onClick={() => setIdx(i => Math.max(0, i - 1))} />
        <button className="absolute inset-y-0 right-0 w-1/3" aria-label="next" onClick={() => { if (idx < group.stories.length - 1) setIdx(i => i + 1); else onClose(); }} />
      </div>

      {canDelete && (
        <button className="btn-ghost text-xs !py-1.5 !px-3 hover:!text-red-500 mt-3" onClick={async () => { await api.deleteStory(story.id); onDeleted(story.id); }}>
          {t('common.delete')}
        </button>
      )}
    </Sheet>
  );
}

function CreateStorySheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [type, setType] = useState<'news' | 'discount' | 'product'>('news');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discount, setDiscount] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setType('news'); setTitle(''); setDescription(''); setDiscount(''); setPhotoUrl(null); } }, [open]);

  const valid = title.trim().length > 0 && (type !== 'discount' || (Number(discount) > 0 && Number(discount) <= 100));

  async function submit() {
    if (!valid) return;
    setSaving(true);
    try {
      await api.createStory({
        type, title: title.trim(),
        description: description.trim() || null,
        discount_percent: type === 'discount' ? Number(discount) : null,
        photo_url: photoUrl,
      });
      onCreated();
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('stories.add')} maxWidth="460px"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={!valid || saving} onClick={submit}>{saving ? t('common.saving') : t('common.add')}</button>
      </>}
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['news', 'discount', 'product'] as const).map(tp => (
            <button key={tp} onClick={() => setType(tp)}
              className={`flex-1 px-3 py-2 rounded-btn text-sm spring ${type === tp ? 'font-semibold' : 'muted'}`}
              style={type === tp ? { background: 'rgb(var(--accent-500) / 0.16)', color: 'rgb(var(--accent-700))' } : undefined}>
              {t(`stories.types.${tp}`)}
            </button>
          ))}
        </div>
        <div><div className="label">{t('stories.titleField')}</div><input className="input" value={title} onChange={e => setTitle(e.target.value)} /></div>
        {type === 'discount' && (
          <div><div className="label">{t('stories.discount')}</div><input className="input" type="number" min="1" max="100" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="10" /></div>
        )}
        <div><div className="label">{t('stories.description')}</div><textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div><div className="label">{t('stories.photo')}</div><PhotoPicker url={photoUrl} onChange={setPhotoUrl} kind="story" /></div>
      </div>
    </Sheet>
  );
}
