import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/api';
import { PriceChart, MovingAverageLine } from '../../components/PriceChart';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import {
  AnimatedNumber,
  ChangeBadge,
  ScoreRing,
  SectionHeader,
  SignalPill,
} from '../../components/ui';

const CHART_WIDTH = Dimensions.get('window').width - spacing.lg * 2;
const PERIODS = ['1mo', '3mo', '6mo', '1y'];

interface AnalysisData {
  currentPrice: number;
  indicators: any;
  trend: any;
  levels: any;
  volatility: any;
  volumeProfile: any;
  risk: any;
  score: any;
  signals: any[];
  overall: { action: string; confidence: number };
}

function IndicatorTile({ label, value, hint, color }: any) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, color ? { color } : null]}>{value}</Text>
      {hint && <Text style={styles.tileHint}>{hint}</Text>}
    </View>
  );
}

function SignalRow({ signal }: any) {
  const tone =
    signal.type === 'BUY'
      ? { color: colors.green, bg: colors.greenSoft, border: colors.greenBorder }
      : signal.type === 'SELL'
        ? { color: colors.red, bg: colors.redSoft, border: colors.redBorder }
        : { color: colors.blue, bg: colors.blueSoft, border: colors.blueBorder };

  const label = signal.type === 'INFO' ? 'BİLGİ' : signal.type;

  return (
    <View style={[styles.signalRow, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={[styles.signalDot, { backgroundColor: tone.color }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.signalHeader}>
          <Text style={[styles.signalType, { color: tone.color }]}>{label}</Text>
          <Text style={styles.signalCategory}>{signal.category}</Text>
        </View>
        <Text style={styles.signalReason}>{signal.reason}</Text>
      </View>
    </View>
  );
}

export default function DetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [period, setPeriod] = useState('3mo');
  const [watched, setWatched] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [analysisData, historyData] = await Promise.all([
        api.getAnalysis(symbol),
        api.getHistorical(symbol, period),
      ]);
      setAnalysis(analysisData);
      setHistory(historyData.slice(-120));
    } catch {
      Alert.alert('Hata', 'Analiz yuklenemedi');
    } finally {
      setLoading(false);
    }
  }, [symbol, period]);

  const checkWatch = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;
      const list = await api.getWatchlist();
      setWatched(list.includes(symbol));
    } catch {}
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => { checkWatch(); }, [checkWatch])
  );

  const toggleWatch = async () => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      router.push('/auth');
      return;
    }
    try {
      if (watched) {
        await api.removeFromWatchlist(symbol);
        setWatched(false);
      } else {
        await api.addToWatchlist(symbol);
        setWatched(true);
      }
    } catch {
      Alert.alert('Hata', 'Islem tamamlanamadi');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Analiz hesaplaniyor</Text>
        </View>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Veri bulunamadi</Text>
        </View>
      </View>
    );
  }

  const ind = analysis.indicators;
  const score = analysis.score;
  const riskColor =
    analysis.risk.level === 'YÜKSEK' ? colors.red
      : analysis.risk.level === 'ORTA' ? colors.amber : colors.green;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.symbol}>{symbol.replace('.IS', '')}</Text>
            <AnimatedNumber
              value={analysis.currentPrice}
              decimals={2}
              style={styles.price}
            />
          </View>
          <ScoreRing score={score.score} size={64} />
        </View>

        <View style={styles.heroBadges}>
          <SignalPill action={analysis.overall.action} confidence={analysis.overall.confidence} />
          <View style={[styles.trendBadge, { borderColor: colors.border }]}>
            <Text style={styles.trendText}>{analysis.trend.label}</Text>
          </View>
          <View style={[styles.trendBadge, { borderColor: riskColor }]}>
            <Text style={[styles.trendText, { color: riskColor }]}>Risk: {analysis.risk.level}</Text>
          </View>
        </View>

        <Pressable onPress={toggleWatch} style={styles.watchBtn}>
          <Text style={styles.watchText}>{watched ? '★ Takipte' : '☆ Takibe Al'}</Text>
        </Pressable>
      </View>

      <View style={styles.scoreBar}>
        <View style={styles.scoreSide}>
          <Text style={styles.scoreLabel}>AL</Text>
          <Text style={[styles.scoreValue, { color: colors.green }]}>{score.buyPoints}</Text>
        </View>
        <View style={styles.scoreTrack}>
          <View style={styles.scoreTrackFill} />
        </View>
        <View style={[styles.scoreSide, { alignItems: 'flex-end' }]}>
          <Text style={styles.scoreLabel}>SAT</Text>
          <Text style={[styles.scoreValue, { color: colors.red }]}>{score.sellPoints}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Fiyat Grafiği" />
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.chartBox}>
          <PriceChart data={history} width={CHART_WIDTH - spacing.lg * 2} height={220} />
          <MovingAverageLine data={history} width={CHART_WIDTH - spacing.lg * 2} height={220} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Osilatörler" subtitle="Kısa vadeli alım-satım durumu" />
        <View style={styles.grid}>
          <IndicatorTile
            label="RSI (14)"
            value={ind.rsi?.toFixed(1)}
            hint={ind.rsi > 70 ? 'Aşırı alım' : ind.rsi < 30 ? 'Aşırı satım' : 'Normal'}
            color={ind.rsi > 70 ? colors.red : ind.rsi < 30 ? colors.green : colors.textPrimary}
          />
          <IndicatorTile
            label="STOCH %K"
            value={ind.stochastic?.k?.toFixed(0)}
            hint={ind.stochastic?.k > 80 ? 'Aşırı alım' : ind.stochastic?.k < 20 ? 'Aşırı satım' : 'Normal'}
            color={ind.stochastic?.k > 80 ? colors.red : ind.stochastic?.k < 20 ? colors.green : colors.textPrimary}
          />
          <IndicatorTile
            label="WILLIAMS %R"
            value={ind.williamsR?.toFixed(0)}
            color={colors.textPrimary}
          />
          <IndicatorTile
            label="CCI (20)"
            value={ind.cci?.toFixed(0)}
            color={ind.cci > 100 ? colors.red : ind.cci < -100 ? colors.green : colors.textPrimary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Trend" subtitle={analysis.trend.label} />
        <View style={styles.grid}>
          <IndicatorTile label="SMA 20" value={ind.sma20?.toFixed(2)} />
          <IndicatorTile label="EMA 20" value={ind.ema20?.toFixed(2)} />
          <IndicatorTile
            label="ADX"
            value={ind.adx?.toFixed(0)}
            hint={ind.adx > 25 ? 'Güçlü trend' : 'Zayıf trend'}
            color={ind.adx > 25 ? colors.blue : colors.textPrimary}
          />
          <IndicatorTile label="OBV" value={ind.obvTrend} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Risk"
          subtitle={`Volatilite: ${analysis.volatility.label} · ${analysis.volatility.annualized}% yıllık`}
        />
        <View style={styles.card}>
          <View style={styles.riskHeader}>
            <View style={[styles.riskBadge, { backgroundColor: riskColor + '20', borderColor: riskColor }]}>
              <Text style={[styles.riskBadgeText, { color: riskColor }]}>{analysis.risk.level}</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={styles.statChipText}>{analysis.volumeProfile.label}</Text>
            </View>
          </View>
          {analysis.risk.factors.map((f: any, i: number) => (
            <View key={i} style={styles.riskFactor}>
              <Text style={styles.riskBullet}>•</Text>
              <Text style={styles.riskText}>{f.reason}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Seviyeler" subtitle="Yakın destek ve direnç" />
        <View style={styles.levelsCard}>
          <View style={styles.levelRow}>
            <Text style={styles.levelLabel}>Direnç</Text>
            <Text style={[styles.levelValue, { color: colors.red }]}>
              {analysis.levels.resistances?.length
                ? analysis.levels.resistances.map((r: number) => r.toFixed(2)).join('  ·  ')
                : '—'}
            </Text>
          </View>
          <View style={styles.currentRow}>
            <Text style={styles.levelLabel}>Güncel</Text>
            <Text style={[styles.levelValue, { color: colors.accent }]}>
              {analysis.currentPrice?.toFixed(2)}
            </Text>
          </View>
          <View style={styles.levelRow}>
            <Text style={styles.levelLabel}>Destek</Text>
            <Text style={[styles.levelValue, { color: colors.green }]}>
              {analysis.levels.supports?.length
                ? analysis.levels.supports.map((s: number) => s.toFixed(2)).join('  ·  ')
                : '—'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Sinyaller" subtitle={`${analysis.signals.length} bulundu`} />
        {analysis.signals.length === 0 ? (
          <Text style={styles.emptyText}>Belirgin sinyal yok</Text>
        ) : (
          analysis.signals.map((signal, i) => <SignalRow key={i} signal={signal} />)
        )}
      </View>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Bu analiz teknik göstergelere dayanır, yatırım tavsiyesi değildir.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...typography.caption, color: colors.textTertiary, marginTop: 12 },
  emptyText: { ...typography.body, color: colors.textTertiary, textAlign: 'center' },
  content: { paddingBottom: spacing.xxxl },

  hero: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  symbol: { ...typography.title, color: colors.textSecondary },
  price: { ...typography.display, color: colors.textPrimary, marginTop: 2 },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  trendBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  trendText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  watchBtn: {
    marginTop: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  watchText: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },

  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  scoreSide: { alignItems: 'flex-start', minWidth: 44 },
  scoreLabel: { fontSize: 10, fontWeight: '700', color: colors.textTertiary },
  scoreValue: { ...typography.heading },
  scoreTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreTrackFill: { flex: 1, backgroundColor: colors.accent, opacity: 0.3 },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileLabel: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },
  tileValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  tileHint: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },

  periodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  periodBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  periodBtnActive: { backgroundColor: colors.accent },
  periodText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  periodTextActive: { color: colors.textInverse },
  chartBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  riskHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  riskBadgeText: { fontSize: 11, fontWeight: '800' },
  statChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statChipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  riskFactor: { flexDirection: 'row', gap: 6, marginTop: 4 },
  riskBullet: { color: colors.textTertiary },
  riskText: { flex: 1, ...typography.caption, color: colors.textSecondary },

  levelsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  currentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
  },
  levelLabel: { ...typography.caption, color: colors.textTertiary },
  levelValue: { ...typography.subheading },

  signalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  signalDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  signalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signalType: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  signalCategory: { fontSize: 10, color: colors.textTertiary, fontWeight: '600' },
  signalReason: { ...typography.caption, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },

  disclaimer: {
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.amberSoft,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.amber,
  },
  disclaimerText: { fontSize: 11, color: colors.amber, lineHeight: 16 },
});