import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, typography } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function AnimatedNumber({
  value,
  decimals = 2,
  suffix = '',
  style,
  duration = 600,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  style?: any;
  duration?: number;
}) {
  const [animated] = useState(() => new Animated.Value(0));
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const listener = animated.addListener(({ value: v }) => {
      setDisplay(v.toFixed(decimals));
    });
    Animated.timing(animated, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animated.removeListener(listener);
  }, [value, duration, decimals]);

  return (
    <Text style={style}>
      {display}
      {suffix}
    </Text>
  );
}

export function Sparkline({
  data,
  width = 60,
  height = 24,
  color,
  strokeWidth = 1.5,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}) {
  if (data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const lineColor = color || (data[data.length - 1] >= data[0] ? colors.green : colors.red);

  const path = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return index === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Path
        d={path}
        stroke={lineColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChangeBadge({
  value,
  size = 'md',
  showIcon = true,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}) {
  const positive = value >= 0;
  const [scale] = useState(() => new Animated.Value(1));

useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.08, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [value, scale]);

  const sizes = {
    sm: { padding: 4, font: 11, icon: 8 },
    md: { padding: 6, font: 13, icon: 10 },
    lg: { padding: 8, font: 15, icon: 12 },
  }[size];

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          paddingVertical: sizes.padding,
          paddingHorizontal: sizes.padding * 1.4,
          backgroundColor: positive ? colors.greenSoft : colors.redSoft,
          borderColor: positive ? colors.greenBorder : colors.redBorder,
          transform: [{ scale }],
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: positive ? colors.green : colors.red, fontSize: sizes.font },
        ]}
      >
        {showIcon ? (positive ? '▲' : '▼') : ''}
        {Math.abs(value).toFixed(2)}%
      </Text>
    </Animated.View>
  );
}

export function SignalPill({
  action,
  confidence,
}: {
  action: string;
  confidence?: number;
}) {
  const config = {
    BUY: { label: 'ALIŞ', color: colors.green, bg: colors.greenSoft, border: colors.greenBorder },
    SELL: { label: 'SATIŞ', color: colors.red, bg: colors.redSoft, border: colors.redBorder },
    HOLD: { label: 'BEKLE', color: colors.amber, bg: colors.amberSoft, border: colors.amberBorder },
  }[action] || { label: 'BEKLE', color: colors.amber, bg: colors.amberSoft, border: colors.amberBorder };

  return (
    <View style={[styles.pill, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Text style={[styles.pillText, { color: config.color }]}>
        {config.label}
        {confidence !== undefined ? ` ${Math.round(confidence)}%` : ''}
      </Text>
    </View>
  );
}

export function ScoreRing({
  score,
  size = 56,
  strokeWidth = 5,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const [animated] = useState(() => new Animated.Value(0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: score,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score, animated]);

const scoreColor =
    score >= 70 ? colors.green : score >= 45 ? colors.amber : colors.red;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={scoreColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - score / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.ringCenter, { width: size, height: size }]}>
        <Text style={[styles.ringValue, { color: scoreColor, fontSize: size * 0.32 }]}>
          {Math.round(score)}
        </Text>
      </View>
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function EmptyState({
  icon = '—',
  title,
  message,
}: {
  icon?: string;
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>{icon}</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message && <Text style={styles.emptyMessage}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconText: {
    fontSize: 24,
    color: colors.textTertiary,
  },
  emptyTitle: {
    ...typography.subheading,
    color: colors.textSecondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

