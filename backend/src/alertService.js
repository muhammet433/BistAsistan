const crypto = require('crypto');
const db = require('./database');

class AlertService {
    create(userId, symbol, condition) {
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
        db.run(
            `INSERT INTO alerts (alert_id, user_id, symbol, metric, direction, threshold)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [alertId, userId, symbol.toUpperCase(), metric, direction, threshold]
        );

        return { success: true, alertId };
    }

    getForUser(userId) {
        return db.query(
            'SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        ).map(this.mapRow);
    }

    getActiveForSymbol(userId, symbol) {
        return db.query(
            `SELECT * FROM alerts
             WHERE user_id = ? AND symbol = ? AND active = 1`,
            [userId, symbol.toUpperCase()]
        ).map(this.mapRow);
    }

    getActiveByUser(userId) {
        return db.query(
            'SELECT * FROM alerts WHERE user_id = ? AND active = 1',
            [userId]
        ).map(this.mapRow);
    }

    remove(userId, alertId) {
        const result = db.run('DELETE FROM alerts WHERE user_id = ? AND alert_id = ?', [userId, alertId]);
        return { success: result.changes > 0 };
    }

    reactivate(userId, alertId) {
        const result = db.run(
            `UPDATE alerts SET active = 1, triggered_at = NULL
             WHERE user_id = ? AND alert_id = ?`,
            [userId, alertId]
        );
        return { success: result.changes > 0 };
    }

    markTriggered(alertId) {
        db.run(
            "UPDATE alerts SET active = 0, triggered_at = datetime('now') WHERE alert_id = ?",
            [alertId]
        );
    }

    checkAlerts(userId, symbol, analysis) {
        const alerts = this.getActiveForSymbol(userId, symbol);
        const triggered = [];

        for (const alert of alerts) {
            const currentValue =
                alert.condition.type === 'PRICE' ? analysis.currentPrice : analysis.indicators?.rsi;

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
                this.markTriggered(alert.id);
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