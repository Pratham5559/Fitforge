/**
 * Database initialization and connection module
 * Uses better-sqlite3 for synchronous, fast SQLite operations
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use /tmp for SQLite on Vercel, otherwise use the configured path or local default
const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
const DB_PATH = process.env.DB_PATH || (isVercel ? '/tmp/fitness.db' : path.join(__dirname, 'fitness.db'));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        // Run schema
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schema);

        // Seed default user if none exists
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
        if (userCount.count === 0) {
            db.prepare(`
                INSERT INTO users (name, height_cm, weight_kg, age, gender, activity_level, goal)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                process.env.DEFAULT_USER_NAME || 'User',
                parseFloat(process.env.DEFAULT_USER_HEIGHT) || 175,
                parseFloat(process.env.DEFAULT_USER_WEIGHT) || 70,
                parseInt(process.env.DEFAULT_USER_AGE) || 25,
                process.env.DEFAULT_USER_GENDER || 'male',
                process.env.DEFAULT_USER_ACTIVITY || 'moderate',
                process.env.DEFAULT_USER_GOAL || 'maintain'
            );
        }

        console.log('✅ Database initialized successfully');
    }
    return db;
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = { getDb, closeDb };
