import { type TKey, useT } from '../../i18n';
import { DEFAULT_PARAMS, ENUMS, PARAM_META, type VoiceParams } from '../../state/params';
import { useApp } from '../../state/store';
import { Knob } from './Knob';
import { Segmented, Select, ToggleRow } from './controls';

type Mod = keyof VoiceParams;

function useParam<M extends Mod>(module: M, key: string) {
  const value = useApp((s) => (s.params[module] as Record<string, unknown>)[key]);
  const setParam = useApp((s) => s.setParam);
  const set = (v: unknown) => setParam(module, key as keyof VoiceParams[M], v as VoiceParams[M][keyof VoiceParams[M]]);
  return [value, set] as const;
}

export function ParamKnob({
  module,
  k,
  format,
  disabled,
  color,
  title,
}: {
  module: Mod;
  k: string;
  format?: (v: number) => string;
  disabled?: boolean;
  color?: string;
  title?: string;
}) {
  const t = useT();
  const [value, set] = useParam(module, k);
  const meta = PARAM_META[`${module}.${k}`];
  const def = (DEFAULT_PARAMS[module] as unknown as Record<string, number>)[k];
  return (
    <Knob
      label={t(`param.${module}.${k}` as TKey)}
      value={value as number}
      meta={meta}
      defaultValue={def}
      onChange={set}
      format={format}
      disabled={disabled}
      color={color}
      title={title}
    />
  );
}

export function ParamToggle({ module, k, disabled }: { module: Mod; k: string; disabled?: boolean }) {
  const t = useT();
  const [value, set] = useParam(module, k);
  return <ToggleRow checked={value as boolean} onChange={set} label={t(`param.${module}.${k}` as TKey)} disabled={disabled} />;
}

export function ParamChoice({ module, k, variant = 'segmented' }: { module: Mod; k: string; variant?: 'segmented' | 'select' }) {
  const t = useT();
  const [value, set] = useParam(module, k);
  const path = `${module}.${k}`;
  const options = (ENUMS[path] ?? []).map((o) => ({ value: o, label: t(`opt.${path}.${o}` as TKey) }));
  const label = t(`param.${path}` as TKey);
  if (variant === 'select') {
    return (
      <div className="row">
        <span className="field-label">{label}</span>
        <Select value={value as string} options={options} onChange={set} label={label} />
      </div>
    );
  }
  return <Segmented value={value as string} options={options} onChange={set} label={label} full />;
}
