// Cloud text-to-speech (OpenAI). expo-speech can only play through the
// phone's own speaker and can't hand back the audio, so playing through the
// skull's amp means getting real audio bytes from somewhere we can upload to
// the ESP32 (see SkellyClient.uploadBlob).

export const TTS_VOICES = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'] as const;
export type TtsVoice = (typeof TTS_VOICES)[number];

const TTS_URL = 'https://api.openai.com/v1/audio/speech';

// Returns an mp3 blob. `speed` is OpenAI's 0.25-4.0 playback speed.
export async function synthesizeSpeech(
  apiKey: string,
  text: string,
  voice: TtsVoice,
  speed: number,
): Promise<Blob> {
  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      input: text,
      voice,
      speed,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `TTS request failed (HTTP ${res.status})`);
  }
  return res.blob();
}
