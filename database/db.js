/**
 * Database initialization and connection module
 * Uses better-sqlite3 for synchronous, fast SQLite operations
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'fitness.db');
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
                VALUES ('Pratham', 175, 70, 21, 'male', 'moderate', 'bulk')
            `).run();
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
