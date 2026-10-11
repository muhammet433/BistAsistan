export const colors = {
  background: '#080B14',
  surface: '#121826',
  surfaceElevated: '#1B2334',
  surfaceHover: '#232D42',

  border: '#27324A',
  borderLight: '#35415E',

  textPrimary: '#F2F6FF',
  textSecondary: '#9BA8C7',
  textTertiary: '#64729A',
  textInverse: '#080B14',

  green: '#00E88F',
  greenSoft: 'rgba(0, 232, 143, 0.14)',
  greenBorder: 'rgba(0, 232, 143, 0.38)',

  red: '#FF3D71',
  redSoft: 'rgba(255, 61, 113, 0.14)',
  redBorder: 'rgba(255, 61, 113, 0.38)',

  amber: '#FFB020',
  amberSoft: 'rgba(255, 176, 32, 0.14)',
  amberBorder: 'rgba(255, 176, 32, 0.38)',

  blue: '#3B82F6',
  blueSoft: 'rgba(59, 130, 246, 0.16)',
  blueBorder: 'rgba(59, 130, 246, 0.4)',

  purple: '#A855F7',
  purpleSoft: 'rgba(168, 85, 247, 0.16)',
  purpleBorder: 'rgba(168, 85, 247, 0.4)',

  cyan: '#06D6E0',
  cyanSoft: 'rgba(6, 214, 224, 0.14)',

  pink: '#F472B6',
  orange: '#FF8A3D',

  accent: '#3B82F6',
  accentAlt: '#A855F7',
  gradientStart: '#3B82F6',
  gradientEnd: '#A855F7',
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