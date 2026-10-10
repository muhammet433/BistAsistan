const db = require('./database');

class NotificationHistoryService {
    add(userId, title, body, symbol = null) {
        db.run(
            'INSERT INTO notifications (user_id, title, body, symbol) VALUES (?, ?, ?, ?)',
            [userId, title, body, symbol]
        );
    }

    getForUser(userId, limit = 50) {
        return db.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            [userId, limit]
        ).map(row => ({
            id: row.id,
            title: row.title,
            body: row.body,
            symbol: row.symbol,
            read: row.read === 1,
            createdAt: row.created_at,
        }));
    }

    getUnreadCount(userId) {
        const row = db.get(
            'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read = 0',
            [userId]
        );
        return row ? row.count : 0;
    }

    markAllRead(userId) {
        db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [userId]);
        return { success: true };
    }

    remove(userId, id) {
        const result = db.run('DELETE FROM notifications WHERE user_id = ? AND id = ?', [userId, id]);
        return { success: result.changes > 0 };
    }

    clear(userId) {
        db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);
        return { success: true };
    }
}

module.exports = new NotificationHistoryService();