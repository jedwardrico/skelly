import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSkelly } from '../context/SkellyContext';
import type { ServoName } from '../api/skellyClient';

interface Props {
  name: ServoName;
  label: string;
  min: number;
  max: number;
}

export function ServoSlider({ name, label, min, max }: Props) {
  const { client, status } = useSkelly();
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

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{Math.round(value)}°</Text>
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
        minimumTrackTintColor="#6c5ce7"
        maximumTrackTintColor="#dfe6e9"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 15, fontWeight: '600', color: '#2d3436' },
  value: { fontSize: 14, color: '#636e72' },
  slider: { width: '100%', height: 36 },
});
