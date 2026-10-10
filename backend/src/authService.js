const crypto = require('crypto');
const db = require('./database');

const SESSION_DAYS = 30;

class AuthService {
    register(name, email, password) {
        const normalizedEmail = email.toLowerCase().trim();

        if (password.length < 6) {
            return { success: false, error: 'Şifre en az 6 karakter olmalı' };
        }

        const existing = db.get('SELECT user_id FROM users WHERE email = ?', [normalizedEmail]);
        if (existing) {
            return { success: false, error: 'Bu e-posta zaten kayıtlı' };
        }

        const userId = crypto.randomUUID();
        db.run(
            'INSERT INTO users (user_id, name, email, password) VALUES (?, ?, ?, ?)',
            [userId, name.trim(), normalizedEmail, this.hashPassword(password)]
        );

        return { success: true, userId, message: 'Kayıt başarılı' };
    }

    login(email, password) {
        const normalizedEmail = email.toLowerCase().trim();
        const user = db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

        if (!user) {
            return { success: false, error: 'Kullanıcı bulunamadı' };
        }

        if (!this.verifyPassword(password, user.password)) {
            return { success: false, error: 'Şifre hatalı' };
        }

        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000)
            .toISOString()
            .replace('T', ' ')
            .slice(0, 19);

        db.run(
            'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
            [token, user.user_id, expiresAt]
        );

        return {
            success: true,
            token,
            user: {
                userId: user.user_id,
                name: user.name,
                email: user.email,
            },
        };
    }

    logout(token) {
        db.run('DELETE FROM sessions WHERE token = ?', [token]);
        return { success: true };
    }

    validateToken(token) {
        const session = db.get(
            `SELECT user_id FROM sessions
             WHERE token = ?
               AND (expires_at IS NULL OR expires_at > datetime('now'))`,
            [token]
        );
        return session ? session.user_id : null;
    }

    getUser(userId) {
        const user = db.get(
            'SELECT user_id, name, email, min_confidence, fcm_token FROM users WHERE user_id = ?',
            [userId]
        );

        if (!user) return null;

        return {
            userId: user.user_id,
            name: user.name,
            email: user.email,
            preferences: { minConfidence: user.min_confidence },
            fcmToken: user.fcm_token,
            watchlist: this.getWatchlist(userId),
        };
    }

    getWatchlist(userId) {
        return db
            .query('SELECT symbol FROM watchlist WHERE user_id = ? ORDER BY added_at DESC', [userId])
            .map(row => row.symbol);
    }

    updateWatchlist(userId, symbol, action = 'add') {
        const normalized = symbol.toUpperCase();
        if (action === 'add') {
            db.run(
                'INSERT OR IGNORE INTO watchlist (user_id, symbol) VALUES (?, ?)',
                [userId, normalized]
            );
        } else {
            db.run('DELETE FROM watchlist WHERE user_id = ? AND symbol = ?', [userId, normalized]);
        }
        return { success: true, watchlist: this.getWatchlist(userId) };
    }

    updatePreferences(userId, preferences) {
        const current = db.get('SELECT min_confidence FROM users WHERE user_id = ?', [userId]);
        if (!current) return { success: false, error: 'Kullanıcı bulunamadı' };

        const minConfidence = preferences.minConfidence ?? current.min_confidence;
        db.run('UPDATE users SET min_confidence = ? WHERE user_id = ?', [minConfidence, userId]);

        return { success: true, preferences: { minConfidence } };
    }

    updateFCMToken(userId, fcmToken) {
        const result = db.run('UPDATE users SET fcm_token = ? WHERE user_id = ?', [fcmToken, userId]);
        return { success: result.changes > 0 };
    }

    getFCMToken(userId) {
        const user = db.get('SELECT fcm_token FROM users WHERE user_id = ?', [userId]);
        return user ? user.fcm_token : null;
    }

    hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
        return `${salt}:${hash}`;
    }

    verifyPassword(password, stored) {
        const [salt, hash] = stored.split(':');
        if (!salt || !hash) return false;
        const candidate = crypto.createHash('sha256').update(salt + password).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
    }
}

module.exports = new AuthService();