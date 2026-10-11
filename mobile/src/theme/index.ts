export const colors = {
  background: '#0B0E14',
  surface: '#141925',
  surfaceElevated: '#1C2233',
  surfaceHover: '#232A3D',

  border: '#252C3D',
  borderLight: '#2F3849',

  textPrimary: '#F0F3F8',
  textSecondary: '#98A2B8',
  textTertiary: '#5E6880',
  textInverse: '#0B0E14',

  green: '#22C77A',
  greenSoft: 'rgba(34, 199, 122, 0.12)',
  greenBorder: 'rgba(34, 199, 122, 0.3)',

  red: '#F5566B',
  redSoft: 'rgba(245, 86, 107, 0.12)',
  redBorder: 'rgba(245, 86, 107, 0.3)',

  amber: '#F5A524',
  amberSoft: 'rgba(245, 165, 36, 0.12)',
  amberBorder: 'rgba(245, 165, 36, 0.3)',

  blue: '#4C8DFF',
  blueSoft: 'rgba(76, 141, 255, 0.12)',
  blueBorder: 'rgba(76, 141, 255, 0.3)',

  purple: '#A97BFF',
  purpleSoft: 'rgba(169, 123, 255, 0.12)',

  accent: '#4C8DFF',
  gradientStart: '#4C8DFF',
  gradientEnd: '#A97BFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '700' as const },
  subheading: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  mono: { fontSize: 13, fontWeight: '600' as const },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  glow: {
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const duration = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;