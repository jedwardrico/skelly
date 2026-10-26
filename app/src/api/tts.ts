// Cloud text-to-speech (ElevenLabs). expo-speech can only play through the
// phone's own speaker and can't hand back the audio, so playing through the
// skull's amp means getting real audio bytes from somewhere we can upload to
// the ESP32 (see SkellyClient.uploadBlob).

// AsyncStorage key the Setup tab saves the API key under and Speech reads.
export const TTS_API_KEY_STORAGE_KEY = 'skelly:speech:elevenLabsKey';

// AsyncStorage key for the Setup tab's "play through skull speaker" switch, which
// the Speech tab reads ('1' = skull speaker, '0' = this phone).
export const SKULL_SPEAKER_STORAGE_KEY = 'skelly:speech:skull';

const API_BASE = 'https://api.elevenlabs.io/v1';

export interface TtsVoice {
  id: string;
  name: string;
}

// Voice the picker starts on. It's a library voice, so it may not appear in
// listVoices(); the app adds it explicitly.
export const DEFAULT_VOICE: TtsVoice = { id: 'PRfCKe8kdrG3nuXOAnoH', name: 'Gork' };

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  const detail = body?.detail;
  return (typeof detail === 'string' ? detail : detail?.message) ?? `${fallback} (HTTP ${res.status})`;
}

// Every voice on the account; the picker's search handles long lists.
export async function listVoices(apiKey: string): Promise<TtsVoice[]> {
  const res = await fetch(`${API_BASE}/voices`, { headers: { 'xi-api-key': apiKey } });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not load voices'));
  const body = await res.json();
  return (body.voices ?? [])
    .map((v: { voice_id: string; name: string }) => ({
      id: v.voice_id,
      name: v.name,
    }));
}

// Returns an mp3 blob. `speed` is clamped to ElevenLabs' 0.7-1.2 range.
export async function synthesizeSpeech(
  apiKey: string,
  text: string,
  voiceId: string,
  speed: number,
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_v4',
      voice_settings: { speed: Math.min(1.2, Math.max(0.7, speed)) },
    }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'TTS request failed'));
  return res.blob();
}
