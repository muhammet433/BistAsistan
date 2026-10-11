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
import { CandlestickChart, PatternBadge } from '../../components/CandlestickChart';
import { colors, spacing, radius, typography } from '../../theme';
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

function fmt(value: any, decimals = 2): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    const nested = Object.values(value)[0];
    if (typeof nested === 'number') return nested.toFixed(decimals);
    return '—';
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(decimals);
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

  if (!analysis || !analysis.currentPrice) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Veri bulunamadi</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const ind = (analysis.indicators || {}) as any;
  const score = analysis.score || {
    score: 50, direction: 'BEKLE', buyPoints: 0, sellPoints: 0, strongSignals: 0,
  };
  const trend = analysis.trend || { label: 'BELIRSIZ', factors: [], slope: 0 };
  const levels = analysis.levels || { supports: [], resistances: [] };
  const volatility = analysis.volatility || { label: 'BILINMIYOR', annualized: '0' };
  const volumeProfile = analysis.volumeProfile || { label: 'BILINMIYOR', ratio: '0' };
  const risk = analysis.risk || { level: 'BILINMIYOR', factors: [] };
const candles = (analysis as any).candles || null;
  const participation = (analysis as any).participation || null;
  const fundamentals = (analysis as any).fundamentals || null;
  const signals = analysis.signals || [];

  const riskLevel = String(risk.level || '');
  const riskColor =
    riskLevel.indexOf('YÜKSEK') === 0 || riskLevel === 'YUKSEK' ? colors.red
      : riskLevel.indexOf('ORTA') === 0 ? colors.amber : colors.green;

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
            <Text style={styles.trendText}>{trend.label}</Text>
          </View>
          <View style={[styles.trendBadge, { borderColor: riskColor }]}>
            <Text style={[styles.trendText, { color: riskColor }]}>Risk: {risk.level}</Text>
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

{candles && candles.candles && candles.candles.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title="Mum Analizi"
            subtitle={candles.summary?.bias || 'Trader okumasi'}
          />

          <View style={styles.biasCard}>
            <View style={styles.biasHeader}>
              <View>
                <Text style={styles.biasLabel}>Mum Eğilimi</Text>
                <Text
                  style={[
                    styles.biasValue,
                    {
                      color:
                        candles.biasScore >= 65
                          ? colors.green
                          : candles.biasScore <= 35
                            ? colors.red
                            : colors.amber,
                    },
                  ]}
                >
                  {candles.biasScore}/100
                </Text>
              </View>
              <View
                style={[
                  styles.trendBadge,
                  {
                    borderColor:
                      candles.shortTermTrend === 'YUKARI'
                        ? colors.greenBorder
                        : candles.shortTermTrend === 'AŞAĞI'
                          ? colors.redBorder
                          : colors.amberBorder,
                  },
                ]}
              >
                <Text style={styles.trendText}>{candles.shortTermTrend}</Text>
              </View>
            </View>
            <Text style={styles.biasSummary}>{candles.summary?.text}</Text>
          </View>

          <View style={styles.candleChartBox}>
            <CandlestickChart
              candles={candles.candles}
              width={CHART_WIDTH - spacing.lg * 2}
              height={260}
            />
          </View>

          {candles.currentPattern && (
            <View style={styles.patternSection}>
              <Text style={styles.patternTitle}>Son Mum Formasyonu</Text>
              <PatternBadge
                name={candles.currentPattern.name}
                bias={candles.currentPattern.bias}
                strength={candles.currentPattern.strength}
              />
              <Text style={styles.patternDesc}>
                {candles.currentPattern.description}
              </Text>
            </View>
          )}

          {candles.consecutive && (
            <View style={styles.patternSection}>
              <Text style={styles.patternTitle}>Ardisik Hareket</Text>
              <PatternBadge
                name={candles.consecutive.pattern}
                bias={candles.consecutive.bias}
                strength={candles.consecutive.strength}
              />
            </View>
          )}

          <Text style={styles.patternTitle}>Tespit Edilen Kaliplar</Text>
          <View style={styles.patternList}>
            {candles.patterns.slice(0, 6).map((p: any, i: number) => (
              <View key={i} style={styles.patternRow}>
                <PatternBadge
                  name={p.name}
                  bias={p.bias}
                  strength={p.strength}
                />
                <Text style={styles.patternDate}>{p.date}</Text>
              </View>
            ))}
          </View>

          {candles.volume && (
            <View style={styles.volumeCard}>
              <Text style={styles.patternTitle}>Hacim Dogrulamasi</Text>
              <Text style={styles.volumeLabel}>{candles.volume.label}</Text>
              <Text style={styles.volumeRatio}>
                Ortalama hacim orani: {candles.volume.ratio}x
              </Text>
            </View>
          )}
        </View>
      )}

      {participation && participation.floatRatio !== null && (
        <View style={styles.section}>
          <SectionHeader
            title="Katılım Oranı"
            subtitle="Halka açıkta kalan hisse payı"
          />
          <View
            style={[
              styles.participationCard,
              {
                borderColor:
                  participation.tone === 'green'
                    ? colors.greenBorder
                    : participation.tone === 'amber'
                      ? colors.amberBorder
                      : colors.redBorder,
                backgroundColor:
                  participation.tone === 'green'
                    ? colors.greenSoft
                    : participation.tone === 'amber'
                      ? colors.amberSoft
                      : colors.redSoft,
              },
            ]}
          >
            <View style={styles.participationTop}>
              <View>
                <Text
                  style={[
                    styles.participationValue,
                    {
                      color:
                        participation.tone === 'green'
                          ? colors.green
                          : participation.tone === 'amber'
                            ? colors.amber
                            : colors.red,
                    },
                  ]}
                >
                  %{participation.floatRatio.toFixed(1)}
                </Text>
                <Text
                  style={[
                    styles.participationLabel,
                    {
                      color:
                        participation.tone === 'green'
                          ? colors.green
                          : participation.tone === 'amber'
                            ? colors.amber
                            : colors.red,
                    },
                  ]}
                >
                  {participation.label}
                </Text>
              </View>

              <View style={styles.participationBarWrap}>
                <View style={styles.participationTrack}>
                  <View
                    style={[
                      styles.participationFill,
                      {
                        width: `${Math.min(participation.floatRatio, 100)}%`,
                        backgroundColor:
                          participation.tone === 'green'
                            ? colors.green
                            : participation.tone === 'amber'
                              ? colors.amber
                              : colors.red,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.participationScale}>0% — 100%</Text>
              </View>
            </View>

            {participation.warning && (
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>!</Text>
                <Text style={styles.warningText}>{participation.warning}</Text>
              </View>
            )}

            {participation.isHealthy && (
              <View style={styles.healthyBox}>
                <Text style={styles.healthyText}>
                  Katılım oranı sağlıklı — fiyat hareketleri daha gerçekçi
                </Text>
              </View>
            )}
          </View>

          {fundamentals && (
            <View style={styles.fundGrid}>
              {fundamentals.sector && (
                <View style={styles.fundItem}>
                  <Text style={styles.fundLabel}>Sektor</Text>
                  <Text style={styles.fundValue} numberOfLines={1}>{fundamentals.sector}</Text>
                </View>
              )}
              {fundamentals.roe !== null && fundamentals.roe !== undefined && (
                <View style={styles.fundItem}>
                  <Text style={styles.fundLabel}>ROE</Text>
                  <Text
                    style={[
                      styles.fundValue,
                      { color: fundamentals.roe > 0 ? colors.green : colors.red },
                    ]}
                  >
                    %{Number(fundamentals.roe).toFixed(1)}
                  </Text>
                </View>
              )}
              {fundamentals.pe !== null && fundamentals.pe !== undefined && (
                <View style={styles.fundItem}>
                  <Text style={styles.fundLabel}>F/K</Text>
                  <Text style={styles.fundValue}>{Number(fundamentals.pe).toFixed(1)}</Text>
                </View>
              )}
              {fundamentals.pb !== null && fundamentals.pb !== undefined && (
                <View style={styles.fundItem}>
                  <Text style={styles.fundLabel}>PD/DD</Text>
                  <Text style={styles.fundValue}>{Number(fundamentals.pb).toFixed(2)}</Text>
                </View>
              )}
              {fundamentals.dividendYield !== null && fundamentals.dividendYield !== undefined && (
                <View style={styles.fundItem}>
                  <Text style={styles.fundLabel}>Temettü</Text>
                  <Text style={[styles.fundValue, { color: colors.amber }]}>
                    %{Number(fundamentals.dividendYield).toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title="Osilatörler" subtitle="Kısa vadeli alım-satım durumu" />
        <View style={styles.grid}>
          <IndicatorTile
            label="RSI (14)"
            value={fmt(ind.rsi, 1)}
            hint={ind.rsi > 70 ? 'Aşırı alım' : ind.rsi < 30 ? 'Aşırı satım' : 'Normal'}
            color={ind.rsi > 70 ? colors.red : ind.rsi < 30 ? colors.green : colors.textPrimary}
          />
          <IndicatorTile
            label="STOCH %K"
            value={fmt(ind.stochastic?.k, 0)}
            hint={ind.stochastic?.k > 80 ? 'Aşırı alım' : ind.stochastic?.k < 20 ? 'Aşırı satım' : 'Normal'}
            color={ind.stochastic?.k > 80 ? colors.red : ind.stochastic?.k < 20 ? colors.green : colors.textPrimary}
          />
          <IndicatorTile
            label="WILLIAMS %R"
            value={fmt(ind.williamsR, 0)}
            color={colors.textPrimary}
          />
          <IndicatorTile
            label="CCI (20)"
            value={fmt(ind.cci, 0)}
            color={ind.cci > 100 ? colors.red : ind.cci < -100 ? colors.green : colors.textPrimary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Trend" subtitle={trend.label} />
        <View style={styles.grid}>
          <IndicatorTile label="SMA 20" value={fmt(ind.sma20, 2)} />
          <IndicatorTile label="EMA 20" value={fmt(ind.ema20, 2)} />
          <IndicatorTile
            label="ADX"
            value={fmt(ind.adx, 0)}
            hint={ind.adx > 25 ? 'Güçlü trend' : 'Zayıf trend'}
            color={ind.adx > 25 ? colors.blue : colors.textPrimary}
          />
          <IndicatorTile label="OBV" value={ind.obvTrend} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Risk"
          subtitle={`Volatilite: ${volatility.label} · ${volatility.annualized}% yıllık`}
        />
        <View style={styles.card}>
          <View style={styles.riskHeader}>
            <View style={[styles.riskBadge, { backgroundColor: riskColor + '20', borderColor: riskColor }]}>
              <Text style={[styles.riskBadgeText, { color: riskColor }]}>{risk.level}</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={styles.statChipText}>{volumeProfile.label}</Text>
            </View>
          </View>
          {risk.factors.map((f: any, i: number) => (
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
              {levels.resistances?.length
                ? levels.resistances.map((r: any) => fmt(r, 2)).join('  ·  ')
                : '—'}
            </Text>
          </View>
          <View style={styles.currentRow}>
            <Text style={styles.levelLabel}>Güncel</Text>
<Text style={[styles.levelValue, { color: colors.accent }]}>
              {fmt(analysis.currentPrice, 2)}
            </Text>
          </View>
          <View style={styles.levelRow}>
            <Text style={styles.levelLabel}>Destek</Text>
<Text style={[styles.levelValue, { color: colors.green }]}>
              {levels.supports?.length
                ? levels.supports.map((s: any) => fmt(s, 2)).join('  ·  ')
                : '—'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Sinyaller" subtitle={`${signals.length} bulundu`} />
        {signals.length === 0 ? (
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

  participationCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
  },
  participationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participationValue: { fontSize: 30, fontWeight: '800' },
  participationLabel: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  participationBarWrap: { flex: 1, marginLeft: spacing.lg },
  participationTrack: {
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  participationFill: { height: '100%', borderRadius: 4 },
  participationScale: { fontSize: 9, color: colors.textTertiary, marginTop: 5, textAlign: 'right' },
  warningBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.redSoft,
    borderRadius: radius.md,
  },
  warningIcon: {
    color: colors.red,
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 18,
  },
  warningText: { flex: 1, fontSize: 12, color: colors.red, lineHeight: 18 },
  healthyBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.md,
  },
  healthyText: { fontSize: 12, color: colors.green, lineHeight: 18 },
  fundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  fundItem: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  fundLabel: { fontSize: 10, color: colors.textTertiary },
  fundValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 3 },

  biasCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  biasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  biasLeft: { alignItems: 'flex-start' },
  biasLabel: { fontSize: 11, color: colors.textTertiary },
  biasValue: { fontSize: 22, fontWeight: '800' },
  biasSummary: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  candleChartBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patternSection: { marginTop: spacing.lg },
  patternTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  patternDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  patternList: { gap: spacing.sm },
  patternRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patternDate: { fontSize: 10, color: colors.textTertiary },
  volumeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
  },
  volumeLabel: { ...typography.body, color: colors.textPrimary },
  volumeRatio: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },

  retryBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
  },
  retryText: { color: colors.textInverse, fontWeight: '700' },

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


