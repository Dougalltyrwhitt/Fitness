// localStorage-backed persistence. Everything lives in the browser the site
// is opened in — use Settings > Export to back up / move between devices.

const LOGS_KEY = "ft_logs_v1";
const BODYWEIGHT_KEY = "ft_bodyweight_v1";

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Failed to read ${key}`, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getLogs() {
  return readJSON(LOGS_KEY, []);
}

export function saveLog(entry) {
  const logs = getLogs();
  const record = { id: uid(), createdAt: new Date().toISOString(), ...entry };
  logs.push(record);
  writeJSON(LOGS_KEY, logs);
  return record;
}

export function updateLog(id, patch) {
  const logs = getLogs();
  const idx = logs.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  logs[idx] = { ...logs[idx], ...patch };
  writeJSON(LOGS_KEY, logs);
  return logs[idx];
}

export function deleteLog(id) {
  const logs = getLogs().filter((l) => l.id !== id);
  writeJSON(LOGS_KEY, logs);
}

export function getBodyweights() {
  return readJSON(BODYWEIGHT_KEY, []);
}

export function saveBodyweight(entry) {
  const list = getBodyweights();
  list.push({ id: uid(), ...entry });
  list.sort((a, b) => a.date.localeCompare(b.date));
  writeJSON(BODYWEIGHT_KEY, list);
}

export function deleteBodyweight(id) {
  writeJSON(BODYWEIGHT_KEY, getBodyweights().filter((b) => b.id !== id));
}

export function exportAll() {
  return JSON.stringify(
    { logs: getLogs(), bodyweights: getBodyweights(), exportedAt: new Date().toISOString() },
    null,
    2
  );
}

export function importAll(json) {
  const data = JSON.parse(json);
  if (!Array.isArray(data.logs)) throw new Error("Invalid backup file: missing logs array");
  writeJSON(LOGS_KEY, data.logs);
  writeJSON(BODYWEIGHT_KEY, Array.isArray(data.bodyweights) ? data.bodyweights : []);
}

export function resetAll() {
  localStorage.removeItem(LOGS_KEY);
  localStorage.removeItem(BODYWEIGHT_KEY);
}
