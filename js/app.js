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

// ---------- Progression suggestions ----------

function parseRepsTarget(repsStr) {
  if (!repsStr || /sec/i.test(repsStr)) return null;
  const range = repsStr.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (range) return { max: parseInt(range[2], 10) };
  const single = repsStr.match(/(\d+)/);
  if (single) return { max: parseInt(single[1], 10) };
  return null;
}

function progressionSuggestion(ex, logs) {
  if (!ex.increment) return null;
  const target = parseRepsTarget(ex.reps);
  if (!target) return null;
  const last = logs
    .filter((l) => l.sessionType === "gym")
    .flatMap((l) => l.exercises.filter((e) => e.name === ex.name && e.sets.some((s) => s.reps > 0)).map((e) => ({ date: l.date, sets: e.sets })))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last) return null;

  const topWeight = Math.max(...last.sets.map((s) => s.weight));
  const bestReps = Math.max(...last.sets.map((s) => s.reps));
  const allHitTop = last.sets.every((s) => s.reps >= target.max);
  const weightLabel = topWeight > 0 ? `${topWeight}kg` : "bodyweight";

  if (allHitTop) {
    const nextWeight = Math.round((topWeight + ex.increment) * 2) / 2;
    const suggestion = topWeight > 0 ? `${nextWeight}kg` : `+${ex.increment}kg added`;
    return `Last time: ${weightLabel} × ${target.max} across all sets — try ${suggestion} today.`;
  }
  return `Last time: ${weightLabel}, best set ${bestReps} reps — repeat that and aim for ${target.max} across all sets before adding load.`;
}

// ---------- Personal records ----------

function computePRs(logs) {
  const bestWeighted = {};
  const bestBodyweight = {};
  const bestDistance = {};
  const bestPace = {};
  const prByLogId = {};
  const markPR = (logId, section, key, value) => {
    const entry = (prByLogId[logId] ??= { gym: {}, run: {} });
    entry[section][key] = value;
  };

  [...logs]
    .filter((l) => l.sessionType === "gym")
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || ""))
    .forEach((l) => {
      l.exercises.forEach((e) => {
        if (!e.sets.length) return;
        const b = bestSet(e.sets);
        if (b.weight > 0) {
          const est = epley1RM(b.weight, b.reps);
          if (est > (bestWeighted[e.name] || 0)) {
            bestWeighted[e.name] = est;
            markPR(l.id, "gym", e.name, "weight");
          }
        } else if (b.reps > 0) {
          if (b.reps > (bestBodyweight[e.name] || 0)) {
            bestBodyweight[e.name] = b.reps;
            markPR(l.id, "gym", e.name, "bodyweight");
          }
        }
      });
    });

  [...logs]
    .filter((l) => l.sessionType === "run")
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || ""))
    .forEach((l) => {
      if (l.distanceKm > (bestDistance[l.sessionId] || 0)) {
        bestDistance[l.sessionId] = l.distanceKm;
        markPR(l.id, "run", "distance", true);
      }
      const pace = l.pace ? parseFloat(l.pace) : null;
      if (pace && l.distanceKm >= 1 && (bestPace[l.sessionId] == null || pace < bestPace[l.sessionId])) {
        bestPace[l.sessionId] = pace;
        markPR(l.id, "run", "pace", true);
      }
    });

  return { prByLogId, bestWeighted, bestBodyweight, bestDistance, bestPace };
}

function prMessage(prEntry) {
  if (!prEntry) return null;
  const parts = [];
  Object.keys(prEntry.gym || {}).forEach((name) => parts.push(`${name} PR`));
  if (prEntry.run?.distance) parts.push("distance PR");
  if (prEntry.run?.pace) parts.push("pace PR");
  return parts.length ? `🏆 New PR! ${parts.join(", ")}` : null;
}

// ---------- Program timeline / deload ----------

function getOrInitProgramStart() {
  const settings = store.getSettings();
  if (settings.programStartDate) return settings.programStartDate;
  const start = todayISO();
  store.saveSettings({ programStartDate: start });
  return start;
}

function currentWeekInfo() {
  const startWeek = startOfWeek(new Date(getOrInitProgramStart() + "T00:00:00"));
  const thisWeek = startOfWeek(new Date());
  const weeksElapsed = Math.round((thisWeek - startWeek) / (7 * 86400000));
  const weekNumber = weeksElapsed + 1;
  return { weekNumber, isDeload: weekNumber > 0 && weekNumber % 4 === 0 };
}

// ---------- Daily reminder ----------
// This can only notify while the app is open in a tab (or briefly after, on
// some browsers) — a true "notify me even if the app is closed" push needs a
// backend push server, which this static/local-storage site doesn't have.

function todaysUnloggedSessions() {
  const dayName = DAY_NAMES[new Date().getDay()];
  const todays = sessionsForDay(dayName);
  const loggedIds = new Set(store.getLogs().filter((l) => l.date === todayISO()).map((l) => l.sessionId));
  return todays.filter((s) => !loggedIds.has(s.id));
}

function maybeShowDailyReminder(force = false) {
  const settings = store.getSettings();
  if (!settings.remindersEnabled) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!force && settings.lastReminderShownDate === todayISO()) return;
  const unlogged = todaysUnloggedSessions();
  if (!unlogged.length) return;
  new Notification("Fitness Tracker", { body: `Not logged yet today: ${unlogged.map((s) => s.name).join(", ")}` });
  store.saveSettings({ lastReminderShownDate: todayISO() });
}

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
  const { weekNumber, isDeload } = currentWeekInfo();
  const unlogged = todaysUnloggedSessions();

  panel.innerHTML = `
    ${
      isDeload
        ? `<div class="deload-banner">📉 Deload week (week ${weekNumber} of this block) — cut volume ~30–40%: fewer sets, same or lighter weight, shorter long run.</div>`
        : `<p class="muted">Week ${weekNumber} of your program.</p>`
    }
    ${
      unlogged.length
        ? `<div class="reminder-banner">⏰ Not logged yet today: ${unlogged.map((s) => s.name).join(", ")}. <a href="#" data-goto-log>Log now →</a></div>`
        : ""
    }
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

  el("[data-goto-log]", panel)?.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab("log");
  });
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
  const logs = store.getLogs();
  const last = lastLogForSession(sessionId);

  if (session.type === "gym") {
    container.innerHTML = `
      <p class="muted">${last ? `Last logged ${fmtDate(last.date)} — top set weights shown as placeholders.` : "No history yet for this session."}</p>
      <form id="gym-log-form">
        ${session.exercises
          .map((ex, i) => {
            const lastEx = last?.exercises?.find((e) => e.name === ex.name);
            const suggestion = progressionSuggestion(ex, logs);
            return `
            <div class="exercise-log-block">
              <h4>${ex.name} <span class="muted">— target ${ex.sets} × ${ex.reps}</span></h4>
              ${suggestion ? `<p class="suggestion">${suggestion}</p>` : ""}
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
      const record = store.saveLog({
        date: el("#log-date").value,
        sessionId,
        sessionType: "gym",
        sessionName: session.name,
        exercises,
        notes: el("#log-notes").value,
      });
      const prEntry = computePRs(store.getLogs()).prByLogId[record.id];
      renderLogFormBody(sessionId);
      flashSaved(container, prMessage(prEntry) || "Saved.");
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
      const record = store.saveLog({
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
      const prEntry = computePRs(store.getLogs()).prByLogId[record.id];
      renderLogFormBody(sessionId);
      flashSaved(container, prMessage(prEntry) || "Saved.");
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
      renderLogFormBody(sessionId);
      flashSaved(container);
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
      renderLogFormBody(sessionId);
      flashSaved(container);
    });
  }
}

function flashSaved(container, message = "Saved.") {
  const note = document.createElement("div");
  note.className = message.startsWith("🏆") ? "saved-toast saved-toast-pr" : "saved-toast";
  note.textContent = message;
  container.prepend(note);
  setTimeout(() => note.remove(), message.startsWith("🏆") ? 3200 : 1800);
}

// ---------- History ----------

let historyEditingId = null;

function renderHistory() {
  const panel = el("#panel-history");
  const logs = [...store.getLogs()].sort((a, b) => b.date.localeCompare(a.date));
  const prByLogId = computePRs(store.getLogs()).prByLogId;

  panel.innerHTML = `
    <h2>History</h2>
    ${logs.length === 0 ? `<p class="muted">Nothing logged yet — head to the Log tab.</p>` : ""}
    <div class="history-list">
      ${logs.map((l) => (l.id === historyEditingId ? renderHistoryEditCard(l) : renderHistoryViewCard(l, prByLogId[l.id]))).join("")}
    </div>
  `;

  wireHistoryCards(panel, logs);
}

function renderHistoryViewCard(l, pr) {
  let summary = "";
  if (l.sessionType === "gym") {
    summary = l.exercises
      .map((e) => {
        const b = bestSet(e.sets);
        if (!b.weight && !b.reps) return "";
        const val = b.weight ? `${b.weight}kg × ${b.reps}` : `${b.reps} reps (bodyweight)`;
        return `${e.name}: top set ${val}${pr?.gym?.[e.name] ? " 🏆" : ""}`;
      })
      .filter(Boolean)
      .join(" · ");
  } else if (l.sessionType === "run") {
    summary = `${l.distanceKm}km in ${l.durationMin}min${l.pace ? ` (${l.pace} min/km)` : ""}`;
    if (pr?.run?.distance) summary += " 🏆 distance PR";
    if (pr?.run?.pace) summary += " 🏆 pace PR";
  } else if (l.rpe) {
    summary = `RPE ${l.rpe}`;
  }
  return `
  <div class="card history-card">
    <div class="history-head">
      <strong>${fmtDate(l.date)}</strong>
      <span class="badge">${l.sessionName}</span>
      <button class="btn-link" data-edit="${l.id}">edit</button>
      <button class="btn-link" data-delete="${l.id}">delete</button>
    </div>
    <p class="muted">${summary}</p>
    ${l.notes ? `<p>${l.notes}</p>` : ""}
  </div>`;
}

function renderHistoryEditCard(l) {
  let fields = "";
  if (l.sessionType === "gym") {
    fields = l.exercises
      .map(
        (e, i) => `
      <div class="exercise-log-block">
        <h4>${e.name}</h4>
        <div class="sets-grid" data-exercise="${i}">
          ${e.sets
            .map(
              (s, si) => `
            <div class="set-input">
              <span>Set ${si + 1}</span>
              <input type="number" step="0.5" value="${s.weight}" data-weight>
              <input type="number" value="${s.reps}" data-reps>
            </div>`
            )
            .join("")}
        </div>
      </div>`
      )
      .join("");
  } else if (l.sessionType === "run") {
    fields = `
      <div class="field-row">
        <label>Distance (km) <input type="number" step="0.01" id="edit-distance" value="${l.distanceKm}"></label>
        <label>Duration (min) <input type="number" step="0.5" id="edit-duration" value="${l.durationMin}"></label>
        <label>RPE <input type="number" min="1" max="10" id="edit-rpe" value="${l.rpe ?? ""}"></label>
      </div>`;
  } else if (l.sessionType === "sprint") {
    fields = `
      <div class="field-row">
        <label>Sprint reps <input type="number" id="edit-reps" value="${l.reps ?? ""}"></label>
        <label>RPE <input type="number" min="1" max="10" id="edit-rpe" value="${l.rpe ?? ""}"></label>
      </div>`;
  } else {
    fields = `
      <div class="field-row">
        <label>RPE <input type="number" min="1" max="10" id="edit-rpe" value="${l.rpe ?? ""}"></label>
      </div>`;
  }

  return `
  <div class="card history-card history-card-editing">
    <div class="history-head">
      <strong>${l.sessionName}</strong>
      <span class="badge">editing</span>
    </div>
    <form data-edit-form="${l.id}">
      <label>Date <input type="date" id="edit-date" value="${l.date}"></label>
      ${fields}
      <label>Notes <textarea id="edit-notes" rows="2">${l.notes || ""}</textarea></label>
      <div class="field-row">
        <button type="submit" class="btn">Save changes</button>
        <button type="button" class="btn-link" data-cancel-edit="${l.id}">Cancel</button>
      </div>
    </form>
  </div>`;
}

function wireHistoryCards(panel, logs) {
  els("[data-edit]", panel).forEach((btn) =>
    btn.addEventListener("click", () => {
      historyEditingId = btn.dataset.edit;
      renderHistory();
    })
  );

  els("[data-cancel-edit]", panel).forEach((btn) =>
    btn.addEventListener("click", () => {
      historyEditingId = null;
      renderHistory();
    })
  );

  els("[data-delete]", panel).forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("Delete this log entry?")) {
        store.deleteLog(btn.dataset.delete);
        renderHistory();
      }
    })
  );

  els("[data-edit-form]", panel).forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = form.dataset.editForm;
      const log = logs.find((l) => l.id === id);
      const patch = { date: el("#edit-date", form).value, notes: el("#edit-notes", form).value };

      if (log.sessionType === "gym") {
        patch.exercises = log.exercises.map((ex, i) => {
          const block = el(`.sets-grid[data-exercise="${i}"]`, form);
          const sets = els(".set-input", block).map((row) => ({
            weight: parseFloat(el("[data-weight]", row).value) || 0,
            reps: parseInt(el("[data-reps]", row).value, 10) || 0,
          }));
          return { name: ex.name, sets };
        });
      } else if (log.sessionType === "run") {
        const distanceKm = parseFloat(el("#edit-distance", form).value) || 0;
        const durationMin = parseFloat(el("#edit-duration", form).value) || 0;
        patch.distanceKm = distanceKm;
        patch.durationMin = durationMin;
        patch.pace = durationMin && distanceKm ? (durationMin / distanceKm).toFixed(2) : null;
        patch.rpe = el("#edit-rpe", form).value ? parseInt(el("#edit-rpe", form).value, 10) : null;
      } else if (log.sessionType === "sprint") {
        patch.reps = el("#edit-reps", form).value ? parseInt(el("#edit-reps", form).value, 10) : null;
        patch.rpe = el("#edit-rpe", form).value ? parseInt(el("#edit-rpe", form).value, 10) : null;
      } else {
        patch.rpe = el("#edit-rpe", form).value ? parseInt(el("#edit-rpe", form).value, 10) : null;
      }

      store.updateLog(id, patch);
      historyEditingId = null;
      renderHistory();
    });
  });
}

// ---------- Progress ----------

function renderProgress() {
  const panel = el("#panel-progress");
  const logs = store.getLogs();
  const exerciseNames = new Set();
  logs.forEach((l) => l.sessionType === "gym" && l.exercises.forEach((e) => exerciseNames.add(e.name)));
  const otherNames = [...exerciseNames].filter((n) => !MAIN_LIFTS.some((m) => m.name === n));
  const prData = computePRs(logs);
  const runSessions = Object.entries(PROGRAM.sessions).filter(([, s]) => s.type === "run");

  panel.innerHTML = `
    <h2>Personal Bests</h2>
    <div class="card-grid">
      ${MAIN_LIFTS.map((m) => {
        const w = prData.bestWeighted[m.name];
        const bw = prData.bestBodyweight[m.name];
        const text = w ? `${Math.round(w * 10) / 10}kg est. 1RM` : bw ? `${bw} reps (bodyweight)` : "No data yet";
        return `<div class="card"><h4>${m.name}</h4><p class="muted">${text}</p></div>`;
      }).join("")}
      ${runSessions
        .map(([id, s]) => {
          const dist = prData.bestDistance[id];
          const pace = prData.bestPace[id];
          const parts = [];
          if (dist) parts.push(`Longest: ${dist}km`);
          if (pace) parts.push(`Fastest: ${pace} min/km`);
          return `<div class="card"><h4>${s.name}</h4><p class="muted">${parts.length ? parts.join(" · ") : "No data yet"}</p></div>`;
        })
        .join("")}
    </div>

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

    <h2>Sleep Score</h2>
    <canvas id="sleep-chart" height="120"></canvas>

    <h2>Bodyweight</h2>
    <canvas id="bw-chart" height="120"></canvas>
  `;

  MAIN_LIFTS.forEach((m) => {
    const points = strengthPoints(m.name, logs);
    drawStrengthChart(el(`#main-lift-${m.id}`), m.name, points, { big: true });
    el(`#main-lift-${m.id}-empty`).style.display = points.length ? "none" : "block";
  });

  let strengthChart, runChart, sleepChart, bwChart;

  el("#progress-exercise").addEventListener("change", (e) => {
    strengthChart?.destroy();
    strengthChart = drawStrengthChart(el("#strength-chart"), e.target.value, strengthPoints(e.target.value, logs));
  });

  runChart = drawRunChart(logs);
  sleepChart = drawSleepChart(store.getSleepScores());
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

function drawSleepChart(sleeps) {
  const sorted = [...sleeps].sort((a, b) => a.date.localeCompare(b.date));
  const ctx = el("#sleep-chart");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: sorted.map((s) => s.date),
      datasets: [
        {
          label: "Sleep score",
          data: sorted.map((s) => s.score),
          borderColor: "#8ab6f9",
          backgroundColor: "rgba(138,182,249,0.15)",
          tension: 0.25,
          fill: true,
        },
      ],
    },
    options: chartOptions((ctx) => (sorted[ctx.dataIndex].hours ? `${sorted[ctx.dataIndex].hours}h slept` : "")),
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
  const sleeps = [...store.getSleepScores()].sort((a, b) => b.date.localeCompare(a.date));
  const { weekNumber, isDeload } = currentWeekInfo();
  const remindersEnabled = !!store.getSettings().remindersEnabled;
  const notificationsSupported = typeof Notification !== "undefined";
  panel.innerHTML = `
    <h2>Daily Reminder</h2>
    <p class="muted">
      Shows a banner on the Dashboard whenever today's session(s) haven't been logged. Optionally, it can also fire a
      browser notification — but only while this site is open in a tab (or briefly after, on some browsers). A true
      "notify me on my phone even with the app closed" reminder needs a real push server, which this static,
      local-storage-only site doesn't have — a phone alarm or calendar reminder is more reliable for that today.
    </p>
    <div class="field-row">
      ${
        !notificationsSupported
          ? `<p class="muted">Browser notifications aren't supported here.</p>`
          : remindersEnabled
          ? `<button class="btn" id="disable-reminders-btn">Notifications on — turn off</button>`
          : `<button class="btn" id="enable-reminders-btn">Enable browser notifications</button>`
      }
    </div>

    <h2>Program Timeline</h2>
    <form id="start-date-form" class="field-row">
      <label>Program start date <input type="date" id="program-start-date" value="${getOrInitProgramStart()}"></label>
      <button type="submit" class="btn">Save</button>
    </form>
    <p class="muted">Used to flag deload weeks (every 4th week) on the Dashboard. Currently: week ${weekNumber}${isDeload ? " — deload week" : ""}.</p>

    <h2>Sleep Score</h2>
    <p class="muted">Logged manually for now — see the note on the Dashboard about automatic sync from Garmin/Strava.</p>
    <form id="sleep-form" class="field-row">
      <label>Date <input type="date" id="sleep-date" value="${todayISO()}"></label>
      <label>Sleep score (0–100) <input type="number" min="0" max="100" id="sleep-score" required></label>
      <label>Hours slept <input type="number" step="0.1" id="sleep-hours"></label>
      <button type="submit" class="btn">Add</button>
    </form>
    <div class="history-list">
      ${sleeps
        .slice(0, 10)
        .map(
          (s) => `<div class="card history-card"><div class="history-head"><strong>${fmtDate(s.date)}</strong><span>${s.score}${s.hours ? ` · ${s.hours}h` : ""}</span><button class="btn-link" data-sleep-delete="${s.id}">delete</button></div></div>`
        )
        .join("")}
    </div>

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

  el("#enable-reminders-btn")?.addEventListener("click", async () => {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      store.saveSettings({ remindersEnabled: true });
      maybeShowDailyReminder(true);
    } else {
      alert("Notification permission wasn't granted — check your browser's site settings if you want to try again.");
    }
    renderSettings();
  });

  el("#disable-reminders-btn")?.addEventListener("click", () => {
    store.saveSettings({ remindersEnabled: false });
    renderSettings();
  });

  el("#start-date-form").addEventListener("submit", (e) => {
    e.preventDefault();
    store.saveSettings({ programStartDate: el("#program-start-date").value });
    renderSettings();
  });

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

  el("#sleep-form").addEventListener("submit", (e) => {
    e.preventDefault();
    store.saveSleepScore({
      date: el("#sleep-date").value,
      score: parseInt(el("#sleep-score").value, 10),
      hours: el("#sleep-hours").value ? parseFloat(el("#sleep-hours").value) : null,
    });
    renderSettings();
  });

  els("[data-sleep-delete]", panel).forEach((btn) =>
    btn.addEventListener("click", () => {
      store.deleteSleepScore(btn.dataset.sleepDelete);
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
  maybeShowDailyReminder();
}

init();
