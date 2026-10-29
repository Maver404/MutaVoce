import { useMemo, useRef, useState } from 'react';
import { useLocalized, useT } from '../../i18n';
import { duplicatePreset, exportPresetFile, importPresetFile } from '../../state/actions';
import { BUILTIN_PRESETS } from '../../presets/builtin';
import { CATEGORY_COLORS, type PresetCategory, type VoicePreset } from '../../presets/types';
import { useApp } from '../../state/store';
import { Icon } from '../components/Icon';

type Filter = 'all' | 'favorites' | PresetCategory;

const GROUPS: PresetCategory[] = ['pro', 'fun', 'env', 'custom'];

export function PresetBrowser() {
  const t = useT();
  const loc = useLocalized();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const custom = useApp((s) => s.customPresets);
  const favorites = useApp((s) => s.favorites);
  const openModal = useApp((s) => s.openModal);
  const fileRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => [...BUILTIN_PRESETS, ...custom], [custom]);
  const favSlots = useMemo(() => favorites.filter((f) => all.some((p) => p.id === f)), [favorites, all]);

  const q = query.trim().toLowerCase();
  const matches = (p: VoicePreset) =>
    !q || p.name.it.toLowerCase().includes(q) || p.name.en.toLowerCase().includes(q) || loc(p.description).toLowerCase().includes(q);

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: t('presets.all') },
    { value: 'favorites', label: `★ ${t('presets.favorites')}` },
    { value: 'pro', label: t('presets.pro') },
    { value: 'fun', label: t('presets.fun') },
    { value: 'env', label: t('presets.env') },
    { value: 'custom', label: t('presets.custom') },
  ];

  const groups: { cat: PresetCategory | 'favorites'; items: VoicePreset[] }[] =
    filter === 'favorites'
      ? [{ cat: 'favorites', items: favSlots.map((id) => all.find((p) => p.id === id)!).filter(matches) }]
      : GROUPS.filter((g) => filter === 'all' || filter === g).map((cat) => ({ cat, items: all.filter((p) => p.category === cat && matches(p)) }));

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <div className="panel-head">
        <span className="panel-title">{t('presets.title')}</span>
        <span className="badge">{all.length}</span>
      </div>
      <div className="preset-search">
        <Icon name="search" size={15} />
        <input
          className="input"
          type="search"
          placeholder={t('presets.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('presets.search')}
        />
      </div>
      <div className="cat-tabs" role="group">
        {filters.map((f) => (
          <button key={f.value} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="scroll">
        {groups.map(({ cat, items }) =>
          items.length === 0 && filter === 'all' && cat !== 'custom' ? null : (
            <div key={cat}>
              {(filter === 'all' || cat === 'favorites') && (
                <div className="preset-group-title" style={{ '--c': cat === 'favorites' ? 'var(--warn)' : CATEGORY_COLORS[cat] } as React.CSSProperties}>
                  <i />
                  {cat === 'favorites' ? t('presets.favorites') : t(`presets.${cat}`)}
                </div>
              )}
              {items.length === 0 ? (
                cat === 'custom' ? (
                  <div className="empty">{t('presets.emptyCustom')}</div>
                ) : cat === 'favorites' && !q ? (
                  <div className="empty">{t('presets.emptyFavorites')}</div>
                ) : null
              ) : (
                <div className="preset-grid">
                  {items.map((p) => (
                    <PresetCard key={p.id} preset={p} slot={favSlots.indexOf(p.id)} />
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {total === 0 && q && <div className="empty">{t('presets.empty')}</div>}
      </div>
      <div className="preset-actions">
        <button className="btn sm primary" onClick={() => openModal('savePreset')}>
          <Icon name="save" size={14} />
          {t('presets.save')}
        </button>
        <button className="btn sm" onClick={() => fileRef.current?.click()} title={t('presets.import')}>
          <Icon name="upload" size={14} />
          {t('presets.import')}
        </button>
        <button className="btn sm" onClick={() => exportPresetFile()} disabled={custom.length === 0} title={t('presets.exportAll')}>
          <Icon name="download" size={14} />
          {t('presets.exportAll')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importPresetFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </>
  );
}

function PresetCard({ preset, slot }: { preset: VoicePreset; slot: number }) {
  const t = useT();
  const loc = useLocalized();
  const active = useApp((s) => s.activePresetId === preset.id);
  const modified = useApp((s) => s.activePresetId === preset.id && s.modified);
  const fav = useApp((s) => s.favorites.includes(preset.id));
  const applyPreset = useApp((s) => s.applyPreset);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const deleteCustomPreset = useApp((s) => s.deleteCustomPreset);
  const openModal = useApp((s) => s.openModal);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <div
      className={`preset-card${active ? ' active' : ''}`}
      style={{ '--c': CATEGORY_COLORS[preset.category] } as React.CSSProperties}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      title={loc(preset.description)}
      onClick={() => applyPreset(preset)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          applyPreset(preset);
        }
      }}
      onMouseLeave={() => {
        setMenu(false);
        setConfirm(false);
      }}
    >
      <span className="emoji" aria-hidden="true">
        {preset.icon}
      </span>
      <span className="pname">
        {loc(preset.name)}
        {modified && <span className="dot-modified"> •</span>}
      </span>
      <button
        className={`star${fav ? ' on' : ''}`}
        aria-label={fav ? t('presets.unfavorite') : t('presets.favorite')}
        title={fav ? t('presets.unfavorite') : t('presets.favorite')}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(preset.id);
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z" />
        </svg>
      </button>
      {slot >= 0 && slot < 9 && preset.category !== 'custom' && <span className="slot">{slot + 1}</span>}
      {preset.category === 'custom' && (
        <>
          {slot >= 0 && slot < 9 && <span className="slot" style={{ right: 32 }}>{slot + 1}</span>}
          <button
            className="icon-btn sm ghost menu-btn"
            aria-label="menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenu((m) => !m);
            }}
          >
            <Icon name="dots" size={16} />
          </button>
          {menu && (
            <div className="menu" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => openModal('renamePreset', preset.id)}>
                <Icon name="edit" size={14} />
                {t('presets.rename')}
              </button>
              <button onClick={() => duplicatePreset(preset.id)}>
                <Icon name="copy" size={14} />
                {t('presets.duplicate')}
              </button>
              <button onClick={() => exportPresetFile([preset.id])}>
                <Icon name="download" size={14} />
                {t('presets.export')}
              </button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm) deleteCustomPreset(preset.id);
                  else setConfirm(true);
                }}
              >
                <Icon name="trash" size={14} />
                {confirm ? t('presets.confirmDelete') : t('presets.delete')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
