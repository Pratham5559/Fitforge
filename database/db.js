/**
 * Database initialization and connection module for PostgreSQL (Supabase)
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool;

function getDb() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;
        
        if (!connectionString) {
            console.error('❌ DATABASE_URL is missing! Please set it in your environment variables.');
            process.exit(1);
        }

        pool = new Pool({
            connectionString,
            ssl: {
                rejectUnauthorized: false // Required for Supabase connections
            }
        });

        // Initialize schema on first connect
        pool.query('SELECT COUNT(*) FROM users').catch(async (err) => {
            console.log('📦 Initializing Supabase schema...');
            const schema = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf8');
            try {
                await pool.query(schema);
                
                // Seed default user
                await pool.query(`
                    INSERT INTO users (name, height_cm, weight_kg, age, gender, activity_level, goal)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    process.env.DEFAULT_USER_NAME || 'User',
                    parseFloat(process.env.DEFAULT_USER_HEIGHT) || 175,
                    parseFloat(process.env.DEFAULT_USER_WEIGHT) || 70,
                    parseInt(process.env.DEFAULT_USER_AGE) || 25,
                    process.env.DEFAULT_USER_GENDER || 'male',
                    process.env.DEFAULT_USER_ACTIVITY || 'moderate',
                    process.env.DEFAULT_USER_GOAL || 'maintain'
                ]);
                
                console.log('✅ Supabase initialized successfully');
            } catch (schemaErr) {
                console.error('❌ Failed to initialize schema:', schemaErr);
            }
        });
    }
    return pool;
}

// Wrapper to make pool.query work like the synchronous sqlite prepare().get()/.run()
async function query(text, params) {
    const db = getDb();
    const res = await db.query(text, params);
    return res;
}

function closeDb() {
    if (pool) {
        pool.end();
        pool = null;
    }
}

module.exports = { getDb, query, closeDb };
