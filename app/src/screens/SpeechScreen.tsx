import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import Slider from '@react-native-community/slider';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { SERVO_LIST } from '../api/servoConfig';

const JAW = SERVO_LIST.find((s) => s.name === 'jaw')!;

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

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((all) => setVoices(all.filter((v) => v.language?.startsWith('en'))))
      .catch(() => setVoices([]));
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

  const speak = () => {
    if (!text.trim()) return;
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
      onError: () => setSpeaking(false),
    });
  };

  const stop = () => {
    Speech.stop();
    setSpeaking(false);
    if (puppetJaw) client.setServo('jaw', jawZero).catch(() => {});
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ConnectionBadge />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Text to speech</Text>
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

      {voices.length > 0 && (
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

      <View style={[styles.puppetRow, { backgroundColor: colors.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Puppet skull jaw while speaking</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Sends jaw servo pulses to Skelly over the control API in time with
            speech. The audio itself plays from this phone, not the skull.
          </Text>
        </View>
        <Switch value={puppetJaw} onValueChange={setPuppetJaw} trackColor={{ true: colors.accent }} />
      </View>

      <Pressable
        style={[styles.speakButton, { backgroundColor: colors.accent }, speaking && { backgroundColor: colors.danger }]}
        onPress={speaking ? stop : speak}
      >
        <Text style={styles.speakButtonText}>{speaking ? 'Stop' : 'Speak'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
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
