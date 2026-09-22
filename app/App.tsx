import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SkellyProvider } from './src/context/SkellyContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { ControlScreen } from './src/screens/ControlScreen';
import { SpeechScreen } from './src/screens/SpeechScreen';
import { ServoConfigScreen } from './src/screens/ServoConfigScreen';

type Tab = 'connect' | 'control' | 'speech' | 'setup';

const TABS: { key: Tab; label: string }[] = [
  { key: 'connect', label: 'Connect' },
  { key: 'control', label: 'Control' },
  { key: 'speech', label: 'Speech' },
  { key: 'setup', label: 'Setup' },
];

function AppShell() {
  const [tab, setTab] = useState<Tab>('connect');
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.screen}>
        {tab === 'connect' && <ConnectScreen />}
        {tab === 'control' && <ControlScreen />}
        {tab === 'speech' && <SpeechScreen />}
        {tab === 'setup' && <ServoConfigScreen />}
      </View>
      <View style={[styles.tabBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={styles.tabButton} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, { color: colors.textMuted }, tab === t.key && { color: colors.accent }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <StatusBar style={colors.statusBarStyle} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SkellyProvider>
        <AppShell />
      </SkellyProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabLabel: { fontSize: 13, fontWeight: '600' },
});
