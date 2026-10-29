export interface AudioDevice {
  deviceId: string;
  label: string;
  virtual: boolean;
}

export interface DeviceLists {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
}

const VIRTUAL_PATTERNS = [/blackhole/i, /vb-?audio/i, /cable (input|output)/i, /^cable/i, /loopback/i, /soundflower/i, /voicemeeter/i, /null.?sink/i, /virtual/i, /mutavoce/i];

export const isVirtualDevice = (label: string) => VIRTUAL_PATTERNS.some((re) => re.test(label));

export async function listDevices(): Promise<DeviceLists> {
  if (!navigator.mediaDevices?.enumerateDevices) return { inputs: [], outputs: [] };
  const all = await navigator.mediaDevices.enumerateDevices();
  const map = (kind: MediaDeviceKind) =>
    all
      // Before permission is granted browsers return anonymous entries with an empty id.
      .filter((d) => d.kind === kind && d.deviceId && d.deviceId !== 'communications')
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `${kind === 'audioinput' ? 'Mic' : 'Output'} ${i + 1}`,
        virtual: isVirtualDevice(d.label),
      }));
  return { inputs: map('audioinput'), outputs: map('audiooutput') };
}

/** Best guess for the virtual cable *playback* side (what we send into). */
export function findVirtualOutput(outputs: AudioDevice[]): AudioDevice | undefined {
  return outputs.find((d) => d.virtual && !/^default$/.test(d.deviceId));
}

export const supports = {
  get mediaDevices() {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  },
  get contextSinkId() {
    return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
  },
  get elementSinkId() {
    return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  },
  get selectAudioOutput() {
    return typeof navigator !== 'undefined' && 'selectAudioOutput' in (navigator.mediaDevices ?? {});
  },
  get audioWorklet() {
    return typeof AudioWorkletNode !== 'undefined';
  },
  get secure() {
    return typeof window !== 'undefined' && window.isSecureContext;
  },
};

/** Firefox exposes outputs only through an explicit picker. */
export async function pickAudioOutput(): Promise<AudioDevice | null> {
  const md = navigator.mediaDevices as MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> };
  if (!md.selectAudioOutput) return null;
  try {
    const d = await md.selectAudioOutput();
    return { deviceId: d.deviceId, label: d.label, virtual: isVirtualDevice(d.label) };
  } catch {
    return null;
  }
}

export type OS = 'mac' | 'windows' | 'linux' | 'other';

export function detectOS(): OS {
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua) && !/iPhone|iPad/i.test(ua)) return 'mac';
  if (/Win/i.test(ua)) return 'windows';
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux';
  return 'other';
}

export const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
