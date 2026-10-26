// Built-in diagnostic clip so the audio path can be tested without spending
// ElevenLabs credits. Mirrors tools/make_test_audio.py (16 kHz mono 16-bit
// PCM WAV): steady 440 Hz, silence, a 200-2000 Hz sweep, then four beeps.
// WAV is uncompressed, so any garbling on the skull is wiring/I2S, not decode.

const RATE = 16000;

function tone(out: number[], f0: number, f1: number, seconds: number) {
  const n = Math.floor(RATE * seconds);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    phase += (2 * Math.PI * (f0 + ((f1 - f0) * i) / n)) / RATE;
    const fade = Math.min(1, i / 160, (n - i) / 160);
    out.push(Math.trunc(0.5 * fade * 32767 * Math.sin(phase)));
  }
}

function silence(out: number[], seconds: number) {
  for (let i = 0; i < Math.floor(RATE * seconds); i++) out.push(0);
}

export function buildTestWav(): Uint8Array {
  const s: number[] = [];
  tone(s, 440, 440, 1.5);
  silence(s, 0.5);
  tone(s, 200, 2000, 2.0);
  silence(s, 0.5);
  for (const f of [330, 392, 523, 392]) {
    tone(s, f, f, 0.18);
    silence(s, 0.12);
  }

  const dataLen = s.length * 2;
  const bytes = new Uint8Array(44 + dataLen);
  const v = new DataView(bytes.buffer);
  const tag = (off: number, t: string) => [...t].forEach((c, i) => (bytes[off + i] = c.charCodeAt(0)));
  tag(0, 'RIFF');
  v.setUint32(4, 36 + dataLen, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, 'data');
  v.setUint32(40, dataLen, true);
  s.forEach((x, i) => v.setInt16(44 + i * 2, x, true));
  return bytes;
}

// Same CRC-32 (IEEE) the firmware computes over the bytes it receives.
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// React Native's Blob can't be built from a typed array, but fetch() can turn a
// data: URI into one.
export async function bytesToBlob(bytes: Uint8Array, mime: string): Promise<Blob> {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const res = await fetch(`data:${mime};base64,${btoa(bin)}`);
  return res.blob();
}
