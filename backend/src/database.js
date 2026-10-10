const fs = require('fs');
const path = require('path');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const useRemote = Boolean(TURSO_URL && TURSO_TOKEN);

let driver;

if (useRemote) {
    const { createClient } = require('@libsql/client');
    const client = createClient({
        url: TURSO_URL,
        authToken: TURSO_TOKEN,
    });
    driver = { kind: 'turso', client };
} else {
    const { DatabaseSync } = require('node:sqlite');
    const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/bist.db');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    driver = { kind: 'sqlite', db };
}

class Database {
    constructor() {
        this.kind = driver.kind;
        this.migrate();
    }

    async exec(sql) {
        if (this.kind === 'turso') {
            const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
            for (const statement of statements) {
                await driver.client.execute(statement);
            }
        } else {
            driver.db.exec(sql);
        }
    }

    async run(sql, params = []) {
        if (this.kind === 'turso') {
            const result = await driver.client.execute({ sql, args: params.map(toArg) });
            return { changes: result.rowsAffected ?? 0 };
        }
        return driver.db.prepare(sql).run(...params);
    }

    async get(sql, params = []) {
        if (this.kind === 'turso') {
            const result = await driver.client.execute({ sql, args: params.map(toArg) });
            return result.rows[0] ?? null;
        }
        return driver.db.prepare(sql).get(...params) ?? null;
    }

    async all(sql, params = []) {
        if (this.kind === 'turso') {
            const result = await driver.client.execute({ sql, args: params.map(toArg) });
            return result.rows;
        }
        return driver.db.prepare(sql).all(...params);
    }

    query(sql, params = []) {
        return this.allSync(sql, params);
    }

    allSync(sql, params = []) {
        if (this.kind === 'turso') {
            throw new Error('Turso modunda senkron sorgu kullanilamaz, await query() kullanin');
        }
        return driver.db.prepare(sql).all(...params);
    }

    getSync(sql, params = []) {
        if (this.kind === 'turso') {
            throw new Error('Turso modunda senkron sorgu kullanilamaz, await get() kullanin');
        }
        return driver.db.prepare(sql).get(...params) ?? null;
    }

    runSync(sql, params = []) {
        if (this.kind === 'turso') {
            throw new Error('Turso modunda senkron sorgu kullanilamaz, await run() kullanin');
        }
        return driver.db.prepare(sql).run(...params);
    }

    async transaction(fn) {
        if (this.kind === 'turso') {
            return fn();
        }
        driver.db.exec('BEGIN');
        try {
            const result = fn();
            driver.db.exec('COMMIT');
            return result;
        } catch (error) {
            driver.db.exec('ROLLBACK');
            throw error;
        }
    }

    async migrate() {
        const schema = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                min_confidence INTEGER DEFAULT 60,
                fcm_token TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )`,
            `CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                expires_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                added_at TEXT DEFAULT (datetime('now')),
                UNIQUE (user_id, symbol),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS alerts (
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
            )`,
            `CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                symbol TEXT,
                read INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS quotes (
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
            )`,
            `CREATE TABLE IF NOT EXISTS analysis_cache (
                symbol TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                computed_at TEXT DEFAULT (datetime('now'))
            )`,
            `CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
        ];

        for (const statement of schema) {
            await this.exec(statement);
        }

        await this.run(
            "DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
        );
    }
}

function toArg(value) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
}

module.exports = new Database();
module.exports.toArg = toArg;