const HOME_GATE_KEY = "hotenai:last_home_seen_date";

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function hasSeenHomeToday() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(HOME_GATE_KEY) === todayKey();
}

export function markHomeSeenToday() {
  if (typeof window === "undefined") return;
  localStorage.setItem(HOME_GATE_KEY, todayKey());
}