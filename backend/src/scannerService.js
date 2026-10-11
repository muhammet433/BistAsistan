const fundamentals = require('./fundamentalsService');
const db = require('./database');
const { toArg } = require('./database');

class ScannerService {
    constructor() {
        this.lastScan = null;
        this.scanning = false;
        this.ttl = 30 * 60 * 1000;
    }

    async getAll(symbols, analysisFn) {
        await fundamentals.load();

        const results = [];
        const batchSize = 10;

        for (let i = 0; i < symbols.length; i += batchSize) {
            const batch = symbols.slice(i, i + batchSize);

            const settled = await Promise.allSettled(
                batch.map(async symbol => {
                    const analysis = await analysisFn(symbol);
                    if (!analysis || analysis.error) return null;

                    const participation = fundamentals.analyze(symbol);
                    const fund = fundamentals.getFundamentals(symbol);

                    const score = this.compositeScore(analysis, participation, fund);
                    if (score === null) return null;

                    return {
                        symbol,
                        name: analysis.indicators ? (fund?.name || symbol) : symbol,
                        price: analysis.currentPrice,
                        changePercent: null,
                        technicalScore: analysis.score?.score ?? 50,
                        candleScore: analysis.candles?.biasScore ?? 50,
                        action: analysis.overall?.action || 'HOLD',
                        confidence: Math.round(analysis.overall?.confidence || 0),
                        rsi: analysis.indicators?.rsi ?? null,
                        adx: analysis.indicators?.adx ?? null,
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
                        sector: fund?.sector ?? null,
                        marketCapMn: fund?.marketCapMn ?? null,
                        compositeScore: score.total,
                        reasons: score.reasons,
                        warnings: participation.warning ? [participation.warning] : [],
                    };
                })
            );

            settled.forEach(r => {
                if (r.status === 'fulfilled' && r.value) results.push(r.value);
            });
        }

        return results;
    }

    compositeScore(analysis, participation, fund) {
        const reasons = [];
        const tech = analysis.score?.score ?? 50;
        const candle = analysis.candles?.biasScore ?? 50;
        const riskLevel = analysis.risk?.level || '';
        const risk = String(riskLevel).indexOf('YÜKSEK') >= 0 || riskLevel === 'YUKSEK'
            ? 25 : riskLevel.indexOf('ORTA') === 0 ? 55 : 80;
        const part = participation.score ?? 50;

        let quality = 50;
        if (fund) {
            let q = 50;
            if (typeof fund.roe === 'number') {
                if (fund.roe > 20) { q += 18; reasons.push('ROE %' + fund.roe.toFixed(1) + ' — cok guclu'); }
                else if (fund.roe > 10) { q += 10; reasons.push('ROE %' + fund.roe.toFixed(1)); }
                else if (fund.roe < 0) { q -= 20; reasons.push('ROE negatif — zarar riski'); }
            }
            if (typeof fund.pb === 'number' && fund.pb > 0) {
                if (fund.pb < 1) { q += 12; reasons.push('PD/DD ' + fund.pb.toFixed(2) + ' — ucuz'); }
                else if (fund.pb > 6) { q -= 12; reasons.push('PD/DDD ' + fund.pb.toFixed(1) + ' — pahali'); }
            }
            if (typeof fund.pe === 'number') {
                if (fund.pe < 6) { q += 10; reasons.push('F/K ' + fund.pe.toFixed(1) + ' — ucuz'); }
                else if (fund.pe > 40) { q -= 10; }
            }
            if (typeof fund.dividendYield === 'number' && fund.dividendYield > 3) {
                q += 8;
                reasons.push('Temettu verimi %' + fund.dividendYield.toFixed(1));
            }
            quality = Math.max(0, Math.min(100, q));
        }

        const weights = { tech: 0.35, candle: 0.15, participation: 0.20, risk: 0.15, quality: 0.15 };

        const total =
            tech * weights.tech +
            candle * weights.candle +
            part * weights.participation +
            risk * weights.risk +
            quality * weights.quality;

        return { total: Math.round(total), reasons: reasons.slice(0, 3) };
    }

    async runScan(symbols, analysisFn) {
        if (this.scanning) {
            return { skipped: true, message: 'Tarama zaten calisiyor' };
        }

        this.scanning = true;
        const startedAt = Date.now();

        try {
            const results = await this.getAll(symbols, analysisFn);

            results.sort((a, b) => b.compositeScore - a.compositeScore);

            const buySignals = results.filter(r => r.action === 'BUY');
            const healthyBuy = buySignals.filter(r => r.isHealthy);
            const healthy = results.filter(r => r.isHealthy);

            const payload = {
                generatedAt: new Date().toISOString(),
                durationMs: Date.now() - startedAt,
                scanned: results.length,
                top: results.slice(0, 30),
                bestBuys: buySignals.slice(0, 20),
                healthyPicks: healthy.slice(0, 20),
                healthyBuys: healthyBuy.slice(0, 20),
            };

            await db.run(
                `INSERT INTO analysis_cache (symbol, payload, computed_at)
                 VALUES (?, ?, datetime('now'))
                 ON CONFLICT(symbol) DO UPDATE SET payload = excluded.payload, computed_at = excluded.computed_at`,
                [toArg('__SCAN__'), toArg(JSON.stringify(payload))]
            );

            this.lastScan = payload;
            console.log(
                `[Scanner] ${results.length} hisse tarandi, ${buySignals.length} alis, ${healthyBuy.length} saglikli alis (${Math.round((Date.now() - startedAt) / 1000)}s)`
            );

            return payload;
        } finally {
            this.scanning = false;
        }
    }

    getCached() {
        if (this.lastScan) return this.lastScan;
        return null;
    }
}

module.exports = new ScannerService();