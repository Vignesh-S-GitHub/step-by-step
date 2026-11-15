import { bindPrism, initialOrientation } from './prism.mjs';
import { coreArtwork, animateCore } from './core.mjs';
import { TARGET_SESSIONS, dayKey, shiftDay, weekDays, scheduled, entry, logSession, removeLog, nextTarget, coreCharge, coreEvolution, mastery, milestones, remaining } from './model.mjs';

const icons = {
  today: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/>',
  habits: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
  progress: '<path d="M4 19h16M7 15v-3m5 3V9m5 6V5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6m2 4 2-2"/>',
  movement: '<path d="m3 15 3-1 3-7 4 10 3-6h5"/>',
  read: '<path d="M12 6c-2-2-6-3-9-2v15c3-1 7 0 9 2 2-2 6-3 9-2V4c-3-1-7 0-9 2Zm0 0v15"/>',
  calm: '<path d="M4 13c4 1 6 3 8 7 2-4 4-6 8-7 1 5-3 8-8 8S3 18 4 13Z"/><path d="M8 14c0-4 2-7 4-9 2 2 4 5 4 9"/>',
  learn: '<path d="m2 10 10-5 10 5-10 5-10-5Zm4 2v5c3 3 9 3 12 0v-5"/>',
  write: '<path d="m14 6 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/>',
  other: '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  play: '<path d="m8 5 12 7-12 7Z"/>',
  pause: '<path d="M9 5v14m6-14v14"/>',
  up: '<path d="M12 19V5m-5 5 5-5 5 5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/><circle cx="12" cy="12" r="8"/>',
  rotate: '<path d="M3 13a9 9 0 1 0 3.5-8M3 5v8h8"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  install: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
};
const categories = { movement: 'Movement', read: 'Reading', calm: 'Mindfulness', learn: 'Learning', write: 'Writing', other: 'Other' };
const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const routes = { today: 'Today', habits: 'Habits', progress: 'Progress' };
const coreRanks = ['Dormant', 'Spark', 'Prism', 'Radiant', 'Nova', 'Ascended'];

const themeKey = 'little-step-theme';
const themes = { amethyst: 'Amethyst', lagoon: 'Lagoon', dusk: 'Dusk', orbit: 'Orbit' };
const orientation = { ...initialOrientation };
let theme = 'amethyst';

function applyTheme(choice, persist = false) {
  theme = Object.hasOwn(themes, choice) ? choice : 'amethyst';
  document.documentElement.dataset.theme = theme;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]').content = color;
  if (persist) {
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      say('Theme changed for this visit.');
    }
  }
}

try {
  applyTheme(localStorage.getItem(themeKey));
} catch {
  applyTheme('amethyst');
}

function rankName(level) {
  return coreRanks[level] ?? `Ascended ${level - 4}`;
}

// Keep the original storage key so existing habits and history carry over.
const key = 'cairn-personal-habits-v1';
const screen = document.querySelector('#screen');
const sheet = document.querySelector('#sheet');
const toast = document.querySelector('#toast');
const coreObserver = new IntersectionObserver(([entry]) => {
  entry.target.classList.toggle('core-idle-paused', !entry.isIntersecting);
});
let today = dayKey();
let selected = today;
let progressWeek = today;
let undoLog = null;
let toastTimeout;
let dialogOrigin;
let storageAvailable = true;
let installPrompt = null;
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function load() {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
    const initial = initialState();
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  } catch {
    storageAvailable = false;
    return initialState();
  }
}

function initialState() {
  return {
    habits: [
      starter('walk', 'Gentle workout', 'movement', 5),
      starter('read', 'Read a few pages', 'read', 10),
      starter('breathe', 'Mindful breathing', 'calm', 5),
    ],
    logs: [],
    timer: null,
  };
}

function starter(id, name, category, minutes) {
  return { id, name, category, minutes, step: 5, cap: 20, created: today, targetSince: today };
}

let state = load();
let route = readRoute();

function save() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
    say('Browser storage is unavailable. Changes may be lost on reload.');
  }
}

function icon(name, size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.other}</svg>`;
}

function safe(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function dateLabel(day, options) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(day + 'T12:00:00'));
}

function countLabel(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function readRoute() {
  const hash = location.hash.slice(1);
  return Object.hasOwn(routes, hash) ? hash : 'today';
}

function say(message, undo = false) {
  clearTimeout(toastTimeout);
  toast.innerHTML = `<span>${safe(message)}</span>${undo ? '<button data-action="undo">Undo</button>' : ''}`;
  toast.classList.add('visible');
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
    toast.replaceChildren();
  }, undo ? 8000 : 4000);
}

function navigation() {
  for (const container of document.querySelectorAll('[data-navigation]')) {
    container.innerHTML = Object.entries(routes).map(([id, label]) =>
      `<a href="#${id}" data-route="${id}" ${route === id ? 'aria-current="page"' : ''}>${icon(id)}<span>${label}</span></a>`
    ).join('');
  }
}

function dateStrip() {
  return `<div class="week-strip" aria-label="This week">${weekDays(today).map((day, i) => {
    const possible = scheduled(state.habits, day).length;
    const completed = state.logs.filter((log) => log.day === day).length;
    const fullDate = dateLabel(day, { weekday: 'long', month: 'long', day: 'numeric' });
    return `<button class="day ${day === today ? 'day-today' : ''}" data-action="date" data-date="${day}" ${day > today ? 'disabled' : ''} aria-pressed="${day === selected}" aria-label="${fullDate}${day === today ? ', today' : ''}${completed ? ', ' + countLabel(completed, 'session') : ''}">
      <span>${weekdays[i]}</span><strong>${day.slice(-2).replace(/^0/, '')}</strong><i class="${completed ? possible && completed >= possible ? 'full' : 'partial' : ''}"></i>
    </button>`;
  }).join('')}</div>`;
}

function chargeFor(day) {
  return coreCharge(state.logs, day, scheduled(state.habits, day).length);
}

function coreCard(day) {
  const charge = chargeFor(day);
  const total = state.logs.length;
  const evolution = coreEvolution(total);
  const distance = evolution.next - total;
  const status = charge.done && charge.done === charge.total ? 'Fully charged' : `${charge.done} of ${charge.total} sessions`;
  return `<section class="core-card" aria-labelledby="core-title" data-charge="${charge.done}" data-rank="${evolution.level}">
    <div class="core-copy">
      <button class="core-rank" data-action="core-info" aria-label="Core rank details: ${rankName(evolution.level)}">${icon('spark', 13)} ${rankName(evolution.level)}</button>
      <h2 id="core-title">Momentum Core</h2>
      <p>${day === today ? 'Today’s charge' : 'Daily charge'} <strong>${status}</strong></p>
      <div class="charge-track" aria-hidden="true"><span style="--charge:${charge.ratio}"></span></div>
      <span class="core-caption">${countLabel(distance, 'session')} to <strong>${rankName(evolution.level + 1)}</strong></span>
    </div>
    <button class="core-art" type="button" data-action="pulse-core" aria-label="Interact with the Momentum Core" aria-describedby="core-controls">${coreArtwork(charge, evolution.level, orientation)}</button>
    <span class="core-guide" id="core-controls" title="Arrow keys to rotate. Home to reset. Enter to pulse.">${icon('rotate', 14)} Drag to rotate</span>
  </section>`;
}

function coreInfo() {
  const evolution = coreEvolution(state.logs.length);
  openSheet('Core ranks', 'Each session charges the core for the day. Lifetime sessions unlock new facets and effects.', `
    <ol class="core-rank-list">${[...milestones, evolution.level >= 6 ? evolution.next : 50].map((threshold) => {
      const level = coreEvolution(threshold).level;
      return `<li><span>${icon(evolution.level >= level ? 'check' : 'spark', 16)} ${rankName(level)}</span><small>${countLabel(threshold, 'session')}</small></li>`;
    }).join('')}</ol>
    <button class="subtle full-button" data-action="close">Done</button>`);
}

function skillLabel(habit, manage) {
  if (!manage) return '';
  const skill = mastery(state.logs, habit.id);
  return `<span>${skill.level ? `Level ${skill.level}` : 'Level 1 after your first session'}${skill.level && skill.next ? ` · ${countLabel(skill.next - skill.sessions, 'session')} to next` : ''}</span>`;
}

function row(habit, manage = false) {
  const logged = entry(state, habit.id, selected);
  const activeDay = selected === today && route === 'today';
  const category = categories[habit.category] ? habit.category : 'other';
  const running = state.timer?.id === habit.id;
  return `<li class="habit-row ${logged && !manage ? 'is-done' : ''}">
    <span class="habit-icon ${category}">${icon(category, 21)}</span>
    <div class="habit-copy"><strong>${safe(habit.name)}</strong><span>${manage ? `${habit.minutes} min daily${habit.step ? ' · Gradual increase' : ''}` : logged ? `${logged.minutes} min · Completed` : `${habit.minutes} min · Daily`}</span>${skillLabel(habit, manage)}</div>
    ${manage
      ? `<button class="icon-button" data-action="edit" data-id="${habit.id}" aria-label="Edit ${safe(habit.name)}">${icon('chevron', 20)}</button>`
      : activeDay
        ? `<div class="row-actions">${logged ? '' : `<button class="icon-button timer-button ${running ? 'running' : ''}" data-action="timer" data-id="${habit.id}" aria-label="${running ? 'Open active timer for' : 'Timer for'} ${safe(habit.name)}">${icon('timer', 21)}</button>`}<button class="check-button ${logged ? 'checked' : ''}" data-action="toggle" data-id="${habit.id}" aria-label="${logged ? 'Undo' : 'Complete'} ${safe(habit.name)}" aria-pressed="${Boolean(logged)}">${icon('check', 18)}</button></div>`
        : `<span class="past-state">${logged ? icon('check', 18) : '—'}</span>`}
  </li>`;
}

function todayScreen() {
  const habits = scheduled(state.habits, selected);
  const completed = state.logs.filter((log) => log.day === selected).length;
  const visible = selected === today ? habits : state.habits.filter((habit) => habits.includes(habit) || entry(state, habit.id, selected));
  const suggestion = selected === today && habits.find((habit) => nextTarget(state, habit));
  const allDone = habits.length > 0 && habits.every((habit) => entry(state, habit.id, selected));
  const currentCount = selected === today ? habits.filter((habit) => entry(state, habit.id, selected)).length : completed;
  return `${dateStrip()}${coreCard(selected)}
    <section class="habit-section" aria-labelledby="activity-title">
      <div class="section-title"><h2 id="activity-title">${selected === today ? 'Daily activities' : 'Activity log'}</h2><span class="completion ${allDone ? 'all-done' : ''}">${allDone ? icon('check', 15) : ''}${currentCount} / ${visible.length} done</span></div>
      ${suggestion ? `<button class="suggestion" data-action="raise" data-id="${suggestion.id}">${icon('up', 16)}<span><strong>${safe(suggestion.name)}</strong> is ready for ${nextTarget(state, suggestion)} min</span>${icon('chevron', 17)}</button>` : ''}
      ${visible.length ? `<ul class="habit-list">${visible.map((habit) => row(habit)).join('')}</ul>` : `<div class="empty"><p>${selected === today ? 'Make room for one small habit.' : 'No activities scheduled for this day.'}</p>${selected === today ? '<button class="small-action" data-action="add">Add a habit</button>' : ''}</div>`}
    </section>`;
}

function habitsScreen() {
  const habits = scheduled(state.habits, today);
  const archived = state.habits.filter((habit) => habit.archived);
  return `<section class="habit-section manage-section" aria-labelledby="manage-title"><div class="section-title"><h2 id="manage-title">Every day</h2><span class="completion">${countLabel(habits.length, 'habit')}</span></div>
    ${habits.length ? `<ul class="habit-list">${habits.map((habit) => row(habit, true)).join('')}</ul>` : '<div class="empty"><p>Start with one activity you can do in five minutes.</p><button class="small-action" data-action="add">Add a habit</button></div>'}
    ${archived.length ? `<details class="archived"><summary>Archived habits (${archived.length})</summary><ul class="habit-list">${archived.map((habit) => `<li class="habit-row"><div class="habit-copy"><strong>${safe(habit.name)}</strong></div><button class="small-action" data-action="restore" data-id="${habit.id}">Restore</button></li>`).join('')}</ul></details>` : ''}
  </section>`;
}

function progressScreen() {
  const total = state.logs.length;
  const evolution = coreEvolution(total);
  const days = weekDays(progressWeek);
  const first = days[0];
  const last = days[6];
  const weeklyCounts = days.map((day) => state.logs.filter((log) => log.day === day).length);
  const max = Math.max(1, ...weeklyCounts);
  const minutes = state.logs.reduce((sum, log) => sum + log.minutes, 0);
  const monthDay = { month: 'short', day: 'numeric' };
  return `<div class="progress-grid">${coreCard(today)}
    <section class="week-report" aria-labelledby="week-title">
      <div class="section-title"><h2 id="week-title">Weekly activity</h2><div class="week-actions">
      <button class="icon-button" data-action="week-prev" aria-label="Previous week">${icon('left', 20)}</button><button class="icon-button" data-action="week-next" aria-label="Next week" ${last >= today ? 'disabled' : ''}>${icon('chevron', 20)}</button></div></div>
      <p>${dateLabel(first, monthDay)} – ${dateLabel(last, monthDay)}</p>
      <div class="chart" aria-label="Sessions completed each day">${weeklyCounts.map((count, i) => `<div class="chart-column" aria-label="${dateLabel(days[i], { weekday: 'long' })}, ${countLabel(count, 'session')}"><span class="bar-count">${count || '–'}</span><span class="bar-track"><i style="--height:${count / max}"></i></span><span>${weekdays[i]}</span></div>`).join('')}</div>
    </section>
    <section class="totals" aria-label="All-time activity"><div><strong>${total}</strong><span>Sessions</span></div><div><strong>${minutes}</strong><span>Minutes</span></div><div><strong>${evolution.level}</strong><span>Core rank</span></div></section>
    <section class="collection" aria-labelledby="rank-title"><div class="section-title"><h2 id="rank-title">Core ranks</h2><span class="completion">${rankName(evolution.level)}</span></div><ol class="collection-ranks">${milestones.map((threshold, i) => `<li class="${total >= threshold ? 'earned' : threshold === evolution.next ? 'next-rank' : ''}"><span>${icon(total >= threshold ? 'check' : 'spark', 15)}</span><small>${rankName(i + 1)}</small><b aria-label="${countLabel(threshold, 'session')}">${threshold}</b></li>`).join('')}</ol></section>
  </div>`;
}

function render({ resetScroll = false } = {}) {
  coreObserver.disconnect();
  navigation();
  document.querySelector('#screen-title').textContent = routes[route];
  document.querySelector('#screen-subtitle').textContent = route === 'today'
    ? dateLabel(selected, { weekday: 'long', month: 'long', day: 'numeric' })
    : route === 'habits' ? 'Set a pace you can come back to.' : 'See how far your daily steps have taken you.';
  document.querySelector('.top-add').hidden = route === 'progress';
  screen.dataset.route = route;
  const scrollAt = resetScroll ? 0 : (screen.querySelector('.habit-list')?.scrollTop || 0);
  screen.innerHTML = ({ today: todayScreen, habits: habitsScreen, progress: progressScreen })[route]();
  const core = screen.querySelector('.core-card');
  if (core) {
    coreObserver.observe(core);
    bindPrism(core.querySelector('.core-art'), orientation);
  }
  if (scrollAt && screen.querySelector('.habit-list')) screen.querySelector('.habit-list').scrollTop = scrollAt;
  if (resetScroll) screen.scrollTop = 0;
}

function openSheet(title, description, content, kind = '') {
  const open = sheet.open;
  if (!open) dialogOrigin = document.activeElement;
  sheet.dataset.kind = kind;
  sheet.innerHTML = `<div class="sheet-body"><div class="sheet-header"><div><h2 id="sheet-title">${title}</h2>${description ? `<p>${description}</p>` : ''}</div><button class="icon-button" data-action="close" aria-label="Close">${icon('close', 22)}</button></div>${content}</div>`;
  if (!open) sheet.showModal();
}

function habitForm(habit) {
  const value = habit || { name: '', category: 'other', minutes: 5, step: 5, cap: 20 };
  openSheet(habit ? 'Edit habit' : 'Add habit', 'Start with a daily target that feels easy to repeat.', `
    <form id="habit-form" data-id="${habit?.id || ''}">
      <label>Activity name<input name="name" maxlength="48" required value="${safe(value.name)}" placeholder="e.g. Stretch after work"></label>
      <label>Category<select name="category">${Object.entries(categories).map(([id, name]) => `<option value="${id}" ${id === value.category ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
      <div class="form-grid"><label>Daily minutes<input name="minutes" type="number" min="1" max="180" required inputmode="numeric" value="${value.minutes}"></label>
      <label>Increase by<select name="step">${[0, 1, 2, 5, 10].map((step) => `<option value="${step}" ${step === value.step ? 'selected' : ''}>${step ? step + ' min' : 'Keep current'}</option>`).join('')}</select></label></div>
      <label data-cap ${value.step ? '' : 'hidden'}>Maximum minutes<input name="cap" type="number" min="1" max="180" ${value.step ? 'required' : 'disabled'} inputmode="numeric" value="${value.cap}"><small>After ${TARGET_SESSIONS} sessions at your target, Cairn offers an increase.</small></label>
      <p class="form-error" role="alert" hidden></p>
      <button class="primary full-button" type="submit">${habit ? 'Save changes' : 'Add daily habit'}</button>
      ${habit ? `<button class="subtle full-button" type="button" data-action="archive" data-id="${habit.id}">Archive habit</button>` : ''}
    </form>`, 'form');
}

function timerSheet(habit) {
  if (state.timer && habit.id !== state.timer.id) {
    openSheet('Timer already active', `Finish or end the timer for ${safe(state.habits.find((item) => item.id === state.timer.id)?.name || 'your current habit')} first.`,
      '<button class="primary full-button" data-action="open-current">Open current timer</button>');
    return;
  }
  openSheet(safe(habit.name), `${habit.minutes} minute daily target`, '<div id="timer-panel"></div>', 'timer');
  sheet.dataset.habit = habit.id;
  updateTimer(true);
}

function updateTimer(force = false) {
  if (!sheet.open || sheet.dataset.kind !== 'timer') return;
  const panel = sheet.querySelector('#timer-panel');
  const habit = state.habits.find((item) => item.id === sheet.dataset.habit);
  if (!habit) return;
  const timer = state.timer?.id === habit.id ? state.timer : null;
  const ms = timer ? remaining(timer) : habit.minutes * 60000;
  const seconds = Math.ceil(ms / 1000);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const status = !timer ? 'ready' : !ms ? 'finished' : timer.endsAt === null ? 'paused' : 'running';
  if (force || panel.dataset.status !== status) {
    const primary = { ready: ['Begin session', 'timer-start', 'play'], running: ['Pause', 'timer-pause', 'pause'], paused: ['Resume', 'timer-resume', 'play'], finished: ['Log session', 'timer-log', 'check'] }[status];
    panel.dataset.status = status;
    panel.innerHTML = `<div class="clock"><output aria-live="off" aria-label="Remaining time"></output><span>${{ ready: 'Ready when you are', running: 'Session in progress', paused: 'Paused', finished: 'Session complete' }[status]}</span></div>
      <button class="primary full-button" data-action="${primary[1]}" data-id="${habit.id}">${icon(primary[2], 20)}${primary[0]}</button>
      ${timer ? '<button class="subtle full-button" data-action="timer-reset">Discard timer</button>' : ''}`;
  }
  const output = panel.querySelector('output');
  if (output.textContent !== time) output.textContent = time;
}

function complete(habit, fromTimer = false) {
  if (!scheduled([habit], today).length) return;
  const before = coreEvolution(state.logs.length);
  const beforeCharge = chargeFor(today);
  const beforeSkill = mastery(state.logs, habit.id).level;
  const minutes = fromTimer ? state.timer.minutes : habit.minutes;
  if (!logSession(state, habit.id, today, minutes)) return;
  if (state.timer?.id === habit.id) state.timer = null;
  undoLog = { id: habit.id, day: today };
  save();
  if (sheet.open) sheet.close();
  render();
  const after = coreEvolution(state.logs.length);
  const afterCharge = chargeFor(today);
  const afterSkill = mastery(state.logs, habit.id).level;
  animateCore(document.querySelector('.core-card'), beforeCharge, afterCharge);
  let message = afterCharge.ratio === 1 ? 'Core fully charged for today.' : 'Core charged · Session logged.';
  if (after.level > before.level) message = `${rankName(after.level)} core unlocked!`;
  if (afterSkill > beforeSkill) message += ` · Skill level ${afterSkill}`;
  say(message, true);
  screen.querySelector(`[data-action="toggle"][data-id="${habit.id}"]`)?.focus({ preventScroll: true });
}

function settings() {
  openSheet('Settings', 'Your habits and session history are saved in this browser.', `
    <label class="theme-picker">Theme
      <select id="theme-select">${Object.entries(themes).map(([id, name]) => `<option value="${id}" ${theme === id ? 'selected' : ''}>${name}</option>`).join('')}</select>
    </label>
    <div class="settings-detail">${icon('today', 21)}<div><strong>Daily check-in</strong><p>Open Step by Step to see today’s activities and any available target increases.</p></div></div>
    ${standalone ? '' : '<button class="primary full-button" data-action="install">Install Step by Step</button>'}
    <button class="subtle full-button" data-action="export">Download activity data</button>`);
}

async function installApp() {
  if (installPrompt) {
    const request = installPrompt;
    installPrompt = null;
    try {
      await request.prompt();
      const choice = await request.userChoice;
      if (choice.outcome === 'accepted') {
        sheet.close();
        return;
      }
    } catch {
      // The browser menu remains available when a native prompt expires.
    }
  }
  openSheet('Install Step by Step', 'Open this website in your phone’s browser.', `
    <div class="install-guide"><p><strong>Android Chrome</strong><br>Tap ⋮, then Add to Home screen or Install app.</p>
    <p><strong>iPhone Safari</strong><br>Tap Share, then Add to Home Screen.</p></div>
    <button class="subtle full-button" data-action="close">Done</button>`);
}

function exportData() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ habits: state.habits, logs: state.logs }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `step-by-step-${today}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function syncDay() {
  const current = dayKey();
  if (current === today) return;
  if (selected === today) selected = current;
  if (progressWeek === today) progressWeek = current;
  today = current;
  render();
}

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'habit-form') return;
  event.preventDefault();
  syncDay();
  const form = event.target;
  const data = new FormData(form);
  const name = String(data.get('name')).trim();
  const minutes = Number(data.get('minutes'));
  const step = Number(data.get('step'));
  const cap = step ? Number(data.get('cap')) : minutes;
  const error = form.querySelector('.form-error');
  if (!name || cap < minutes) {
    error.textContent = !name ? 'Enter an activity name.' : 'Maximum minutes must be at least the daily target.';
    error.hidden = false;
    form.elements[!name ? 'name' : 'cap'].focus();
    return;
  }
  const habit = state.habits.find((item) => item.id === form.dataset.id);
  const values = { name, category: data.get('category'), minutes, step, cap };
  if (habit) {
    if (habit.minutes !== minutes) habit.targetSince = today;
    Object.assign(habit, values);
  } else {
    state.habits.push({ ...values, id: crypto.randomUUID(), created: today, targetSince: today });
    selected = today;
  }
  save();
  sheet.close();
  render({ resetScroll: true });
  say(habit ? 'Habit updated.' : 'Daily habit added.');
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'theme-select') {
    applyTheme(event.target.value, true);
    return;
  }
  if (event.target.name !== 'step') return;
  const control = sheet.querySelector('[data-cap]');
  control.hidden = event.target.value === '0';
  control.querySelector('input').disabled = control.hidden;
  control.querySelector('input').required = !control.hidden;
});

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action], [data-route]');
  if (!trigger) return;
  syncDay();
  const { action, id, date } = trigger.dataset;
  const habit = state.habits.find((item) => item.id === id);
  if (trigger.dataset.route === 'today' && route === 'today' && selected !== today) {
    selected = today;
    render({ resetScroll: true });
  }
  switch (action) {
    case 'date':
      selected = date;
      render({ resetScroll: true });
      screen.querySelector(`[data-date="${date}"]`)?.focus({ preventScroll: true });
      break;
    case 'week-prev':
    case 'week-next':
      progressWeek = shiftDay(progressWeek, action === 'week-prev' ? -7 : 7);
      render();
      screen.querySelector(`[data-action="${action}"]:not(:disabled)`)?.focus({ preventScroll: true });
      break;
    case 'add': habitForm(); break;
    case 'edit': habitForm(habit); break;
    case 'close': sheet.close(); break;
    case 'timer': timerSheet(habit); break;
    case 'open-current': {
      const current = state.habits.find((item) => item.id === state.timer?.id);
      if (current) timerSheet(current);
      break;
    }
    case 'timer-start':
      if (state.timer) return;
      state.timer = { id, minutes: habit.minutes, remainingMs: habit.minutes * 60000, endsAt: Date.now() + habit.minutes * 60000 };
      save();
      updateTimer();
      break;
    case 'timer-pause':
      if (!state.timer || state.timer.id !== id) return;
      state.timer.remainingMs = remaining(state.timer);
      state.timer.endsAt = null;
      save();
      updateTimer();
      break;
    case 'timer-resume':
      if (!state.timer || state.timer.id !== id) return;
      state.timer.endsAt = Date.now() + state.timer.remainingMs;
      save();
      updateTimer();
      break;
    case 'timer-reset':
      state.timer = null;
      save();
      updateTimer();
      render();
      break;
    case 'timer-log':
      if (state.timer?.id === id && !remaining(state.timer)) complete(habit, true);
      break;
    case 'toggle':
      if (entry(state, id, today)) {
        removeLog(state, id, today);
        save();
        render();
        say('Session removed.');
        screen.querySelector(`[data-action="toggle"][data-id="${id}"]`)?.focus({ preventScroll: true });
      } else {
        complete(habit);
      }
      break;
    case 'undo':
      if (!undoLog) return;
      removeLog(state, undoLog.id, undoLog.day);
      undoLog = null;
      save();
      render();
      say('Session removed.');
      break;
    case 'raise': {
      const target = nextTarget(state, habit);
      if (!target) return;
      openSheet('Ready for a little more?', `You’ve completed at least ${TARGET_SESSIONS} sessions of ${safe(habit.name)} at ${habit.minutes} minutes.`, `
        <button class="primary full-button" data-action="accept-raise" data-id="${id}">Increase to ${target} min</button>
        <button class="subtle full-button" data-action="close">Keep ${habit.minutes} min</button>`);
      break;
    }
    case 'accept-raise': {
      const target = nextTarget(state, habit);
      if (target) {
        habit.minutes = target;
        habit.targetSince = today;
        save();
        sheet.close();
        render();
        say(`Daily target set to ${target} minutes.`);
      }
      break;
    }
    case 'archive':
      openSheet('Archive this habit?', `${safe(habit.name)} will leave your daily list. Completed sessions will stay in your history.`, `
        <button class="primary full-button" data-action="confirm-archive" data-id="${id}">Archive habit</button>
        <button class="subtle full-button" data-action="edit" data-id="${id}">Go back</button>`);
      break;
    case 'confirm-archive':
      habit.archived = today;
      habit.inactivePeriods = [...(habit.inactivePeriods || []), { from: today }];
      if (state.timer?.id === id) state.timer = null;
      save();
      sheet.close();
      render();
      say('Habit archived.');
      break;
    case 'restore': {
      const period = habit.inactivePeriods?.at(-1);
      if (period) period.to = today;
      delete habit.archived;
      save();
      render();
      say('Habit restored.');
      break;
    }
    case 'core-info': coreInfo(); break;
    case 'pulse-core': {
      const card = trigger.closest('.core-card');
      animateCore(card);
      break;
    }
    case 'settings': settings(); break;
    case 'install': void installApp(); break;
    case 'export': exportData(); break;
  }
});

sheet.addEventListener('close', () => {
  if (dialogOrigin?.isConnected) dialogOrigin.focus({ preventScroll: true });
});

window.addEventListener('hashchange', () => {
  route = readRoute();
  if (route === 'today') selected = today;
  render({ resetScroll: true });
});

window.addEventListener('storage', (event) => {
  if (event.key === themeKey) {
    applyTheme(event.newValue);
    const selector = document.querySelector('#theme-select');
    if (selector) selector.value = theme;
    return;
  }
  if (event.key !== key) return;
  state = load();
  render();
  updateTimer();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    syncDay();
    updateTimer();
  }
});

setInterval(() => {
  syncDay();
  updateTimer();
}, 400);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Offline setup could not start', error));
}

for (const target of document.querySelectorAll('[data-icon]')) target.innerHTML = icon(target.dataset.icon);
render();
if (!storageAvailable) say('Browser storage is unavailable. Changes may be lost on reload.');
