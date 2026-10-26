import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ServoSlider } from '../components/ServoSlider';
import { VISIBLE_SERVO_LIST } from '../api/servoConfig';

export function ControlScreen() {
  const { client, status } = useSkelly();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <ConnectionBadge />
      </View>

      <View style={[styles.nowPlaying, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Now playing</Text>
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
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Manual servo control</Text>
      <View style={styles.servoList}>
        {VISIBLE_SERVO_LIST.map((servo) => (
          <ServoSlider key={servo.name} name={servo.name} label={servo.label} min={servo.min} max={servo.max} rest={servo.rest} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  nowPlaying: { borderRadius: 14, padding: 16 },
  nowPlayingFile: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  jawMeterTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  jawMeterFill: { height: '100%' },
  stopButton: { marginTop: 14, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  stopButtonText: { color: '#fff', fontWeight: '700' },
  servoList: { paddingBottom: 24 },
});
