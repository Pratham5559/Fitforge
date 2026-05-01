-- ============================================
-- FITFORGE - PostgreSQL Schema (Supabase)
-- ============================================

-- User Profile Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'User',
    height_cm REAL NOT NULL DEFAULT 175,
    weight_kg REAL NOT NULL DEFAULT 70,
    age INTEGER NOT NULL DEFAULT 25,
    gender TEXT NOT NULL DEFAULT 'male',
    activity_level TEXT NOT NULL DEFAULT 'moderate',
    goal TEXT NOT NULL DEFAULT 'maintain',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Weight History
CREATE TABLE IF NOT EXISTS weight_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    weight_kg REAL NOT NULL,
    logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Exercise Library
CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    is_cardio BOOLEAN NOT NULL DEFAULT FALSE
);

-- Workout Sessions
CREATE TABLE IF NOT EXISTS workout_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    session_name TEXT,
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Workout Sets
CREATE TABLE IF NOT EXISTS workout_sets (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    weight_kg REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    rpe REAL,
    volume REAL GENERATED ALWAYS AS (weight_kg * reps) STORED,
    is_warmup BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- Cardio Log
CREATE TABLE IF NOT EXISTS cardio_log (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    duration_minutes REAL NOT NULL,
    distance_km REAL,
    avg_heart_rate INTEGER,
    split_time_per_km REAL,
    calories_burned REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- Nutrition Log
CREATE TABLE IF NOT EXISTS nutrition_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_name TEXT,
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fats_g REAL NOT NULL DEFAULT 0,
    water_ml REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Seed default exercises (using ON CONFLICT to avoid errors on redeploy)
INSERT INTO exercises (name, category, is_cardio) VALUES
('Bench Press', 'chest', FALSE),
('Incline Bench Press', 'chest', FALSE),
('Dumbbell Flyes', 'chest', FALSE),
('Push Ups', 'chest', FALSE),
('Cable Crossover', 'chest', FALSE),
('Deadlift', 'back', FALSE),
('Barbell Row', 'back', FALSE),
('Lat Pulldown', 'back', FALSE),
('Pull Ups', 'back', FALSE),
('Seated Cable Row', 'back', FALSE),
('T-Bar Row', 'back', FALSE),
('Overhead Press', 'shoulders', FALSE),
('Lateral Raise', 'shoulders', FALSE),
('Face Pull', 'shoulders', FALSE),
('Arnold Press', 'shoulders', FALSE),
('Rear Delt Fly', 'shoulders', FALSE),
('Barbell Curl', 'arms', FALSE),
('Tricep Pushdown', 'arms', FALSE),
('Hammer Curl', 'arms', FALSE),
('Skull Crushers', 'arms', FALSE),
('Preacher Curl', 'arms', FALSE),
('Squat', 'legs', FALSE),
('Leg Press', 'legs', FALSE),
('Romanian Deadlift', 'legs', FALSE),
('Leg Extension', 'legs', FALSE),
('Leg Curl', 'legs', FALSE),
('Calf Raise', 'legs', FALSE),
('Bulgarian Split Squat', 'legs', FALSE),
('Plank', 'core', FALSE),
('Cable Crunch', 'core', FALSE),
('Hanging Leg Raise', 'core', FALSE),
('Clean and Press', 'compound', FALSE),
('Power Clean', 'compound', FALSE),
('Running', 'cardio', TRUE),
('Cycling', 'cardio', TRUE),
('Rowing', 'cardio', TRUE),
('Jump Rope', 'cardio', TRUE),
('Swimming', 'cardio', TRUE),
('Stair Climber', 'cardio', TRUE)
ON CONFLICT (name) DO NOTHING;
