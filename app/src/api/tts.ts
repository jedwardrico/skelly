// Cloud text-to-speech (ElevenLabs). expo-speech can only play through the
// phone's own speaker and can't hand back the audio, so playing through the
// skull's amp means getting real audio bytes from somewhere we can upload to
// the ESP32 (see SkellyClient.uploadBlob).

// AsyncStorage key the Setup tab saves the API key under and Speech reads.
export const TTS_API_KEY_STORAGE_KEY = 'skelly:speech:elevenLabsKey';

const API_BASE = 'https://api.elevenlabs.io/v1';

export interface TtsVoice {
  id: string;
  name: string;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  const detail = body?.detail;
  return (typeof detail === 'string' ? detail : detail?.message) ?? `${fallback} (HTTP ${res.status})`;
}

// Free-tier voices only: the premade ones. Library, cloned and generated voices
// (which need a paid plan to use via the API) are filtered out.
export async function listVoices(apiKey: string): Promise<TtsVoice[]> {
  const res = await fetch(`${API_BASE}/voices`, { headers: { 'xi-api-key': apiKey } });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not load voices'));
  const body = await res.json();
  return (body.voices ?? [])
    .filter((v: { category?: string }) => v.category === 'premade')
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
