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

    analyze(historicalData) {
        if (!historicalData || historicalData.length < 30) {
            return { error: 'Yetersiz veri (en az 30 gün gerekli)' };
        }

        const closes = historicalData.map(d => d.close);

        const rsi = this.calculateRSI(closes);
        const macd = this.calculateMACD(closes);
        const sma20 = this.calculateSMA(closes, 20);
        const ema20 = this.calculateEMA(closes, 20);
        const bb = this.calculateBollingerBands(closes);

        const currentRSI = rsi[rsi.length - 1];
        const currentMACD = macd[macd.length - 1];
        const currentSMA = sma20[sma20.length - 1];
        const currentEMA = ema20[ema20.length - 1];
        const currentBB = bb[bb.length - 1];
        const currentPrice = closes[closes.length - 1];

        const signals = this.generateSignals({
            currentRSI,
            currentMACD,
            currentSMA,
            currentPrice,
            currentBB,
            previousRSI: rsi[rsi.length - 2],
            closes
        });

        return {
            currentPrice,
            indicators: {
                rsi: currentRSI,
                macd: currentMACD,
                sma20: currentSMA,
                ema20: currentEMA,
                bollingerBands: currentBB
            },
            signals,
            timestamp: new Date().toISOString()
        };
    }

    generateSignals({ currentRSI, currentMACD, currentSMA, currentPrice, currentBB, previousRSI, closes }) {
        const signals = [];

        if (currentRSI < 30) {
            signals.push({ type: 'BUY', strength: 'STRONG', reason: `RSI aşırı satım bölgesinde (${currentRSI.toFixed(2)})` });
        } else if (currentRSI < 40) {
            signals.push({ type: 'BUY', strength: 'MODERATE', reason: `RSI düşük (${currentRSI.toFixed(2)})` });
        } else if (currentRSI > 70) {
            signals.push({ type: 'SELL', strength: 'STRONG', reason: `RSI aşırı alım bölgesinde (${currentRSI.toFixed(2)})` });
        } else if (currentRSI > 60) {
            signals.push({ type: 'SELL', strength: 'MODERATE', reason: `RSI yüksek (${currentRSI.toFixed(2)})` });
        }

        if (currentMACD && currentMACD.MACD > currentMACD.signal) {
            signals.push({ type: 'BUY', strength: 'MODERATE', reason: 'MACD sinyal çizgisini yukarı kesti' });
        } else if (currentMACD && currentMACD.MACD < currentMACD.signal) {
            signals.push({ type: 'SELL', strength: 'MODERATE', reason: 'MACD sinyal çizgisini aşağı kesti' });
        }

        if (currentPrice > currentSMA) {
            signals.push({ type: 'BUY', strength: 'WEAK', reason: 'Fiyat 20 günlük SMA üzerinde' });
        } else {
            signals.push({ type: 'SELL', strength: 'WEAK', reason: 'Fiyat 20 günlük SMA altında' });
        }

        if (currentBB) {
            if (currentPrice < currentBB.lower) {
                signals.push({ type: 'BUY', strength: 'STRONG', reason: 'Fiyat Bollinger alt bandına yakın' });
            } else if (currentPrice > currentBB.upper) {
                signals.push({ type: 'SELL', strength: 'STRONG', reason: 'Fiyat Bollinger üst bandına yakın' });
            }
        }

        const momentum = this.calculateMomentum(closes, 10);
        if (momentum > 5) {
            signals.push({ type: 'BUY', strength: 'WEAK', reason: `Güçlü yukarı momentum (+${momentum.toFixed(2)}%)` });
        } else if (momentum < -5) {
            signals.push({ type: 'SELL', strength: 'WEAK', reason: `Güçlü aşağı momentum (${momentum.toFixed(2)}%)` });
        }

        return signals;
    }

    calculateMomentum(closes, period) {
        if (closes.length < period + 1) return 0;
        const current = closes[closes.length - 1];
        const past = closes[closes.length - 1 - period];
        return ((current - past) / past) * 100;
    }

    getOverallSignal(signals) {
        if (!signals || signals.length === 0) return { action: 'HOLD', confidence: 0 };

        let buyScore = 0;
        let sellScore = 0;

        signals.forEach(s => {
            const weight = s.strength === 'STRONG' ? 2 : s.strength === 'MODERATE' ? 1.5 : 1;
            if (s.type === 'BUY') buyScore += weight;
            else sellScore += weight;
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
