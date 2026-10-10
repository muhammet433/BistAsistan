const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/bist.db');

class Database {
    constructor() {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new DatabaseSync(DB_PATH);
        this.db.exec('PRAGMA journal_mode = WAL;');
        this.db.exec('PRAGMA foreign_keys = ON;');
        this.migrate();
    }

    migrate() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                min_confidence INTEGER DEFAULT 60,
                fcm_token TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                expires_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                added_at TEXT DEFAULT (datetime('now')),
                UNIQUE (user_id, symbol),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id TEXT UNIQUE NOT NULL,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                metric TEXT NOT NULL,
                direction TEXT NOT NULL,
                threshold REAL NOT NULL,
                active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                triggered_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                symbol TEXT,
                read INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS quotes (
                symbol TEXT PRIMARY KEY,
                name TEXT,
                price REAL,
                change REAL,
                change_percent REAL,
                volume INTEGER,
                day_high REAL,
                day_low REAL,
                week52_high REAL,
                week52_low REAL,
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS analysis_cache (
                symbol TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                computed_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
            CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
            CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        `);

        this.cleanupExpiredSessions();
    }

    cleanupExpiredSessions() {
        this.db
            .prepare(`DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`)
            .run();
    }

    query(sql, params = []) {
        return this.db.prepare(sql).all(...params);
    }

    get(sql, params = []) {
        return this.db.prepare(sql).get(...params);
    }

    run(sql, params = []) {
        return this.db.prepare(sql).run(...params);
    }

    transaction(fn) {
        this.db.exec('BEGIN');
        try {
            const result = fn();
            this.db.exec('COMMIT');
            return result;
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }
}

module.exports = new Database();
module.exports.Database = Database;