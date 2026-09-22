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
import { ConnectionBadge } from '../components/ConnectionBadge';

export function ConnectScreen() {
  const { host, setHost, connectionState, connectionError, reconnect } = useSkelly();
  const [draft, setDraft] = useState(host);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Skelly</Text>
      <Text style={styles.subtitle}>Animatronic skull control</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Skull address</Text>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="192.168.1.42 or 192.168.4.1"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.hint}>
          Find this in the ESP32's serial monitor after boot, or use{' '}
          <Text style={styles.mono}>192.168.4.1</Text> if it's hosting its own
          Skelly-Setup WiFi network.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            setHost(draft.trim());
          }}
        >
          <Text style={styles.buttonText}>Connect</Text>
        </Pressable>
        {connectionState === 'error' && draft === host && (
          <Pressable style={styles.retryButton} onPress={reconnect}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.status}>
        <ConnectionBadge />
        {connectionError ? <Text style={styles.error}>{connectionError}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '800', color: '#2d3436', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#636e72', textAlign: 'center', marginBottom: 32 },
  card: { backgroundColor: '#f5f6fa', borderRadius: 16, padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#636e72', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  hint: { fontSize: 12, color: '#95a5a6', marginTop: 8, lineHeight: 17 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
  button: {
    marginTop: 16,
    backgroundColor: '#6c5ce7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  retryButton: { marginTop: 10, alignItems: 'center' },
  retryText: { color: '#6c5ce7', fontWeight: '600' },
  status: { marginTop: 24, alignItems: 'center' },
  error: { color: '#e74c3c', fontSize: 12, marginTop: 6 },
});
