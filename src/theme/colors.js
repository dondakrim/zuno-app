// Palette officielle Zuno, tirée du logo.
// Le violet est réservé aux barres de navigation, l'orange aux actions principales.
//
// THÈME SOMBRE : `colors` est modifié sur place par applyTheme() AVANT que les
// écrans ne soient chargés (voir App.js). Tous les écrans qui utilisent
// `colors.xxx` passent donc automatiquement en sombre.
export const colors = {
  purple: '#2E0B8C',
  purpleDark: '#210875',
  orange: '#FF6A00',
  white: '#FFFFFF',
  background: '#F7F7F5',
  surface: '#FFFFFF',
  border: '#E5E3DC',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6A63',
  textMuted: '#9B998F',
  success: '#1D9E75',
  successBg: '#E1F5EE',
  danger: '#E24B4A',
  // Teintes douces (pastilles d'icônes, badges)
  tintOrange: '#FFF1E6',
  tintRed: '#FBE9E9',
  tintPurple: '#ECE8FB',
  tintBlue: '#E6F0FD',
  blue: '#1D5FC9',
};

export const lightColors = { ...colors };

export const darkColors = {
  purple: '#8366F5',
  purpleDark: '#5A3FC4',
  orange: '#FF8A33',
  white: '#FFFFFF',
  background: '#0F0E17',
  surface: '#1C1B2B',
  border: '#3A3850',
  textPrimary: '#FFFFFF',
  textSecondary: '#D5D3E6',
  textMuted: '#B3B0C8',
  success: '#4FE0A5',
  successBg: '#12372C',
  danger: '#FF8A89',
  tintOrange: '#3F2A18',
  tintRed: '#42202A',
  tintPurple: '#2E2860',
  tintBlue: '#1D3050',
  blue: '#8DB6FF',
};

export const theme = { mode: 'light' };

export function applyTheme(mode) {
  const dark = mode === 'dark';
  Object.assign(colors, dark ? darkColors : lightColors);
  theme.mode = dark ? 'dark' : 'light';
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};
