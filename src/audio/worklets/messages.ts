import type { PitchSettings } from '../dsp/pitchEngine';
import type { CarrierType } from '../dsp/vocoder';

/** Main thread → processor. */
export interface GateMsg {
  enabled: boolean;
  thresholdDb: number;
  attackMs: number;
  releaseMs: number;
}
export interface PitchMsg {
  enabled: boolean;
  settings: Partial<PitchSettings>;
}
export interface HarmonizerMsg {
  enabled: boolean;
  voice1: number;
  level1: number;
  voice2: number;
  level2: number;
}
export interface VocoderMsg {
  enabled: boolean;
  carrier: CarrierType;
  note: number;
}
export interface BitcrusherMsg {
  enabled: boolean;
  bits: number;
  downsample: number;
}
export interface CaptureMsg {
  recording: boolean;
}

/** Processor → main thread. */
export type ProcessorEvent =
  | { type: 'gate'; open: boolean }
  | { type: 'pitch'; freq: number; clarity: number; correction: number }
  | { type: 'chunk'; channels: Float32Array[] };
