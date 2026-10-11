import { useMemo, Fragment } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Rect, Text as SvgText } from 'react-native-svg';

export interface ChartPoint {
  date: string;
  close: number;
  volume?: number;
}

interface PriceChartProps {
  data: ChartPoint[];
  width: number;
  height?: number;
  showVolume?: boolean;
}

export function PriceChart({
  data,
  width,
  height = 220,
  showVolume = true,
}: PriceChartProps) {
  const chartHeight = showVolume ? height * 0.75 : height;
  const volumeHeight = showVolume ? height * 0.2 : 0;
  const padding = { top: 10, right: 45, bottom: showVolume ? 4 : 24, left: 8 };

  const chart = useMemo(() => {
    if (data.length < 2) return null;

    const closes = data.map(d => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const xFor = (index: number) =>
      padding.left + (index / (data.length - 1)) * innerWidth;
    const yFor = (value: number) =>
      padding.top + innerHeight - ((value - min) / range) * innerHeight;

    const linePath = data
      .map((point, index) => {
        const x = xFor(index);
        const y = yFor(point.close);
        return index === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
      const y = padding.top + innerHeight * ratio;
      const value = max - range * ratio;
      return { y, value };
    });

    let volumeBars: { x: number; y: number; h: number; w: number }[] = [];
    if (showVolume) {
      const maxVolume = Math.max(...data.map(d => d.volume || 0)) || 1;
      const barWidth = Math.max(1, innerWidth / data.length - 1);
      const baseY = height - padding.bottom;
      volumeBars = data.map((point, index) => {
        const barHeight = ((point.volume || 0) / maxVolume) * volumeHeight;
        return {
          x: xFor(index) - barWidth / 2,
          y: baseY - barHeight,
          h: barHeight,
          w: barWidth,
        };
      });
    }

    return {
      linePath,
      gridLines,
      volumeBars,
      min,
      max,
      yFor,
      xFor,
      innerHeight,
      lastX: xFor(data.length - 1),
      lastY: yFor(data[data.length - 1].close),
    };
  }, [data, width, height, showVolume]);

  if (!chart) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Grafik için yeterli veri yok</Text>
      </View>
    );
  }

  const isUp = data[data.length - 1].close >= data[0].close;
  const lineColor = isUp ? '#4caf50' : '#f44336';

  return (
    <Svg width={width} height={height}>
      {chart.gridLines.map((line, index) => (
        <Fragment key={index}>
          <Line
            x1={padding.left}
            y1={line.y}
            x2={width - padding.right}
            y2={line.y}
            stroke="#e0e0e0"
            strokeWidth={1}
          />
          <SvgText
            x={width - padding.right + 4}
            y={line.y + 4}
            fontSize="10"
            fill="#888"
          >
            {line.value.toFixed(2)}
          </SvgText>
        </Fragment>
      ))}

      {chart.volumeBars.map((bar, index) => (
        <Rect
          key={index}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          fill="#cfd8dc"
          opacity={0.7}
        />
      ))}

      <Path
        d={chart.linePath}
        stroke={lineColor}
        strokeWidth={2}
        fill="none"
      />

      <Rect
        x={chart.lastX - 3}
        y={chart.lastY - 3}
        width={6}
        height={6}
        fill={lineColor}
      />
    </Svg>
  );
}

export function MovingAverageLine({
  data,
  width,
  height = 220,
  period = 20,
  color = '#f57c00',
}: {
  data: ChartPoint[];
  width: number;
  height?: number;
  period?: number;
  color?: string;
}) {
  const path = useMemo(() => {
    if (data.length <= period) return null;

    const padding = { top: 10, right: 45, bottom: 24, left: 8 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const values: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      values.push(slice.reduce((sum, p) => sum + p.close, 0) / period);
    }

    const closes = data.map(d => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const d = values
      .map((value, index) => {
        const dataIndex = index + period - 1;
        const x =
          padding.left + (dataIndex / (data.length - 1)) * innerWidth;
        const y = padding.top + innerHeight - ((value - min) / range) * innerHeight;
        return index === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    return { d, values };
  }, [data, width, height, period]);

  if (!path) return null;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Path d={path.d} stroke={color} strokeWidth={1.5} fill="none" strokeDasharray="4,3" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 8,
  },
  emptyText: { color: '#888', fontSize: 13 },
});