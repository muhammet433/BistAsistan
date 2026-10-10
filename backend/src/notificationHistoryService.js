const db = require('./database');
const { toArg } = require('./database');

class NotificationHistoryService {
    async add(userId, title, body, symbol = null) {
        await db.run(
            'INSERT INTO notifications (user_id, title, body, symbol) VALUES (?, ?, ?, ?)',
            [toArg(userId), toArg(title), toArg(body), symbol ? toArg(symbol) : null]
        );
    }

    async getForUser(userId, limit = 50) {
        const rows = await db.all(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            [toArg(userId), toArg(limit)]
        );
        return rows.map(row => ({
            id: row.id,
            title: row.title,
            body: row.body,
            symbol: row.symbol,
            read: row.read === 1,
            createdAt: row.created_at,
        }));
    }

    async getUnreadCount(userId) {
        const row = await db.get(
            'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read = 0',
            [toArg(userId)]
        );
        return row ? row.count : 0;
    }

    async markAllRead(userId) {
        await db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [toArg(userId)]);
        return { success: true };
    }

    async clear(userId) {
        await db.run('DELETE FROM notifications WHERE user_id = ?', [toArg(userId)]);
        return { success: true };
    }
}

module.exports = new NotificationHistoryService();