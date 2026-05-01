/**
 * FITNESS LOGIC ENGINE
 * Phase 1 & 2: All formulas and intelligence
 * - Mifflin-St Jeor BMR
 * - TDEE calculation
 * - Macro splitting
 * - Progressive overload detection
 * - Plateau detection
 * - 1RM estimation (Epley formula)
 * - Endurance / split time calculator
 * - Diet plan generator
 */

// ─── Activity Multipliers ───
const ACTIVITY_MULTIPLIERS = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
};

// ─── BMR: Mifflin-St Jeor Equation ───
function calculateBMR(weight_kg, height_cm, age, gender) {
    if (gender === 'male') {
        return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
    } else {
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
    }
}

// ─── TDEE: Total Daily Energy Expenditure ───
function calculateTDEE(weight_kg, height_cm, age, gender, activity_level) {
    const bmr = calculateBMR(weight_kg, height_cm, age, gender);
    const multiplier = ACTIVITY_MULTIPLIERS[activity_level] || 1.55;
    return Math.round(bmr * multiplier);
}

// ─── Macro Requirements based on Goal ───
function calculateMacros(tdee, weight_kg, goal) {
    let calories, proteinRatio, carbRatio, fatRatio;

    switch (goal) {
        case 'cut':
            calories = Math.round(tdee * 0.80); // 20% deficit
            proteinRatio = 2.2; // g per kg bodyweight
            fatRatio = 0.25;    // 25% of calories from fat
            break;
        case 'bulk':
            calories = Math.round(tdee * 1.15); // 15% surplus
            proteinRatio = 1.8;
            fatRatio = 0.25;
            break;
        case 'stamina':
            calories = Math.round(tdee * 1.05); // 5% surplus
            proteinRatio = 1.6;
            fatRatio = 0.15; // shift 15% fat into carbs
            break;
        case 'maintain':
        default:
            calories = tdee;
            proteinRatio = 1.8;
            fatRatio = 0.25;
            break;
    }

    const protein_g = Math.round(proteinRatio * weight_kg);
    const protein_cal = protein_g * 4;
    const fat_cal = Math.round(calories * fatRatio);
    const fats_g = Math.round(fat_cal / 9);
    const carb_cal = calories - protein_cal - fat_cal;
    const carbs_g = Math.round(carb_cal / 4);
    const water_ml = Math.round(weight_kg * 35); // 35ml per kg

    return {
        calories,
        protein_g,
        carbs_g,
        fats_g,
        water_ml,
        breakdown: {
            protein_pct: Math.round((protein_cal / calories) * 100),
            carbs_pct: Math.round((carb_cal / calories) * 100),
            fats_pct: Math.round((fat_cal / calories) * 100)
        }
    };
}

// ─── 1RM Estimation (Epley Formula) ───
function estimate1RM(weight, reps) {
    if (reps === 1) return weight;
    if (reps === 0 || weight === 0) return 0;
    return Math.round(weight * (1 + reps / 30));
}

// ─── Progressive Overload Check ───
// Compares current session volume to previous session for same exercise
function checkProgressiveOverload(currentVolume, previousVolume) {
    if (!previousVolume || previousVolume === 0) {
        return { status: 'first_session', message: 'First recorded session — keep it up!', change_pct: 0 };
    }
    const change = ((currentVolume - previousVolume) / previousVolume) * 100;
    if (change > 0) {
        return { status: 'progressing', message: `+${change.toFixed(1)}% volume increase 🔥`, change_pct: change };
    } else if (change === 0) {
        return { status: 'maintained', message: 'Same volume — try adding weight or reps next time', change_pct: 0 };
    } else {
        return { status: 'regressed', message: `${change.toFixed(1)}% volume decrease — recovery day?`, change_pct: change };
    }
}

// ─── Plateau Detection ───
// Flags if no increase in weight or reps across last N sessions (default 3)
function detectPlateau(sessionHistory, threshold = 3) {
    if (!sessionHistory || sessionHistory.length < threshold) {
        return { plateau: false, message: 'Not enough data yet', sessions_checked: sessionHistory?.length || 0 };
    }

    const recent = sessionHistory.slice(-threshold);
    const maxWeights = recent.map(s => s.max_weight);
    const totalVolumes = recent.map(s => s.total_volume);

    const weightStagnant = maxWeights.every(w => w <= maxWeights[0]);
    const volumeStagnant = totalVolumes.every(v => v <= totalVolumes[0]);

    if (weightStagnant && volumeStagnant) {
        return {
            plateau: true,
            message: `⚠️ Plateau detected! No progress in last ${threshold} sessions. Consider: deload, change rep range, or swap variation.`,
            sessions_checked: threshold,
            suggestion: getSuggestion(recent)
        };
    }

    return { plateau: false, message: '✅ Still progressing', sessions_checked: threshold };
}

function getSuggestion(sessions) {
    const avgRPE = sessions.reduce((sum, s) => sum + (s.avg_rpe || 7), 0) / sessions.length;
    if (avgRPE >= 9) {
        return 'RPE is very high — consider a deload week (reduce volume by 40%)';
    } else if (avgRPE >= 7) {
        return 'Try adding micro-plates (+1.25kg) or extra rep per set';
    } else {
        return 'RPE is low — you might be holding back. Push harder!';
    }
}

// ─── Endurance / Split Time Calculator ───
function calculateSplitTime(distance_km, duration_minutes) {
    if (!distance_km || !duration_minutes) return null;
    const pace_per_km = duration_minutes / distance_km;
    const pace_min = Math.floor(pace_per_km);
    const pace_sec = Math.round((pace_per_km - pace_min) * 60);
    const speed_kmh = (distance_km / duration_minutes) * 60;

    return {
        pace_per_km: `${pace_min}:${pace_sec.toString().padStart(2, '0')} /km`,
        speed_kmh: Math.round(speed_kmh * 10) / 10,
        estimated_5k: Math.round(pace_per_km * 5),
        estimated_10k: Math.round(pace_per_km * 10),
        calories_estimate: Math.round(duration_minutes * 8.5) // rough MET-based estimate
    };
}

// ─── Diet Plan Generator ───
function generateDietPlan(macros, goal) {
    const { calories, protein_g, carbs_g, fats_g } = macros;

    // Split into 4 meals + 1 snack
    const meals = [
        {
            name: '🌅 Breakfast',
            time: '8:00 AM',
            calories: Math.round(calories * 0.25),
            protein: Math.round(protein_g * 0.25),
            carbs: Math.round(carbs_g * 0.30),
            fats: Math.round(fats_g * 0.25),
            suggestions: getBreakfastSuggestions(goal)
        },
        {
            name: '🥗 Lunch',
            time: '12:30 PM',
            calories: Math.round(calories * 0.30),
            protein: Math.round(protein_g * 0.30),
            carbs: Math.round(carbs_g * 0.25),
            fats: Math.round(fats_g * 0.30),
            suggestions: getLunchSuggestions(goal)
        },
        {
            name: '🏋️ Pre-Workout Snack',
            time: '4:00 PM',
            calories: Math.round(calories * 0.10),
            protein: Math.round(protein_g * 0.10),
            carbs: Math.round(carbs_g * 0.20),
            fats: Math.round(fats_g * 0.05),
            suggestions: ['Banana + Peanut Butter', 'Rice Cakes + Honey', 'Protein Bar', 'Oats + Whey']
        },
        {
            name: '🍛 Dinner',
            time: '7:30 PM',
            calories: Math.round(calories * 0.30),
            protein: Math.round(protein_g * 0.30),
            carbs: Math.round(carbs_g * 0.20),
            fats: Math.round(fats_g * 0.30),
            suggestions: getDinnerSuggestions(goal)
        },
        {
            name: '🌙 Evening Snack',
            time: '9:30 PM',
            calories: Math.round(calories * 0.05),
            protein: Math.round(protein_g * 0.05),
            carbs: Math.round(carbs_g * 0.05),
            fats: Math.round(fats_g * 0.10),
            suggestions: ['Greek Yogurt', 'Casein Shake', 'Cottage Cheese', 'Handful of Almonds']
        }
    ];

    return { meals, daily_totals: macros };
}

function getBreakfastSuggestions(goal) {
    const base = ['Eggs + Toast', 'Oats + Whey Protein', 'Paneer Bhurji + Roti'];
    if (goal === 'bulk') base.push('Banana Smoothie + PB');
    if (goal === 'cut') base.push('Egg Whites + Veggies');
    if (goal === 'stamina') base.push('Poha + Sprouts');
    return base;
}

function getLunchSuggestions(goal) {
    const base = ['Chicken Breast + Rice', 'Dal + Rice + Sabzi', 'Rajma Chawal + Raita'];
    if (goal === 'bulk') base.push('Double portion Rice + Chicken');
    if (goal === 'cut') base.push('Grilled Fish + Salad');
    if (goal === 'stamina') base.push('Pasta + Lean Meat');
    return base;
}

function getDinnerSuggestions(goal) {
    const base = ['Grilled Chicken + Veggies', 'Paneer Tikka + Roti', 'Fish Curry + Rice'];
    if (goal === 'bulk') base.push('Egg Curry + Extra Roti');
    if (goal === 'cut') base.push('Soup + Salad + Tofu');
    if (goal === 'stamina') base.push('Khichdi + Curd');
    return base;
}

module.exports = {
    calculateBMR,
    calculateTDEE,
    calculateMacros,
    estimate1RM,
    checkProgressiveOverload,
    detectPlateau,
    calculateSplitTime,
    generateDietPlan,
    ACTIVITY_MULTIPLIERS
};
