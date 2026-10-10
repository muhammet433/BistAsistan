const crypto = require('crypto');
const db = require('./database');
const { toArg } = require('./database');

class AlertService {
    async create(userId, symbol, condition) {
        const metric = condition.type;
        const direction = condition.direction;
        const threshold = Number(condition.threshold);

        if (!['PRICE', 'RSI'].includes(metric)) {
            return { success: false, error: 'Geçersiz kriter tipi' };
        }
        if (!['ABOVE', 'BELOW'].includes(direction)) {
            return { success: false, error: 'Geçersiz yön' };
        }
        if (!Number.isFinite(threshold) || threshold <= 0) {
            return { success: false, error: 'Geçersiz eşik değeri' };
        }

        const alertId = crypto.randomUUID();
        await db.run(
            `INSERT INTO alerts (alert_id, user_id, symbol, metric, direction, threshold)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                toArg(alertId),
                toArg(userId),
                toArg(symbol.toUpperCase()),
                toArg(metric),
                toArg(direction),
                toArg(threshold),
            ]
        );

        return { success: true, alertId };
    }

    async getForUser(userId) {
        const rows = await db.all(
            'SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC',
            [toArg(userId)]
        );
        return rows.map(row => this.mapRow(row));
    }

    async getActiveForSymbol(userId, symbol) {
        const rows = await db.all(
            'SELECT * FROM alerts WHERE user_id = ? AND symbol = ? AND active = 1',
            [toArg(userId), toArg(symbol.toUpperCase())]
        );
        return rows.map(row => this.mapRow(row));
    }

    async remove(userId, alertId) {
        const result = await db.run('DELETE FROM alerts WHERE user_id = ? AND alert_id = ?', [
            toArg(userId),
            toArg(alertId),
        ]);
        return { success: result.changes > 0 };
    }

    async reactivate(userId, alertId) {
        const result = await db.run(
            'UPDATE alerts SET active = 1, triggered_at = NULL WHERE user_id = ? AND alert_id = ?',
            [toArg(userId), toArg(alertId)]
        );
        return { success: result.changes > 0 };
    }

    async markTriggered(alertId) {
        await db.run(
            "UPDATE alerts SET active = 0, triggered_at = datetime('now') WHERE alert_id = ?",
            [toArg(alertId)]
        );
    }

    async checkAlerts(userId, symbol, analysis) {
        const alerts = await this.getActiveForSymbol(userId, symbol);
        const triggered = [];

        for (const alert of alerts) {
            const currentValue =
                alert.condition.type === 'PRICE'
                    ? analysis.currentPrice
                    : analysis.indicators?.rsi;

            if (!Number.isFinite(currentValue)) continue;

            const hit =
                alert.condition.direction === 'ABOVE'
                    ? currentValue >= alert.condition.threshold
                    : currentValue <= alert.condition.threshold;

            if (hit) {
                triggered.push({
                    alertId: alert.id,
                    symbol: alert.symbol,
                    type: alert.condition.type,
                    direction: alert.condition.direction,
                    value: currentValue,
                    threshold: alert.condition.threshold,
                    timestamp: new Date().toISOString(),
                });
                await this.markTriggered(alert.id);
            }
        }

        return triggered;
    }

    mapRow(row) {
        return {
            id: row.alert_id,
            symbol: row.symbol,
            condition: {
                type: row.metric,
                direction: row.direction,
                threshold: row.threshold,
            },
            active: row.active === 1,
            createdAt: row.created_at,
            triggeredAt: row.triggered_at,
        };
    }
}

module.exports = new AlertService();