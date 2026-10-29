import { useT } from './i18n';
import { type MobileTab, type RightTab, useApp } from './state/store';
import { Icon, type IconName } from './ui/components/Icon';
import { Header } from './ui/layout/Header';
import { IOPanel } from './ui/layout/IOPanel';
import { MasterBar } from './ui/layout/MasterBar';
import { PresetBrowser } from './ui/layout/PresetBrowser';
import { Rack } from './ui/layout/Rack';
import { Modals, Toasts } from './ui/panels/Modals';
import { RecorderPanel } from './ui/panels/RecorderPanel';
import { SoundboardPanel } from './ui/panels/SoundboardPanel';
import { useShortcuts } from './ui/hooks/useShortcuts';
import { Analyzer } from './ui/visual/Analyzer';

function RightColumn() {
  const t = useT();
  const tab = useApp((s) => s.rightTab);
  const set = useApp((s) => s.set);
  const recording = useApp((s) => s.recording);
  const tabs: { id: RightTab; icon: IconName; label: string }[] = [
    { id: 'audio', icon: 'sliders', label: t('mobile.io') },
    { id: 'sounds', icon: 'grid', label: t('mobile.sounds') },
    { id: 'record', icon: 'record', label: t('recorder.title') },
  ];
  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => set({ rightTab: x.id })}>
            <Icon name={x.icon} size={14} />
            {x.label}
            {x.id === 'record' && recording && <span className="led on" style={{ background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)' }} />}
          </button>
        ))}
      </div>
      <div className="scroll">
        {tab === 'audio' && <IOPanel />}
        {tab === 'sounds' && <SoundboardPanel />}
        {tab === 'record' && <RecorderPanel />}
      </div>
    </>
  );
}

function MobileTabs() {
  const t = useT();
  const tab = useApp((s) => s.mobileTab);
  const set = useApp((s) => s.set);
  const tabs: { id: MobileTab; icon: IconName; label: string }[] = [
    { id: 'presets', icon: 'star', label: t('mobile.presets') },
    { id: 'effects', icon: 'sliders', label: t('mobile.effects') },
    { id: 'io', icon: 'headphones', label: t('mobile.io') },
  ];
  return (
    <nav className="mobile-tabs" role="tablist">
      {tabs.map((x) => (
        <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => set({ mobileTab: x.id })}>
          <Icon name={x.icon} size={18} />
          {x.label}
        </button>
      ))}
    </nav>
  );
}

export function App() {
  useShortcuts();
  const mobileTab = useApp((s) => s.mobileTab);
  return (
    <div className="app">
      <Header />
      <main className="main" data-tab={mobileTab}>
        <aside className="col col-left">
          <PresetBrowser />
        </aside>
        <section className="col col-center">
          <Analyzer />
          <div className="scroll">
            <Rack />
          </div>
        </section>
        <aside className="col col-right">
          <RightColumn />
        </aside>
      </main>
      <MasterBar />
      <MobileTabs />
      <Modals />
      <Toasts />
    </div>
  );
}
