const ti = require('technicalindicators');

class AnalysisEngine {
    calculateRSI(closes, period = 14) {
        return ti.rsi({ values: closes, period });
    }

    calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        return ti.macd({
            values: closes,
            fastPeriod,
            slowPeriod,
            signalPeriod,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
        });
    }

    calculateSMA(closes, period = 20) {
        return ti.sma({ values: closes, period });
    }

    calculateEMA(closes, period = 20) {
        return ti.ema({ values: closes, period });
    }

    calculateBollingerBands(closes, period = 20, stdDev = 2) {
        return ti.bollingerbands({ values: closes, period, stdDev });
    }

    calculateStochastic(closes, highs, lows, period = 14) {
        return ti.stochastic({ close: closes, high: highs, low: lows, period, signalPeriod: 3 });
    }

    calculateADX(highs, lows, closes, period = 14) {
        return ti.adx({ high: highs, low: lows, close: closes, period });
    }

    calculateOBV(closes, volumes) {
        return ti.obv({ close: closes, volume: volumes });
    }

    calculateWilliamsR(closes, highs, lows, period = 14) {
        return ti.williamsr({ close: closes, high: highs, low: lows, period });
    }

    calculateCCI(highs, lows, closes, period = 20) {
        return ti.cci({ high: highs, low: lows, close: closes, period });
    }

    calculateSupportResistance(closes, lookback = 50, tolerance = 0.015) {
        const recent = closes.slice(-lookback);
        const sorted = [...recent].sort((a, b) => a - b);
        const levels = [];

        for (let i = 0; i < sorted.length - 1; i++) {
            const price = sorted[i];
            const isSupport = recent.filter(c => Math.abs(c - price) / price < tolerance).length >= 3;
            if (isSupport && !levels.some(l => Math.abs(l - price) / price < tolerance)) {
                levels.push(price);
            }
        }

        const current = closes[closes.length - 1];
        const supports = levels.filter(l => l < current).sort((a, b) => b - a);
        const resistances = levels.filter(l => l > current).sort((a, b) => a - b);

        return {
            supports: supports.slice(0, 3),
            resistances: resistances.slice(0, 3),
            nearestSupport: supports[0] ?? null,
            nearestResistance: resistances[0] ?? null,
        };
    }

    analyzeTrend(closes) {
        const sma20 = this.calculateSMA(closes, 20);
        const sma50 = closes.length >= 50 ? this.calculateSMA(closes, 50) : null;
        const sma200 = closes.length >= 200 ? this.calculateSMA(closes, 200) : null;

        const price = closes[closes.length - 1];
        const s20 = sma20[sma20.length - 1];
        const s50 = sma50 ? sma50[sma50.length - 1] : null;
        const s200 = sma200 ? sma200[sma200.length - 1] : null;

        let score = 0;
        const factors = [];

        if (price > s20) { score += 1; factors.push('Fiyat 20 günlük ortalamanın üzerinde'); }
        else { score -= 1; factors.push('Fiyat 20 günlük ortalamanın altında'); }

        if (s50) {
            if (s20 > s50) { score += 1; factors.push('20 günlük ortalama 50 günlüğün üzerinde'); }
            else { score -= 1; factors.push('20 günlük ortalama 50 günlüğün altında'); }
        }

        if (s200) {
            if (price > s200) { score += 1; factors.push('Fiyat 200 günlük ortalamanın üzerinde'); }
            else { score -= 1; factors.push('Fiyat 200 günlük ortalamanın altında'); }
        }

        const slope = closes.length >= 10
            ? (closes[closes.length - 1] - closes[closes.length - 11]) / closes[closes.length - 11]
            : 0;

        let label;
        if (score >= 2) label = 'GÜÇLÜ YUKARI';
        else if (score === 1) label = 'YUKARI';
        else if (score === 0) label = 'YATAY';
        else if (score === -1) label = 'AŞAĞI';
        else label = 'GÜÇLÜ AŞAĞI';

        return {
            label,
            score,
            slope,
            sma20: s20,
            sma50: s50,
            sma200: s200,
            factors,
        };
    }

    analyze(historicalData) {
        if (!historicalData || historicalData.length < 30) {
            return { error: 'Yetersiz veri (en az 30 gun gerekli)' };
        }

        const closes = historicalData.map(d => d.close);
        const highs = historicalData.map(d => d.high ?? d.close);
        const lows = historicalData.map(d => d.low ?? d.close);
        const volumes = historicalData.map(d => d.volume ?? 0);

        const currentPrice = closes[closes.length - 1];

        const rsi = this.calculateRSI(closes);
        const macd = this.calculateMACD(closes);
        const sma20 = this.calculateSMA(closes, 20);
        const ema20 = this.calculateEMA(closes, 20);
        const bb = this.calculateBollingerBands(closes);
        const stoch = this.calculateStochastic(closes, highs, lows);
        const adx = this.calculateADX(highs, lows, closes);
        const obv = this.calculateOBV(closes, volumes);
        const wr = this.calculateWilliamsR(closes, highs, lows);
        const cci = this.calculateCCI(highs, lows, closes);

        const trend = this.analyzeTrend(closes);
        const levels = this.calculateSupportResistance(closes);
        const volatility = this.calculateVolatility(closes);
        const volumeProfile = this.analyzeVolume(historicalData);
        const risk = this.assessRisk(closes, volatility, trend);

        const signals = this.generateSignals({
            currentRSI: rsi[rsi.length - 1],
            previousRSI: rsi[rsi.length - 2],
            macd: macd[macd.length - 1],
            previousMacd: macd[macd.length - 2],
            stoch: stoch[stoch.length - 1],
            adx: adx[adx.length - 1],
            williamsR: wr[wr.length - 1],
            cci: cci[cci.length - 1],
            currentSMA: sma20[sma20.length - 1],
            currentPrice,
            bb: bb[bb.length - 1],
            closes,
            trend,
        });

        const score = this.calculateScore({
            signals, trend, risk, volatility, currentRSI: rsi[rsi.length - 1],
        });

        return {
            currentPrice,
            indicators: {
                rsi: rsi[rsi.length - 1],
                macd: macd[macd.length - 1],
                sma20: sma20[sma20.length - 1],
                ema20: ema20[ema20.length - 1],
                bollingerBands: bb[bb.length - 1],
                stochastic: stoch[stoch.length - 1],
                adx: adx[adx.length - 1],
                williamsR: wr[wr.length - 1],
                cci: cci[cci.length - 1],
                obvTrend: this.detectObvTrend(obv, closes),
            },
            trend,
            levels,
            volatility,
            volumeProfile,
            risk,
            score,
            signals,
            timestamp: new Date().toISOString(),
        };
    }

    calculateVolatility(closes, period = 20) {
        const recent = closes.slice(-period);
        const returns = [];
        for (let i = 1; i < recent.length; i++) {
            returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
        }
        const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
        const daily = Math.sqrt(variance) * 100;
        const annualized = daily * Math.sqrt(252);

        let label;
        if (annualized < 25) label = 'DÜŞÜK';
        else if (annualized < 45) label = 'ORTA';
        else if (annualized < 70) label = 'YÜKSEK';
        else label = 'ÇOK YÜKSEK';

        return { daily: daily.toFixed(2), annualized: annualized.toFixed(1), label };
    }

    analyzeVolume(historicalData) {
        const recent = historicalData.slice(-20);
        const older = historicalData.slice(-60, -20);

        const recentAvg = recent.reduce((s, d) => s + (d.volume || 0), 0) / (recent.length || 1);
        const olderAvg = older.length
            ? older.reduce((s, d) => s + (d.volume || 0), 0) / older.length
            : recentAvg;

        const ratio = olderAvg ? recentAvg / olderAvg : 1;

        let label;
        if (ratio > 1.5) label = 'YÜKSEK HACİM';
        else if (ratio > 1.15) label = 'ARTAN HACİM';
        else if (ratio < 0.7) label = 'DÜŞÜK HACİM';
        else label = 'NORMAL HACİM';

        return { ratio: ratio.toFixed(2), label, recentAvg: Math.round(recentAvg) };
    }

    detectObvTrend(obv, closes) {
        if (!obv || obv.length < 20) return 'BELIRSIZ';

        const recent = obv.slice(-10);
        const older = obv.slice(-20, -10);
        const recentAvg = recent.reduce((s, v) => s + (v?.value ?? v ?? 0), 0) / recent.length;
        const olderAvg = older.reduce((s, v) => s + (v?.value ?? v ?? 0), 0) / older.length;

        const priceUp = closes[closes.length - 1] > closes[closes.length - 11];

        if (recentAvg > olderAvg && priceUp) return 'POZİTİF BİRLİK';
        if (recentAvg < olderAvg && !priceUp) return 'NEGATİF BİRLİK';
        if (recentAvg > olderAvg && !priceUp) return 'DİVANSİYON (risk)';
        return 'NÖTR';
    }

    assessRisk(closes, volatility, trend) {
        const levels = [];

        if (volatility.label === 'ÇOK YÜKSEK') levels.push({ level: 'YÜKSEK', reason: 'Aşırı günlük dalgalanma' });
        else if (volatility.label === 'YÜKSEK') levels.push({ level: 'ORTA-YÜKSEK', reason: 'Yüksek volatilite' });

        const drawdown = this.maxDrawdown(closes.slice(-60));
        if (drawdown < -30) levels.push({ level: 'YÜKSEK', reason: `%${Math.abs(drawdown).toFixed(0)} düşüş (60 gün)` });

        if (trend.label === 'GÜÇLÜ AŞAĞI') levels.push({ level: 'ORTA-YÜKSEK', reason: 'Güçlü düşüş trendi' });
        if (trend.label === 'AŞAĞI') levels.push({ level: 'DÜŞÜK', reason: 'Düşüş trendi' });
        if (trend.label === 'GÜÇLÜ YUKARI') levels.push({ level: 'DÜŞÜK', reason: 'Güçlü yükseliş trendi' });

        if (levels.length === 0) levels.push({ level: 'DÜŞÜK', reason: 'Belirgin risk faktörü yok' });

        const maxLevel = levels.some(l => l.level === 'YÜKSEK') ? 'YÜKSEK'
            : levels.some(l => l.level === 'ORTA-YÜKSEK') ? 'ORTA'
            : 'DÜŞÜK';

        return { level: maxLevel, factors: levels.slice(0, 3) };
    }

    maxDrawdown(closes) {
        let peak = closes[0];
        let maxDd = 0;
        for (const price of closes) {
            if (price > peak) peak = price;
            const dd = ((price - peak) / peak) * 100;
            if (dd < maxDd) maxDd = dd;
        }
        return maxDd;
    }

    generateSignals({ currentRSI, previousRSI, macd, previousMacd, stoch, adx, williamsR, cci, currentSMA, currentPrice, bb, closes, trend }) {
        const signals = [];
        const strongTrend = adx && adx > 25;

        if (currentRSI < 30) signals.push({ type: 'BUY', strength: 'STRONG', category: 'MOMENTUM', reason: `RSI asiri satim bolgesinde (${currentRSI.toFixed(1)})` });
        else if (currentRSI < 40) signals.push({ type: 'BUY', strength: 'MODERATE', category: 'MOMENTUM', reason: `RSI dusuk (${currentRSI.toFixed(1)})` });
        else if (currentRSI > 70) signals.push({ type: 'SELL', strength: 'STRONG', category: 'MOMENTUM', reason: `RSI asiri alim bolgesinde (${currentRSI.toFixed(1)})` });
        else if (currentRSI > 60) signals.push({ type: 'SELL', strength: 'MODERATE', category: 'MOMENTUM', reason: `RSI yuksek (${currentRSI.toFixed(1)})` });

        if (previousRSI != null && currentRSI > 30 && previousRSI <= 30) {
            signals.push({ type: 'BUY', strength: 'STRONG', category: 'DONUSUM', reason: 'RSI 30 seviyesinden yukseldi' });
        }
        if (previousRSI != null && currentRSI < 70 && previousRSI >= 70) {
            signals.push({ type: 'SELL', strength: 'STRONG', category: 'DONUSUM', reason: 'RSI 70 seviyesinden dustu' });
        }

        if (macd) {
            if (previousMacd && previousMacd.histogram <= 0 && macd.histogram > 0) {
                signals.push({ type: 'BUY', strength: 'STRONG', category: 'TREND', reason: 'MACD histogrami sifirin ustune cikti' });
            }
            if (previousMacd && previousMacd.histogram >= 0 && macd.histogram < 0) {
                signals.push({ type: 'SELL', strength: 'STRONG', category: 'TREND', reason: 'MACD histogrami sifirin altina dustu' });
            }
            if (macd.MACD > macd.signal) signals.push({ type: 'BUY', strength: 'WEAK', category: 'TREND', reason: 'MACD sinyal cubugunun ustunde' });
            else signals.push({ type: 'SELL', strength: 'WEAK', category: 'TREND', reason: 'MACD sinyal cubugunun altinda' });
        }

        if (stoch) {
            if (stoch.k < 20) signals.push({ type: 'BUY', strength: 'MODERATE', category: 'OSILATOR', reason: `Stochastic asiri satimda (${stoch.k.toFixed(1)})` });
            else if (stoch.k > 80) signals.push({ type: 'SELL', strength: 'MODERATE', category: 'OSILATOR', reason: `Stochastic asiri alimda (${stoch.k.toFixed(1)})` });
        }

        if (williamsR != null) {
            if (williamsR < -80) signals.push({ type: 'BUY', strength: 'WEAK', category: 'OSILATOR', reason: `Williams %R asiri satimda (${williamsR.toFixed(1)})` });
            else if (williamsR > -20) signals.push({ type: 'SELL', strength: 'WEAK', category: 'OSILATOR', reason: `Williams %R asiri alimda (${williamsR.toFixed(1)})` });
        }

        if (cci != null) {
            if (cci < -100) signals.push({ type: 'BUY', strength: 'MODERATE', category: 'OSILATOR', reason: `CCI asiri satimda (${cci.toFixed(0)})` });
            else if (cci > 100) signals.push({ type: 'SELL', strength: 'MODERATE', category: 'OSILATOR', reason: `CCI asiri alimda (${cci.toFixed(0)})` });
        }

        if (currentPrice > currentSMA) signals.push({ type: 'BUY', strength: 'WEAK', category: 'TREND', reason: 'Fiyat 20 gunluk SMA ustu' });
        else signals.push({ type: 'SELL', strength: 'WEAK', category: 'TREND', reason: 'Fiyat 20 gunluk SMA alti' });

        if (trend.label === 'GÜÇLÜ YUKARI' || trend.label === 'YUKARI') {
            signals.push({ type: 'BUY', strength: 'MODERATE', category: 'TREND', reason: `${trend.label} trendi tespit edildi` });
        } else if (trend.label === 'GÜÇLÜ AŞAĞI' || trend.label === 'AŞAĞI') {
            signals.push({ type: 'SELL', strength: 'MODERATE', category: 'TREND', reason: `${trend.label} trendi tespit edildi` });
        }

        if (bb) {
            if (currentPrice < bb.lower) signals.push({ type: 'BUY', strength: 'STRONG', category: 'FIYAT', reason: 'Fiyat Bollinger alt bandinda' });
            else if (currentPrice > bb.upper) signals.push({ type: 'SELL', strength: 'STRONG', category: 'FIYAT', reason: 'Fiyat Bollinger ust bandinda' });
        }

        const momentum = this.calculateMomentum(closes, 10);
        if (momentum > 8) signals.push({ type: 'BUY', strength: 'MODERATE', category: 'MOMENTUM', reason: `Guclu momentum (+%${momentum.toFixed(1)} / 10 gun)` });
        else if (momentum < -8) signals.push({ type: 'SELL', strength: 'MODERATE', category: 'MOMENTUM', reason: `Guclu dusus momentumu (-%${momentum.toFixed(1)} / 10 gun)` });

        if (strongTrend) {
            signals.push({
                type: 'INFO',
                strength: 'WEAK',
                category: 'TREND GUCU',
                reason: `ADX ${adx.toFixed(0)} — guclu trend mevcut, karsi mudah sonrasi sinyaller guclu`,
            });
        }

        return signals;
    }

    calculateMomentum(closes, period) {
        if (closes.length < period + 1) return 0;
        const current = closes[closes.length - 1];
        const past = closes[closes.length - 1 - period];
        return ((current - past) / past) * 100;
    }

    calculateScore({ signals, trend, risk, volatility, currentRSI }) {
        let buyScore = 0;
        let sellScore = 0;
        let strong = 0;

        for (const signal of signals) {
            if (signal.type === 'INFO') continue;
            const weight = signal.strength === 'STRONG' ? 3 : signal.strength === 'MODERATE' ? 2 : 1;
            if (signal.type === 'BUY') { buyScore += weight; if (signal.strength === 'STRONG') strong++; }
            else sellScore += weight;
            if (signal.type === 'SELL' && signal.strength === 'STRONG') strong++;
        }

        trend.score > 0 ? (buyScore += trend.score) : (sellScore += Math.abs(trend.score));

        if (risk.level === 'YÜKSEK') {
            if (buyScore > sellScore) buyScore *= 0.7;
            else sellScore *= 0.7;
        }

        const total = buyScore + sellScore;
        let base = total === 0 ? 50 : (buyScore / total) * 100;

        const hasStrong = strong > 0 ? 8 : 0;
        base = buyScore > sellScore ? Math.min(base + hasStrong, 100) : Math.max(base - hasStrong, 0);

        if (volatility.label === 'ÇOK YÜKSEK') base = 50 + (base - 50) * 0.6;

        return {
            score: Math.round(base),
            direction: buyScore > sellScore ? 'AL' : sellScore > buyScore ? 'SAT' : 'BEKLE',
            buyPoints: buyScore,
            sellPoints: sellScore,
            strongSignals: strong,
        };
    }

    getOverallSignal(signals) {
        if (!signals || signals.length === 0) return { action: 'HOLD', confidence: 0 };

        let buyScore = 0;
        let sellScore = 0;

        signals.forEach(s => {
            if (s.type === 'INFO') return;
            const weight = s.strength === 'STRONG' ? 2 : s.strength === 'MODERATE' ? 1.5 : 1;
            if (s.type === 'BUY') buyScore += weight;
            else if (s.type === 'SELL') sellScore += weight;
        });

        const total = buyScore + sellScore;
        if (total === 0) return { action: 'HOLD', confidence: 0 };

        const confidence = Math.abs(buyScore - sellScore) / total * 100;

        if (buyScore > sellScore * 1.5) return { action: 'BUY', confidence };
        if (sellScore > buyScore * 1.5) return { action: 'SELL', confidence };
        return { action: 'HOLD', confidence };
    }
}

module.exports = new AnalysisEngine();