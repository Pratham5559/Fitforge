/**
 * FITNESS TRACKER - Express API Server
 * Phase 2: Core Backend Development
 * 
 * Endpoints:
 * - User profile & weight logging
 * - Workout session management
 * - Nutrition logging
 * - Analytics & intelligence
 * - Diet plan generation
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, closeDb } = require('./database/db');
const engine = require('./engine/fitness');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════
// USER PROFILE ENDPOINTS
// ═══════════════════════════════════════════

// GET user profile with computed macros
app.get('/api/user', (req, res) => {
    try {
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
        if (!user) return res.status(404).json({ error: 'User not found' });

        const bmr = engine.calculateBMR(user.weight_kg, user.height_cm, user.age, user.gender);
        const tdee = engine.calculateTDEE(user.weight_kg, user.height_cm, user.age, user.gender, user.activity_level);
        const macros = engine.calculateMacros(tdee, user.weight_kg, user.goal);

        res.json({ ...user, bmr, tdee, macros });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update user profile
app.put('/api/user', (req, res) => {
    try {
        const db = getDb();
        const { name, height_cm, weight_kg, age, gender, activity_level, goal } = req.body;
        db.prepare(`
            UPDATE users SET name=?, height_cm=?, weight_kg=?, age=?, gender=?, activity_level=?, goal=?, updated_at=CURRENT_TIMESTAMP
            WHERE id = 1
        `).run(name, height_cm, weight_kg, age, gender, activity_level, goal);

        // Also log weight
        db.prepare('INSERT OR REPLACE INTO weight_log (user_id, weight_kg, logged_at) VALUES (1, ?, date("now"))').run(weight_kg);

        const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
        const bmr = engine.calculateBMR(user.weight_kg, user.height_cm, user.age, user.gender);
        const tdee = engine.calculateTDEE(user.weight_kg, user.height_cm, user.age, user.gender, user.activity_level);
        const macros = engine.calculateMacros(tdee, user.weight_kg, user.goal);

        res.json({ ...user, bmr, tdee, macros });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST daily weight
app.post('/api/user/weight', (req, res) => {
    try {
        const db = getDb();
        const { weight_kg } = req.body;
        db.prepare('INSERT INTO weight_log (user_id, weight_kg, logged_at) VALUES (1, ?, date("now"))').run(weight_kg);
        db.prepare('UPDATE users SET weight_kg = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(weight_kg);
        res.json({ success: true, weight_kg });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET weight history
app.get('/api/user/weight-history', (req, res) => {
    try {
        const db = getDb();
        const days = parseInt(req.query.days) || 90;
        const history = db.prepare(`
            SELECT * FROM weight_log WHERE user_id = 1 
            AND logged_at >= date('now', '-${days} days')
            ORDER BY logged_at ASC
        `).all();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════
// EXERCISE ENDPOINTS
// ═══════════════════════════════════════════

app.get('/api/exercises', (req, res) => {
    try {
        const db = getDb();
        const category = req.query.category;
        let exercises;
        if (category) {
            exercises = db.prepare('SELECT * FROM exercises WHERE category = ? ORDER BY name').all(category);
        } else {
            exercises = db.prepare('SELECT * FROM exercises ORDER BY category, name').all();
        }
        res.json(exercises);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/exercises', (req, res) => {
    try {
        const db = getDb();
        const { name, category, is_cardio } = req.body;
        const result = db.prepare('INSERT INTO exercises (name, category, is_cardio) VALUES (?, ?, ?)').run(name, category, is_cardio ? 1 : 0);
        res.json({ id: result.lastInsertRowid, name, category, is_cardio });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════
// WORKOUT SESSION ENDPOINTS
// ═══════════════════════════════════════════

// GET all sessions (paginated)
app.get('/api/workouts', (req, res) => {
    try {
        const db = getDb();
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const sessions = db.prepare(`
            SELECT ws.*, 
                   COUNT(DISTINCT wset.exercise_id) as exercise_count,
                   SUM(wset.volume) as total_volume
            FROM workout_sessions ws
            LEFT JOIN workout_sets wset ON ws.id = wset.session_id AND wset.is_warmup = 0
            WHERE ws.user_id = 1
            GROUP BY ws.id
            ORDER BY ws.session_date DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single session with all sets
app.get('/api/workouts/:id', (req, res) => {
    try {
        const db = getDb();
        const session = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const sets = db.prepare(`
            SELECT wset.*, e.name as exercise_name, e.category, e.is_cardio
            FROM workout_sets wset
            JOIN exercises e ON wset.exercise_id = e.id
            WHERE wset.session_id = ?
            ORDER BY wset.created_at ASC
        `).all(req.params.id);

        const cardio = db.prepare(`
            SELECT cl.*, e.name as exercise_name
            FROM cardio_log cl
            JOIN exercises e ON cl.exercise_id = e.id
            WHERE cl.session_id = ?
        `).all(req.params.id);

        res.json({ ...session, sets, cardio });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new workout session
app.post('/api/workouts', (req, res) => {
    try {
        const db = getDb();
        const { session_name, session_date, notes } = req.body;
        const result = db.prepare(`
            INSERT INTO workout_sessions (user_id, session_name, session_date, notes)
            VALUES (1, ?, COALESCE(?, date('now')), ?)
        `).run(session_name || 'Workout', session_date, notes);
        
        const session = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(result.lastInsertRowid);
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a workout session
app.delete('/api/workouts/:id', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM workout_sessions WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST add set to session
app.post('/api/workouts/:id/sets', (req, res) => {
    try {
        const db = getDb();
        const { exercise_id, set_number, weight_kg, reps, rpe, is_warmup } = req.body;
        const result = db.prepare(`
            INSERT INTO workout_sets (session_id, exercise_id, set_number, weight_kg, reps, rpe, is_warmup)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.params.id, exercise_id, set_number || 1, weight_kg || 0, reps || 0, rpe, is_warmup ? 1 : 0);

        const set = db.prepare(`
            SELECT wset.*, e.name as exercise_name
            FROM workout_sets wset
            JOIN exercises e ON wset.exercise_id = e.id
            WHERE wset.id = ?
        `).get(result.lastInsertRowid);

        // Get progressive overload info
        const lastSession = db.prepare(`
            SELECT SUM(wset.volume) as total_volume
            FROM workout_sets wset
            JOIN workout_sessions ws ON wset.session_id = ws.id
            WHERE wset.exercise_id = ? AND ws.user_id = 1 AND ws.id != ?
            AND ws.session_date = (
                SELECT MAX(ws2.session_date) FROM workout_sessions ws2
                JOIN workout_sets wset2 ON ws2.id = wset2.session_id
                WHERE wset2.exercise_id = ? AND ws2.user_id = 1 AND ws2.id != ?
            )
        `).get(exercise_id, req.params.id, exercise_id, req.params.id);

        const currentVolume = db.prepare(`
            SELECT SUM(volume) as total_volume FROM workout_sets 
            WHERE session_id = ? AND exercise_id = ? AND is_warmup = 0
        `).get(req.params.id, exercise_id);

        const overload = engine.checkProgressiveOverload(
            currentVolume?.total_volume || 0,
            lastSession?.total_volume || 0
        );

        res.json({ set, overload });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a set
app.delete('/api/sets/:id', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM workout_sets WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST add cardio to session
app.post('/api/workouts/:id/cardio', (req, res) => {
    try {
        const db = getDb();
        const { exercise_id, duration_minutes, distance_km, avg_heart_rate } = req.body;
        const splitData = engine.calculateSplitTime(distance_km, duration_minutes);

        const result = db.prepare(`
            INSERT INTO cardio_log (session_id, exercise_id, duration_minutes, distance_km, avg_heart_rate, split_time_per_km, calories_burned)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.params.id, exercise_id, duration_minutes, distance_km, avg_heart_rate,
            splitData ? parseFloat(splitData.pace_per_km) : null,
            splitData ? splitData.calories_estimate : Math.round(duration_minutes * 8));

        res.json({ id: result.lastInsertRowid, splitData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════
// NUTRITION ENDPOINTS
// ═══════════════════════════════════════════

// GET today's nutrition
app.get('/api/nutrition/today', (req, res) => {
    try {
        const db = getDb();
        const meals = db.prepare(`
            SELECT * FROM nutrition_log WHERE user_id = 1 AND log_date = date('now')
            ORDER BY created_at ASC
        `).all();

        const summary = db.prepare(`
            SELECT * FROM daily_nutrition WHERE user_id = 1 AND log_date = date('now')
        `).get() || { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0, total_water: 0 };

        // Get targets
        const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
        const tdee = engine.calculateTDEE(user.weight_kg, user.height_cm, user.age, user.gender, user.activity_level);
        const targets = engine.calculateMacros(tdee, user.weight_kg, user.goal);

        res.json({ meals, summary, targets });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST log meal
app.post('/api/nutrition', (req, res) => {
    try {
        const db = getDb();
        const { meal_name, calories, protein_g, carbs_g, fats_g, water_ml, log_date } = req.body;
        const result = db.prepare(`
            INSERT INTO nutrition_log (user_id, log_date, meal_name, calories, protein_g, carbs_g, fats_g, water_ml)
            VALUES (1, COALESCE(?, date('now')), ?, ?, ?, ?, ?, ?)
        `).run(log_date, meal_name || 'Meal', calories || 0, protein_g || 0, carbs_g || 0, fats_g || 0, water_ml || 0);

        res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a meal entry
app.delete('/api/nutrition/:id', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM nutrition_log WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET nutrition history
app.get('/api/nutrition/history', (req, res) => {
    try {
        const db = getDb();
        const days = parseInt(req.query.days) || 30;
        const history = db.prepare(`
            SELECT * FROM daily_nutrition WHERE user_id = 1
            AND log_date >= date('now', '-${days} days')
            ORDER BY log_date ASC
        `).all();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════
// ANALYTICS & INTELLIGENCE ENDPOINTS
// ═══════════════════════════════════════════

// GET exercise analytics with plateau detection
app.get('/api/analytics/exercise/:exerciseId', (req, res) => {
    try {
        const db = getDb();
        const history = db.prepare(`
            SELECT * FROM exercise_volume_history 
            WHERE user_id = 1 AND exercise_id = ?
            ORDER BY session_date ASC
        `).all(req.params.exerciseId);

        const plateau = engine.detectPlateau(history);

        // Calculate 1RM history
        const oneRMHistory = history.map(h => ({
            date: h.session_date,
            estimated_1rm: engine.estimate1RM(h.max_weight, Math.round(h.total_reps / h.total_sets)),
            max_weight: h.max_weight,
            total_volume: h.total_volume
        }));

        res.json({ history, plateau, oneRMHistory });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET overall dashboard stats
app.get('/api/analytics/dashboard', (req, res) => {
    try {
        const db = getDb();

        // This week's workout count
        const weekWorkouts = db.prepare(`
            SELECT COUNT(*) as count FROM workout_sessions 
            WHERE user_id = 1 AND session_date >= date('now', 'weekday 0', '-7 days')
        `).get();

        // Total volume this week
        const weekVolume = db.prepare(`
            SELECT COALESCE(SUM(wset.volume), 0) as total
            FROM workout_sets wset
            JOIN workout_sessions ws ON wset.session_id = ws.id
            WHERE ws.user_id = 1 AND ws.session_date >= date('now', 'weekday 0', '-7 days')
            AND wset.is_warmup = 0
        `).get();

        // Today's nutrition
        const todayNutrition = db.prepare(`
            SELECT * FROM daily_nutrition WHERE user_id = 1 AND log_date = date('now')
        `).get() || { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0, total_water: 0 };

        // User + macros
        const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
        const tdee = engine.calculateTDEE(user.weight_kg, user.height_cm, user.age, user.gender, user.activity_level);
        const macros = engine.calculateMacros(tdee, user.weight_kg, user.goal);

        // Streak calculation
        const recentDates = db.prepare(`
            SELECT DISTINCT session_date FROM workout_sessions 
            WHERE user_id = 1 ORDER BY session_date DESC LIMIT 30
        `).all();

        let streak = 0;
        const today = new Date();
        for (let i = 0; i < recentDates.length; i++) {
            const expected = new Date(today);
            expected.setDate(expected.getDate() - i);
            const expectedStr = expected.toISOString().split('T')[0];
            if (recentDates[i]?.session_date === expectedStr) {
                streak++;
            } else {
                break;
            }
        }

        // Personal records
        const prs = db.prepare(`
            SELECT e.name, MAX(wset.weight_kg) as max_weight, 
                   MAX(wset.volume) as max_volume
            FROM workout_sets wset
            JOIN exercises e ON wset.exercise_id = e.id
            JOIN workout_sessions ws ON wset.session_id = ws.id
            WHERE ws.user_id = 1 AND wset.is_warmup = 0
            GROUP BY e.name
            ORDER BY max_weight DESC
            LIMIT 5
        `).all();

        res.json({
            weekWorkouts: weekWorkouts.count,
            weekVolume: weekVolume.total,
            streak,
            todayNutrition,
            targets: macros,
            user,
            prs
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET weight vs 1RM chart data
app.get('/api/analytics/weight-vs-strength', (req, res) => {
    try {
        const db = getDb();
        const exerciseId = req.query.exercise_id || 1; // default to Bench Press

        const weightHistory = db.prepare(`
            SELECT logged_at as date, weight_kg FROM weight_log 
            WHERE user_id = 1 ORDER BY logged_at ASC
        `).all();

        const strengthHistory = db.prepare(`
            SELECT session_date as date, max_weight, total_volume, total_reps, total_sets
            FROM exercise_volume_history 
            WHERE user_id = 1 AND exercise_id = ?
            ORDER BY session_date ASC
        `).all(exerciseId);

        const oneRMHistory = strengthHistory.map(s => ({
            date: s.date,
            estimated_1rm: engine.estimate1RM(s.max_weight, Math.round(s.total_reps / s.total_sets))
        }));

        res.json({ weightHistory, strengthHistory, oneRMHistory });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════
// DIET PLAN ENDPOINT
// ═══════════════════════════════════════════

app.get('/api/diet-plan', (req, res) => {
    try {
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
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

// Start server
app.listen(PORT, () => {
    console.log(`\n🏋️  FITNESS TRACKER running at http://localhost:${PORT}\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    closeDb();
    process.exit(0);
});
