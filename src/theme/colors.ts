export const Colors = {
  // Backgrounds
  bgPrimary: '#1a1a2e',
  bgSecondary: '#16213e',
  bgTertiary: '#0f3460',
  bgCard: 'rgba(255,255,255,0.08)',
  bgCardHover: 'rgba(255,255,255,0.12)',
  bgCardDark: 'rgba(0,0,0,0.3)',

  // Accents
  cyan: '#00d2ff',
  cyanLight: '#33dbff',
  cyanDark: '#0099cc',
  purple: '#7c3aed',
  purpleLight: '#a78bfa',
  gold: '#ffd700',
  goldLight: '#ffe55c',

  // Status
  active: '#22c55e',
  standby: '#f59e0b',
  powerSave: '#6b7280',
  error: '#ef4444',

  // Ranks
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  goldRank: '#ffd700',
  platinum: '#e5e4e2',

  // Text
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.35)',
  textInverse: '#1a1a2e',

  // Borders
  border: 'rgba(255,255,255,0.12)',
  borderLight: 'rgba(255,255,255,0.06)',

  // Gradients
  gradientStart: '#1a1a2e',
  gradientEnd: '#16213e',
  gradientCyan: '#00d2ff',
  gradientPurple: '#7c3aed',

  // Supporter
  supporter: '#ffd700',

  // Transparent
  transparent: 'transparent',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

export const Gradients = {
  background: ['#1a1a2e', '#16213e', '#0f3460'],
  cyan: ['#00d2ff', '#0099cc'],
  purple: ['#7c3aed', '#5b21b6'],
  gold: ['#ffd700', '#f59e0b'],
  card: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'],
  active: ['#22c55e', '#16a34a'],
  bronze: ['#cd7f32', '#a0522d'],
  silver: ['#c0c0c0', '#9ca3af'],
  goldRank: ['#ffd700', '#f59e0b'],
  platinum: ['#e5e4e2', '#d4d4d4'],
} as const;
