# 🏛️ Civitas — Where Citizens Are Made

> A gamified Social Studies learning platform built by a classroom teacher for real students.

**Civitas** is a full-stack educational platform covering middle school through AP-level Social Studies courses. Students earn trophies, gold, and historical figure characters by completing unit games, vocabulary quizzes, flashcard decks, and AI-graded FRQ challenges — all without ever leaving the browser.

---

## 🎓 What It Is

Civitas is not a quiz app with a coat of paint. It is a complete learning management system built around the idea that **students engage more deeply when the work feels like a game worth playing.**

Each course in the suite includes:
- **Unit games** — multiple-choice content mastery challenges with scoring and trophy tiers
- **Briefings** — teacher-authored study guides for each unit
- **Flashcard decks** — vocabulary study with spaced repetition
- **Vocab quizzes** — graded checks with gold rewards
- **FRQ practice** — AI-graded free-response questions scored against official AP rubrics
- **Leaderboards** — per-class rankings updated in real time
- **Certificates** — printable achievement records for students and teachers

---

## 📚 Courses

### Middle School
| Course | Grade | Status |
|--------|-------|--------|
| World Geography | 6th | 🔜 Coming Soon |
| World History: Ancient–Medieval | 7th | 🔜 Coming Soon |
| U.S. History: To Reconstruction | 8th | 🔜 Coming Soon |

### High School Standard
| Course | Grade | Status |
|--------|-------|--------|
| World History: Modern | 9th | 🔜 Coming Soon |
| U.S. History | 10th | ✅ Live (American Chronicles) |
| American Government | 11th | 🔜 Coming Soon |
| Economics | 12th | 🔜 Coming Soon |

### AP Courses
| Course | Status |
|--------|--------|
| AP U.S. History | 🔜 Coming Soon |
| AP U.S. Government & Politics | 🚧 In Development |
| AP Comparative Government | 🔜 Coming Soon |
| AP World History | 🔜 Coming Soon |
| AP Human Geography | 🔜 Coming Soon |
| AP Economics | 🔜 Coming Soon |
| AP Research | 🔜 Coming Soon |

---

## ✨ Key Features

### 🤖 AI-Graded FRQs
AP courses include free-response practice graded in real time by Claude (Anthropic). Students receive point-by-point feedback scored against official College Board rubrics — instantly, without teacher intervention. Students can resubmit as many times as they want to improve their score.

### 🏆 Trophy System
Every unit awards a trophy tier based on accuracy:
- 🏛️ **Historian** — 100%
- 🥇 **Gold** — 90–99%
- 🥈 **Silver** — 80–89%
- 🥉 **Bronze** — 70–79%
- ✅ **Completed** — 60–69%

### 🎭 Historical Figure Characters
Students unlock historical figures relevant to their courses — James Madison and RBG for AP Gov, Lincoln and Harriet Tubman for U.S. History, Adam Smith and Keynes for Economics. Characters carry across all courses and years.

### 🪙 Gold Economy
Students earn gold by answering correctly, passing vocab checks, and completing units. Gold persists across all courses and school years, building a multi-year academic record.

### 📊 Teacher Dashboard
- Real-time class results by period
- FRQ scores with AI feedback visible to teacher
- Time-on-task tracking (minutes per session)
- One-click CSV export for research and gradebook integration

### 👤 Persistent Multi-Course Profiles
One login. Multiple courses. Progress, gold, and characters carry year over year. A student who takes U.S. History as a sophomore and AP Gov as a junior keeps the same profile.

---

## 🗂️ Repository Structure

```
civitas/
├── index.html              ← Platform shell (all courses, login, dashboard)
├── games/
│   ├── us-history/         ← U.S. History unit games
│   ├── ap-gov/             ← AP Gov unit games
│   ├── ap-comparative/     ← AP Comparative Gov unit games
│   ├── ap-research/        ← AP Research tools
│   └── flashcards/         ← Shared flashcard engine (all courses)
├── briefings/
│   ├── us-history/         ← U.S. History study guides
│   └── ap-gov/             ← AP Gov study guides
└── assets/                 ← Shared images and resources
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS — no framework, no build step |
| Hosting | GitHub Pages (free, instant deploy) |
| Database | Supabase (PostgreSQL) |
| AI Grading | Anthropic Claude API |
| Auth | Supabase + name-based profile sync |

No installation required. No server to maintain. Runs entirely in the browser.

---

## 📈 Research

Civitas is being used as a longitudinal research instrument to study the effect of gamified curriculum on standardized test performance.

**Research questions:**
- Does time-on-task (measured via session tracking) correlate with EOC/AP exam scores?
- Do students who complete more unit games score higher on standardized assessments than the district and state averages?
- Does AI-graded FRQ feedback improve student writing performance across multiple submissions?

Data collected: units completed, accuracy per unit, vocab quiz scores, FRQ scores and revision history, session duration, gold earned (proxy for engagement depth).

**Data collection:** 2025–2026 school year  
**Expected publication:** Summer 2026

---

## 👨‍🏫 About

Built by **Joshua Olson**, U.S. History and AP Government teacher at Brevard County Public Schools, Florida.

- 10th Grade U.S. History (Florida EOC aligned)
- AP U.S. Government & Politics
- AP Comparative Government & Politics
- AP Research

> *"I built this because my students needed something worth showing up for."*

---

## 📄 License

© 2026 Joshua Olson. All rights reserved.

This project is publicly viewable for educational and research purposes. The codebase, content, question banks, and game designs may not be copied, redistributed, or used commercially without written permission.

---

## 📬 Contact

For research inquiries, licensing, or partnership discussions:  
**Joshua Olson** — Brevard County Public Schools, Florida
