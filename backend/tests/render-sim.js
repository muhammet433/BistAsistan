const db = require('../src/database');

console.log('DB_PATH:', process.env.DB_PATH);
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'");
console.log('Tablolar:', tables.map(t => t.name).join(', '));

db.run(
    'INSERT INTO users (user_id, name, email, password) VALUES (?, ?, ?, ?)',
    ['render-test', 'Render Testi', 'render@test.com', 'hash']
);
console.log('Yazma:', db.get('SELECT name FROM users').name);
console.log('OK: Render ortami calisiyor');