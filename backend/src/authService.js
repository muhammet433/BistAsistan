const crypto = require('crypto');
const db = require('./database');
const { toArg } = require('./database');

const SESSION_DAYS = 30;

class AuthService {
    async register(name, email, password) {
        const normalizedEmail = email.toLowerCase().trim();

        if (password.length < 6) {
            return { success: false, error: 'Şifre en az 6 karakter olmalı' };
        }

        const existing = await db.get('SELECT user_id FROM users WHERE email = ?', [
            toArg(normalizedEmail),
        ]);
        if (existing) {
            return { success: false, error: 'Bu e-posta zaten kayıtlı' };
        }

        const userId = crypto.randomUUID();
        await db.run(
            'INSERT INTO users (user_id, name, email, password) VALUES (?, ?, ?, ?)',
            [
                toArg(userId),
                toArg(name.trim()),
                toArg(normalizedEmail),
                toArg(this.hashPassword(password)),
            ]
        );

        return { success: true, userId, message: 'Kayıt başarılı' };
    }

    async login(email, password) {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await db.get('SELECT * FROM users WHERE email = ?', [toArg(normalizedEmail)]);

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

        await db.run(
            'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
            [toArg(token), toArg(user.user_id), toArg(expiresAt)]
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

    async logout(token) {
        await db.run('DELETE FROM sessions WHERE token = ?', [toArg(token)]);
        return { success: true };
    }

    async validateToken(token) {
        const session = await db.get(
            `SELECT user_id FROM sessions
             WHERE token = ?
               AND (expires_at IS NULL OR expires_at > datetime('now'))`,
            [toArg(token)]
        );
        return session ? session.user_id : null;
    }

    async getUser(userId) {
        const user = await db.get(
            'SELECT user_id, name, email, min_confidence, fcm_token FROM users WHERE user_id = ?',
            [toArg(userId)]
        );

        if (!user) return null;

        return {
            userId: user.user_id,
            name: user.name,
            email: user.email,
            preferences: { minConfidence: user.min_confidence },
            fcmToken: user.fcm_token,
            watchlist: await this.getWatchlist(userId),
        };
    }

    async getWatchlist(userId) {
        const rows = await db.all(
            'SELECT symbol FROM watchlist WHERE user_id = ? ORDER BY added_at DESC',
            [toArg(userId)]
        );
        return rows.map(row => row.symbol);
    }

    async updateWatchlist(userId, symbol, action = 'add') {
        const normalized = symbol.toUpperCase();

        if (action === 'add') {
            await db.run(
                'INSERT OR IGNORE INTO watchlist (user_id, symbol) VALUES (?, ?)',
                [toArg(userId), toArg(normalized)]
            );
        } else {
            await db.run('DELETE FROM watchlist WHERE user_id = ? AND symbol = ?', [
                toArg(userId),
                toArg(normalized),
            ]);
        }

        return { success: true, watchlist: await this.getWatchlist(userId) };
    }

    async updatePreferences(userId, preferences) {
        const current = await db.get(
            'SELECT min_confidence FROM users WHERE user_id = ?',
            [toArg(userId)]
        );
        if (!current) return { success: false, error: 'Kullanıcı bulunamadı' };

        const minConfidence = preferences.minConfidence ?? current.min_confidence;
        await db.run('UPDATE users SET min_confidence = ? WHERE user_id = ?', [
            toArg(minConfidence),
            toArg(userId),
        ]);

        return { success: true, preferences: { minConfidence } };
    }

    async updateFCMToken(userId, fcmToken) {
        const result = await db.run('UPDATE users SET fcm_token = ? WHERE user_id = ?', [
            toArg(fcmToken),
            toArg(userId),
        ]);
        return { success: result.changes > 0 };
    }

    async getFCMToken(userId) {
        const user = await db.get('SELECT fcm_token FROM users WHERE user_id = ?', [
            toArg(userId),
        ]);
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