import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ServoSlider } from '../components/ServoSlider';
import { VISIBLE_SERVO_LIST } from '../api/servoConfig';

export function ControlScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <ConnectionBadge />
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
  servoList: { paddingBottom: 24 },
});
