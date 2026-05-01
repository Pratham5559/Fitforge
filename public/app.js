/**
 * FITFORGE — Main Application JavaScript
 * Complete SPA with all screens & interactions
 */

const API = '';

// ═══ STATE ═══
let state = {
    user: null,
    currentScreen: 'dashboard',
    activeSession: null,
    workoutTimer: null,
    workoutSeconds: 0,
    restTimer: null,
    restSeconds: 90,
    exercises: [],
    charts: {}
};

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', async () => {
    // Splash screen
    setTimeout(() => {
        document.getElementById('splash').classList.add('fade-out');
        document.getElementById('app').classList.remove('hidden');
        setTimeout(() => document.getElementById('splash').remove(), 500);
    }, 1800);

    await loadExercises();
    await loadDashboard();
    setupNavigation();
    setupEventListeners();
    setGreeting();
});

// ═══ API HELPERS ═══
async function api(endpoint, options = {}) {
    try {
        const res = await fetch(`${API}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        return await res.json();
    } catch (err) {
        console.error('API Error:', err);
        showToast('Connection error');
        return null;
    }
}

// ═══ NAVIGATION ═══
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const screen = btn.dataset.screen;
            if (screen === 'workout') {
                if (!state.activeSession) {
                    startNewWorkout();
                }
                switchScreen('workout');
            } else {
                switchScreen(screen);
            }
        });
    });
    document.getElementById('btn-profile').addEventListener('click', () => switchScreen('profile'));
}

function switchScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.screen === name);
    });
    state.currentScreen = name;

    // Load data when switching
    if (name === 'dashboard') loadDashboard();
    if (name === 'nutrition') loadNutrition();
    if (name === 'charts') loadCharts();
    if (name === 'diet') loadDietPlan();
    if (name === 'profile') loadProfile();
}

// ═══ GREETING ═══
function setGreeting() {
    const h = new Date().getHours();
    let g = 'Good Evening';
    if (h < 12) g = 'Good Morning';
    else if (h < 17) g = 'Good Afternoon';
    const name = state.user?.name || 'Champ';
    document.getElementById('greeting-text').textContent = `${g}, ${name} 💪`;
    document.getElementById('greeting-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ═══ DASHBOARD ═══
async function loadDashboard() {
    const data = await api('/api/analytics/dashboard');
    if (!data) return;
    state.user = data.user;

    document.getElementById('stat-week-workouts').textContent = data.weekWorkouts;
    document.getElementById('stat-week-volume').textContent = formatNumber(data.weekVolume);
    document.getElementById('stat-streak').textContent = data.streak;
    document.getElementById('stat-body-weight').textContent = data.user.weight_kg;
    document.getElementById('streak-badge').textContent = `🔥 ${data.streak}`;

    // Nutrition progress
    const n = data.todayNutrition;
    const t = data.targets;
    document.getElementById('protein-numbers').textContent = `${Math.round(n.total_protein)} / ${t.protein_g}g`;
    document.getElementById('protein-bar').style.width = `${Math.min(100, (n.total_protein / t.protein_g) * 100)}%`;
    document.getElementById('cal-progress').textContent = `${Math.round(n.total_calories)} / ${t.calories}`;
    document.getElementById('carb-progress').textContent = `${Math.round(n.total_carbs)} / ${t.carbs_g}g`;
    document.getElementById('fat-progress').textContent = `${Math.round(n.total_fats)} / ${t.fats_g}g`;
    document.getElementById('water-progress').textContent = `${Math.round(n.total_water)} / ${t.water_ml} ml`;
    document.getElementById('water-bar').style.width = `${Math.min(100, (n.total_water / t.water_ml) * 100)}%`;

    // PRs
    const prList = document.getElementById('pr-list');
    if (data.prs && data.prs.length > 0) {
        prList.innerHTML = data.prs.map(pr => `
            <div class="pr-item">
                <span class="pr-name">${pr.name}</span>
                <span class="pr-value">${pr.max_weight} kg</span>
            </div>
        `).join('');
    }

    setGreeting();
}

// ═══ EXERCISES ═══
async function loadExercises() {
    state.exercises = await api('/api/exercises') || [];
    populateExerciseSelects();
}

function populateExerciseSelects() {
    const selects = ['exercise-select', 'chart-exercise-select'];
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        // Group by category
        const categories = {};
        state.exercises.forEach(e => {
            if (!categories[e.category]) categories[e.category] = [];
            categories[e.category].push(e);
        });
        sel.innerHTML = '<option value="">Select Exercise...</option>';
        Object.entries(categories).forEach(([cat, exercises]) => {
            const group = document.createElement('optgroup');
            group.label = cat.charAt(0).toUpperCase() + cat.slice(1);
            exercises.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = e.name;
                group.appendChild(opt);
            });
            sel.appendChild(group);
        });
        sel.value = current;
    });
}

// ═══ WORKOUT SESSION ═══
async function startNewWorkout() {
    const data = await api('/api/workouts', { method: 'POST', body: { session_name: 'Workout' } });
    if (!data) return;
    state.activeSession = data;
    state.workoutSeconds = 0;
    document.getElementById('workout-name').value = data.session_name;
    document.getElementById('workout-exercises').innerHTML = '<div class="empty-workout-state"><p>Select an exercise above to start logging sets</p></div>';
    startWorkoutTimer();
}

function startWorkoutTimer() {
    if (state.workoutTimer) clearInterval(state.workoutTimer);
    state.workoutTimer = setInterval(() => {
        state.workoutSeconds++;
        const m = Math.floor(state.workoutSeconds / 60).toString().padStart(2, '0');
        const s = (state.workoutSeconds % 60).toString().padStart(2, '0');
        document.getElementById('workout-timer').textContent = `${m}:${s}`;
    }, 1000);
}

function addExerciseToWorkout() {
    const select = document.getElementById('exercise-select');
    const exerciseId = parseInt(select.value);
    if (!exerciseId || !state.activeSession) return;

    const exercise = state.exercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    const container = document.getElementById('workout-exercises');
    if (container.querySelector('.empty-workout-state')) container.innerHTML = '';

    // Check if exercise already added
    if (container.querySelector(`[data-exercise-id="${exerciseId}"]`)) {
        showToast('Exercise already added');
        return;
    }

    const block = document.createElement('div');
    block.className = 'exercise-block';
    block.dataset.exerciseId = exerciseId;
    block.innerHTML = `
        <div class="exercise-block-header">
            <span class="exercise-block-name">${exercise.name}</span>
            <span class="overload-badge" id="overload-${exerciseId}"></span>
        </div>
        <table class="sets-table">
            <thead><tr><th>Set</th><th>Kg</th><th>Reps</th><th>RPE</th><th></th><th></th></tr></thead>
            <tbody id="sets-body-${exerciseId}"></tbody>
        </table>
        <button class="btn-add-set" onclick="addSetRow(${exerciseId})">+ Add Set</button>
    `;
    container.appendChild(block);
    addSetRow(exerciseId);
    select.value = '';
}

let setCounters = {};
function addSetRow(exerciseId) {
    if (!setCounters[exerciseId]) setCounters[exerciseId] = 0;
    setCounters[exerciseId]++;
    const setNum = setCounters[exerciseId];
    const tbody = document.getElementById(`sets-body-${exerciseId}`);
    const tr = document.createElement('tr');
    tr.id = `set-row-${exerciseId}-${setNum}`;
    tr.innerHTML = `
        <td class="set-num">${setNum}</td>
        <td><input class="set-input" type="number" id="weight-${exerciseId}-${setNum}" placeholder="0" inputmode="decimal"></td>
        <td><input class="set-input" type="number" id="reps-${exerciseId}-${setNum}" placeholder="0" inputmode="numeric"></td>
        <td><input class="set-input" type="number" id="rpe-${exerciseId}-${setNum}" placeholder="7" min="1" max="10" inputmode="numeric"></td>
        <td><button class="btn-save-set" onclick="saveSet(${exerciseId}, ${setNum})">✓</button></td>
        <td><button class="btn-delete-set" onclick="deleteSetRow(${exerciseId}, ${setNum})">×</button></td>
    `;
    tbody.appendChild(tr);
}

async function saveSet(exerciseId, setNum) {
    const weight = parseFloat(document.getElementById(`weight-${exerciseId}-${setNum}`).value) || 0;
    const reps = parseInt(document.getElementById(`reps-${exerciseId}-${setNum}`).value) || 0;
    const rpe = parseFloat(document.getElementById(`rpe-${exerciseId}-${setNum}`).value) || null;

    if (weight === 0 && reps === 0) { showToast('Enter weight and reps'); return; }

    const data = await api(`/api/workouts/${state.activeSession.id}/sets`, {
        method: 'POST',
        body: { exercise_id: exerciseId, set_number: setNum, weight_kg: weight, reps, rpe }
    });

    if (!data) return;

    // Mark as saved
    const btn = document.querySelector(`#set-row-${exerciseId}-${setNum} .btn-save-set`);
    btn.innerHTML = '<span class="saved-indicator">✓</span>';
    btn.disabled = true;

    // Show overload badge
    if (data.overload) {
        const badge = document.getElementById(`overload-${exerciseId}`);
        badge.textContent = data.overload.message;
        badge.className = `overload-badge ${data.overload.status}`;
    }

    showToast(`Set ${setNum} saved!`);
    showRestTimer();
}

function deleteSetRow(exerciseId, setNum) {
    const row = document.getElementById(`set-row-${exerciseId}-${setNum}`);
    if (row) row.remove();
}

async function finishWorkout() {
    if (!state.activeSession) return;
    if (state.workoutTimer) clearInterval(state.workoutTimer);
    state.workoutTimer = null;

    showToast(`Workout complete! ${Math.floor(state.workoutSeconds / 60)} min`);
    state.activeSession = null;
    state.workoutSeconds = 0;
    setCounters = {};
    switchScreen('dashboard');
}

function cancelWorkout() {
    if (!state.activeSession) { switchScreen('dashboard'); return; }
    if (confirm('Discard this workout?')) {
        if (state.workoutTimer) clearInterval(state.workoutTimer);
        state.workoutTimer = null;
        api(`/api/workouts/${state.activeSession.id}`, { method: 'DELETE' });
        state.activeSession = null;
        state.workoutSeconds = 0;
        setCounters = {};
        switchScreen('dashboard');
    }
}

// ═══ REST TIMER ═══
function showRestTimer() {
    const el = document.getElementById('rest-timer');
    el.classList.remove('hidden');
    state.restSeconds = 90;
    updateRestDisplay();

    if (state.restTimer) clearInterval(state.restTimer);
    state.restTimer = setInterval(() => {
        state.restSeconds--;
        updateRestDisplay();
        if (state.restSeconds <= 0) {
            hideRestTimer();
            showToast('Rest over — go again! 💪');
        }
    }, 1000);
}

function updateRestDisplay() {
    document.getElementById('rest-countdown').textContent = state.restSeconds;
}

function hideRestTimer() {
    if (state.restTimer) clearInterval(state.restTimer);
    state.restTimer = null;
    document.getElementById('rest-timer').classList.add('hidden');
}

// ═══ NUTRITION ═══
async function loadNutrition() {
    const data = await api('/api/nutrition/today');
    if (!data) return;

    const s = data.summary;
    const t = data.targets;

    // Draw rings
    drawRing('ring-calories', s.total_calories, t.calories, '#fdcb6e');
    drawRing('ring-protein', s.total_protein, t.protein_g, '#00cec9');
    drawRing('ring-carbs', s.total_carbs, t.carbs_g, '#6c5ce7');
    drawRing('ring-fats', s.total_fats, t.fats_g, '#fd79a8');

    document.getElementById('ring-cal-text').textContent = Math.round(s.total_calories);
    document.getElementById('ring-pro-text').textContent = `${Math.round(s.total_protein)}g`;
    document.getElementById('ring-carb-text').textContent = `${Math.round(s.total_carbs)}g`;
    document.getElementById('ring-fat-text').textContent = `${Math.round(s.total_fats)}g`;

    // Meals list
    const container = document.getElementById('meals-container');
    if (data.meals.length > 0) {
        container.innerHTML = data.meals.map(m => `
            <div class="meal-item">
                <div class="meal-item-info">
                    <h4>${m.meal_name}</h4>
                    <span>P: ${m.protein_g}g · C: ${m.carbs_g}g · F: ${m.fats_g}g</span>
                </div>
                <div class="meal-item-right">
                    <span class="meal-item-cal">${m.calories} cal</span>
                    <button class="btn-delete-meal" onclick="deleteMeal(${m.id})">×</button>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="empty-state">No meals logged today</p>';
    }
}

async function saveMeal() {
    const meal = {
        meal_name: document.getElementById('meal-name').value || 'Meal',
        calories: parseFloat(document.getElementById('meal-calories').value) || 0,
        protein_g: parseFloat(document.getElementById('meal-protein').value) || 0,
        carbs_g: parseFloat(document.getElementById('meal-carbs').value) || 0,
        fats_g: parseFloat(document.getElementById('meal-fats').value) || 0,
        water_ml: parseFloat(document.getElementById('meal-water').value) || 0
    };
    await api('/api/nutrition', { method: 'POST', body: meal });
    showToast('Meal logged!');
    // Clear form
    ['meal-name', 'meal-calories', 'meal-protein', 'meal-carbs', 'meal-fats', 'meal-water'].forEach(id => document.getElementById(id).value = '');
    loadNutrition();
    loadDashboard();
}

async function deleteMeal(id) {
    await api(`/api/nutrition/${id}`, { method: 'DELETE' });
    loadNutrition();
    loadDashboard();
}

// ═══ RING DRAWING ═══
function drawRing(canvasId, current, target, color) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - 8;
    const pct = Math.min(1, current / (target || 1));

    ctx.clearRect(0, 0, size, size);
    // Background ring
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#2a2a3d';
    ctx.lineWidth = 6;
    ctx.stroke();
    // Progress ring
    ctx.beginPath();
    ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();
}

// ═══ CHARTS ═══
async function loadCharts() {
    const exerciseId = document.getElementById('chart-exercise-select').value || 1;

    // Exercise analytics
    const analytics = await api(`/api/analytics/exercise/${exerciseId}`);
    if (analytics) {
        // Plateau alert
        const alert = document.getElementById('plateau-alert');
        if (analytics.plateau.plateau) {
            alert.classList.remove('hidden');
            document.getElementById('plateau-message').textContent = analytics.plateau.message;
        } else {
            alert.classList.add('hidden');
        }

        // Volume chart
        if (analytics.history.length > 0) {
            renderChart('chart-volume', {
                type: 'bar',
                data: {
                    labels: analytics.history.map(h => formatDate(h.session_date)),
                    datasets: [{
                        label: 'Total Volume (kg)',
                        data: analytics.history.map(h => h.total_volume),
                        backgroundColor: 'rgba(108, 92, 231, 0.6)',
                        borderColor: '#6c5ce7',
                        borderWidth: 1,
                        borderRadius: 6
                    }]
                }
            });
        }
    }

    // Weight vs Strength
    const wsData = await api(`/api/analytics/weight-vs-strength?exercise_id=${exerciseId}`);
    if (wsData && (wsData.weightHistory.length > 0 || wsData.oneRMHistory.length > 0)) {
        const allDates = [...new Set([
            ...wsData.weightHistory.map(w => w.date),
            ...wsData.oneRMHistory.map(s => s.date)
        ])].sort();

        renderChart('chart-weight-strength', {
            type: 'line',
            data: {
                labels: allDates.map(d => formatDate(d)),
                datasets: [
                    {
                        label: 'Body Weight (kg)',
                        data: allDates.map(d => { const e = wsData.weightHistory.find(w => w.date === d); return e ? e.weight_kg : null; }),
                        borderColor: '#74b9ff', backgroundColor: 'rgba(116, 185, 255, 0.1)',
                        tension: 0.4, fill: true, spanGaps: true
                    },
                    {
                        label: 'Est. 1RM (kg)',
                        data: allDates.map(d => { const e = wsData.oneRMHistory.find(s => s.date === d); return e ? e.estimated_1rm : null; }),
                        borderColor: '#00cec9', backgroundColor: 'rgba(0, 206, 201, 0.1)',
                        tension: 0.4, fill: true, spanGaps: true
                    }
                ]
            }
        });
    }

    // Nutrition history
    const nutHistory = await api('/api/nutrition/history?days=30');
    if (nutHistory && nutHistory.length > 0) {
        renderChart('chart-nutrition', {
            type: 'line',
            data: {
                labels: nutHistory.map(n => formatDate(n.log_date)),
                datasets: [
                    { label: 'Calories', data: nutHistory.map(n => n.total_calories), borderColor: '#fdcb6e', tension: 0.3, yAxisID: 'y' },
                    { label: 'Protein (g)', data: nutHistory.map(n => n.total_protein), borderColor: '#00cec9', tension: 0.3, yAxisID: 'y1' }
                ]
            },
            options: {
                scales: {
                    y: { position: 'left', ticks: { color: '#888' }, grid: { color: '#222' } },
                    y1: { position: 'right', ticks: { color: '#888' }, grid: { display: false } }
                }
            }
        });
    }
}

function renderChart(canvasId, config) {
    if (state.charts[canvasId]) state.charts[canvasId].destroy();
    const ctx = document.getElementById(canvasId).getContext('2d');
    const defaults = {
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#888', font: { size: 11 } } } },
            scales: {
                x: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: '#1a1a26' } },
                y: { ticks: { color: '#555' }, grid: { color: '#1a1a26' } }
            }
        }
    };
    const merged = { ...defaults, ...config, options: { ...defaults.options, ...(config.options || {}), scales: { ...defaults.options.scales, ...(config.options?.scales || {}) } } };
    state.charts[canvasId] = new Chart(ctx, merged);
}

// ═══ DIET PLAN ═══
async function loadDietPlan() {
    const data = await api('/api/diet-plan');
    if (!data) return;

    document.getElementById('diet-bmr').textContent = Math.round(data.bmr);
    document.getElementById('diet-tdee').textContent = data.tdee;
    document.getElementById('diet-target').textContent = data.daily_totals.calories;
    document.getElementById('diet-goal').textContent = data.user_goal.charAt(0).toUpperCase() + data.user_goal.slice(1);

    const container = document.getElementById('diet-meals');
    container.innerHTML = data.meals.map(meal => `
        <div class="diet-meal-card">
            <div class="diet-meal-header">
                <span class="diet-meal-name">${meal.name}</span>
                <span class="diet-meal-time">${meal.time}</span>
            </div>
            <div class="diet-meal-macros">
                <span class="diet-macro-tag" style="color:var(--orange)">${meal.calories} cal</span>
                <span class="diet-macro-tag" style="color:var(--green)">P: ${meal.protein}g</span>
                <span class="diet-macro-tag" style="color:var(--accent)">C: ${meal.carbs}g</span>
                <span class="diet-macro-tag" style="color:var(--pink)">F: ${meal.fats}g</span>
            </div>
            <div class="diet-suggestions">
                ${meal.suggestions.map(s => `<div class="diet-suggestion">${s}</div>`).join('')}
            </div>
        </div>
    `).join('');
}

// ═══ PROFILE ═══
async function loadProfile() {
    const data = await api('/api/user');
    if (!data) return;
    state.user = data;
    document.getElementById('profile-name').value = data.name;
    document.getElementById('profile-height').value = data.height_cm;
    document.getElementById('profile-weight').value = data.weight_kg;
    document.getElementById('profile-age').value = data.age;
    document.getElementById('profile-gender').value = data.gender;
    document.getElementById('profile-activity').value = data.activity_level;
    document.getElementById('profile-goal').value = data.goal;

    document.getElementById('computed-bmr').textContent = `${Math.round(data.bmr)} cal`;
    document.getElementById('computed-tdee').textContent = `${data.tdee} cal`;
    document.getElementById('computed-cal').textContent = `${data.macros.calories} cal`;
    document.getElementById('computed-protein').textContent = `${data.macros.protein_g}g`;
    document.getElementById('computed-carbs').textContent = `${data.macros.carbs_g}g`;
    document.getElementById('computed-fats').textContent = `${data.macros.fats_g}g`;
}

async function saveProfile() {
    const body = {
        name: document.getElementById('profile-name').value,
        height_cm: parseFloat(document.getElementById('profile-height').value),
        weight_kg: parseFloat(document.getElementById('profile-weight').value),
        age: parseInt(document.getElementById('profile-age').value),
        gender: document.getElementById('profile-gender').value,
        activity_level: document.getElementById('profile-activity').value,
        goal: document.getElementById('profile-goal').value
    };
    await api('/api/user', { method: 'PUT', body });
    showToast('Profile updated!');
    loadProfile();
    loadDashboard();
}

// ═══ WEIGHT MODAL ═══
function showWeightModal() {
    document.getElementById('modal-weight').classList.remove('hidden');
    document.getElementById('modal-weight-input').value = state.user?.weight_kg || '';
    document.getElementById('modal-weight-input').focus();
}

async function saveWeight() {
    const weight = parseFloat(document.getElementById('modal-weight-input').value);
    if (!weight) return;
    await api('/api/user/weight', { method: 'POST', body: { weight_kg: weight } });
    document.getElementById('modal-weight').classList.add('hidden');
    showToast(`Weight logged: ${weight} kg`);
    loadDashboard();
}

// ═══ EVENT LISTENERS ═══
function setupEventListeners() {
    document.getElementById('btn-start-workout').addEventListener('click', () => {
        if (!state.activeSession) startNewWorkout();
        switchScreen('workout');
    });
    document.getElementById('btn-log-meal').addEventListener('click', () => switchScreen('nutrition'));
    document.getElementById('btn-log-weight').addEventListener('click', showWeightModal);
    document.getElementById('btn-add-exercise').addEventListener('click', addExerciseToWorkout);
    document.getElementById('btn-finish-workout').addEventListener('click', finishWorkout);
    document.getElementById('btn-end-workout').addEventListener('click', cancelWorkout);
    document.getElementById('btn-save-meal').addEventListener('click', saveMeal);
    document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
    document.getElementById('btn-skip-rest').addEventListener('click', hideRestTimer);
    document.getElementById('modal-weight-save').addEventListener('click', saveWeight);
    document.getElementById('modal-weight-cancel').addEventListener('click', () => document.getElementById('modal-weight').classList.add('hidden'));
    document.querySelector('.modal-backdrop')?.addEventListener('click', () => document.getElementById('modal-weight').classList.add('hidden'));
    document.getElementById('chart-exercise-select').addEventListener('change', loadCharts);

    // Rest timer buttons
    document.querySelectorAll('.rest-btn[data-time]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rest-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.restSeconds = parseInt(btn.dataset.time);
            updateRestDisplay();
        });
    });
}

// ═══ UTILS ═══
function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function formatNumber(n) {
    if (!n) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return Math.round(n).toString();
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}
