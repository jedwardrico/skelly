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
import { ConnectionBadge } from '../components/ConnectionBadge';
import { SERVO_LIST } from '../api/servoConfig';

const JAW = SERVO_LIST.find((s) => s.name === 'jaw')!;

export function SpeechScreen() {
  const { client } = useSkelly();
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
    const angle = jawOpenRef.current ? JAW.max * 0.6 : JAW.rest;
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
        if (puppetJaw) client.setServo('jaw', JAW.rest).catch(() => {});
      },
      onStopped: () => {
        setSpeaking(false);
        if (puppetJaw) client.setServo('jaw', JAW.rest).catch(() => {});
      },
      onError: () => setSpeaking(false),
    });
  };

  const stop = () => {
    Speech.stop();
    setSpeaking(false);
    if (puppetJaw) client.setServo('jaw', JAW.rest).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ConnectionBadge />
      </View>

      <Text style={styles.sectionTitle}>Text to speech</Text>
      <TextInput
        style={styles.textInput}
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Type something for Skelly to say…"
      />

      <View style={styles.row}>
        <Text style={styles.label}>Rate</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.5}
          maximumValue={1.5}
          value={rate}
          onValueChange={setRate}
          minimumTrackTintColor="#6c5ce7"
        />
        <Text style={styles.value}>{rate.toFixed(2)}x</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Pitch</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.5}
          maximumValue={2.0}
          value={pitch}
          onValueChange={setPitch}
          minimumTrackTintColor="#6c5ce7"
        />
        <Text style={styles.value}>{pitch.toFixed(2)}x</Text>
      </View>

      {voices.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Voice</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.voiceRow}>
            <Pressable
              style={[styles.voiceChip, voiceId === undefined && styles.voiceChipActive]}
              onPress={() => setVoiceId(undefined)}
            >
              <Text style={[styles.voiceChipText, voiceId === undefined && styles.voiceChipTextActive]}>
                Default
              </Text>
            </Pressable>
            {voices.map((v) => (
              <Pressable
                key={v.identifier}
                style={[styles.voiceChip, voiceId === v.identifier && styles.voiceChipActive]}
                onPress={() => setVoiceId(v.identifier)}
              >
                <Text style={[styles.voiceChipText, voiceId === v.identifier && styles.voiceChipTextActive]}>
                  {v.name ?? v.identifier}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <View style={styles.puppetRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Puppet skull jaw while speaking</Text>
          <Text style={styles.hint}>
            Sends jaw servo pulses to Skelly over the control API in time with
            speech. The audio itself plays from this phone, not the skull.
          </Text>
        </View>
        <Switch value={puppetJaw} onValueChange={setPuppetJaw} />
      </View>

      <Pressable
        style={[styles.speakButton, speaking && styles.speakButtonActive]}
        onPress={speaking ? stop : speak}
      >
        <Text style={styles.speakButtonText}>{speaking ? 'Stop' : 'Speak'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#636e72', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  textInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  label: { width: 60, fontSize: 14, color: '#2d3436', fontWeight: '600' },
  slider: { flex: 1, height: 36 },
  value: { width: 50, fontSize: 13, color: '#636e72', textAlign: 'right' },
  voiceRow: { marginBottom: 4 },
  voiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f5f6fa',
    borderRadius: 20,
    marginRight: 8,
  },
  voiceChipActive: { backgroundColor: '#6c5ce7' },
  voiceChipText: { fontSize: 13, color: '#2d3436' },
  voiceChipTextActive: { color: '#fff', fontWeight: '700' },
  puppetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    backgroundColor: '#f5f6fa',
    borderRadius: 12,
    padding: 14,
  },
  hint: { fontSize: 12, color: '#95a5a6', marginTop: 4, lineHeight: 16 },
  speakButton: {
    marginTop: 24,
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  speakButtonActive: { backgroundColor: '#e74c3c' },
  speakButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
