import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSkelly } from '../context/SkellyContext';
import { useServoCalibration } from '../context/ServoCalibrationContext';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { SERVO_LIST } from '../api/servoConfig';
import type { ServoName } from '../api/skellyClient';

function ServoZeroRow({ name, label, min, max }: { name: ServoName; label: string; min: number; max: number }) {
  const { client, status } = useSkelly();
  const { getZero, setZero, resetZero, isOverridden } = useServoCalibration();
  const [jogValue, setJogValue] = useState<number | null>(null);

  const reported = status.servos[name];
  const zero = getZero(name);
  const displayValue = jogValue ?? reported ?? zero;

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.zeroText}>
          zero: {Math.round(zero)}°{isOverridden(name) ? '' : ' (default)'}
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
          style={styles.setButton}
          onPress={() => {
            const angle = jogValue ?? reported ?? zero;
            setZero(name, angle);
          }}
        >
          <Text style={styles.setButtonText}>Set current as zero</Text>
        </Pressable>
        <Pressable
          style={[styles.resetButton, !isOverridden(name) && styles.resetButtonDisabled]}
          disabled={!isOverridden(name)}
          onPress={() => resetZero(name)}
        >
          <Text style={[styles.resetButtonText, !isOverridden(name) && styles.resetButtonTextDisabled]}>
            Reset
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ServoConfigScreen() {
  const { client } = useSkelly();
  const { getZero } = useServoCalibration();

  const homeAll = () => {
    Promise.all(SERVO_LIST.map((s) => client.setServo(s.name, getZero(s.name)))).catch(() =>
      Alert.alert('Failed to move one or more servos home'),
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ConnectionBadge />
      </View>

      <Text style={styles.sectionTitle}>Servo zero calibration</Text>
      <Text style={styles.hint}>
        Jog a servo to where it should sit at rest, then "Set current as
        zero". This is stored on this phone only - it doesn't change the
        firmware's compiled-in restAngle (include/Config.h), so "Home all"
        below is the app's own idea of neutral, used for its puppeteering
        features.
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
  resetButton: { paddingHorizontal: 16, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#dfe6e9' },
  resetButtonDisabled: { backgroundColor: '#f0f1f5' },
  resetButtonText: { color: '#2d3436', fontWeight: '700', fontSize: 13 },
  resetButtonTextDisabled: { color: '#b2bec3' },
  homeButton: { marginTop: 8, backgroundColor: '#2d3436', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  homeButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
