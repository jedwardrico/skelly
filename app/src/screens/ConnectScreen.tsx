import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';
import { ConnectionBadge } from '../components/ConnectionBadge';

export function ConnectScreen() {
  const { host, setHost, connectionState, connectionError, reconnect } = useSkelly();
  const { colors } = useTheme();
  const [draft, setDraft] = useState(host);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Skelly</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Animatronic skull control</Text>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Skull address</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="192.168.1.42 or 192.168.4.1"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Find this in the ESP32's serial monitor after boot, or use{' '}
          <Text style={styles.mono}>192.168.4.1</Text> if it's hosting its own
          Skelly-Setup WiFi network.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={() => {
            setHost(draft.trim());
          }}
        >
          <Text style={[styles.buttonText, { color: colors.accentText }]}>Connect</Text>
        </Pressable>
        {connectionState === 'error' && draft === host && (
          <Pressable style={styles.retryButton} onPress={reconnect}>
            <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.status}>
        <ConnectionBadge />
        {connectionError ? <Text style={[styles.error, { color: colors.danger }]}>{connectionError}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 32 },
  card: { borderRadius: 16, padding: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
  button: {
    marginTop: 16,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '700', fontSize: 16 },
  retryButton: { marginTop: 10, alignItems: 'center' },
  retryText: { fontWeight: '600' },
  status: { marginTop: 24, alignItems: 'center' },
  error: { fontSize: 12, marginTop: 6 },
});
