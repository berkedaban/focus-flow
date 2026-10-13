const DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const LABELS = { focus: ["DERİN ODAK", "Bir işe başlamak için harika bir an."], short: ["KISA MOLA", "Ayağa kalk, biraz nefes al."], long: ["UZUN MOLA", "Kendine iyi bakmayı unutma."] };
const CIRCUMFERENCE = 2 * Math.PI * 128;
const $ = (selector) => document.querySelector(selector);
const todayKey = new Date().toLocaleDateString("en-CA");
const state = loadState();
let mode = "focus";
let remaining = DURATIONS.focus;
let timerId = null;
let soundOn = true;
let audioContext;
let toastId;

function loadState() {
  try {
    const all = JSON.parse(localStorage.getItem("focus-flow-v1") || "{}");
    const day = all.date === todayKey ? all : { date: todayKey, tasks: [], focusMinutes: 0, sessions: 0 };
    return { tasks: Array.isArray(day.tasks) ? day.tasks : [], focusMinutes: Number(day.focusMinutes) || 0, sessions: Number(day.sessions) || 0 };
  } catch { return { tasks: [], focusMinutes: 0, sessions: 0 }; }
}

function saveState() {
  localStorage.setItem("focus-flow-v1", JSON.stringify({ ...state, date: todayKey }));
}

function render() {
  const list = $("#task-list");
  list.innerHTML = "";
  state.tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item${task.done ? " done" : ""}`;
    const check = document.createElement("button");
    check.className = "task-check"; check.setAttribute("aria-label", task.done ? "İşi tamamlanmadı olarak işaretle" : "İşi tamamlandı olarak işaretle"); check.textContent = task.done ? "✓" : "";
    check.addEventListener("click", () => { task.done = !task.done; saveState(); render(); });
    const text = document.createElement("span"); text.className = "task-text"; text.textContent = task.text;
    const remove = document.createElement("button"); remove.className = "task-delete"; remove.setAttribute("aria-label", "İşi sil"); remove.textContent = "×";
    remove.addEventListener("click", () => { state.tasks = state.tasks.filter((item) => item.id !== task.id); saveState(); render(); });
    li.append(check, text, remove); list.append(li);
  });
  const done = state.tasks.filter((task) => task.done).length;
  $("#task-count").textContent = `${done}/${state.tasks.length}`;
  $("#empty-state").hidden = state.tasks.length > 0;
  $("#focus-total").textContent = state.focusMinutes;
  $("#focus-count").textContent = state.sessions;
  [...$("#session-dots").children].forEach((dot, index) => dot.classList.toggle("filled", index < state.sessions % 7 || (state.sessions > 0 && state.sessions % 7 === 0 && index === 6)));
}

function updateTimer() {
  const mins = Math.floor(remaining / 60).toString().padStart(2, "0");
  const secs = (remaining % 60).toString().padStart(2, "0");
  $("#timer").textContent = `${mins}:${secs}`;
  $("#timer").setAttribute("datetime", `PT${mins}M${secs}S`);
  const progress = 1 - remaining / DURATIONS[mode];
  $("#ring-progress").style.strokeDashoffset = `${CIRCUMFERENCE * progress}`;
  document.title = timerId ? `${mins}:${secs} — Focus Flow` : "Focus Flow — Ritmini bul";
}

function setMode(nextMode) {
  pauseTimer(); mode = nextMode; remaining = DURATIONS[mode];
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active); tab.setAttribute("aria-selected", active);
  });
  $("#timer-label").textContent = LABELS[mode][0];
  $("#timer-hint").textContent = LABELS[mode][1];
  $("#session-note").textContent = mode === "focus" ? "25 dakika sadece senin." : "Bu mola da ilerlemenin bir parçası.";
  updateTimer();
}

function pauseTimer() {
  clearInterval(timerId); timerId = null;
  $("#start-icon").textContent = "▶"; $("#start-text").textContent = "Devam et";
  updateTimer();
}

function startTimer() {
  if (timerId) { pauseTimer(); return; }
  $("#start-icon").textContent = "Ⅱ"; $("#start-text").textContent = "Duraklat";
  timerId = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      remaining = 0; pauseTimer(); chime();
      if (mode === "focus") { state.focusMinutes += 25; state.sessions += 1; saveState(); render(); }
      showToast(mode === "focus" ? "Odak seansı tamamlandı. Harika iş! ✦" : "Mola bitti. Hazır olduğunda devam et.");
      if (mode === "focus") setMode(state.sessions % 4 === 0 ? "long" : "short");
    }
    updateTimer();
  }, 1000);
}

function chime() {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18, 0.36].forEach((delay, index) => {
      const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = [660, 784, 988][index];
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + delay + 0.42);
      oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(audioContext.currentTime + delay); oscillator.stop(audioContext.currentTime + delay + 0.45);
    });
  } catch { /* Audio is optional; timer still works without it. */ }
}

function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(toastId); toastId = setTimeout(() => toast.classList.remove("show"), 3000);
}

$("#task-form").addEventListener("submit", (event) => {
  event.preventDefault(); const input = $("#task-input"); const text = input.value.trim();
  if (!text) return;
  state.tasks.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, text, done: false });
  input.value = ""; saveState(); render(); input.focus();
});
document.querySelectorAll(".mode-tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
$("#start").addEventListener("click", startTimer);
$("#reset").addEventListener("click", () => { pauseTimer(); remaining = DURATIONS[mode]; $("#start-text").textContent = "Başla"; updateTimer(); });
$("#skip").addEventListener("click", () => setMode(mode === "focus" ? "short" : "focus"));
$("#sound-toggle").addEventListener("click", (event) => { soundOn = !soundOn; event.currentTarget.classList.toggle("muted", !soundOn); event.currentTarget.setAttribute("aria-pressed", soundOn); showToast(soundOn ? "Seans bitiş sesi açık." : "Seans bitiş sesi kapalı."); });

const formattedDate = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
$("#today").textContent = formattedDate.charAt(0).toLocaleUpperCase("tr-TR") + formattedDate.slice(1);
render(); updateTimer();

