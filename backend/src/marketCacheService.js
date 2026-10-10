const db = require('./database');

const STALE_MINUTES = 20;

class MarketCacheService {
    saveQuotes(quotes) {
        if (!quotes || quotes.length === 0) return 0;

        const stmt = db.db.prepare(`
            INSERT INTO quotes (symbol, name, price, change, change_percent, volume,
                                day_high, day_low, week52_high, week52_low, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(symbol) DO UPDATE SET
                name = excluded.name,
                price = excluded.price,
                change = excluded.change,
                change_percent = excluded.change_percent,
                volume = excluded.volume,
                day_high = excluded.day_high,
                day_low = excluded.day_low,
                week52_high = excluded.week52_high,
                week52_low = excluded.week52_low,
                updated_at = excluded.updated_at
        `);

        db.transaction(() => {
            for (const q of quotes) {
                stmt.run(
                    q.symbol, q.name, q.price, q.change, q.changePercent,
                    q.volume, q.dayHigh, q.dayLow, q.fiftyTwoWeekHigh, q.fiftyTwoWeekLow
                );
            }
        });

        return quotes.length;
    }

    getQuotes() {
        return db.query('SELECT * FROM quotes ORDER BY symbol').map(row => ({
            symbol: row.symbol,
            name: row.name,
            price: row.price,
            change: row.change,
            changePercent: row.change_percent,
            volume: row.volume,
            dayHigh: row.day_high,
            dayLow: row.day_low,
            fiftyTwoWeekHigh: row.week52_high,
            fiftyTwoWeekLow: row.week52_low,
            updatedAt: row.updated_at,
        }));
    }

    getQuote(symbol) {
        const row = db.get('SELECT * FROM quotes WHERE symbol = ?', [symbol.toUpperCase()]);
        if (!row) return null;
        return {
            symbol: row.symbol,
            name: row.name,
            price: row.price,
            change: row.change,
            changePercent: row.change_percent,
            volume: row.volume,
            updatedAt: row.updated_at,
        };
    }

    isFresh(symbol) {
        const row = db.get(
            "SELECT updated_at FROM quotes WHERE symbol = ? AND updated_at > datetime('now', ?)",
            [symbol.toUpperCase(), `-${STALE_MINUTES} minutes`]
        );
        return Boolean(row);
    }

    getAgeMinutes() {
        const row = db.get(
            "SELECT CAST((julianday('now') - julianday(MAX(updated_at))) * 1440 AS INTEGER) AS age FROM quotes"
        );
        return row?.age ?? null;
    }

    saveAnalysis(symbol, payload) {
        db.run(
            `INSERT INTO analysis_cache (symbol, payload, computed_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(symbol) DO UPDATE SET
                payload = excluded.payload,
                computed_at = excluded.computed_at`,
            [symbol.toUpperCase(), JSON.stringify(payload)]
        );
    }

    getAnalysis(symbol, maxAgeMinutes = 60) {
        const row = db.get(
            `SELECT payload FROM analysis_cache
             WHERE symbol = ? AND computed_at > datetime('now', ?)`,
            [symbol.toUpperCase(), `-${maxAgeMinutes} minutes`]
        );
        if (!row) return null;
        try {
            return JSON.parse(row.payload);
        } catch {
            return null;
        }
    }

    getStats() {
        return {
            quoteCount: db.get('SELECT COUNT(*) AS c FROM quotes')?.c ?? 0,
            analysisCount: db.get('SELECT COUNT(*) AS c FROM analysis_cache')?.c ?? 0,
            ageMinutes: this.getAgeMinutes(),
        };
    }
}

module.exports = new MarketCacheService();