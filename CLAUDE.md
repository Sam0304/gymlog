# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Gymlog is a German-language workout-tracking PWA for the user's iPhone: plain HTML/CSS/ES-module JavaScript, **no build step, no dependencies, no tests or linter**. It is published as-is via GitHub Pages at https://sam0304.github.io/gymlog/ (repo `Sam0304/gymlog`, branch `main`, root). All user data lives on the device in IndexedDB; nothing is uploaded.

## Commands

```bash
python -m http.server 8080   # serve locally; ES modules and the service worker need http, not file://
```

`.claude/launch.json` defines this as the `gymlog` preview server. Verify changes in the browser pane at mobile size (375×812), in light and dark mode, using real clicks. Seed test data with `demo-`-prefixed IDs and remove it afterwards. Don't overwrite an active workout or plans the user created in the preview.

**Releasing an update:**
1. Bump `APP_VERSION` and add the notes in `js/version.js`. Users see a one-time "Neue Version" sheet.
2. Bump `VERSION` in `sw.js`.
3. Add any **new file** to the `FILES` list in `sw.js`, or it won't work offline.
4. Commit, then push via the user's Terminal panel (`run_in_terminal`, `git push`). Pushing from the Bash/PowerShell tool fails because Git Credential Manager needs an interactive prompt.

The repo-local git email is the GitHub noreply address. Keep it that way: the repo is public.

## Architecture

**Routing:** `js/app.js` is a hash router. `#<view>/<param>` maps to a module in `js/views/`. Each view module exports:
- `title`
- optional `tab`, which says which tab-bar item to highlight
- `render(el, param)`. If it returns a function, the router calls it as cleanup when leaving the view (timers, overlays).

`#view` persists across navigations. A view that attaches listeners to `el` itself must first create and append its own child root (see `plan.js` `renderEditor`, `coach.js`, `hiit.js`), otherwise listeners stack on every visit.

**Data layer:**
- `js/db.js` wraps IndexedDB with these stores:
  - `exercises`: custom exercises only; built-ins are the `BUILTIN` array in `js/exercises.js`
  - `workouts`, `plans`, `bodyweight`
  - `settings`: key/value. Keys include `activeWorkout`, `activePlan`, `coachProfile`, `favorites`, `weeklyGoal`, `hiit`, `lastBackup`, `seenVersion`.
- Every store is created in DB version 1. Adding a store requires bumping `VERSION` in `db.js`.
- `js/backup.js` exports and imports **all** stores plus settings.

**Workout model** (`js/workouts.js`): `{ id, name, start, end, planId?, dayId?, exercises: [{ exId, target?, sets: [{ w?, r?, s?, min?, km? }] }] }`.
- Which set fields apply depends on the exercise's `log` type: `kg` (weight × reps), `bw` (bodyweight reps with optional extra weight), `time` (seconds), `cardio` (min/km).
- The running workout is stored in `settings.activeWorkout` and saved on every input.
- `finishWorkout()` keeps only checked (`done`) sets and **must keep `target`**: the coach's progression advice depends on it.

**Domain logic modules (pure functions):**
- `progress.js`: per-session metrics, streak, sets per muscle, time ranges.
- `coach-rules.js`:
  - `buildPlan(profile)`: built from `templates.js`, then adjusted in order: equipment swap → dedupe → goal/level/focus sets and reps → cap to session length → cardio.
  - `progressionAdvice` / `weightAdvice`: double progression with step size by equipment.
  - plateau detection, rest seconds by goal.
- `plans.js`: plan days rotate via the `planId`/`dayId` stored on saved workouts.

If you change the catalog or the swap tables, re-check that every template and swap target ID exists in `BUILTIN`.

**Records and progress** compare only "more weight, or same/heavier weight with more reps" (`recordType`, `plateau`). The muscle group `Dehnen` (stretching) and `Cardio` are excluded from records, progression advice and the muscle-volume bars (`NON_STRENGTH`).

**UI helpers** (`js/ui.js`):
- `openSheet`, `ask`, `promptText`, `toast`, `esc`. Use `ask`/`promptText` instead of `confirm()`/`prompt()`: those are blocked in the preview and unreliable in iOS PWAs.
- Always pass user-entered text through `esc()`.
- Colors are CSS tokens on `:root` in `css/styles.css`, with dark-mode overrides.

**iOS specifics:**
- The backup is prepared before the tap, because `navigator.share` needs fresh user activation.
- `beep.js` must be unlocked inside a tap.
- The HIIT timer uses timestamps plus a Wake Lock, so it catches up after the screen locks.
- The service worker is network-first with a 2.5 s timeout, falling back to the cache.

## Working with this user

- The UI and all user-facing text are German; write the code comments in German too.
- The user doesn't write code. Implement everything yourself; don't leave `TODO(human)` tasks.
- After each feature, check in on design and extra features before moving on.
- Don't show formula-based estimates such as an estimated 1RM. The user rejected those in favor of real values.
