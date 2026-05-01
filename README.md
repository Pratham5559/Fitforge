# 🏋️ FitForge — Personal Fitness Tracker

A full-stack, mobile-first fitness tracker built for the gym. Track workouts, log nutrition, detect plateaus, and get smart diet plans — all from your phone's browser.

![Node.js](https://img.shields.io/badge/Node.js-25+-339933?logo=nodedotjs&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-4-FF6384?logo=chartdotjs&logoColor=white)

---

## ✨ Features

### 🏋️ Workout Logger
- Log sets with weight, reps, and RPE
- **Progressive overload detection** — compares your volume to your last session
- **Plateau alert** — flags if you haven't improved in 3 sessions with RPE-based suggestions
- **Visual rest timer** (60s / 90s / 2m / 3m) pops up after saving each set
- Live workout duration timer

### 🍽️ Nutrition Tracker
- Log meals with calories, protein, carbs, fats, and water
- Animated progress rings for each macro
- Protein progress bar on the dashboard
- Daily water intake tracking

### 📊 Smart Analytics
- **Body Weight vs Estimated 1RM** chart (Epley formula)
- **Volume progression** per exercise over time
- **30-day nutrition history** (calories & protein)
- Powered by Chart.js

### 🥗 Diet Plan Generator
- Auto-calculates BMR (Mifflin-St Jeor) and TDEE
- 4 goal modes: **Cut**, **Maintain**, **Bulk**, **Stamina**
- Generates a 5-meal daily plan with macro split
- Indian food suggestions (Paneer Bhurji, Dal Rice, Rajma Chawal, etc.)
- Stamina mode auto-shifts 15% fat calories → carbs

### 🏆 Dashboard
- Weekly workout count & total volume
- Day streak tracker
- Personal records (top 5 lifts)
- Quick actions: Start Workout, Log Meal, Log Weight

---

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/FITNESSTRACKER.git
cd FITNESSTRACKER

# Install dependencies
npm install

# Start the server
npm start

# Open in browser
open http://localhost:3000
```

The SQLite database is auto-created on first run with 36 pre-seeded exercises.

---

## 📁 Project Structure

```
FITNESSTRACKER/
├── server.js              # Express 5 API server (14+ endpoints)
├── package.json
├── database/
│   ├── schema.sql         # SQL schema + seed data (7 tables, 2 views)
│   ├── db.js              # SQLite connection module
│   └── fitness.db         # Auto-created on first run
├── engine/
│   └── fitness.js         # Logic engine (BMR, TDEE, plateau, 1RM, diet)
└── public/
    ├── index.html         # SPA (6 screens)
    ├── style.css          # Premium dark-mode mobile-first CSS
    └── app.js             # Frontend JavaScript
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/user` | GET / PUT | Profile + computed BMR, TDEE, macros |
| `/api/user/weight` | POST | Log daily weight |
| `/api/user/weight-history` | GET | Weight trend data |
| `/api/exercises` | GET / POST | Exercise library (36 built-in) |
| `/api/workouts` | GET / POST | Workout sessions |
| `/api/workouts/:id/sets` | POST | Log set + progressive overload check |
| `/api/workouts/:id/cardio` | POST | Cardio with split time calc |
| `/api/nutrition/today` | GET | Today's intake vs macro targets |
| `/api/nutrition` | POST / DELETE | Log or delete meals |
| `/api/nutrition/history` | GET | 30-day nutrition history |
| `/api/analytics/dashboard` | GET | Stats, streak, PRs |
| `/api/analytics/exercise/:id` | GET | Volume history + plateau detection |
| `/api/analytics/weight-vs-strength` | GET | Body weight vs 1RM data |
| `/api/diet-plan` | GET | Full meal plan based on TDEE & goal |

---

## 🧠 Logic Engine

| Formula | Usage |
|---|---|
| **Mifflin-St Jeor** | BMR = 10×weight + 6.25×height − 5×age + 5 (male) |
| **TDEE** | BMR × activity multiplier (1.2 – 1.9) |
| **Epley 1RM** | weight × (1 + reps/30) |
| **Progressive Overload** | Compares session volume to previous session |
| **Plateau Detection** | Flags 3+ sessions with no weight/volume increase |
| **Macro Calculator** | Goal-based protein/carb/fat split |

---

## 🛠️ Tech Stack

- **Backend**: Node.js + Express 5
- **Database**: SQLite (via better-sqlite3)
- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Charts**: Chart.js 4
- **Design**: Mobile-first, dark theme, Inter font

---

## 📱 Designed for the Gym

- Large, tap-friendly buttons
- Dark theme (easy on eyes under gym lights)
- Rest timer pops up automatically after each set
- Works in any mobile browser — no app install needed

---

## 📄 License

MIT — built for personal use, feel free to fork and customize.
