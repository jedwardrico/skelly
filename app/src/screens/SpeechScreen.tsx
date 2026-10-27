import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { SERVO_LIST } from '../api/servoConfig';
import {
  DEFAULT_VOICE,
  listVoices,
  SKULL_SPEAKER_STORAGE_KEY,
  synthesizeSpeech,
  TTS_API_KEY_STORAGE_KEY,
  TtsVoice,
} from '../api/tts';
import { VoicePicker } from '../components/VoicePicker';
import { ClipLibrary } from '../components/ClipLibrary';
import { VolumeSlider } from '../components/VolumeSlider';

const JAW = SERVO_LIST.find((s) => s.name === 'jaw')!;

const SKULL_VOICE_STORAGE_KEY = 'skelly:speech:skullVoice';
// Fixed name so repeated speech overwrites one clip instead of filling LittleFS.
const SPEECH_CLIP = 'tts.mp3';
// Used when the key can't list voices (e.g. a restricted key without the
// voices_read permission) so speech still works.
const FALLBACK_VOICES: TtsVoice[] = [DEFAULT_VOICE];

// The account's voices, with the default pinned first even when the API didn't
// list it (it isn't a premade voice).
function withDefaultVoice(list: TtsVoice[]): TtsVoice[] {
  return [DEFAULT_VOICE, ...list.filter((v) => v.id !== DEFAULT_VOICE.id)];
}

export function SpeechScreen() {
  const { client, status } = useSkelly();
  const { colors } = useTheme();
  const jawZero = status.servoZero.jaw ?? JAW.rest;
  const [text, setText] = useState("Hello, I'm Skelly.");
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [speaking, setSpeaking] = useState(false);
  const [puppetJaw, setPuppetJaw] = useState(true);
  const jawOpenRef = useRef(false);
  const [useSkull, setUseSkull] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [skullVoice, setSkullVoice] = useState<string | undefined>(DEFAULT_VOICE.id);
  const [skullVoices, setSkullVoices] = useState<TtsVoice[]>(FALLBACK_VOICES);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'synthesizing' | 'uploading' | null>(null);

  useEffect(() => {
    AsyncStorage.multiGet([SKULL_SPEAKER_STORAGE_KEY, TTS_API_KEY_STORAGE_KEY, SKULL_VOICE_STORAGE_KEY])
      .then((pairs) => {
        const saved = Object.fromEntries(pairs);
        if (saved[SKULL_SPEAKER_STORAGE_KEY] != null) setUseSkull(saved[SKULL_SPEAKER_STORAGE_KEY] === '1');
        if (saved[TTS_API_KEY_STORAGE_KEY]) setApiKey(saved[TTS_API_KEY_STORAGE_KEY]!);
        if (saved[SKULL_VOICE_STORAGE_KEY]) setSkullVoice(saved[SKULL_VOICE_STORAGE_KEY]!);
      })
      .catch(() => {});
  }, []);

  const changeSkullVoice = (v: string) => {
    setSkullVoice(v);
    AsyncStorage.setItem(SKULL_VOICE_STORAGE_KEY, v).catch(() => {});
  };

  // Load the account's voices once a key is entered (debounced while typing).
  useEffect(() => {
    if (!apiKey.trim()) {
      setSkullVoices(FALLBACK_VOICES);
      setVoicesError(null);
      return;
    }
    const timer = setTimeout(() => {
      listVoices(apiKey.trim())
        .then((list) => {
          const usable = withDefaultVoice(list);
          setVoicesError(null);
          setSkullVoices(usable);
          setSkullVoice((cur) => (usable.some((v) => v.id === cur) ? cur : DEFAULT_VOICE.id));
        })
        .catch((err) => {
          setVoicesError(err instanceof Error ? err.message : 'Could not load voices');
          setSkullVoices(FALLBACK_VOICES);
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [apiKey]);

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((all) => setVoices(all.filter((v) => v.language?.startsWith('en'))))
      .catch(() => setVoices([]));

    // Without this, iOS silences on-device TTS whenever the ring/silent
    // switch is flipped, since AVSpeechSynthesizer otherwise respects it.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // On-device TTS speaks through the phone's own speaker - it doesn't touch
  // the skull's MAX98357A amp. This crude jaw puppeteering (pulse the jaw
  // servo on each word boundary) gives the skull something to do while the
  // phone talks, until the firmware gains a streaming-TTS-to-speaker path
  // (see docs/ARCHITECTURE.md's "live streaming TTS" roadmap item).
  const pulseJaw = () => {
    if (!puppetJaw) return;
    jawOpenRef.current = !jawOpenRef.current;
    const angle = jawOpenRef.current ? JAW.max * 0.6 : jawZero;
    client.setServo('jaw', angle).catch(() => {});
  };

  // Synthesizes with ElevenLabs, uploads the mp3 to the skull and plays it
  // there. The firmware's audio-envelope jaw sync drives the jaw, so no
  // phone-side puppeteering is needed on this path.
  const speakOnSkull = async () => {
    if (!apiKey.trim()) {
      Alert.alert('API key needed', 'Add your ElevenLabs API key in the Setup tab to generate speech for the skull.');
      return;
    }
    if (!skullVoice) {
      Alert.alert('No voice', 'No ElevenLabs voice is selected yet - wait a moment after entering the API key.');
      return;
    }
    try {
      setBusy('synthesizing');
      const audio = await synthesizeSpeech(apiKey.trim(), text.trim(), skullVoice, rate);
      setBusy('uploading');
      // Stop first so we're not overwriting the clip while it's being read.
      await client.stop().catch(() => {});
      await client.uploadBlob(audio, SPEECH_CLIP);
      await client.play(SPEECH_CLIP);
    } catch (err) {
      Alert.alert('Speech failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const speak = () => {
    if (!text.trim()) return;
    if (useSkull) {
      speakOnSkull();
      return;
    }
    Speech.speak(text.trim(), {
      voice: voiceId,
      rate,
      pitch,
      onStart: () => setSpeaking(true),
      onBoundary: pulseJaw,
      onDone: () => {
        setSpeaking(false);
        if (puppetJaw) client.setServo('jaw', jawZero).catch(() => {});
      },
      onStopped: () => {
        setSpeaking(false);
        if (puppetJaw) client.setServo('jaw', jawZero).catch(() => {});
      },
      onError: (error) => {
        setSpeaking(false);
        Alert.alert('Speech failed', error?.message ?? 'Unknown error');
      },
    });
  };

  const stop = () => {
    if (useSkull) {
      client.stop().catch(() => {});
      return;
    }
    Speech.stop();
    setSpeaking(false);
    if (puppetJaw) client.setServo('jaw', jawZero).catch(() => {});
  };

  const skullSpeaking = useSkull && status.playing && status.file?.endsWith(SPEECH_CLIP);
  const active = useSkull ? !!skullSpeaking : speaking;
  const buttonLabel = busy === 'synthesizing' ? 'Generating…' : busy === 'uploading' ? 'Sending to skull…' : active ? 'Stop' : 'Speak';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ConnectionBadge />
      </View>

      <View style={[styles.nowPlaying, { backgroundColor: colors.surface }]}>
        <Text style={[styles.nowPlayingTitle, { color: colors.textSecondary }]}>Now playing</Text>
        <Text style={[styles.nowPlayingFile, { color: colors.textPrimary }]}>
          {status.playing ? status.file ?? 'unknown clip' : '— nothing —'}
        </Text>
        <View style={[styles.jawMeterTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.jawMeterFill, { width: `${Math.round(status.jawLevel * 100)}%`, backgroundColor: colors.accent }]} />
        </View>
        <Pressable
          style={[styles.stopButton, { backgroundColor: colors.danger }, !status.playing && { backgroundColor: colors.disabled }]}
          disabled={!status.playing}
          onPress={() => client.stop()}
        >
          <Text style={styles.stopButtonText}>Stop</Text>
        </Pressable>
        <VolumeSlider />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Text to speech</Text>
      <Text style={[styles.hint, { color: colors.textMuted, marginBottom: 8 }]}>
        Playing on {useSkull ? "the skull's speaker" : "this phone's speaker"} (change in the Setup tab).
      </Text>
      <TextInput
        style={[styles.textInput, { borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Type something for Skelly to say…"
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>Rate</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.5}
          maximumValue={1.5}
          value={rate}
          onValueChange={setRate}
          minimumTrackTintColor={colors.accent}
        />
        <Text style={[styles.value, { color: colors.textSecondary }]}>{rate.toFixed(2)}x</Text>
      </View>
      {!useSkull && (
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>Pitch</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.5}
          maximumValue={2.0}
          value={pitch}
          onValueChange={setPitch}
          minimumTrackTintColor={colors.accent}
        />
        <Text style={[styles.value, { color: colors.textSecondary }]}>{pitch.toFixed(2)}x</Text>
      </View>
      )}

      {useSkull && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Voice</Text>
          <VoicePicker voices={skullVoices} selectedId={skullVoice} onSelect={changeSkullVoice} />
          {voicesError && (
            <Text style={[styles.hint, { color: colors.danger }]}>
              Couldn't load your voices ({voicesError}). Using a default voice instead.
            </Text>
          )}
          {!apiKey.trim() && (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Add your ElevenLabs API key in the Setup tab to use the skull speaker.
            </Text>
          )}
        </>
      )}

      {!useSkull && voices.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Voice</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.voiceRow}>
            <Pressable
              style={[styles.voiceChip, { backgroundColor: colors.surface }, voiceId === undefined && { backgroundColor: colors.accent }]}
              onPress={() => setVoiceId(undefined)}
            >
              <Text
                style={[
                  styles.voiceChipText,
                  { color: colors.textPrimary },
                  voiceId === undefined && { color: colors.accentText, fontWeight: '700' },
                ]}
              >
                Default
              </Text>
            </Pressable>
            {voices.map((v) => (
              <Pressable
                key={v.identifier}
                style={[
                  styles.voiceChip,
                  { backgroundColor: colors.surface },
                  voiceId === v.identifier && { backgroundColor: colors.accent },
                ]}
                onPress={() => setVoiceId(v.identifier)}
              >
                <Text
                  style={[
                    styles.voiceChipText,
                    { color: colors.textPrimary },
                    voiceId === v.identifier && { color: colors.accentText, fontWeight: '700' },
                  ]}
                >
                  {v.name ?? v.identifier}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {!useSkull && (
      <View style={[styles.puppetRow, { backgroundColor: colors.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.puppetLabel, { color: colors.textPrimary }]}>Puppet skull jaw while speaking</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Sends jaw servo pulses to Skelly over the control API in time with
            speech. The audio itself plays from this phone, not the skull.
          </Text>
        </View>
        <Switch value={puppetJaw} onValueChange={setPuppetJaw} trackColor={{ true: colors.accent }} />
      </View>
      )}

      <Pressable
        style={[styles.speakButton, { backgroundColor: colors.accent }, active && { backgroundColor: colors.danger }, !!busy && { opacity: 0.6 }]}
        disabled={!!busy}
        onPress={active ? stop : speak}
      >
        <Text style={styles.speakButtonText}>{buttonLabel}</Text>
      </Pressable>

      <ClipLibrary />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  nowPlaying: { borderRadius: 14, padding: 16 },
  nowPlayingTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  nowPlayingFile: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  jawMeterTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  jawMeterFill: { height: '100%' },
  stopButton: { marginTop: 14, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  stopButtonText: { color: '#fff', fontWeight: '700' },
  textInput: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  label: { width: 60, fontSize: 14, fontWeight: '600' },
  puppetLabel: { fontSize: 14, fontWeight: '600' },
  slider: { flex: 1, height: 36 },
  value: { width: 50, fontSize: 13, textAlign: 'right' },
  voiceRow: { marginBottom: 4 },
  voiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  voiceChipText: { fontSize: 13 },
  puppetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    borderRadius: 12,
    padding: 14,
  },
  hint: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  speakButton: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  speakButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
