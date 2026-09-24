import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { SERVO_LIST, VISIBLE_SERVO_LIST } from '../api/servoConfig';
import type { ServoName } from '../api/skellyClient';

function ServoZeroRow({ name, label, min, max }: { name: ServoName; label: string; min: number; max: number }) {
  const { client, status } = useSkelly();
  const { colors } = useTheme();
  const [jogValue, setJogValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const reported = status.servos[name];
  const zero = status.servoZero[name] ?? (min + max) / 2;
  const defaultZero = SERVO_LIST.find((s) => s.name === name)?.rest ?? zero;
  const isOverridden = Math.abs(zero - defaultZero) > 0.5;
  const displayValue = jogValue ?? reported ?? zero;

  const nudge = (delta: number) => {
    const next = Math.min(max, Math.max(min, displayValue + delta));
    setJogValue(next);
    client.setServo(name, next).catch(() => {});
  };

  const nudgeButton = (delta: number) => (
    <Pressable
      key={delta}
      style={[styles.nudgeButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
      onPress={() => nudge(delta)}
    >
      <Text style={[styles.nudgeButtonText, { color: colors.textPrimary }]}>
        {delta > 0 ? `+${delta}` : delta}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <View style={styles.rowHeader}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.zeroText, { color: colors.accent }]}>
          zero: {Math.round(zero)}°{isOverridden ? '' : ' (default)'}
        </Text>
      </View>

      <View style={styles.sliderRow}>
        <View style={styles.nudgeGroup}>
          {nudgeButton(-10)}
          {nudgeButton(-5)}
        </View>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          value={displayValue}
          onValueChange={(v) => setJogValue(v)}
          onSlidingComplete={(v) => {
            setJogValue(v);
            client.setServo(name, v).catch(() => {});
          }}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.border}
        />
        <View style={styles.nudgeGroup}>
          {nudgeButton(5)}
          {nudgeButton(10)}
        </View>
      </View>
      <Text style={[styles.currentText, { color: colors.textSecondary }]}>current: {Math.round(displayValue)}°</Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.setButton, { backgroundColor: colors.accent }, saving && styles.buttonDisabled]}
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
          style={[
            styles.resetButton,
            { backgroundColor: colors.disabled },
            (!isOverridden || saving) && { backgroundColor: colors.surfaceAlt },
          ]}
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
          <Text
            style={[
              styles.resetButtonText,
              { color: colors.textPrimary },
              !isOverridden && { color: colors.disabledText },
            ]}
          >
            Reset
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ServoConfigScreen() {
  const { client, status } = useSkelly();
  const { colors, mode, toggleTheme } = useTheme();

  const homeAll = () => {
    Promise.all(
      VISIBLE_SERVO_LIST.map((s) => client.setServo(s.name, status.servoZero[s.name] ?? s.rest)),
    ).catch(() => Alert.alert('Failed to move one or more servos home'));
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ConnectionBadge />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
      <View style={[styles.appearanceRow, { backgroundColor: colors.surface }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>Dark mode</Text>
        <Switch value={mode === 'dark'} onValueChange={toggleTheme} trackColor={{ true: colors.accent }} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Servo zero calibration</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Jog a servo to where it should sit at rest, then "Set current as
        zero". This is persisted on the skull itself (flash/NVS via
        `POST /api/servo/zero`), so it survives reboots and applies no
        matter which phone or app connects - see docs/API.md.
      </Text>

      {VISIBLE_SERVO_LIST.map((servo) => (
        <ServoZeroRow key={servo.name} name={servo.name} label={servo.label} min={servo.min} max={servo.max} />
      ))}

      <Pressable style={[styles.homeButton, { backgroundColor: colors.textPrimary }]} onPress={homeAll}>
        <Text style={[styles.homeButtonText, { color: colors.background }]}>Home all (go to zero)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 8, marginBottom: 8 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 16 },
  appearanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  row: { borderRadius: 14, padding: 16, marginBottom: 14 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 15, fontWeight: '700' },
  zeroText: { fontSize: 13, fontWeight: '600' },
  sliderRow: { flexDirection: 'row', alignItems: 'center' },
  slider: { flex: 1, height: 36 },
  nudgeGroup: { flexDirection: 'row' },
  nudgeButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginHorizontal: 2,
    minWidth: 36,
    alignItems: 'center',
  },
  nudgeButtonText: { fontSize: 12, fontWeight: '700' },
  currentText: { fontSize: 12, marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  setButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  setButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  buttonDisabled: { opacity: 0.5 },
  resetButton: { paddingHorizontal: 16, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  resetButtonText: { fontWeight: '700', fontSize: 13 },
  homeButton: { marginTop: 8, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  homeButtonText: { fontWeight: '700', fontSize: 16 },
});
