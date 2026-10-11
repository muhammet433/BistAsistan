import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { colors, typography } from '../theme';

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bullish: boolean;
}

export function CandlestickChart({
  candles,
  width,
  height = 260,
  showVolume = true,
}: {
  candles: Candle[];
  width: number;
  height?: number;
  showVolume?: boolean;
}) {
  const chart = useMemo(() => {
    if (!candles || candles.length < 2) return null;

    const valid = candles.filter(
      c =>
        c && typeof c.close === 'number' && Number.isFinite(c.close) &&
        typeof c.high === 'number' && Number.isFinite(c.high) &&
        typeof c.low === 'number' && Number.isFinite(c.low)
    );

    if (valid.length < 2) return null;

    const padding = { top: 8, right: 44, bottom: showVolume ? 18 : 22, left: 6 };
    const volumeZone = showVolume ? height * 0.18 : 0;
    const priceHeight = height - padding.top - padding.bottom - volumeZone;

    const highs = valid.map(c => c.high);
    const lows = valid.map(c => c.low);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const range = max - min || 1;

    const innerWidth = width - padding.left - padding.right;
    const step = innerWidth / valid.length;
    const bodyWidth = Math.max(1.5, Math.min(step * 0.62, 12));

    const xFor = (i: number) => padding.left + step * i + step / 2;
    const yFor = (price: number) =>
      padding.top + priceHeight - ((price - min) / range) * priceHeight;

    const maxVolume = Math.max(...valid.map(c => c.volume || 0)) || 1;
    const volBase = height - padding.bottom;

    const shapes = valid.map((c, i) => {
      const x = xFor(i);
      const open = typeof c.open === 'number' && Number.isFinite(c.open) ? c.open : c.close;
      const openY = yFor(open);
      const closeY = yFor(c.close);
      const highY = yFor(c.high);
      const lowY = yFor(c.low);

      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(Math.abs(closeY - openY), 1);

      const volHeight = ((c.volume || 0) / maxVolume) * volumeZone;

      return { x, bodyTop, bodyHeight, highY, lowY, bodyWidth, volHeight, bullish: c.bullish };
    });

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
      y: padding.top + priceHeight * ratio,
      value: max - range * ratio,
    }));

    const last = valid[valid.length - 1];
    const lastY = yFor(last.close);

    return { shapes, gridLines, lastY, padding, priceHeight, volumeZone };
  }, [candles, width, height, showVolume]);

  if (!chart) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Mum grafigi icin yeterli veri yok</Text>
      </View>
    );
  }

  const { shapes, gridLines, lastY, padding, priceHeight, volumeZone } = chart;
  const volBase = height - padding.bottom;

  return (
    <Svg width={width} height={height}>
      {gridLines.map((line, i) => (
        <React.Fragment key={i}>
          <Line
            x1={padding.left}
            y1={line.y}
            x2={width - padding.right}
            y2={line.y}
            stroke={colors.border}
            strokeWidth={0.5}
          />
          <SvgText
            x={width - padding.right + 4}
            y={line.y + 3}
            fontSize="9"
            fill={colors.textTertiary}
          >
            {line.value.toFixed(1)}
          </SvgText>
        </React.Fragment>
      ))}

      {shapes.map((s, i) => {
        const color = s.bullish ? colors.green : colors.red;
        return (
          <React.Fragment key={i}>
            <Line
              x1={s.x}
              y1={s.highY}
              x2={s.x}
              y2={s.lowY}
              stroke={color}
              strokeWidth={1}
            />
            <Rect
              x={s.x - s.bodyWidth / 2}
              y={s.bodyTop}
              width={s.bodyWidth}
              height={s.bodyHeight}
              fill={s.bullish ? colors.green : colors.red}
              rx={0.5}
            />
            {volumeZone > 0 && (
              <Rect
                x={s.x - s.bodyWidth / 2}
                y={volBase - s.volHeight}
                width={s.bodyWidth}
                height={Math.max(s.volHeight, 0.5)}
                fill={color}
                opacity={0.25}
              />
            )}
          </React.Fragment>
        );
      })}

      <Line
        x1={padding.left}
        y1={lastY}
        x2={width - padding.right}
        y2={lastY}
        stroke={colors.accent}
        strokeWidth={0.8}
        strokeDasharray="3,3"
        opacity={0.7}
      />
    </Svg>
  );
}

export function PatternBadge({
  name,
  bias,
  strength,
}: {
  name: string;
  bias: string;
  strength: string;
}) {
  const tone =
    bias === 'BULLISH'
      ? { bg: colors.greenSoft, border: colors.greenBorder, text: colors.green }
      : bias === 'BEARISH'
        ? { bg: colors.redSoft, border: colors.redBorder, text: colors.red }
        : { bg: colors.surfaceElevated, border: colors.border, text: colors.textSecondary };

  const strengthText =
    strength === 'HIGH' ? 'GÜÇLÜ' : strength === 'MEDIUM' ? 'ORTA' : 'ZAYIF';

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.badgeName, { color: tone.text }]}>{name}</Text>
      <Text style={styles.badgeMeta}>{strengthText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeName: { fontSize: 12, fontWeight: '700' },
  badgeMeta: { fontSize: 9, fontWeight: '600', color: colors.textTertiary },
});