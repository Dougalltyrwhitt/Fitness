# Pre-Season Tracker

A structured strength/running program for an extended rugby union pre-season (wing/centre), plus a small static website to log and track progress against it.

## The program, in brief

Built around a 7–5 workday, Touch on Wednesday night, and Netball on Thursday night.

| Day | Sessions |
|---|---|
| Monday | Gym — Lower Body / Athletic Power |
| Tuesday | Lunch Run (quick) + Gym — Upper Push |
| Wednesday | Mobility (day) + Touch (evening) |
| Thursday | Lunch Run (easy) + Netball (evening) |
| Friday | Gym — Upper Pull |
| Saturday | Long Slow Run |
| Sunday | Sprint & Agility + Gym — Accessory (optional 4th session) |

**Why this shape:**
- **Gym is upper-body-biased, but not upper-only.** Running builds aerobic conditioning, not squat/hinge strength or jump power — both of which matter for tackling, accelerating off the mark, and holding your feet in contact. Monday carries the one dedicated lower/power day, placed first in the week while legs are freshest.
- **Friday is upper-only on purpose**, so legs get to recover from back-to-back Wednesday/Thursday game nights before Saturday's long run.
- **Tuesday's lunch run is the harder of the two weekday runs** (tempo or intervals) because there's no game that night. **Thursday's is kept easy** because netball follows a few hours later.
- **Sunday's sprint & agility session** is the dedicated top-end-speed work that neither the runs nor gym sessions provide — short sprints plus change-of-direction drills relevant to backline play.
- **The 4th gym session (Sunday accessory) is optional** — it's the first thing to drop in a heavy week; the main lifts, the long run, and the sprint session shouldn't be.

Full exercise-by-exercise detail (sets/reps/rest/notes) is in [`js/program.js`](js/program.js) and rendered in the site's **Program** tab. Weights aren't prescribed in the plan — they're personal and progress weekly, so they live in your logged history instead (see Progression, below).

**Progression:** double progression on every main lift — stay in the rep range across all sets, and once every set hits the top of the range, add ~2.5–5kg upper body / ~5kg lower body next time. Take a deload week roughly every 4th week (cut volume ~30–40%) given how much stacks up across a week with two game nights on top.

**Also worth knowing:**
- Protein target ~1.8–2.2 g/kg bodyweight/day to support the hypertrophy work.
- Sleep 7–9 hours — with two-a-days on Tuesday/Thursday and back-to-back game nights, sleep is doing a lot of the recovery work.
- Track bodyweight weekly, same day/time, to see the trend rather than day-to-day noise (built into the site's Settings tab).
- If something has to give in a given week: drop the optional Sunday accessory gym session first, then shorten (don't skip) Thursday's easy run.

## The website

A static, no-build-step site — plain HTML/CSS/JS, using `localStorage` for persistence (nothing leaves your browser) and [Chart.js](https://www.chartjs.org/) (via CDN) for progress charts.

**Tabs:**
- **Dashboard** — today's scheduled session(s), a one-week-at-a-glance grid, and quick "log this session" shortcuts.
- **Program** — the full plan: every exercise, sets/reps/rest, run structures, and the sprint session breakdown.
- **Log** — pick a session and log what you actually did. Gym sessions show last time's weight/reps as placeholders so progressive overload is obvious; runs log distance/duration/pace; games and sprint sessions log RPE and notes.
- **History** — everything you've logged, newest first, with delete.
- **Progress** — a chart of estimated 1RM over time per exercise (Epley formula, based on your best set that session), a running distance/pace chart, and a bodyweight chart.
- **Settings** — bodyweight log, and JSON export/import to back up or move data between devices/browsers.

### Running it locally

No build step needed. Either:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or just open `index.html` directly in a browser (the ES modules and Chart.js CDN load fine over `file://` in most modern browsers, but a local server is more reliable).

### Deploying (GitHub Pages)

1. Push this repo to GitHub (already the case if you're reading this from there).
2. In the repo settings → **Pages**, set the source to the branch you want live (e.g. `main`) and folder `/ (root)`.
3. The site will be published at `https://<username>.github.io/<repo>/`.

### Data & backups

All logged history and bodyweight entries live in your browser's `localStorage` — nothing is sent anywhere. That means:
- Data is per-browser/per-device. Use **Settings → Export backup** regularly, and **Import** on another device to bring it across.
- Clearing browser data/site data will wipe your history — export first if you're about to do that.
