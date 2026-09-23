import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';
import type { ServoName } from '../api/skellyClient';

interface Props {
  name: ServoName;
  label: string;
  min: number;
  max: number;
}

export function ServoSlider({ name, label, min, max }: Props) {
  const { client, status } = useSkelly();
  const { colors } = useTheme();
  const [dragging, setDragging] = useState(false);
  const [localValue, setLocalValue] = useState<number | null>(null);

  const reported = status.servos[name];
  const value = localValue ?? reported ?? (min + max) / 2;

  // Once the servo's real position catches up to our optimistic local value
  // (set while dragging), drop the override and trust the reported status.
  useEffect(() => {
    if (!dragging && localValue !== null && reported !== undefined && Math.abs(reported - localValue) < 0.5) {
      setLocalValue(null);
    }
  }, [dragging, localValue, reported]);

  const nudge = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    setLocalValue(next);
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
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.textSecondary }]}>{Math.round(value)}°</Text>
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
          value={reported ?? (min + max) / 2}
          onSlidingStart={() => setDragging(true)}
          onValueChange={(v) => setLocalValue(v)}
          onSlidingComplete={(v) => {
            setDragging(false);
            setLocalValue(v);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 15, fontWeight: '600' },
  value: { fontSize: 14 },
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
});
