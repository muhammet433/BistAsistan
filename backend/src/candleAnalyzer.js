class CandleAnalyzer {
    buildCandles(data) {
        return data
            .filter(d => d.open != null && d.high != null && d.low != null && d.close != null)
            .map(d => ({
                date: d.date,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume || 0,
                bullish: d.close >= d.open,
                body: Math.abs(d.close - d.open),
                upperWick: d.high - Math.max(d.open, d.close),
                lowerWick: Math.min(d.open, d.close) - d.low,
                range: d.high - d.low,
            }));
    }

    detectPattern(candles, index) {
        const c = candles[index];
        const p = candles[index - 1];
        const p2 = candles[index - 2];
        if (!c || !p) return null;

        const avgRange = this.avgRange(candles, index, 14);
        const bodyRatio = avgRange ? c.body / avgRange : 0;
        const avgBody = this.avgBody(candles, index, 14);
        const relativeBody = avgBody ? c.body / avgBody : 1;

        const PATTERNS = [];

        if (bodyRatio < 0.08) {
            PATTERNS.push({
                name: 'Doji',
                bias: 'NEUTRAL',
                strength: 'LOW',
                description: 'Açılış ve kapanış neredeyse aynı — piyasa kararsız, yön belirsiz',
            });
        }

        if (c.body > avgBody * 1.8 && c.range > avgRange * 1.2) {
            PATTERNS.push({
                name: 'Marubozu',
                bias: c.bullish ? 'BULLISH' : 'BEARISH',
                strength: 'HIGH',
                description: c.bullish
                    ? 'Gövde neredeyse tamamen yeşil — güçlü alıcı kontrolü'
                    : 'Gövde neredeyse tamamen kırmızı — güçlü satıcı kontrolü',
            });
        }

        if (
            p.body > avgBody &&
            c.body > avgBody &&
            c.bullish && p.bullish &&
            p2 && p2.bullish
        ) {
            PATTERNS.push({
                name: 'Üç Asker (Three White Soldiers)',
                bias: 'BULLISH',
                strength: 'HIGH',
                description: 'Üç ardışık güçlü yükseliş mumu — trend gücü ve alıcı isteği yüksek',
            });
        }

        if (
            p.body > avgBody &&
            c.body > avgBody &&
            !c.bullish && !p.bullish &&
            p2 && !p2.bullish
        ) {
            PATTERNS.push({
                name: 'Üç Kız Kardeş (Three Black Crows)',
                bias: 'BEARISH',
                strength: 'HIGH',
                description: 'Üç ardışık güçlü düşüş mumu — satıcı baskısı artıyor',
            });
        }

        if (
            c.bullish &&
            !p.bullish &&
            p.body > 0 &&
            c.close >= p.open &&
            c.open <= p.close
        ) {
            PATTERNS.push({
                name: 'Yükseliş Yutan (Bullish Engulfing)',
                bias: 'BULLISH',
                strength: 'HIGH',
                description: 'Düşüş mumunu tamamen sarmaladı — dönüş sinyali, alıcılar güç kazandı',
            });
        }

        if (
            !c.bullish &&
            p.bullish &&
            p.body > 0 &&
            c.close <= p.open &&
            c.open >= p.close
        ) {
            PATTERNS.push({
                name: 'Düşüş Yutan (Bearish Engulfing)',
                bias: 'BEARISH',
                strength: 'HIGH',
                description: 'Yükseliş mumunu tamamen sarmaladı — satıcılar güç kazandı, dikkat',
            });
        }

        if (avgRange && c.range > avgRange * 1.6) {
            PATTERNS.push({
                name: c.bullish ? 'Boğa Şekilli Uzun Gövde' : 'Ayı Şekilli Uzun Gövde',
                bias: c.bullish ? 'BULLISH' : 'BEARISH',
                strength: 'MEDIUM',
                description: 'Normalin üzerinde büyük gövde — güçlü bir gün',
            });
        }

        if (avgBody && c.body < avgBody * 0.25 && c.range > avgBody * 1.5) {
            PATTERNS.push({
                name: 'İğne (Spinning Top)',
                bias: 'NEUTRAL',
                strength: 'LOW',
                description: 'Küçük gövde, uzun fitiller — alıcı ve satıcı dengede, yön belirsiz',
            });
        }

        if (c.lowerWick > c.body * 2 && c.lowerWick > (avgRange || 0) * 0.5) {
            PATTERNS.push({
                name: 'Çekiç (Hammer)',
                bias: 'BULLISH',
                strength: 'MEDIUM',
                description: 'Uzun alt fitil — düşüşler alıcılarca karşılandı, destek bulundu',
            });
        }

        if (c.upperWick > c.body * 2 && c.upperWick > (avgRange || 0) * 0.5) {
            PATTERNS.push({
                name: 'Şemsiye (Shooting Star)',
                bias: 'BEARISH',
                strength: 'MEDIUM',
                description: 'Uzun üst fitil — yükselişler satıcılarca karşılandı, direnç var',
            });
        }

        return PATTERNS.length > 0 ? PATTERNS[0] : null;
    }

    analyzeConsecutive(candles, count = 3) {
        const last = candles.slice(-count);
        const allBullish = last.every(c => c.bullish && c.close > c.open);
        const allBearish = last.every(c => !c.bullish && c.close < c.open);

        if (allBullish && count >= 3) {
            return { pattern: `${count} Ardışık Yükseliş`, bias: 'BULLISH', strength: 'HIGH' };
        }
        if (allBearish && count >= 3) {
            return { pattern: `${count} Ardışık Düşüş`, bias: 'BEARISH', strength: 'HIGH' };
        }
        return null;
    }

    avgRange(candles, index, period) {
        const start = Math.max(0, index - period);
        const slice = candles.slice(start, index);
        if (slice.length === 0) return 0;
        return slice.reduce((s, c) => s + c.range, 0) / slice.length;
    }

    avgBody(candles, index, period) {
        const start = Math.max(0, index - period);
        const slice = candles.slice(start, index);
        if (slice.length === 0) return 0;
        return slice.reduce((s, c) => s + c.body, 0) / slice.length;
    }

    findSupportResistance(candles, lookback = 60, tolerance = 0.02) {
        const recent = candles.slice(-lookback);
        const closes = recent.map(c => c.close);

        const pivotHighs = [];
        const pivotLows = [];

        for (let i = 2; i < recent.length - 2; i++) {
            const c = recent[i];
            if (c.high > recent[i - 1].high && c.high > recent[i - 2].high &&
                c.high > recent[i + 1].high && c.high > recent[i + 2].high) {
                pivotHighs.push({ price: c.high, date: c.date });
            }
            if (c.low < recent[i - 1].low && c.low < recent[i - 2].low &&
                c.low < recent[i + 1].low && c.low < recent[i + 2].low) {
                pivotLows.push({ price: c.low, date: c.date });
            }
        }

        const cluster = (points) => {
            const levels = [];
            for (const p of points) {
                const found = levels.find(l => Math.abs(l.price - p.price) / p.price < tolerance);
                if (found) {
                    found.touches++;
                    found.price = (found.price * (found.touches - 1) + p.price) / found.touches;
                } else {
                    levels.push({ ...p, touches: 1 });
                }
            }
            return levels.sort((a, b) => b.touches - a.touches);
        };

        const current = closes[closes.length - 1];

        return {
            resistances: cluster(pivotHighs).filter(l => l.price > current).slice(0, 3),
            supports: cluster(pivotLows).filter(l => l.price < current).slice(0, 3),
        };
    }

    analyzeVolumeConfirmation(candles) {
        if (candles.length < 20) return { confirmed: false, label: 'YETERSİZ VERİ' };

        const recent = candles.slice(-20);
        const older = candles.slice(-40, -20);

        const recentAvgVol = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
        const olderAvgVol = older.length
            ? older.reduce((s, c) => s + c.volume, 0) / older.length
            : recentAvgVol;

        const ratio = olderAvgVol ? recentAvgVol / olderAvgVol : 1;
        const last = candles[candles.length - 1];
        const dayBefore = candles[candles.length - 2];

        const priceUp = last.bullish;
        const volumeUp = last.volume > recentAvgVol * 1.2;

        if (priceUp && volumeUp) {
            return { confirmed: true, label: 'Hacim destekli yükseliş', ratio: ratio.toFixed(2), strong: true };
        }
        if (!priceUp && volumeUp) {
            return { confirmed: true, label: 'Yüksek hacimli düşüş — satış baskısı', ratio: ratio.toFixed(2), strong: true };
        }
        if (priceUp && !volumeUp) {
            return { confirmed: false, label: 'Düşük hacimli yükseliş — zayıf', ratio: ratio.toFixed(2), strong: false };
        }
        if (!priceUp && !volumeUp) {
            return { confirmed: false, label: 'Düşük hacimli düşüş — ilgi az', ratio: ratio.toFixed(2), strong: false };
        }
        return { confirmed: false, label: 'Nötr hacim', ratio: ratio.toFixed(2), strong: false };
    }

    analyzeCandles(historicalData, limit = 30) {
        const candles = this.buildCandles(historicalData);
        if (candles.length < 10) {
            return { error: 'Yetersiz mum verisi' };
        }

        const currentIndex = candles.length - 1;
        const patterns = [];

        for (let i = Math.max(2, currentIndex - limit + 1); i <= currentIndex; i++) {
            const detected = this.detectPattern(candles, i);
            if (detected) {
                patterns.push({ ...detected, date: candles[i].date, index: i });
            }
        }

        const currentPattern = this.detectPattern(candles, currentIndex);
        const consecutive = this.analyzeConsecutive(candles);
        const levels = this.findSupportResistance(candles);
        const volume = this.analyzeVolumeConfirmation(candles);

        const last5 = candles.slice(-5);
        const bullish5 = last5.filter(c => c.bullish).length;
        const shortTermTrend =
            bullish5 >= 4 ? 'YUKARI' : bullish5 <= 1 ? 'AŞAĞI' : 'YATAY';

        const biasScore = this.calculateBiasScore(patterns, consecutive, shortTermTrend, volume, candles);

        return {
            patterns: patterns.slice(-12).reverse(),
            currentPattern,
            consecutive,
            levels,
            volume,
            shortTermTrend,
            biasScore,
            candles: candles.slice(-limit),
            summary: this.summarize(currentPattern, consecutive, shortTermTrend, volume, biasScore),
        };
    }

    calculateBiasScore(patterns, consecutive, shortTermTrend, volume, candles) {
        let score = 50;

        if (consecutive) {
            score += consecutive.bias === 'BULLISH' ? 12 : -12;
        }

        const recentPatterns = patterns.slice(-3);
        for (const p of recentPatterns) {
            if (p.bias === 'BULLISH') score += 5;
            else if (p.bias === 'BEARISH') score -= 5;
        }

        if (shortTermTrend === 'YUKARI') score += 6;
        else if (shortTermTrend === 'AŞAĞI') score -= 6;

        if (volume.strong) {
            const last = candles[candles.length - 1];
            score += last.bullish ? 5 : -5;
        }

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    summarize(currentPattern, consecutive, trend, volume, biasScore) {
        const parts = [];

        if (currentPattern) {
            parts.push(`Son mum: ${currentPattern.name} (${currentPattern.bias === 'BULLISH' ? 'yükseliş yönlü' : currentPattern.bias === 'BEARISH' ? 'düşüş yönlü' : 'nötr'})`);
        }
        if (consecutive) parts.push(consecutive.pattern);
        parts.push(`Kısa vade trend: ${trend}`);
        parts.push(volume.label);

        let bias;
        if (biasScore >= 65) bias = 'YÜKSELİŞ EĞİLİMİ';
        else if (biasScore <= 35) bias = 'DÜŞÜŞ EĞİLİMİ';
        else bias = 'KARARSIZ';

        return { text: parts.join(' · '), bias };
    }
}

module.exports = new CandleAnalyzer();