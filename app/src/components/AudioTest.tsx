import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';
import { buildTestWav, bytesToBlob, crc32 } from '../api/testAudio';

const TEST_CLIP = 'app_test.wav';

// Uploads and plays a generated WAV (no ElevenLabs credits) and compares the
// CRC-32 the firmware computed against ours, to tell a corrupted transfer from
// a wiring/decode problem.
export function AudioTest() {
  const { client } = useSkelly();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const sendTestTone = async () => {
    try {
      setBusy(true);
      setResult(null);
      const bytes = buildTestWav();
      const expected = crc32(bytes);
      await client.stop().catch(() => {});
      const info = await client.uploadBlobInfo(await bytesToBlob(bytes, 'audio/wav'), TEST_CLIP);
      const match = info.crc32 === expected && info.size === bytes.length;
      setResult(
        match
          ? `Transfer OK (${bytes.length} bytes, CRC ${expected.toString(16)}). Garbling now = wiring/power.`
          : `Transfer CORRUPTED: sent ${bytes.length} bytes / CRC ${expected.toString(16)}, skull got ${info.size} / ${info.crc32?.toString(16)}.`,
      );
      await client.play(TEST_CLIP);
    } catch (err) {
      Alert.alert('Test tone failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Pressable
        style={[styles.button, { borderColor: colors.accent }, busy && { opacity: 0.6 }]}
        disabled={busy}
        onPress={sendTestTone}
      >
        <Text style={[styles.buttonText, { color: colors.accent }]}>{busy ? 'Sending…' : 'Send test tone to skull'}</Text>
      </Pressable>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Uploads and plays a generated WAV (no ElevenLabs credits) and checks the bytes arrived intact.
      </Text>
      {result && <Text style={[styles.hint, { color: colors.textPrimary }]}>{result}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 2, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 12, marginTop: 4, lineHeight: 16 },
});
