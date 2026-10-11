import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Animated,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { EmptyState } from '../../components/ui';

interface NewsItem {
  title: string;
  link: string | null;
  pubDate: string;
  summary: string;
  source: string;
}

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const opacity = React.useMemo(() => new Animated.Value(0), []);
  const translateY = React.useMemo(() => new Animated.Value(14), []);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay: Math.min(index * 45, 280),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, { toValue: 0, damping: 14, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, index]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPress={() => item.link && Linking.openURL(item.link)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.sourceTag}>
            <Text style={styles.sourceText}>{item.source}</Text>
          </View>
          {item.pubDate && (
            <Text style={styles.date}>
              {new Date(item.pubDate).toLocaleDateString('tr-TR')}
            </Text>
          )}
        </View>

        <Text style={styles.articleTitle}>{item.title}</Text>

        {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

export default function NewsScreen() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.getNews();
      setNews(data.news || []);
    } catch {
      setNews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Haberler</Text>
        <Text style={styles.subtitle}>{news.length} baslik</Text>
      </View>

      <FlatList
        data={news}
        keyExtractor={(item, i) => `${i}-${item.title.slice(0, 20)}`}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => <NewsCard item={item} index={index} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState icon="—" title="Haber bulunamadi" message="Kaynak yenilenmeyi deneyebilirsin" />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  list: { padding: spacing.md, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardPressed: { backgroundColor: colors.surfaceHover, transform: [{ scale: 0.99 }] },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sourceTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.blueSoft,
  },
  sourceText: { fontSize: 10, fontWeight: '700', color: colors.blue },
  date: { fontSize: 11, color: colors.textTertiary },
  articleTitle: { ...typography.subheading, color: colors.textPrimary, lineHeight: 21 },
  summary: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
});
