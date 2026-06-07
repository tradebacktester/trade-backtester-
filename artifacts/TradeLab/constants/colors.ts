export const colors = {
  background: '#050505',
  surface: '#111214',
  surfaceRaised: '#1A1A1E',
  border: '#1F1F23',
  borderStrong: '#2A2A2E',

  foreground: '#FFFFFF',
  foregroundMuted: '#A1A1AA',
  foregroundSubtle: '#71717A',

  primary: '#FFFFFF',
  primaryForeground: '#050505',

  brand: '#000000',
  brandLight: '#1A1A1A',
  brandDim: 'rgba(0,0,0,0.35)',

  success: '#22C55E',
  successDim: 'rgba(34,197,94,0.12)',
  warning: '#F59E0B',
  warningDim: 'rgba(245,158,11,0.12)',
  error: '#EF4444',
  errorDim: 'rgba(239,68,68,0.12)',

  tabBar: '#0A0A0C',
  tabBarBorder: '#1A1A1E',

  radius: 14,
  radiusSm: 8,
  radiusLg: 20,
} as const;

export type Colors = typeof colors;
