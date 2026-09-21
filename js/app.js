import { PROGRAM, SESSION_TYPE_LABELS } from "./program.js";
import * as store from "./storage.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const el = (sel, root = document) => root.querySelector(sel);
const els = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function sessionsForDay(dayName) {
  const day = PROGRAM.week.find((w) => w.day === dayName);
  return day ? day.sessions.map((id) => ({ id, ...PROGRAM.sessions[id] })) : [];
}

function epley1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}

function bestSet(sets) {
  const score = (s) => epley1RM(s.weight, s.reps) || s.reps || 0;
  return sets.reduce((best, s) => (score(s) > score(best) ? s : best), sets[0] || { weight: 0, reps: 0 });
}

// Bodyweight-only lifts (e.g. unweighted pull-ups) have no est. 1RM to chart —
// fall back to reps in that case instead of dropping the point entirely.
function progressValue(b) {
  if (b.weight > 0) {
    return { value: Math.round(epley1RM(b.weight, b.reps) * 10) / 10, label: `${b.weight}kg × ${b.reps}`, metric: "est. 1RM (kg)" };
  }
  return { value: b.reps, label: `${b.reps} reps (bodyweight)`, metric: "reps (bodyweight)" };
}

const MAIN_LIFTS = [
  { id: "squat", name: "Back Squat" },
  { id: "bench", name: "Barbell Bench Press" },
  { id: "pullup", name: "Weighted Pull-Up" },
];

// ---------- Tab plumbing ----------

const TABS = ["dashboard", "program", "log", "history", "progress", "settings"];

function switchTab(tab) {
  els(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  els(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${tab}`));
  const renderers = { dashboard: renderDashboard, program: renderProgram, log: renderLog, history: renderHistory, progress: renderProgress, settings: renderSettings };
  renderers[tab]?.();
  location.hash = tab;
}

// ---------- Dashboard ----------

function renderDashboard() {
  const panel = el("#panel-dashboard");
  const dayName = DAY_NAMES[new Date().getDay()];
  const todays = sessionsForDay(dayName);
  const logs = store.getLogs();
  const weekStart = startOfWeek(new Date());
  const loggedThisWeek = logs.filter((l) => new Date(l.date) >= weekStart);
  const plannedThisWeek = PROGRAM.week.reduce((n, d) => n + d.sessions.length, 0);

  panel.innerHTML = `
    <h2>Today — ${dayName}</h2>
    <div class="card-grid">
      ${todays
        .map(
          (s) => `
        <div class="card session-card session-${s.type}">
          <div class="badge">${SESSION_TYPE_LABELS[s.type] || s.type}</div>
          <h3>${s.name}</h3>
          <p class="muted">${s.when || ""}</p>
          <p>${s.blurb || ""}</p>
          <button class="btn" data-log-session="${s.id}">Log this session</button>
        </div>`
        )
        .join("") || `<p class="muted">Nothing scheduled today — rest, or catch up if you missed something.</p>`}
    </div>

    <h2>This Week</h2>
    <p class="muted">${loggedThisWeek.length} of ${plannedThisWeek} sessions logged so far this week.</p>
    <div class="week-grid">
      ${PROGRAM.week
        .map((d) => {
          const isToday = d.day === dayName;
          return `<div class="week-col ${isToday ? "is-today" : ""}">
            <h4>${d.day}</h4>
            ${d.sessions
              .map((id) => {
                const s = PROGRAM.sessions[id];
                return `<div class="mini-session session-${s.type}">${s.name}</div>`;
              })
              .join("")}
          </div>`;
        })
        .join("")}
    </div>

    <h2>Program Principles</h2>
    <ul class="principles">
      ${PROGRAM.principles.map((p) => `<li>${p}</li>`).join("")}
    </ul>
  `;

  els("[data-log-session]", panel).forEach((btn) =>
    btn.addEventListener("click", () => {
      switchTab("log");
      el("#log-session-select").value = btn.dataset.logSession;
      el("#log-session-select").dispatchEvent(new Event("change"));
    })
  );
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // start weeks on Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------- Program ----------

function renderProgram() {
  const panel = el("#panel-program");
  panel.innerHTML = `
    <h2>${PROGRAM.meta.title}</h2>
    <p>${PROGRAM.meta.summary}</p>

    <div class="totals-row">
      ${Object.entries(PROGRAM.weeklyTotals)
        .map(([k, v]) => `<div class="total-pill"><strong>${v}</strong><span>${k}</span></div>`)
        .join("")}
    </div>

    ${PROGRAM.week
      .map((d) => {
        const sessions = d.sessions.map((id) => ({ id, ...PROGRAM.sessions[id] }));
        return `
        <section class="program-day">
          <h3>${d.day}</h3>
          ${sessions.map((s) => renderSessionDetail(s)).join("")}
        </section>`;
      })
      .join("")}

    <h2>Principles</h2>
    <ul class="principles">${PROGRAM.principles.map((p) => `<li>${p}</li>`).join("")}</ul>
  `;
}

function renderSessionDetail(s) {
  let body = "";
  if (s.type === "gym") {
    body = `
      <table class="exercise-table">
        <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th><th>Notes</th></tr></thead>
        <tbody>
          ${s.exercises
            .map((e) => `<tr><td>${e.name}</td><td>${e.sets}</td><td>${e.reps}</td><td>${e.rest}</td><td class="muted">${e.notes || ""}</td></tr>`)
            .join("")}
        </tbody>
      </table>`;
  } else if (s.type === "run") {
    body = `<ul>${s.options.map((o) => `<li>${o}</li>`).join("")}</ul><p class="muted">Target: ${s.target}</p>`;
  } else if (s.type === "sprint") {
    body = `<ol>${s.structure.map((step) => `<li>${step}</li>`).join("")}</ol>`;
  }
  return `
    <div class="detail-block session-${s.type}">
      <div class="detail-head">
        <span class="badge">${SESSION_TYPE_LABELS[s.type] || s.type}${s.optional ? " · optional" : ""}</span>
        <h4>${s.name}</h4>
        <span class="muted">${s.when || ""}</span>
      </div>
      <p>${s.blurb || ""}</p>
      ${body}
    </div>`;
}

// ---------- Log ----------

function allSessionOptions() {
  return Object.entries(PROGRAM.sessions).map(([id, s]) => ({ id, ...s }));
}

function renderLog() {
  const panel = el("#panel-log");
  const sessions = allSessionOptions();
  panel.innerHTML = `
    <h2>Log a Session</h2>
    <div class="field-row">
      <label>Date <input type="date" id="log-date" value="${todayISO()}"></label>
      <label>Session
        <select id="log-session-select">
          ${sessions.map((s) => `<option value="${s.id}">${s.name} (${SESSION_TYPE_LABELS[s.type]})</option>`).join("")}
        </select>
      </label>
    </div>
    <div id="log-form-body"></div>
  `;

  const select = el("#log-session-select");
  select.addEventListener("change", () => renderLogFormBody(select.value));
  renderLogFormBody(select.value);
}

function lastLogForSession(sessionId) {
  const logs = store.getLogs().filter((l) => l.sessionId === sessionId);
  logs.sort((a, b) => b.date.localeCompare(a.date));
  return logs[0];
}

function renderLogFormBody(sessionId) {
  const container = el("#log-form-body");
  const session = { id: sessionId, ...PROGRAM.sessions[sessionId] };
  const last = lastLogForSession(sessionId);

  if (session.type === "gym") {
    container.innerHTML = `
      <p class="muted">${last ? `Last logged ${fmtDate(last.date)} — top set weights shown as placeholders.` : "No history yet for this session."}</p>
      <form id="gym-log-form">
        ${session.exercises
          .map((ex, i) => {
            const lastEx = last?.exercises?.find((e) => e.name === ex.name);
            return `
            <div class="exercise-log-block">
              <h4>${ex.name} <span class="muted">— target ${ex.sets} × ${ex.reps}</span></h4>
              <div class="sets-grid" data-exercise="${i}">
                ${Array.from({ length: ex.sets })
                  .map((_, si) => {
                    const prev = lastEx?.sets?.[si];
                    return `<div class="set-input">
                      <span>Set ${si + 1}</span>
                      <input type="number" step="0.5" placeholder="${prev ? prev.weight + "kg" : "kg"}" data-weight>
                      <input type="number" placeholder="${prev ? prev.reps + " reps" : "reps"}" data-reps>
                    </div>`;
                  })
                  .join("")}
              </div>
            </div>`;
          })
          .join("")}
        <label>Notes <textarea id="log-notes" rows="2" placeholder="How did it feel? RPE, energy, anything to remember."></textarea></label>
        <button type="submit" class="btn">Save session</button>
      </form>
    `;

    el("#gym-log-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const exercises = session.exercises.map((ex, i) => {
        const block = el(`.sets-grid[data-exercise="${i}"]`, container);
        const sets = els(".set-input", block).map((row) => ({
          weight: parseFloat(el("[data-weight]", row).value) || 0,
          reps: parseInt(el("[data-reps]", row).value, 10) || 0,
        }));
        return { name: ex.name, sets };
      });
      store.saveLog({
        date: el("#log-date").value,
        sessionId,
        sessionType: "gym",
        sessionName: session.name,
        exercises,
        notes: el("#log-notes").value,
      });
      flashSaved(container);
      renderLogFormBody(sessionId);
    });
  } else if (session.type === "run") {
    container.innerHTML = `
      <p class="muted">${last ? `Last logged ${fmtDate(last.date)}: ${last.distanceKm}km in ${last.durationMin}min.` : "No history yet for this run."}</p>
      <form id="run-log-form">
        <div class="field-row">
          <label>Distance (km) <input type="number" step="0.01" id="run-distance" required></label>
          <label>Duration (min) <input type="number" step="0.5" id="run-duration" required></label>
          <label>RPE (1-10) <input type="number" min="1" max="10" id="run-rpe"></label>
        </div>
        <label>Notes <textarea id="log-notes" rows="2" placeholder="Pace, how the legs felt, weather, whatever's useful later."></textarea></label>
        <button type="submit" class="btn">Save run</button>
      </form>
    `;
    el("#run-log-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const distanceKm = parseFloat(el("#run-distance").value) || 0;
      const durationMin = parseFloat(el("#run-duration").value) || 0;
      store.saveLog({
        date: el("#log-date").value,
        sessionId,
        sessionType: "run",
        sessionName: session.name,
        runType: session.runType,
        distanceKm,
        durationMin,
        pace: durationMin && distanceKm ? (durationMin / distanceKm).toFixed(2) : null,
        rpe: el("#run-rpe").value ? parseInt(el("#run-rpe").value, 10) : null,
        notes: el("#log-notes").value,
      });
      flashSaved(container);
      renderLogFormBody(sessionId);
    });
  } else if (session.type === "sprint") {
    container.innerHTML = `
      <form id="sprint-log-form">
        <div class="field-row">
          <label>Sprint reps completed <input type="number" id="sprint-reps"></label>
          <label>RPE (1-10) <input type="number" min="1" max="10" id="sprint-rpe"></label>
        </div>
        <label>Notes <textarea id="log-notes" rows="2" placeholder="Distances used, times if you took any, how sharp you felt."></textarea></label>
        <button type="submit" class="btn">Save session</button>
      </form>
    `;
    el("#sprint-log-form").addEventListener("submit", (e) => {
      e.preventDefault();
      store.saveLog({
        date: el("#log-date").value,
        sessionId,
        sessionType: "sprint",
        sessionName: session.name,
        reps: el("#sprint-reps").value ? parseInt(el("#sprint-reps").value, 10) : null,
        rpe: el("#sprint-rpe").value ? parseInt(el("#sprint-rpe").value, 10) : null,
        notes: el("#log-notes").value,
      });
      flashSaved(container);
      renderLogFormBody(sessionId);
    });
  } else if (session.type === "game" || session.type === "mobility") {
    container.innerHTML = `
      <form id="simple-log-form">
        <div class="field-row">
          <label>RPE (1-10) <input type="number" min="1" max="10" id="simple-rpe"></label>
        </div>
        <label>Notes <textarea id="log-notes" rows="2" placeholder="How the game/session went."></textarea></label>
        <button type="submit" class="btn">Save</button>
      </form>
    `;
    el("#simple-log-form").addEventListener("submit", (e) => {
      e.preventDefault();
      store.saveLog({
        date: el("#log-date").value,
        sessionId,
        sessionType: session.type,
        sessionName: session.name,
        rpe: el("#simple-rpe").value ? parseInt(el("#simple-rpe").value, 10) : null,
        notes: el("#log-notes").value,
      });
      flashSaved(container);
      renderLogFormBody(sessionId);
    });
  }
}

function flashSaved(container) {
  const note = document.createElement("div");
  note.className = "saved-toast";
  note.textContent = "Saved.";
  container.prepend(note);
  setTimeout(() => note.remove(), 1800);
}

// ---------- History ----------

function renderHistory() {
  const panel = el("#panel-history");
  const logs = [...store.getLogs()].sort((a, b) => b.date.localeCompare(a.date));

  panel.innerHTML = `
    <h2>History</h2>
    ${logs.length === 0 ? `<p class="muted">Nothing logged yet — head to the Log tab.</p>` : ""}
    <div class="history-list">
      ${logs
        .map((l) => {
          let summary = "";
          if (l.sessionType === "gym") {
            summary = l.exercises
              .map((e) => {
                const b = bestSet(e.sets);
                return b.weight ? `${e.name}: top set ${b.weight}kg × ${b.reps}` : "";
              })
              .filter(Boolean)
              .join(" · ");
          } else if (l.sessionType === "run") {
            summary = `${l.distanceKm}km in ${l.durationMin}min${l.pace ? ` (${l.pace} min/km)` : ""}`;
          } else if (l.rpe) {
            summary = `RPE ${l.rpe}`;
          }
          return `
          <div class="card history-card">
            <div class="history-head">
              <strong>${fmtDate(l.date)}</strong>
              <span class="badge">${l.sessionName}</span>
              <button class="btn-link" data-delete="${l.id}">delete</button>
            </div>
            <p class="muted">${summary}</p>
            ${l.notes ? `<p>${l.notes}</p>` : ""}
          </div>`;
        })
        .join("")}
    </div>
  `;

  els("[data-delete]", panel).forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("Delete this log entry?")) {
        store.deleteLog(btn.dataset.delete);
        renderHistory();
      }
    })
  );
}

// ---------- Progress ----------

function renderProgress() {
  const panel = el("#panel-progress");
  const logs = store.getLogs();
  const exerciseNames = new Set();
  logs.forEach((l) => l.sessionType === "gym" && l.exercises.forEach((e) => exerciseNames.add(e.name)));
  const otherNames = [...exerciseNames].filter((n) => !MAIN_LIFTS.some((m) => m.name === n));

  panel.innerHTML = `
    <h2>Main Lifts</h2>
    <div class="main-lift-grid">
      ${MAIN_LIFTS.map(
        (m) => `
        <div>
          <h4>${m.name}</h4>
          <div class="main-lift-chart-wrap"><canvas id="main-lift-${m.id}"></canvas></div>
          <p class="muted" id="main-lift-${m.id}-empty" style="display:none">No sessions logged yet for this lift.</p>
        </div>`
      ).join("")}
    </div>

    <h2>Other Exercises</h2>
    <label>Exercise
      <select id="progress-exercise">
        <option value="">— choose —</option>
        ${otherNames.map((n) => `<option value="${n}">${n}</option>`).join("")}
      </select>
    </label>
    <canvas id="strength-chart" height="120"></canvas>

    <h2>Running Progress</h2>
    <canvas id="run-chart" height="120"></canvas>

    <h2>Bodyweight</h2>
    <canvas id="bw-chart" height="120"></canvas>
  `;

  MAIN_LIFTS.forEach((m) => {
    const points = strengthPoints(m.name, logs);
    drawStrengthChart(el(`#main-lift-${m.id}`), m.name, points, { big: true });
    el(`#main-lift-${m.id}-empty`).style.display = points.length ? "none" : "block";
  });

  let strengthChart, runChart, bwChart;

  el("#progress-exercise").addEventListener("change", (e) => {
    strengthChart?.destroy();
    strengthChart = drawStrengthChart(el("#strength-chart"), e.target.value, strengthPoints(e.target.value, logs));
  });

  runChart = drawRunChart(logs);
  bwChart = drawBodyweightChart(store.getBodyweights());
}

function strengthPoints(exerciseName, logs) {
  if (!exerciseName) return [];
  return logs
    .filter((l) => l.sessionType === "gym")
    .map((l) => {
      const ex = l.exercises.find((e) => e.name === exerciseName);
      if (!ex || !ex.sets.length) return null;
      const b = bestSet(ex.sets);
      if (!b.weight && !b.reps) return null;
      return { date: l.date, ...progressValue(b) };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function drawStrengthChart(ctx, exerciseName, points, { big = false } = {}) {
  const metric = points[0]?.metric || "est. 1RM (kg) / reps (bodyweight)";
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: points.map((p) => p.date),
      datasets: [
        {
          label: exerciseName ? `${exerciseName} — ${metric}` : "",
          data: points.map((p) => p.value),
          borderColor: "#7dd3c0",
          backgroundColor: "rgba(125,211,192,0.15)",
          tension: 0.25,
          fill: true,
          pointRadius: big ? 4 : 3,
        },
      ],
    },
    options: {
      ...chartOptions((ctx) => `top set: ${points[ctx.dataIndex].label}`),
      maintainAspectRatio: !big,
    },
  });
}

function drawRunChart(logs) {
  const runs = logs.filter((l) => l.sessionType === "run").sort((a, b) => a.date.localeCompare(b.date));
  const ctx = el("#run-chart");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: runs.map((r) => r.date),
      datasets: [
        {
          label: "Distance (km)",
          data: runs.map((r) => r.distanceKm),
          borderColor: "#8ab6f9",
          backgroundColor: "rgba(138,182,249,0.15)",
          tension: 0.25,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "Pace (min/km)",
          data: runs.map((r) => (r.pace ? parseFloat(r.pace) : null)),
          borderColor: "#f7b267",
          tension: 0.25,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      ...chartOptions(),
      scales: {
        y: { position: "left", title: { display: true, text: "km" } },
        y1: { position: "right", title: { display: true, text: "min/km" }, grid: { drawOnChartArea: false } },
      },
    },
  });
}

function drawBodyweightChart(bws) {
  const ctx = el("#bw-chart");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: bws.map((b) => b.date),
      datasets: [
        {
          label: "Bodyweight (kg)",
          data: bws.map((b) => b.weightKg),
          borderColor: "#c792ea",
          backgroundColor: "rgba(199,146,234,0.15)",
          tension: 0.25,
          fill: true,
        },
      ],
    },
    options: chartOptions(),
  });
}

function chartOptions(tooltipExtra) {
  return {
    responsive: true,
    plugins: {
      legend: { labels: { color: "#cfd8e3" } },
      tooltip: tooltipExtra ? { callbacks: { afterLabel: tooltipExtra } } : {},
    },
    scales: {
      x: { ticks: { color: "#8b96a5" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#8b96a5" }, grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };
}

// ---------- Settings ----------

function renderSettings() {
  const panel = el("#panel-settings");
  const bws = [...store.getBodyweights()].sort((a, b) => b.date.localeCompare(a.date));
  panel.innerHTML = `
    <h2>Bodyweight Log</h2>
    <form id="bw-form" class="field-row">
      <label>Date <input type="date" id="bw-date" value="${todayISO()}"></label>
      <label>Weight (kg) <input type="number" step="0.1" id="bw-weight" required></label>
      <button type="submit" class="btn">Add</button>
    </form>
    <div class="history-list">
      ${bws
        .slice(0, 10)
        .map(
          (b) => `<div class="card history-card"><div class="history-head"><strong>${fmtDate(b.date)}</strong><span>${b.weightKg}kg</span><button class="btn-link" data-bw-delete="${b.id}">delete</button></div></div>`
        )
        .join("")}
    </div>

    <h2>Backup</h2>
    <p class="muted">All data lives in this browser's local storage only. Export regularly, especially before clearing browser data or switching devices.</p>
    <div class="field-row">
      <button class="btn" id="export-btn">Export backup (.json)</button>
      <label class="btn" for="import-file">Import backup
        <input type="file" id="import-file" accept="application/json" style="display:none">
      </label>
      <button class="btn btn-danger" id="reset-btn">Reset all data</button>
    </div>
  `;

  el("#bw-form").addEventListener("submit", (e) => {
    e.preventDefault();
    store.saveBodyweight({ date: el("#bw-date").value, weightKg: parseFloat(el("#bw-weight").value) });
    renderSettings();
  });

  els("[data-bw-delete]", panel).forEach((btn) =>
    btn.addEventListener("click", () => {
      store.deleteBodyweight(btn.dataset.bwDelete);
      renderSettings();
    })
  );

  el("#export-btn").addEventListener("click", () => {
    const blob = new Blob([store.exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fitness-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  el("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      store.importAll(await file.text());
      alert("Import complete.");
      renderSettings();
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  });

  el("#reset-btn").addEventListener("click", () => {
    if (confirm("This deletes all logged history and bodyweight entries in this browser. Continue?")) {
      store.resetAll();
      renderSettings();
    }
  });
}

// ---------- Init ----------

function init() {
  els(".tab-btn").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  const initial = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "dashboard";
  switchTab(initial);
}

init();
