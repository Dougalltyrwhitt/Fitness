// Static description of the weekly training program.
// Weights are intentionally left out of the plan — they live in the logged
// history instead, since progressive overload is personal and changes weekly.

export const PROGRAM = {
  meta: {
    title: "Rugby Pre-Season Program",
    summary:
      "Built for a wing/centre using this as an extended pre-season: strength + hypertrophy in the gym (upper-body-biased, one dedicated lower/power day so running alone isn't carrying leg strength), a quick/long run split, a weekly sprint & agility session, plus Touch and Netball as built-in conditioning.",
  },

  week: [
    {
      day: "Monday",
      sessions: ["lower-power"],
    },
    {
      day: "Tuesday",
      sessions: ["run-tue", "upper-push"],
    },
    {
      day: "Wednesday",
      sessions: ["mobility-wed", "touch"],
    },
    {
      day: "Thursday",
      sessions: ["run-thu", "netball"],
    },
    {
      day: "Friday",
      sessions: ["upper-pull"],
    },
    {
      day: "Saturday",
      sessions: ["run-sat"],
    },
    {
      day: "Sunday",
      sessions: ["sprint-sun", "accessory"],
    },
  ],

  sessions: {
    "lower-power": {
      type: "gym",
      name: "Lower Body / Athletic Power",
      when: "Monday",
      blurb:
        "Fresh legs, heaviest lower-body day of the week. This is the session that stops running being the only thing developing your legs — squat/hinge strength and jump power carry straight into tackling, accelerating and holding a line out wide.",
      exercises: [
        { name: "Box Jump / Broad Jump", sets: 3, reps: "5", rest: "2 min", notes: "Explosive — do it first while completely fresh, focus on landing soft." },
        { name: "Back Squat", sets: 4, reps: "5", rest: "2–3 min", notes: "Main strength lift. RPE 7–8. Add load once all 4 sets hit 5 clean reps." },
        { name: "Romanian Deadlift", sets: 3, reps: "8", rest: "2 min", notes: "Posterior chain — hamstrings/glutes for sprinting and tackling." },
        { name: "Bulgarian Split Squat", sets: 3, reps: "10 / leg", rest: "90 sec", notes: "Unilateral strength + knee stability for cutting." },
        { name: "Standing Calf Raise", sets: 3, reps: "15", rest: "60 sec" },
        { name: "Pallof Press", sets: 3, reps: "12 / side", rest: "60 sec", notes: "Anti-rotation core — helps with fending and passing under load." },
      ],
    },

    "upper-push": {
      type: "gym",
      name: "Upper Body — Push",
      when: "Tuesday evening",
      blurb: "Strength-biased press work first, hypertrophy accessories after.",
      exercises: [
        { name: "Barbell Bench Press", sets: 4, reps: "5", rest: "2–3 min", notes: "RPE 7–8. Progress load once all sets hit 5." },
        { name: "Overhead Press", sets: 3, reps: "6–8", rest: "2 min" },
        { name: "Incline Dumbbell Press", sets: 3, reps: "10", rest: "90 sec" },
        { name: "Weighted Dip (or Close-Grip Bench)", sets: 3, reps: "8–10", rest: "90 sec" },
        { name: "Dumbbell Lateral Raise", sets: 3, reps: "12–15", rest: "60 sec" },
        { name: "Triceps Rope Pushdown", sets: 3, reps: "12–15", rest: "60 sec" },
      ],
    },

    "upper-pull": {
      type: "gym",
      name: "Upper Body — Pull",
      when: "Friday",
      blurb:
        "Deliberately upper-only and placed after Wed/Thu game nights so your legs get to recover before Saturday's long run. Face pulls are non-negotiable — shoulder health matters a lot when you're getting tackled.",
      exercises: [
        { name: "Weighted Pull-Up (or Lat Pulldown)", sets: 4, reps: "6–8", rest: "2 min" },
        { name: "Barbell Bent-Over Row", sets: 4, reps: "6–8", rest: "2 min" },
        { name: "Seated Cable Row", sets: 3, reps: "10", rest: "90 sec" },
        { name: "Face Pull", sets: 3, reps: "15", rest: "60 sec", notes: "Shoulder health — don't skip this given the contact." },
        { name: "Barbell or DB Curl", sets: 3, reps: "10–12", rest: "60 sec" },
        { name: "Hammer Curl", sets: 3, reps: "12", rest: "60 sec" },
        { name: "Hanging Knee Raise / Weighted Sit-Up", sets: 3, reps: "12–15", rest: "60 sec" },
      ],
    },

    accessory: {
      type: "gym",
      name: "Accessory (Optional 4th Session)",
      when: "Sunday, after Sprint & Agility",
      blurb:
        "Short (~25–30 min), low-fatigue pump session. This is the 4th gym session mentioned in the brief — the first thing to drop on a heavy week, never the main lifts.",
      optional: true,
      exercises: [
        { name: "Dumbbell Shoulder Press", sets: 3, reps: "10", rest: "60 sec" },
        { name: "Chest-Supported Row", sets: 3, reps: "12", rest: "60 sec" },
        { name: "EZ-Bar Curl", sets: 3, reps: "12", rest: "60 sec" },
        { name: "Overhead Triceps Extension", sets: 3, reps: "12", rest: "60 sec" },
        { name: "Plank", sets: 3, reps: "45 sec", rest: "45 sec" },
        { name: "Side Plank", sets: 2, reps: "30 sec / side", rest: "30 sec" },
      ],
    },

    "run-tue": {
      type: "run",
      runType: "quick",
      name: "Lunch Run — Quick",
      when: "Tuesday lunch (30 min)",
      blurb:
        "Alternate weekly between the two options below — keeps the quick runs from going stale and covers both tempo and speed endurance.",
      options: [
        "Week A: 5 min warm-up jog + 20 min continuous tempo (comfortably hard) + 5 min cool-down.",
        "Week B: 5 min warm-up + 6–8 × 400m @ 5k effort, 90 sec jog recovery + cool-down.",
      ],
      target: "2–4 km of hard running inside the 30 min window",
    },

    "run-thu": {
      type: "run",
      runType: "quick",
      name: "Lunch Run — Easy",
      when: "Thursday lunch (20–25 min)",
      blurb:
        "Deliberately easier than Tuesday's — you've got netball that night, this should prime the legs, not fatigue them.",
      options: ["20–25 min conversational pace, 2–3 km, optionally finish with 4–6 relaxed 20 sec strides."],
      target: "2–3 km easy",
    },

    "run-sat": {
      type: "run",
      runType: "long",
      name: "Long Slow Run",
      when: "Saturday",
      blurb:
        "Zone 2 / conversational pace. Add roughly 0.5–1 km per week on top of last week's distance; every 4th week, cut the distance back by about 30% to let your legs absorb the load before building again.",
      options: ["Easy, conversational pace throughout — no watch-chasing. Distance is the only variable that should be changing week to week."],
      target: "Building distance — log it every week and let the Progress tab track the trend",
    },

    "sprint-sun": {
      type: "sprint",
      name: "Sprint & Agility",
      when: "Sunday",
      blurb:
        "The dedicated speed session — this is what running volume alone won't give you: top-end speed and change of direction for wing/centre.",
      structure: [
        "Warm-up: 10 min jog + dynamic drills (leg swings, A-skips, high knees) + 3–4 build-up strides.",
        "Speed: 8–10 × 40–60m @ 90–100% effort, full 2–3 min recovery between reps.",
        "Agility: 4–6 reps of a change-of-direction drill (5-10-5 shuttle, ladder + cut) — acceleration/deceleration/cutting relevant to backline play.",
        "Cool-down: light jog + stretch.",
      ],
    },

    touch: {
      type: "game",
      name: "Touch Footy",
      when: "Wednesday evening",
      blurb: "Game night — counts as conditioning/agility work. Log RPE so the weekly load is visible.",
    },

    netball: {
      type: "game",
      name: "Netball",
      when: "Thursday evening",
      blurb: "Game night — high-intensity, lots of change of direction and jumping. Log RPE.",
    },

    "mobility-wed": {
      type: "mobility",
      name: "Rest / Mobility",
      when: "Wednesday (daytime)",
      blurb: "10–15 min of mobility/foam rolling. No lifting today — legs and CNS get a break before Touch.",
    },
  },

  principles: [
    "Progressive overload: use double progression on every main lift — stay in the rep range across all sets, and once you hit the top of the range on every set, add weight next time (≈2.5–5kg upper body, ≈5kg lower body).",
    "Deload every 4th week: cut volume roughly 30–40% (fewer sets, same or lighter weight, shorter long run) given how many sessions stack up across a week with two game nights on top.",
    "Recovery order if something has to give: drop the optional Sunday accessory session first, then shorten (never skip) the Thursday easy run — protect the main lifts, the sprint session and the long run.",
    "Protein target ~1.8–2.2 g/kg bodyweight/day to support the hypertrophy work alongside this much conditioning.",
    "Sleep 7–9 hours — with two-a-days on Tuesday and Thursday plus back-to-back game nights, sleep is doing a lot of the recovery work.",
    "Track bodyweight weekly, same day/time, to see muscle gain vs fat trend rather than day-to-day noise.",
  ],

  weeklyTotals: {
    gym: "3–4 (Mon, Tue, Fri + optional Sun)",
    runs: "3 (Tue quick, Thu easy, Sat long)",
    games: "2 (Touch Wed, Netball Thu)",
    sprint: "1 (Sun)",
  },
};

export const SESSION_TYPE_LABELS = {
  gym: "Gym",
  run: "Run",
  sprint: "Sprint",
  game: "Game",
  mobility: "Mobility",
};
