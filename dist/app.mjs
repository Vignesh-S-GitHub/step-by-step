import { mount as mountLadder } from './cosmicLadder.js';
import { TARGET_SESSIONS, dayKey, shiftDay, weekDays, scheduled, entry, logSession, removeLog, deleteHabit, nextTarget, dayCompletion, mastery, remaining, mergeBackup, normalizeGoldenSteps, stepsPerZone, zoneIndex, zones, nextDestination, checkInDays, canEditCheckIn, normalizeWeeklyGoal, weeklyGoalProgress, flightTrailSteps, skyPhase, timerProgress } from './model.mjs';

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
  down: '<path d="m6 9 6 6 6-6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  play: '<path d="m8 5 12 7-12 7Z"/>',
  pause: '<path d="M9 5v14m6-14v14"/>',
  up: '<path d="M12 19V5m-5 5 5-5 5 5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/><circle cx="12" cy="12" r="8"/>',
  rotate: '<path d="M3 13a9 9 0 1 0 3.5-8M3 5v8h8"/>',
  planet: '<circle cx="12" cy="12" r="6"/><path d="M16 8c2.6-.7 4.5-.5 5 .4 1 1.8-2.5 5.3-7.6 7.9s-10 3.2-10.9 1.4c-.5-1 .6-2.6 2.6-4.2"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  install: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
};
const categories = { movement: 'Movement', read: 'Reading', calm: 'Mindfulness', learn: 'Learning', write: 'Writing', other: 'Other' };
const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const repeatDays = [[1,'Mo'],[2,'Tu'],[3,'We'],[4,'Th'],[5,'Fr'],[6,'Sa'],[0,'Su']];
const routes = { today: 'Today', habits: 'Habits', progress: 'Progress' };

const themeKey = 'little-step-theme';
const themes = { amethyst: 'Amethyst', lagoon: 'Lagoon', dusk: 'Dusk', orbit: 'Orbit' };
const pickers = {
  category: { label: 'Category', options: Object.entries(categories) },
  step: { label: 'Increase by', options: [0, 1, 2, 5, 10].map((step) => [String(step), step ? step + ' min' : 'Keep current']) },
  theme: { label: 'Theme', options: Object.entries(themes) },
};
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

// Keep the original storage key so existing habits and history carry over.
const key = 'cairn-personal-habits-v1';
const screen = document.querySelector('#screen');
const sheet = document.querySelector('#sheet');
const picker = document.createElement('dialog');
picker.id = 'option-picker';
picker.className = 'option-picker';
picker.setAttribute('aria-labelledby', 'picker-title');
sheet.after(picker);
let pickerTrigger;
const toast = document.querySelector('#toast');
let ladder;
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
    if (stored) {
      const existing = JSON.parse(stored);
      existing.goldenSteps = normalizeGoldenSteps(existing.goldenSteps, existing.logs.length);
      return existing;
    }
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
    goldenSteps: [],
    timer: null,
  };
}

function starter(id, name, category, minutes) {
  return { id, name, category, minutes, step: 5, cap: 20, created: today, targetSince: today };
}

let state = load();
let route = readRoute();

function save(candidate = state) {
  try {
    localStorage.setItem(key, JSON.stringify(candidate));
    storageAvailable = true;
    return true;
  } catch {
    storageAvailable = false;
    say('Browser storage is unavailable. Changes may be lost on reload.');
    return false;
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
  const days = checkInDays(today);
  const yesterday = shiftDay(today, -1);
  return `<div class="week-strip" aria-label="Check-in calendar">${days.map((day) => {
    const possible = scheduled(state.habits, day).length;
    const completed = state.logs.filter((log) => log.day === day).length;
    const fullDate = dateLabel(day, { weekday: 'long', month: 'long', day: 'numeric' });
    const relative = day === today ? ', today' : day === yesterday ? ', yesterday' : '';
    return `<button class="day ${day === today ? 'day-today' : ''}" data-action="date" data-date="${day}" ${day > today ? 'disabled' : ''} aria-pressed="${day === selected}" aria-label="${fullDate}${relative}${completed ? ', ' + countLabel(completed, 'session') : ''}">
      <span>${dateLabel(day, { weekday: 'narrow' })}</span><strong>${day.slice(-2).replace(/^0/, '')}</strong><i class="${completed ? possible && completed >= possible ? 'full' : 'partial' : ''}"></i>
    </button>`;
  }).join('')}</div>`;
}

function chargeFor(day) {
  return dayCompletion(state.logs, day, scheduled(state.habits, day).length);
}

function ladderCard() {
  return `<section class="ladder-card" aria-labelledby="ladder-title">
    <button class="ladder-stage" aria-disabled="true" type="button" aria-label="Cosmic Flight" aria-describedby="ladder-controls">
      <span class="ladder-fallback" aria-hidden="true">
        <svg viewBox="0 0 82 140" focusable="false">
          <path fill="var(--sky-a)" d="M30 84C20 88 14 100 11 111L31 105ZM53 83c11 5 16 17 18 27l-20-6Z"/>
          <path fill="var(--accent)" d="M33 103h16c4 10-2 22-8 36-6-14-12-26-8-36Z"/>
          <path fill="var(--ink)" d="M37 103h8c2 8-2 16-4 22-2-6-6-14-4-22Z"/>
          <path fill="var(--muted)" d="M41 4C19 26 17 75 29 98c3 7 21 7 24 0C65 75 63 26 41 4Z"/>
          <path fill="var(--accent)" d="M41 4c-6 6-11 14-15 25 9 4 20 4 30 0C52 18 47 10 41 4Z"/>
          <circle cx="41" cy="53" r="11" fill="var(--sky-b)" stroke="var(--sky-a)" stroke-width="3"/>
          <path stroke="var(--ink)" stroke-linecap="round" stroke-width="2" opacity=".75" d="M36 52c1-2 3-4 5-4"/>
        </svg>
      </span>
    </button>
    <svg class="flight-trail" viewBox="0 0 180 70" preserveAspectRatio="none" aria-hidden="true">
      <path class="flight-trail-guide" pathLength="100" d="M6 62C59 60 103 53 141 24Q152 15 158 5"/>
      <path class="flight-trail-live" pathLength="100" d="M6 62C59 60 103 53 141 24Q152 15 158 5"/>
    </svg>
    <div class="ladder-copy">
      <h2 id="ladder-title">Cosmic Flight</h2>
      <p class="ladder-zone" data-ladder-label="zone"></p>
      <strong class="ladder-count" data-ladder-label="count"></strong>
      <p class="ladder-charge" data-ladder-charge></p>
      <p class="ladder-next" data-ladder-next hidden>${icon('planet', 13)} <span></span></p>
    </div>
    <button class="icon-button ladder-route" data-action="ladder-info" aria-label="Cosmic Flight journey">${icon('spark', 18)}</button>
    <span class="ladder-guide" id="ladder-controls">${icon('rotate', 13)} Drag to move</span>
  </section>`;
}

function journey() {
  return `<ol class="ladder-journey">${zones.slice(0, -1).map(({ name, distance }, index) => `<li class="${zoneIndex(state.logs.length) === index ? 'current' : ''}">
    ${icon(state.logs.length >= index * stepsPerZone ? 'check' : 'spark', 15)}
    <span>${name}<small>${distance}</small></span>
    <small>${countLabel(index * stepsPerZone, 'step')}</small>
  </li>`).join('')}</ol>`;
}

function ladderInfo() {
  openSheet('Cosmic Flight journey', 'Every completed session adds a step. A new zone opens every eight steps.', `
    ${journey()}<button class="subtle full-button" data-action="close">Done</button>`);
}

function skillLabel(habit, manage) {
  if (!manage) return '';
  const skill = mastery(state.logs, habit.id);
  return `<span>${skill.level ? `Level ${skill.level}` : 'Level 1 after your first session'}${skill.level && skill.next ? ` · ${countLabel(skill.next - skill.sessions, 'session')} to next` : ''}</span>`;
}

function row(habit, manage = false) {
  const logged = entry(state, habit.id, selected);
  const editable = route === 'today' && canEditCheckIn(selected, today);
  const category = categories[habit.category] ? habit.category : 'other';
  const running = state.timer?.id === habit.id;
  return `<li class="habit-row ${logged && !manage ? 'is-done' : ''}" data-habit-row="${habit.id}">
    <span class="habit-icon ${category}">${icon(category, 21)}</span>
    <div class="habit-copy"><strong>${safe(habit.name)}</strong><span>${manage ? `${habit.minutes} min daily${habit.step ? ' · Gradual increase' : ''}` : logged ? `${logged.minutes} min · Completed` : `${habit.minutes} min · Daily`}</span>${skillLabel(habit, manage)}</div>
    ${manage
      ? `<button class="icon-button" data-action="edit" data-id="${habit.id}" aria-label="Edit ${safe(habit.name)}">${icon('chevron', 20)}</button>`
      : editable
        ? `<div class="row-actions">${logged || selected !== today ? '' : `<button class="icon-button timer-button ${running ? 'running' : ''}" data-action="timer" data-id="${habit.id}" aria-label="${running ? 'Open active timer for' : 'Timer for'} ${safe(habit.name)}">${icon('timer', 21)}</button>`}<button class="check-button ${logged ? 'checked' : ''}" data-action="toggle" data-id="${habit.id}" data-check-in-day="${selected}" aria-label="${logged ? 'Undo' : 'Complete'} ${safe(habit.name)}${selected !== today ? ' for yesterday' : ''}" aria-pressed="${Boolean(logged)}">${icon('check', 18)}</button></div>`
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
  const title = selected === today ? 'Daily activities' : selected === shiftDay(today, -1) ? 'Yesterday’s activities' : 'Activity log';
  return `${dateStrip()}<div data-ladder-slot></div>
    <section class="habit-section" aria-labelledby="activity-title">
      <div class="section-title"><h2 id="activity-title">${title}</h2><span class="completion ${allDone ? 'all-done' : ''}">${allDone ? icon('check', 15) : ''}${currentCount} / ${visible.length} done</span></div>
      ${suggestion ? `<button class="suggestion" data-action="raise" data-id="${suggestion.id}">${icon('up', 16)}<span><strong>${safe(suggestion.name)}</strong> is ready for ${nextTarget(state, suggestion)} min</span>${icon('chevron', 17)}</button>` : ''}
      ${visible.length ? `<ul class="habit-list">${visible.map((habit) => row(habit)).join('')}</ul>` : `<div class="empty"><p>${selected === today ? 'Make room for one small habit.' : 'No activities scheduled for this day.'}</p>${selected === today ? '<button class="small-action" data-action="add">Add a habit</button>' : ''}</div>`}
    </section>`;
}

function habitsScreen() {
  const habits = state.habits.filter((habit) => !habit.archived && habit.created <= today);
  const archived = state.habits.filter((habit) => habit.archived);
  return `<section class="habit-section manage-section" aria-labelledby="manage-title"><div class="section-title"><h2 id="manage-title">Your habits</h2><span class="completion">${countLabel(habits.length, 'habit')}</span></div>
    ${habits.length ? `<ul class="habit-list">${habits.map((habit) => row(habit, true)).join('')}</ul>` : '<div class="empty"><p>Start with one activity you can do in five minutes.</p><button class="small-action" data-action="add">Add a habit</button></div>'}
    ${archived.length ? `<details class="archived"><summary>Archived habits (${archived.length})</summary><ul class="habit-list">${archived.map((habit) => `<li class="habit-row"><div class="habit-copy"><strong>${safe(habit.name)}</strong></div><button class="small-action" data-action="restore" data-id="${habit.id}">Restore</button><button class="icon-button danger" data-action="delete-habit" data-id="${habit.id}" aria-label="Delete ${safe(habit.name)}">${icon('trash', 19)}</button></li>`).join('')}</ul></details>` : ''}
  </section>`;
}

function weeklyGoalCard() {
  const progress = weeklyGoalProgress(state.logs, today, state.weeklyGoal);
  const met = progress && progress.days >= progress.target;
  const detail = progress
    ? (met ? `${countLabel(progress.days, 'day')} · Goal reached` : `${progress.days} of ${progress.target} days this week`)
    : 'Pick how many days you want to show up.';
  return `<section class="weekly-goal" aria-labelledby="weekly-goal-title">
    ${progress ? `<div class="goal-ring" role="progressbar" aria-label="Days logged this week"
      aria-valuemax="${progress.target}" aria-valuenow="${Math.min(progress.days, progress.target)}"
      aria-valuetext="${countLabel(progress.days, 'day')} logged, goal ${progress.target}" style="--goal-turn:${Math.min(1, progress.days / progress.target)}turn">
      <span aria-hidden="true">${met ? icon('check', 19) : `${progress.days}/${progress.target}`}</span>
    </div>` : ''}
    <div class="goal-copy"><h2 id="weekly-goal-title">Weekly goal</h2><p>${detail}</p></div>
    <button class="small-action" data-action="weekly-goal">${progress ? 'Edit goal' : 'Set goal'}</button>
  </section>`;
}

function weeklyGoalSheet() {
  const current = normalizeWeeklyGoal(state.weeklyGoal);
  openSheet('Weekly goal', 'Choose how many days to check in. Each day with a completed habit counts once.',
    `<div class="goal-options" role="group" aria-label="Days per week">${weekdays.map((_, index) => {
      const days = index + 1;
      return `<button type="button" data-action="set-weekly-goal" data-days="${days}" aria-label="${countLabel(days, 'day')} per week" aria-pressed="${days === current}">${days}</button>`;
    }).join('')}</div>
    ${current ? '<button class="subtle full-button" data-action="set-weekly-goal" data-days="off">Turn off weekly goal</button>' : ''}`);
}

function progressScreen() {
  const total = state.logs.length;
  const zone = zones[zoneIndex(total)];
  const days = weekDays(progressWeek);
  const first = days[0];
  const last = days[6];
  const weeklyCounts = days.map((day) => state.logs.filter((log) => log.day === day).length);
  const max = Math.max(1, ...weeklyCounts);
  const minutes = state.logs.reduce((sum, log) => sum + log.minutes, 0);
  const monthDay = { month: 'short', day: 'numeric' };
  return `<div class="progress-grid">
    <section class="week-report" aria-labelledby="week-title">
      <div class="section-title"><h2 id="week-title">Weekly activity</h2><div class="week-actions">
      <button class="icon-button" data-action="week-prev" aria-label="Previous week">${icon('left', 20)}</button><button class="icon-button" data-action="week-next" aria-label="Next week" ${last >= today ? 'disabled' : ''}>${icon('chevron', 20)}</button></div></div>
      <p>${dateLabel(first, monthDay)} – ${dateLabel(last, monthDay)}</p>
      <div class="chart" aria-label="Sessions completed each day">${weeklyCounts.map((count, i) => `<div class="chart-column" aria-label="${dateLabel(days[i], { weekday: 'long' })}, ${countLabel(count, 'session')}"><span class="bar-count">${count || '–'}</span><span class="bar-track"><i style="--height:${count / max}"></i></span><span>${weekdays[i]}</span></div>`).join('')}</div>
    </section>
    <section class="totals" aria-label="All-time activity"><div><strong>${total}</strong><span>Sessions</span></div><div><strong>${minutes}</strong><span>Minutes</span></div><div><strong>${state.goldenSteps.length}</strong><span>Golden steps</span></div></section>
    ${weeklyGoalCard()}
    <section class="collection" aria-labelledby="journey-title"><div class="section-title"><h2 id="journey-title">Cosmic Flight</h2>${zone.name ? `<span class="completion">${zone.name}</span>` : ''}</div>${journey()}</section>
  </div>`;
}

function render({ resetScroll = false } = {}) {
  const previousRoute = screen.dataset.route;
  const existingLadder = screen.querySelector('.ladder-card');
  if (route !== 'today' && ladder) {
    ladder.destroy();
    ladder = undefined;
  }
  const todayCharge = dayCompletion(state.logs, today, scheduled(state.habits, today).length);
  document.documentElement.style.setProperty('--momentum', String(todayCharge.ratio));
  navigation();
  document.querySelector('#screen-title').textContent = routes[route];
  document.querySelector('#screen-subtitle').textContent = route === 'today'
    ? dateLabel(selected, { weekday: 'long', month: 'long', day: 'numeric' })
    : route === 'habits' ? 'Set a pace you can come back to.' : 'See how far your daily steps have taken you.';
  document.querySelector('.top-add').hidden = route === 'progress';
  screen.dataset.route = route;
  const scrollAt = resetScroll ? 0 : (screen.querySelector('.habit-list')?.scrollTop || 0);
  screen.innerHTML = ({ today: todayScreen, habits: habitsScreen, progress: progressScreen })[route]();
  if (route === 'today') {
    const slot = screen.querySelector('[data-ladder-slot]');
    if (existingLadder) slot.replaceWith(existingLadder);
    else slot.outerHTML = ladderCard();
    const card = screen.querySelector('.ladder-card');
    const charge = chargeFor(selected);
    const trailSteps = flightTrailSteps(state.logs.length);
    const trail = card.querySelector('.flight-trail');
    trail.style.setProperty('--trail-fill', String(trailSteps / stepsPerZone * 100));
    trail.classList.toggle('is-lit', trailSteps > 0);
    const destination = nextDestination(state.logs.length);
    const next = card.querySelector('[data-ladder-next]');
    next.hidden = !destination;
    if (destination) next.querySelector('span').textContent = countLabel(destination.remaining, 'step') + ' to ' + destination.name;
    card.querySelector('[data-ladder-charge]').textContent = (selected === today ? 'Today' : 'Selected day') + ' · ' + charge.done + ' / ' + charge.total + ' sessions';
    ladder ??= mountLadder(card);
    ladder.setProgress(state.logs.length, state.goldenSteps);
  }
  if (scrollAt && screen.querySelector('.habit-list')) screen.querySelector('.habit-list').scrollTop = scrollAt;
  if (resetScroll) screen.scrollTop = 0;
  updateActiveHabit();
  if (previousRoute !== route && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const easing = 'cubic-bezier(.22,.7,.25,1)';
    if (previousRoute) {
      const direction = Object.keys(routes).indexOf(route) > Object.keys(routes).indexOf(previousRoute) ? 1 : -1;
      screen.animate([{ opacity: .55, transform: 'translateX(' + direction * 11 + 'px)' }, { opacity: 1, transform: 'translateX(0)' }],
        { duration: 205, easing });
    } else {
      const cards = screen.querySelectorAll('.ladder-card,.habit-section,.week-report,.totals,.weekly-goal,.collection');
      cards.forEach((card, index) => card.animate([{ opacity: .4, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 290, delay: index * 35, easing, fill: 'backwards' }));
    }
  }
}

function openSheet(title, description, content, kind = '') {
  const open = sheet.open;
  if (!open) dialogOrigin = document.activeElement;
  sheet.dataset.kind = kind;
  sheet.innerHTML = `<div class="sheet-body"><div class="sheet-header"><div><h2 id="sheet-title">${title}</h2>${description ? `<p>${description}</p>` : ''}</div><button class="icon-button" data-action="close" aria-label="Close">${icon('close', 22)}</button></div>${content}</div>`;
  if (!open) sheet.showModal();
}

function pickerField(name, value) {
  const { label, options } = pickers[name];
  const current = options.find(([id]) => id === String(value)) || options[0];
  return `<div class="picker-field ${name === 'theme' ? 'theme-picker' : ''}">
    <span id="picker-label-${name}">${label}</span>
    <input type="hidden" name="${name}" value="${current[0]}">
    <button class="picker-trigger" type="button" data-action="open-picker" data-picker="${name}"
      aria-haspopup="dialog" aria-controls="option-picker" aria-labelledby="picker-label-${name} picker-value-${name}">
      <span id="picker-value-${name}">${current[1]}</span>${icon('down', 16)}
    </button>
  </div>`;
}

function setPickerValue(trigger, value) {
  const name = trigger.dataset.picker;
  const option = pickers[name].options.find(([id]) => id === value);
  if (!option) return;
  const input = trigger.previousElementSibling;
  input.value = value;
  trigger.querySelector('span').textContent = option[1];
  if (picker.open && pickerTrigger === trigger) {
    for (const button of picker.querySelectorAll('[data-option]')) {
      button.setAttribute('aria-pressed', String(button.dataset.option === value));
    }
  }
  return input;
}

function openPicker(trigger) {
  const { label, options } = pickers[trigger.dataset.picker];
  const selectedValue = trigger.previousElementSibling.value;
  pickerTrigger = trigger;
  picker.innerHTML = `<div class="sheet-body">
    <div class="sheet-header"><h2 id="picker-title">${label}</h2><button class="icon-button" data-picker-close type="button" aria-label="Close options">${icon('close')}</button></div>
    <ul class="picker-options">${options.map(([id, text]) => `<li>
      <button type="button" data-option="${id}" aria-pressed="${id === selectedValue}">${text}${icon('check', 19)}</button>
    </li>`).join('')}</ul>
  </div>`;
  picker.showModal();
  picker.querySelector('[aria-pressed="true"]').focus();
}

picker.addEventListener('click', (event) => {
  if (event.target === picker || event.target.closest('[data-picker-close]')) {
    picker.close();
    return;
  }
  const option = event.target.closest('[data-option]');
  if (!option) return;
  const input = setPickerValue(pickerTrigger, option.dataset.option);
  picker.close();
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

picker.addEventListener('keydown', (event) => {
  const current = event.target.closest('[data-option]');
  if (!current || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const options = [...picker.querySelectorAll('[data-option]')];
  const index = options.indexOf(current);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
    : (index + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
  event.preventDefault();
  options[next].focus();
});

picker.addEventListener('close', () => {
  if (pickerTrigger?.isConnected) pickerTrigger.focus({ preventScroll: true });
});

function habitForm(habit) {
  const value = habit || { name: '', category: 'other', minutes: 5, step: 5, cap: 20 };
  openSheet(habit ? 'Edit habit' : 'Add habit', 'Start with a daily target that feels easy to repeat.', `
    <form id="habit-form" data-id="${habit?.id || ''}">
      <label>Activity name<input name="name" maxlength="48" required value="${safe(value.name)}" placeholder="e.g. Stretch after work"></label>
      ${pickerField('category', value.category)}
      <fieldset class="weekday-field"><legend>Repeat on</legend><div class="weekday-options">${repeatDays.map(([day,label]) => `<label class="weekday-option"><input type="checkbox" name="weekdays" value="${day}" ${(value.weekdays ?? [0,1,2,3,4,5,6]).includes(day) ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></fieldset>
      <div class="form-grid"><label>Daily minutes<input name="minutes" type="number" min="1" max="180" required inputmode="numeric" value="${value.minutes}"></label>
      ${pickerField('step', value.step)}</div>
      <label data-cap ${value.step ? '' : 'hidden'}>Maximum minutes<input name="cap" type="number" min="1" max="180" ${value.step ? 'required' : 'disabled'} inputmode="numeric" value="${value.cap}"><small>After ${TARGET_SESSIONS} sessions at your target, Step by Step offers an increase.</small></label>
      <p class="form-error" role="alert" hidden></p>
      <button class="primary full-button" type="submit">${habit ? 'Save changes' : 'Add daily habit'}</button>
      ${habit ? `<div class="form-grid">
        <button class="subtle full-button" type="button" data-action="archive" data-id="${habit.id}">Archive habit</button>
        <button class="subtle full-button danger" type="button" data-action="delete-habit" data-id="${habit.id}">${icon('trash', 17)} Delete habit</button>
      </div>` : ''}
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

function updateActiveHabit() {
  const timer = state.timer;
  if (!timer || route !== 'today' || selected !== today) return;
  const row = screen.querySelector(`[data-habit-row="${timer.id}"]`);
  const ring = row?.querySelector('.check-button:not(.checked)');
  if (!ring) return;
  const now = Date.now();
  const turn = timerProgress(timer, now).toFixed(3) + 'turn';
  if (ring.style.getPropertyValue('--habit-turn') !== turn) ring.style.setProperty('--habit-turn', turn);
  row.classList.toggle('is-timing', timer.endsAt !== null && remaining(timer, now) > 0);
}

function updateTimer(force = false) {
  updateActiveHabit();
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

function complete(habit, { fromTimer = false, day = today } = {}) {
  if (!habit || !canEditCheckIn(day, today) || !scheduled([habit], day).length) return;
  const beforeSkill = mastery(state.logs, habit.id).level;
  const minutes = fromTimer ? state.timer.minutes : habit.minutes;
  const golden = Math.random() < 1 / 6;
  const candidate = { ...state, logs: [...state.logs], goldenSteps: [...state.goldenSteps] };
  if (!logSession(candidate, habit.id, day, minutes, golden)) return;
  if (day === today && candidate.timer?.id === habit.id) candidate.timer = null;
  if (!save(candidate)) return;
  state = candidate;
  undoLog = { id: habit.id, day };
  if (sheet.open) sheet.close();
  ladder?.addStep(golden);
  render();
  const afterSkill = mastery(state.logs, habit.id).level;
  let message = golden ? 'Golden step added!' : day === today ? 'Session logged. Flight advanced.' : 'Yesterday’s session logged.';
  if (afterSkill > beforeSkill) message += ` · Skill level ${afterSkill}`;
  say(message, true);
  screen.querySelector(`[data-action="toggle"][data-id="${habit.id}"]`)?.focus({ preventScroll: true });
}

function removeCompletion(id, day) {
  const candidate = { ...state };
  if (!removeLog(candidate, id, day) || !save(candidate)) return false;
  state = candidate;
  if (undoLog?.id === id && undoLog.day === day) undoLog = null;
  render();
  say('Session removed.');
  return true;
}

function settings() {
  openSheet('Settings', 'Your habits and session history are saved in this browser.', `
    ${pickerField('theme', theme)}
    <div class="settings-detail">${icon('today', 21)}<div><strong>Daily check-in</strong><p>Open Step by Step to see today’s activities and any available target increases.</p></div></div>
    ${standalone ? '' : '<button class="primary full-button" data-action="install">Install Step by Step</button>'}
    <button class="subtle full-button" data-action="export">Download activity data</button>
    <button class="subtle full-button" data-action="import">Import activity data</button>
    <input type="file" id="backup-file" accept=".json,application/json" hidden>`, 'settings');
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
  const url = URL.createObjectURL(new Blob([JSON.stringify({ habits: state.habits, logs: state.logs, goldenSteps: state.goldenSteps, weeklyGoal: state.weeklyGoal }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `step-by-step-${today}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importData(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  try {
    if (file.size > 12 * 1024 * 1024) throw new Error('This backup is too large for browser storage.');
    const backup = JSON.parse(await file.text());
    const before = state.logs.length;
    const next = mergeBackup(state, backup);
    if (!save(next)) {
      throw new Error('Could not save the backup. Existing activity data was kept.');
    }
    state = next;
    if (sheet.open && sheet.dataset.kind === 'settings') sheet.close();
    render();
    say(next.logs.length === before ? 'Backup merged.' : `Imported ${countLabel(next.logs.length - before, 'session')}.`);
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Choose a valid Step by Step JSON backup.' : error.message;
    if (sheet.open && sheet.dataset.kind === 'settings') {
      const feedback = sheet.querySelector('.sheet-header p');
      feedback.setAttribute('role', 'alert');
      feedback.textContent = message;
    } else say(message);
  }
}

function syncDay() {
  const now = new Date();
  const phase = skyPhase(now.getHours());
  if (document.documentElement.dataset.skyTime !== phase) document.documentElement.dataset.skyTime = phase;
  const current = dayKey(now);
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
  const selectedWeekdays = data.getAll('weekdays').map(Number);
  const error = form.querySelector('.form-error');
  if (!selectedWeekdays.length) {
    error.textContent = 'Choose at least one day for this habit.';
    error.hidden = false;
    form.querySelector('input[name="weekdays"]').focus();
    return;
  }
  if (!name || cap < minutes) {
    error.textContent = !name ? 'Enter an activity name.' : 'Maximum minutes must be at least the daily target.';
    error.hidden = false;
    form.elements[!name ? 'name' : 'cap'].focus();
    return;
  }
  const habit = state.habits.find((item) => item.id === form.dataset.id);
  const values = { name, category: data.get('category'), minutes, step, cap, weekdays: selectedWeekdays };
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
  say(habit ? 'Habit updated.' : 'Habit added.');
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'backup-file') {
    void importData(event.target);
    return;
  }
  if (event.target.name === 'theme') {
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
    case 'open-picker': openPicker(trigger); break;
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
      if (state.timer?.id === id && !remaining(state.timer)) complete(habit, { fromTimer: true });
      break;
    case 'toggle': {
      const day = trigger.dataset.checkInDay;
      if (!habit || day !== selected || !canEditCheckIn(day, today)) return;
      if (entry(state, id, day)) {
        if (!removeCompletion(id, day)) return;
        screen.querySelector(`[data-action="toggle"][data-id="${id}"]`)?.focus({ preventScroll: true });
      } else {
        complete(habit, { day });
      }
      break;
    }
    case 'undo':
      if (undoLog) removeCompletion(undoLog.id, undoLog.day);
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
    case 'delete-habit': {
      if (!habit) return;
      const count = state.logs.filter((log) => log.id === id).length;
      const history = count ? ` and ${countLabel(count, 'completed session')}` : '';
      const cancel = habit.archived ? 'close' : 'edit';
      openSheet('Delete this habit?', `${safe(habit.name)}${history} will be permanently deleted.`, `
        <div class="form-grid">
          <button class="subtle full-button" data-action="${cancel}" data-id="${id}" autofocus>Cancel</button>
          <button class="primary full-button danger-primary" data-action="confirm-delete-habit" data-id="${id}">${icon('trash', 17)} Delete habit</button>
        </div>`);
      sheet.querySelector('[autofocus]').focus({ preventScroll: true });
      break;
    }
    case 'confirm-delete-habit': {
      const next = deleteHabit(state, id);
      if (next === state) {
        sheet.close();
        return;
      }
      if (!save(next)) {
        const description = sheet.querySelector('.sheet-header p');
        description.setAttribute('role', 'alert');
        description.textContent = 'Browser storage is unavailable. The habit was kept.';
        return;
      }
      state = next;
      if (undoLog?.id === id) undoLog = null;
      const showArchived = screen.querySelector('.archived')?.open;
      sheet.close();
      render();
      const archived = screen.querySelector('.archived');
      if (showArchived && archived) archived.open = true;
      const focusTarget = showArchived && archived ? archived.querySelector('summary') : document.querySelector('.top-add');
      focusTarget.focus({ preventScroll: true });
      say('Habit deleted.');
      break;
    }
    case 'restore': {
      const period = habit.inactivePeriods?.at(-1);
      if (period) period.to = today;
      delete habit.archived;
      save();
      render();
      say('Habit restored.');
      break;
    }
    case 'weekly-goal': weeklyGoalSheet(); break;
    case 'set-weekly-goal': {
      const days = normalizeWeeklyGoal(Number(trigger.dataset.days));
      if (days === null && trigger.dataset.days !== 'off') return;
      const next = { ...state, weeklyGoal: days };
      if (!save(next)) return;
      state = next;
      sheet.close();
      render();
      screen.querySelector('[data-action="weekly-goal"]')?.focus({ preventScroll: true });
      say(days === null ? 'Weekly goal turned off.' : 'Weekly goal set to ' + countLabel(days, 'day') + '.');
      break;
    }
    case 'ladder-info': ladderInfo(); break;
    case 'settings': settings(); break;
    case 'install': void installApp(); break;
    case 'export': exportData(); break;
    case 'import': sheet.querySelector('#backup-file').click(); break;
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
    const trigger = sheet.querySelector('[data-picker="theme"]');
    if (trigger) setPickerValue(trigger, theme);
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
syncDay();
render();
if (!storageAvailable) say('Browser storage is unavailable. Changes may be lost on reload.');
