/**
 * FITNESS TRACKER - Express API Server (PostgreSQL / Supabase Version)
 * Phase 2: Core Backend Development
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, query, closeDb } = require('./database/db');
const engine = require('./engine/fitness');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════
// USER PROFILE ENDPOINTS
// ═══════════════════════════════════════════

app.get('/api/user', async (req, res) => {
    try {
        const result = await query('SELECT * FROM users WHERE id = 1');
        const user = result.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        const bmr = engine.calculateBMR(user.weight_kg, user.height_cm, user.age, user.gender);
        const tdee = engine.calculateTDEE(user.weight_kg, user.height_cm, user.age, user.gender, user.activity_level);
        const macros = engine.calculateMacros(tdee, user.weight_kg, user.goal);

        res.json({ ...user, bmr, tdee, macros });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/user', async (req, res) => {
    try {
        const { name, height_cm, weight_kg, age, gender, activity_level, goal } = req.body;
        await query(`
            UPDATE users SET name=$1, height_cm=$2, weight_kg=$3, age=$4, gender=$5, activity_level=$6, goal=$7, updated_at=CURRENT_TIMESTAMP
            WHERE id = 1
        `, [name, height_cm, weight_kg, age, gender, activity_level, goal]);

        await query('INSERT INTO weight_log (user_id, weight_kg, logged_at) VALUES (1, $1, CURRENT_DATE)', [weight_kg]);

        const result = await query('SELECT * FROM users WHERE id = 1');
        const user = result.rows[0];
        const bmr = engine.calculateBMR(user.weight_kg, user.height_cm, user.age, user.gender);
        const tdee = engine.calculateTDEE(user.weight_kg, user.height_cm, user.age, user.gender, user.activity_level);
        const macros = engine.calculateMacros(tdee, user.weight_kg, user.goal);

        res.json({ ...user, bmr, tdee, macros });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/user/weight', async (req, res) => {
    try {
        const { weight_kg } = req.body;
        await query('INSERT INTO weight_log (user_id, weight_kg, logged_at) VALUES (1, $1, CURRENT_DATE)', [weight_kg]);
        await query('UPDATE users SET weight_kg = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [weight_kg]);
        res.json({ success: true, weight_kg });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/user/weight-history', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 90;
        const result = await query(`
            SELECT * FROM weight_log WHERE user_id = 1 
            AND logged_at >= CURRENT_DATE - INTERVAL '$1 days'
            ORDER BY logged_at ASC
        `, [days]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════
// EXERCISE ENDPOINTS
// ═══════════════════════════════════════════

app.get('/api/exercises', async (req, res) => {
    try {
        const category = req.query.category;
        let result;
        if (category) {
            result = await query('SELECT * FROM exercises WHERE category = $1 ORDER BY name', [category]);
        } else {
            result = await query('SELECT * FROM exercises ORDER BY category, name');
        }
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/exercises', async (req, res) => {
    try {
        const { name, category, is_cardio } = req.body;
        const result = await query('INSERT INTO exercises (name, category, is_cardio) VALUES ($1, $2, $3) RETURNING id', [name, category, is_cardio]);
        res.json({ id: result.rows[0].id, name, category, is_cardio });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════
// WORKOUT SESSION ENDPOINTS
// ═══════════════════════════════════════════

app.get('/api/workouts', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const result = await query(`
            SELECT ws.*, 
                   COUNT(DISTINCT wset.exercise_id) as exercise_count,
                   COALESCE(SUM(wset.weight_kg * wset.reps), 0) as total_volume
            FROM workout_sessions ws
            LEFT JOIN workout_sets wset ON ws.id = wset.session_id AND wset.is_warmup = FALSE
            WHERE ws.user_id = 1
            GROUP BY ws.id
            ORDER BY ws.session_date DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/workouts/:id', async (req, res) => {
    try {
        const sessionRes = await query('SELECT * FROM workout_sessions WHERE id = $1', [req.params.id]);
        const session = sessionRes.rows[0];
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const setsRes = await query(`
            SELECT wset.*, e.name as exercise_name, e.category, e.is_cardio, (wset.weight_kg * wset.reps) as volume
            FROM workout_sets wset
            JOIN exercises e ON wset.exercise_id = e.id
            WHERE wset.session_id = $1
            ORDER BY wset.created_at ASC
        `, [req.params.id]);

        const cardioRes = await query(`
            SELECT cl.*, e.name as exercise_name
            FROM cardio_log cl
            JOIN exercises e ON cl.exercise_id = e.id
            WHERE cl.session_id = $1
        `, [req.params.id]);

        res.json({ ...session, sets: setsRes.rows, cardio: cardioRes.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/workouts', async (req, res) => {
    try {
        const { session_name, session_date, notes } = req.body;
        const result = await query(`
            INSERT INTO workout_sessions (user_id, session_name, session_date, notes)
            VALUES (1, $1, COALESCE($2, CURRENT_DATE), $3)
            RETURNING *
        `, [session_name || 'Workout', session_date, notes]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/workouts/:id', async (req, res) => {
    try {
        await query('DELETE FROM workout_sessions WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/workouts/:id/sets', async (req, res) => {
    try {
        const { exercise_id, set_number, weight_kg, reps, rpe, is_warmup } = req.body;
        const insertRes = await query(`
            INSERT INTO workout_sets (session_id, exercise_id, set_number, weight_kg, reps, rpe, is_warmup)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [req.params.id, exercise_id, set_number || 1, weight_kg || 0, reps || 0, rpe, is_warmup || false]);

        const set = insertRes.rows[0];

        // Get progressive overload info
        const lastSessionRes = await query(`
            SELECT SUM(wset.weight_kg * wset.reps) as total_volume
            FROM workout_sets wset
            JOIN workout_sessions ws ON wset.session_id = ws.id
            WHERE wset.exercise_id = $1 AND ws.user_id = 1 AND ws.id != $2
            AND ws.session_date = (
                SELECT MAX(ws2.session_date) FROM workout_sessions ws2
                JOIN workout_sets wset2 ON ws2.id = wset2.session_id
                WHERE wset2.exercise_id = $3 AND ws2.user_id = 1 AND ws2.id != $4
            )
        `, [exercise_id, req.params.id, exercise_id, req.params.id]);

        const currentVolumeRes = await query(`
            SELECT SUM(weight_kg * reps) as total_volume FROM workout_sets 
            WHERE session_id = $1 AND exercise_id = $2 AND is_warmup = FALSE
        `, [req.params.id, exercise_id]);

        const overload = engine.checkProgressiveOverload(
            parseFloat(currentVolumeRes.rows[0]?.total_volume || 0),
            parseFloat(lastSessionRes.rows[0]?.total_volume || 0)
        );

        res.json({ set, overload });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/sets/:id', async (req, res) => {
    try {
        await query('DELETE FROM workout_sets WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════
// NUTRITION ENDPOINTS
// ═══════════════════════════════════════════

app.get('/api/nutrition/today', async (req, res) => {
    try {
        const mealsRes = await query(`
            SELECT * FROM nutrition_log WHERE user_id = 1 AND log_date = CURRENT_DATE
            ORDER BY created_at ASC
        `);

        const summaryRes = await query(`
            SELECT 
                SUM(calories) as total_calories,
                SUM(protein_g) as total_protein,
                SUM(carbs_g) as total_carbs,
                SUM(fats_g) as total_fats,
                SUM(water_ml) as total_water
            FROM nutrition_log WHERE user_id = 1 AND log_date = CURRENT_DATE
        `);

        const summary = summaryRes.rows[0] || { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0, total_water: 0 };

        const userRes = await query('SELECT * FROM users WHERE id = 1');
        const user = userRes.rows[0];
        const tdee = engine.calculateTDEE(user.weight_kg, user.height_cm, user.age, user.gender, user.activity_level);
        const targets = engine.calculateMacros(tdee, user.weight_kg, user.goal);

        res.json({ meals: mealsRes.rows, summary, targets });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/nutrition', async (req, res) => {
    try {
        const { meal_name, calories, protein_g, carbs_g, fats_g, water_ml, log_date } = req.body;
        await query(`
            INSERT INTO nutrition_log (user_id, log_date, meal_name, calories, protein_g, carbs_g, fats_g, water_ml)
            VALUES (1, COALESCE($1, CURRENT_DATE), $2, $3, $4, $5, $6, $7)
        `, [log_date, meal_name || 'Meal', calories || 0, protein_g || 0, carbs_g || 0, fats_g || 0, water_ml || 0]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/nutrition/history', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const result = await query(`
            SELECT 
                log_date,
                SUM(calories) as total_calories,
                SUM(protein_g) as total_protein,
                SUM(carbs_g) as total_carbs,
                SUM(fats_g) as total_fats,
                SUM(water_ml) as total_water
            FROM nutrition_log WHERE user_id = 1
            AND log_date >= CURRENT_DATE - INTERVAL '1 day' * $1
            GROUP BY log_date
            ORDER BY log_date ASC
        `, [days]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════
// ANALYTICS ENDPOINTS
// ═══════════════════════════════════════════

app.get('/api/analytics/dashboard', async (req, res) => {
    try {
        const weekWorkoutsRes = await query(`
            SELECT COUNT(*) as count FROM workout_sessions 
            WHERE user_id = 1 AND session_date >= CURRENT_DATE - INTERVAL '7 days'
        `);

        const weekVolumeRes = await query(`
            SELECT COALESCE(SUM(wset.weight_kg * wset.reps), 0) as total
            FROM workout_sets wset
            JOIN workout_sessions ws ON wset.session_id = ws.id
            WHERE ws.user_id = 1 AND ws.session_date >= CURRENT_DATE - INTERVAL '7 days'
            AND wset.is_warmup = FALSE
        `);

        const todayNutritionRes = await query(`
            SELECT 
                SUM(calories) as total_calories,
                SUM(protein_g) as total_protein,
                SUM(carbs_g) as total_carbs,
                SUM(fats_g) as total_fats,
                SUM(water_ml) as total_water
            FROM nutrition_log WHERE user_id = 1 AND log_date = CURRENT_DATE
        `);

        const userRes = await query('SELECT * FROM users WHERE id = 1');
        const user = userRes.rows[0];
        const tdee = engine.calculateTDEE(user.weight_kg, user.height_cm, user.age, user.gender, user.activity_level);
        const macros = engine.calculateMacros(tdee, user.weight_kg, user.goal);

        const prsRes = await query(`
            SELECT e.name, MAX(wset.weight_kg) as max_weight
            FROM workout_sets wset
            JOIN exercises e ON wset.exercise_id = e.id
            JOIN workout_sessions ws ON wset.session_id = ws.id
            WHERE ws.user_id = 1 AND wset.is_warmup = FALSE
            GROUP BY e.name
            ORDER BY max_weight DESC
            LIMIT 5
        `);

        res.json({
            weekWorkouts: parseInt(weekWorkoutsRes.rows[0].count),
            weekVolume: parseFloat(weekVolumeRes.rows[0].total),
            streak: 1, // Simple placeholder for now
            todayNutrition: todayNutritionRes.rows[0] || { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0, total_water: 0 },
            targets: macros,
            user,
            prs: prsRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/exercise/:exerciseId', async (req, res) => {
    try {
        const historyRes = await query(`
            SELECT 
                ws.session_date,
                SUM(wset.weight_kg * wset.reps) as total_volume,
                MAX(wset.weight_kg) as max_weight,
                SUM(wset.reps) as total_reps,
                COUNT(wset.id) as total_sets,
                AVG(wset.rpe) as avg_rpe
            FROM workout_sets wset
            JOIN workout_sessions ws ON wset.session_id = ws.id
            WHERE ws.user_id = 1 AND wset.exercise_id = $1 AND wset.is_warmup = FALSE
            GROUP BY ws.session_date
            ORDER BY ws.session_date ASC
        `, [req.params.exerciseId]);

        const history = historyRes.rows.map(h => ({
            ...h,
            total_volume: parseFloat(h.total_volume),
            max_weight: parseFloat(h.max_weight),
            avg_rpe: parseFloat(h.avg_rpe)
        }));

        const plateau = engine.detectPlateau(history);
        const oneRMHistory = history.map(h => ({
            date: h.session_date,
            estimated_1rm: engine.estimate1RM(h.max_weight, Math.round(h.total_reps / h.total_sets))
        }));

        res.json({ history, plateau, oneRMHistory });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/weight-vs-strength', async (req, res) => {
    try {
        const exerciseId = req.query.exercise_id || 1;
        const weightRes = await query('SELECT logged_at as date, weight_kg FROM weight_log WHERE user_id = 1 ORDER BY logged_at ASC');
        const strengthRes = await query(`
            SELECT ws.session_date as date, MAX(wset.weight_kg) as max_weight, SUM(wset.reps) as total_reps, COUNT(wset.id) as total_sets
            FROM workout_sets wset
            JOIN workout_sessions ws ON wset.session_id = ws.id
            WHERE ws.user_id = 1 AND wset.exercise_id = $1 AND wset.is_warmup = FALSE
            GROUP BY ws.session_date
            ORDER BY ws.session_date ASC
        `, [exerciseId]);

        const oneRMHistory = strengthRes.rows.map(s => ({
            date: s.date,
            estimated_1rm: engine.estimate1RM(parseFloat(s.max_weight), Math.round(s.total_reps / s.total_sets))
        }));

        res.json({ weightHistory: weightRes.rows, oneRMHistory });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/diet-plan', async (req, res) => {
    try {
        const result = await query('SELECT * FROM users WHERE id = 1');
        const user = result.rows[0];
        const tdee = engine.calculateTDEE(user.weight_kg, user.height_cm, user.age, user.gender, user.activity_level);
        const macros = engine.calculateMacros(tdee, user.weight_kg, user.goal);
        const plan = engine.generateDietPlan(macros, user.goal);
        res.json({ ...plan, user_goal: user.goal, tdee, bmr: engine.calculateBMR(user.weight_kg, user.height_cm, user.age, user.gender) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SPA fallback
app.get('/{*splat}', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 FitForge running on http://localhost:${PORT}`));
}

module.exports = app;
