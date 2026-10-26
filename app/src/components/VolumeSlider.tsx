import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';

// Skull speaker volume. Follows the volume the skull reports, except while
// dragging, when the local value wins so the thumb doesn't jump back.
export function VolumeSlider() {
  const { client, status } = useSkelly();
  const { colors } = useTheme();
  const [dragValue, setDragValue] = useState<number | null>(null);

  const value = dragValue ?? status.volume;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>Volume</Text>
        <Text style={[styles.value, { color: colors.textSecondary }]}>{Math.round(value * 100)}%</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={value}
        onValueChange={setDragValue}
        onSlidingComplete={(v) => {
          setDragValue(null);
          client.setVolume(v).catch(() => {});
        }}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 15, fontWeight: '600' },
  value: { fontSize: 14 },
  slider: { height: 36 },
});
