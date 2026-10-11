const fundamentals = require('./fundamentalsService');
const db = require('./database');
const { toArg } = require('./database');

const CONCURRENCY = 25;
const SCAN_TTL = 20 * 60 * 1000;

class ScannerService {
    constructor() {
        this.scanning = false;
        this.scanStartedAt = null;
    }

    async analyzeOne(symbol, analysisFn, historyCache) {
        if (historyCache && historyCache.has(symbol)) {
            return historyCache.get(symbol);
        }

        const historical = await analysisFn.raw(symbol);
        if (!historical || historical.length < 60) return null;

        if (historyCache) historyCache.set(symbol, historical);
        return historical;
    }

    async runScan(symbols, fetcher) {
        if (this.scanning) {
            return { skipped: true, message: 'Tarama devam ediyor' };
        }

        this.scanning = true;
        this.scanStartedAt = Date.now();
        const startedAt = Date.now();
        const historyCache = new Map();

        try {
            await fundamentals.load();

            const results = [];
            let done = 0;

            for (let i = 0; i < symbols.length; i += CONCURRENCY) {
                const batch = symbols.slice(i, i + CONCURRENCY);

                const settled = await Promise.allSettled(
                    batch.map(async symbol => {
                        try {
                            let historical = historyCache.get(symbol);

                            if (!historical) {
                                historical = await fetcher.historical(symbol);
                                if (!historical || historical.length < 60) return null;
                                historyCache.set(symbol, historical);
                            }

                            return {
                                symbol,
                                historical,
                                participation: fundamentals.analyze(symbol),
                                fund: fundamentals.getFundamentals(symbol),
                            };
                        } catch {
                            return null;
                        }
                    })
                );

                settled.forEach(r => {
                    if (r.status !== 'fulfilled' || !r.value) return;
                    done++;
                    results.push(r.value);
                });
            }

            // Analiz hesaplama (CPU) — senkron ama hizli
            const scored = results.map(item => {
                try {
                    const analysis = fetcher.analyze(item.historical);
                    const candles = fetcher.analyzeCandles(item.historical);
                    const score = this.compositeScore(analysis, item.participation, item.fund, candles);
                    if (score === null) return null;

                    return this.buildRow(item, analysis, candles, score);
                } catch (error) {
                    this.lastError = `${item.symbol}: ${error.message}`;
                    return null;
                }
            }).filter(Boolean);

            scored.sort((a, b) => b.compositeScore - a.compositeScore);

            const buys = scored.filter(r => r.action === 'BUY');
            const healthyBuys = buys.filter(r => r.isHealthy);

            const payload = {
                generatedAt: new Date().toISOString(),
                durationMs: Date.now() - startedAt,
                scanned: scored.length,
                top: scored.slice(0, 50),
                bestBuys: buys.slice(0, 30),
                healthyPicks: scored.filter(r => r.isHealthy).slice(0, 30),
                healthyBuys: healthyBuys.slice(0, 30),
                bestTen: (healthyBuys.length >= 5 ? healthyBuys : buys.length >= 5 ? buys : scored).slice(0, 10),
            };

            await db.run(
                `INSERT INTO analysis_cache (symbol, payload, computed_at)
                 VALUES (?, ?, datetime('now'))
                 ON CONFLICT(symbol) DO UPDATE SET payload = excluded.payload, computed_at = excluded.computed_at`,
                [toArg('__SCAN__'), toArg(JSON.stringify(payload))]
            );

            console.log(
                `[Scanner] ${scored.length} hisse tarandi (${done} veri), ${buys.length} alis, ` +
                `${healthyBuys.length} saglikli alis, ${Math.round((Date.now() - startedAt) / 1000)}s` +
                (this.lastError ? ` | son hata: ${this.lastError}` : '')
            );

            return payload;
        } finally {
            this.scanning = false;
            this.scanStartedAt = null;
        }
    }

    buildRow(item, analysis, candles, score) {
        const { symbol, participation, fund } = item;

        const scoreDirection = analysis.score?.direction;
        const action =
            analysis.overall?.action ||
            (scoreDirection === 'AL' ? 'BUY' : scoreDirection === 'SAT' ? 'SELL' : 'HOLD');

        const confidence = Math.round(
            analysis.overall?.confidence ??
            Math.abs((analysis.score?.buyPoints ?? 0) - (analysis.score?.sellPoints ?? 0)) * 10
        );

        return {
            symbol,
            name: fund?.name || symbol,
            sector: fund?.sector || null,
            price: analysis.currentPrice,
            action,
            confidence,
            technicalScore: analysis.score?.score ?? 50,
            candleScore: candles?.biasScore ?? 50,
            candleTrend: candles?.shortTermTrend || 'BELIRSIZ',
            candlePattern: candles?.currentPattern?.name || null,
            volumeLabel: analysis.volumeProfile?.label || null,
            volumeRatio: parseFloat(analysis.volumeProfile?.ratio || '0'),
            volumeConfirmed: !!analysis.volumeProfile,
            rsi: analysis.indicators?.rsi ?? null,
            adx: analysis.indicators?.adx ?? null,
            mdi: analysis.indicators?.mdi ?? null,
            pdi: analysis.indicators?.pdi ?? null,
            trend: analysis.trend?.label || 'BELIRSIZ',
            risk: analysis.risk?.level || 'BILINMIYOR',
            volatility: analysis.volatility?.label || 'BILINMIYOR',
            participationRatio: participation.floatRatio,
            participationLabel: participation.label,
            participationTone: participation.tone,
            participationScore: participation.score,
            isHealthy: participation.isHealthy,
            pe: fund?.pe ?? null,
            pb: fund?.pb ?? null,
            roe: fund?.roe ?? null,
            dividendYield: fund?.dividendYield ?? null,
            marketCapMn: fund?.marketCapMn ?? null,
            compositeScore: score.total,
            summary: score.summary,
            reasons: score.reasons,
            warnings: participation.warning ? [participation.warning] : [],
        };
    }

    compositeScore(analysis, participation, fund, candles) {
        const tech = analysis.score?.score ?? 50;
        const candle = candles?.biasScore ?? 50;
        const riskLevel = String(analysis.risk?.level || '');
        const risk =
            riskLevel.indexOf('YÜKSEK') >= 0 || riskLevel === 'YUKSEK' ? 25
              : riskLevel.indexOf('ORTA') === 0 ? 55
                : 80;
        const part = participation.score ?? 50;

        const reasons = [];
        let quality = 50;

        if (fund) {
            let q = 50;
            if (typeof fund.roe === 'number') {
                if (fund.roe > 20) { q += 18; reasons.push('Güçlü kârlılık (ROE %' + fund.roe.toFixed(0) + ')'); }
                else if (fund.roe > 10) { q += 10; reasons.push('İyi kârlılık (ROE %' + fund.roe.toFixed(0) + ')'); }
                else if (fund.roe < 0) { q -= 35; reasons.push('Zarar eden şirket — dikkat'); }
            }
            if (typeof fund.pb === 'number' && fund.pb > 0) {
                if (fund.pb < 1) { q += 12; reasons.push('Bilineer değerinin altında'); }
                else if (fund.pb > 6) { q -= 12; reasons.push('Pahalı görünüyor'); }
            }
            if (typeof fund.pe === 'number') {
                if (fund.pe < 6) { q += 10; reasons.push('Düşük çarpan (F/K ' + fund.pe.toFixed(1) + ')'); }
                else if (fund.pe > 40) { q -= 10; }
            }
            if (typeof fund.dividendYield === 'number' && fund.dividendYield > 3) {
                q += 8;
                reasons.push('Yüksek temettü verimi');
            }
            quality = Math.max(0, Math.min(100, q));
        }

        const volumeRatio = candles?.volume?.ratio ? parseFloat(candles.volume.ratio) : 1;
        const volumeStrong = candles?.volume?.strong ? 1 : 0;

        const total =
            tech * 0.28 +
            candle * 0.22 +
            volumeStrong * 12 +
            part * 0.18 +
            risk * 0.12 +
            quality * 0.10 +
            (volumeRatio > 1.2 ? 8 : volumeRatio < 0.8 ? -6 : 0);

        const summary = this.buildSummary({
            total: Math.round(total), analysis, participation, candles, reasons,
        });

        return { total: Math.round(total), reasons: reasons.slice(0, 2), summary };
    }

    buildSummary({ total, analysis, participation, candles, reasons }) {
        const action = analysis.overall?.action || analysis.score?.direction === 'AL' ? 'BUY'
            : analysis.overall?.action || (analysis.score?.direction === 'SAT' ? 'SELL' : 'HOLD');
        const direction = action === 'BUY' ? 'yükseliş' : action === 'SELL' ? 'düşüş' : 'belirsiz';

        const parts = [];
        parts.push(`Teknik: ${analysis.score?.score ?? 50}/100 ${direction} yönde`);
        if (candles?.shortTermTrend) parts.push(`Mum: ${candles.shortTermTrend}`);
        parts.push(`Katılım: %${participation.floatRatio ?? '?'}`);
        if (reasons.length) parts.push(reasons[0]);

        return parts;
    }

    async getCached(maxAgeMs = SCAN_TTL) {
        const row = await db.get(
            `SELECT payload, computed_at FROM analysis_cache
             WHERE symbol = ? AND computed_at > datetime('now', ?)`,
            [toArg('__SCAN__'), toArg(`-${Math.round(maxAgeMs / 60000)} minutes`)]
        );

        if (!row) return null;
        try { return JSON.parse(row.payload); }
        catch { return null; }
    }
}

module.exports = new ScannerService();