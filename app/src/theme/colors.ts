export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  danger: string;
  success: string;
  warning: string;
  disabled: string;
  disabledText: string;
  inputBackground: string;
  statusBarStyle: 'light' | 'dark';
}

export const darkColors: ThemeColors = {
  background: '#0f1115',
  surface: '#1b1e24',
  surfaceAlt: '#262a33',
  border: '#31353f',
  textPrimary: '#eceff1',
  textSecondary: '#9aa5b1',
  textMuted: '#6b7280',
  accent: '#8b7cf6',
  accentText: '#fff',
  danger: '#ef5350',
  success: '#2ecc71',
  warning: '#f1c40f',
  disabled: '#31353f',
  disabledText: '#6b7280',
  inputBackground: '#14161b',
  statusBarStyle: 'light',
};

export const lightColors: ThemeColors = {
  background: '#fff',
  surface: '#f5f6fa',
  surfaceAlt: '#e8e3ff',
  border: '#dfe6e9',
  textPrimary: '#2d3436',
  textSecondary: '#636e72',
  textMuted: '#95a5a6',
  accent: '#6c5ce7',
  accentText: '#fff',
  danger: '#e74c3c',
  success: '#2ecc71',
  warning: '#f1c40f',
  disabled: '#dfe6e9',
  disabledText: '#b2bec3',
  inputBackground: '#fff',
  statusBarStyle: 'dark',
};
