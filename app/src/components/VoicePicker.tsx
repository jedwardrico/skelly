import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { TtsVoice } from '../api/tts';

interface Props {
  voices: TtsVoice[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

// Dropdown that opens a searchable list of voices. The list can run to dozens
// of entries, which the old horizontal chip row made hard to scan.
export function VoicePicker({ voices, selectedId, onSelect }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = voices.find((v) => v.id === selectedId);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? voices.filter((v) => v.name.toLowerCase().includes(q)) : voices;
  }, [voices, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Pressable
        style={[styles.field, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.fieldText, { color: colors.textPrimary }]} numberOfLines={1}>
          {selected?.name ?? 'Select a voice'}
        </Text>
        <Text style={{ color: colors.textSecondary }}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          {/* Inner Pressable swallows taps so only the backdrop dismisses. */}
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[
                styles.search,
                { borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.textPrimary },
              ]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search voices…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={(v) => v.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[styles.empty, { color: colors.textMuted }]}>No voices match “{query}”.</Text>
              }
              renderItem={({ item }) => {
                const active = item.id === selectedId;
                return (
                  <Pressable
                    style={[styles.row, active && { backgroundColor: colors.accent }]}
                    onPress={() => {
                      onSelect(item.id);
                      close();
                    }}
                  >
                    <Text
                      style={{ color: active ? colors.accentText : colors.textPrimary, fontWeight: active ? '700' : '400' }}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldText: { flex: 1, fontSize: 16, marginRight: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  sheet: { maxHeight: '70%', borderRadius: 14, borderWidth: 1, padding: 12 },
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 8 },
  row: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8 },
  empty: { textAlign: 'center', paddingVertical: 16 },
});
