-- ============================================
-- FITNESS TRACKER - Complete SQL Schema
-- Phase 1: Architecture & Data Modeling
-- ============================================

-- User Profile Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'User',
    height_cm REAL NOT NULL DEFAULT 175,
    weight_kg REAL NOT NULL DEFAULT 70,
    age INTEGER NOT NULL DEFAULT 25,
    gender TEXT NOT NULL DEFAULT 'male' CHECK(gender IN ('male', 'female')),
    activity_level TEXT NOT NULL DEFAULT 'moderate' CHECK(activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    goal TEXT NOT NULL DEFAULT 'maintain' CHECK(goal IN ('cut', 'maintain', 'bulk', 'stamina')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Weight History (for tracking weight over time)
CREATE TABLE IF NOT EXISTS weight_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    weight_kg REAL NOT NULL,
    logged_at DATE NOT NULL DEFAULT (date('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Exercise Library
CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK(category IN ('chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'compound')),
    is_cardio INTEGER NOT NULL DEFAULT 0
);

-- Workout Sessions
CREATE TABLE IF NOT EXISTS workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    session_date DATE NOT NULL DEFAULT (date('now')),
    session_name TEXT,
    duration_minutes INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Workout Sets (individual sets within a session)
CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    weight_kg REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    rpe REAL CHECK(rpe >= 1 AND rpe <= 10),
    volume REAL GENERATED ALWAYS AS (weight_kg * reps) STORED,
    is_warmup INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- Cardio Sessions
CREATE TABLE IF NOT EXISTS cardio_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    duration_minutes REAL NOT NULL,
    distance_km REAL,
    avg_heart_rate INTEGER,
    split_time_per_km REAL,
    calories_burned REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- Nutrition Log
CREATE TABLE IF NOT EXISTS nutrition_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    log_date DATE NOT NULL DEFAULT (date('now')),
    meal_name TEXT,
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fats_g REAL NOT NULL DEFAULT 0,
    water_ml REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Daily Nutrition Summary (aggregated view)
CREATE VIEW IF NOT EXISTS daily_nutrition AS
SELECT 
    user_id,
    log_date,
    SUM(calories) as total_calories,
    SUM(protein_g) as total_protein,
    SUM(carbs_g) as total_carbs,
    SUM(fats_g) as total_fats,
    SUM(water_ml) as total_water
FROM nutrition_log
GROUP BY user_id, log_date;

-- Exercise Volume History (for progressive overload tracking)
CREATE VIEW IF NOT EXISTS exercise_volume_history AS
SELECT 
    ws.user_id,
    ws.session_date,
    wset.exercise_id,
    e.name as exercise_name,
    SUM(wset.volume) as total_volume,
    MAX(wset.weight_kg) as max_weight,
    SUM(wset.reps) as total_reps,
    COUNT(wset.id) as total_sets,
    AVG(wset.rpe) as avg_rpe
FROM workout_sets wset
JOIN workout_sessions ws ON wset.session_id = ws.id
JOIN exercises e ON wset.exercise_id = e.id
WHERE wset.is_warmup = 0
GROUP BY ws.user_id, ws.session_date, wset.exercise_id;

-- Seed default exercises
INSERT OR IGNORE INTO exercises (name, category, is_cardio) VALUES
-- Chest
('Bench Press', 'chest', 0),
('Incline Bench Press', 'chest', 0),
('Dumbbell Flyes', 'chest', 0),
('Push Ups', 'chest', 0),
('Cable Crossover', 'chest', 0),
-- Back
('Deadlift', 'back', 0),
('Barbell Row', 'back', 0),
('Lat Pulldown', 'back', 0),
('Pull Ups', 'back', 0),
('Seated Cable Row', 'back', 0),
('T-Bar Row', 'back', 0),
-- Shoulders
('Overhead Press', 'shoulders', 0),
('Lateral Raise', 'shoulders', 0),
('Face Pull', 'shoulders', 0),
('Arnold Press', 'shoulders', 0),
('Rear Delt Fly', 'shoulders', 0),
-- Arms
('Barbell Curl', 'arms', 0),
('Tricep Pushdown', 'arms', 0),
('Hammer Curl', 'arms', 0),
('Skull Crushers', 'arms', 0),
('Preacher Curl', 'arms', 0),
-- Legs
('Squat', 'legs', 0),
('Leg Press', 'legs', 0),
('Romanian Deadlift', 'legs', 0),
('Leg Extension', 'legs', 0),
('Leg Curl', 'legs', 0),
('Calf Raise', 'legs', 0),
('Bulgarian Split Squat', 'legs', 0),
-- Core
('Plank', 'core', 0),
('Cable Crunch', 'core', 0),
('Hanging Leg Raise', 'core', 0),
-- Compound
('Clean and Press', 'compound', 0),
('Power Clean', 'compound', 0),
-- Cardio
('Running', 'cardio', 1),
('Cycling', 'cardio', 1),
('Rowing', 'cardio', 1),
('Jump Rope', 'cardio', 1),
('Swimming', 'cardio', 1),
('Stair Climber', 'cardio', 1);
