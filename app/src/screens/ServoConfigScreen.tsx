import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSkelly } from '../context/SkellyContext';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { SERVO_LIST } from '../api/servoConfig';
import type { ServoName } from '../api/skellyClient';

function ServoZeroRow({ name, label, min, max }: { name: ServoName; label: string; min: number; max: number }) {
  const { client, status } = useSkelly();
  const [jogValue, setJogValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const reported = status.servos[name];
  const zero = status.servoZero[name] ?? (min + max) / 2;
  const defaultZero = SERVO_LIST.find((s) => s.name === name)?.rest ?? zero;
  const isOverridden = Math.abs(zero - defaultZero) > 0.5;
  const displayValue = jogValue ?? reported ?? zero;

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.zeroText}>
          zero: {Math.round(zero)}°{isOverridden ? '' : ' (default)'}
        </Text>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        value={reported ?? zero}
        onValueChange={(v) => setJogValue(v)}
        onSlidingComplete={(v) => {
          setJogValue(v);
          client.setServo(name, v).catch(() => {});
        }}
        minimumTrackTintColor="#6c5ce7"
        maximumTrackTintColor="#dfe6e9"
      />
      <Text style={styles.currentText}>current: {Math.round(displayValue)}°</Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.setButton, saving && styles.buttonDisabled]}
          disabled={saving}
          onPress={async () => {
            const angle = jogValue ?? reported ?? zero;
            setSaving(true);
            try {
              const ok = await client.setServoZero(name, angle);
              if (!ok) Alert.alert('Failed to save zero', `Could not persist ${label}'s zero on the skull.`);
            } catch (err) {
              Alert.alert('Failed to save zero', String(err));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Text style={styles.setButtonText}>Set current as zero</Text>
        </Pressable>
        <Pressable
          style={[styles.resetButton, (!isOverridden || saving) && styles.resetButtonDisabled]}
          disabled={!isOverridden || saving}
          onPress={async () => {
            setSaving(true);
            try {
              const ok = await client.resetServoZero(name);
              if (!ok) Alert.alert('Failed to reset zero', `Could not reset ${label}'s zero on the skull.`);
            } catch (err) {
              Alert.alert('Failed to reset zero', String(err));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Text style={[styles.resetButtonText, !isOverridden && styles.resetButtonTextDisabled]}>
            Reset
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ServoConfigScreen() {
  const { client, status } = useSkelly();

  const homeAll = () => {
    Promise.all(
      SERVO_LIST.map((s) => client.setServo(s.name, status.servoZero[s.name] ?? s.rest)),
    ).catch(() => Alert.alert('Failed to move one or more servos home'));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ConnectionBadge />
      </View>

      <Text style={styles.sectionTitle}>Servo zero calibration</Text>
      <Text style={styles.hint}>
        Jog a servo to where it should sit at rest, then "Set current as
        zero". This is persisted on the skull itself (flash/NVS via
        `POST /api/servo/zero`), so it survives reboots and applies no
        matter which phone or app connects - see docs/API.md.
      </Text>

      {SERVO_LIST.map((servo) => (
        <ServoZeroRow key={servo.name} name={servo.name} label={servo.label} min={servo.min} max={servo.max} />
      ))}

      <Pressable style={styles.homeButton} onPress={homeAll}>
        <Text style={styles.homeButtonText}>Home all (go to zero)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#636e72', textTransform: 'uppercase', marginTop: 8, marginBottom: 8 },
  hint: { fontSize: 12, color: '#95a5a6', lineHeight: 17, marginBottom: 16 },
  row: { backgroundColor: '#f5f6fa', borderRadius: 14, padding: 16, marginBottom: 14 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 15, fontWeight: '700', color: '#2d3436' },
  zeroText: { fontSize: 13, color: '#6c5ce7', fontWeight: '600' },
  slider: { width: '100%', height: 36 },
  currentText: { fontSize: 12, color: '#636e72', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  setButton: { flex: 1, backgroundColor: '#6c5ce7', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  setButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  buttonDisabled: { opacity: 0.5 },
  resetButton: { paddingHorizontal: 16, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#dfe6e9' },
  resetButtonDisabled: { backgroundColor: '#f0f1f5' },
  resetButtonText: { color: '#2d3436', fontWeight: '700', fontSize: 13 },
  resetButtonTextDisabled: { color: '#b2bec3' },
  homeButton: { marginTop: 8, backgroundColor: '#2d3436', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  homeButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
