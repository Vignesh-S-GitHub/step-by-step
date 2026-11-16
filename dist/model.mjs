export const TARGET_SESSIONS = 5;

export function dayKey(date = new Date()) {
  const two = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function localDate(day) {
  return new Date(day + 'T12:00:00');
}

export function shiftDay(day, offset) {
  const date = localDate(day);
  date.setDate(date.getDate() + offset);
  return dayKey(date);
}

export function weekDays(day) {
  const offset = (localDate(day).getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => shiftDay(day, i - offset));
}

export function checkInDays(today) {
  const days = weekDays(today);
  const yesterday = shiftDay(today, -1);
  return days[0] === today ? [yesterday, ...days.slice(0, -1)] : days;
}

export function canEditCheckIn(day, today) {
  return day === today || day === shiftDay(today, -1);
}

export function normalizeWeeklyGoal(goal) {
  return Number.isInteger(goal) && goal >= 1 && goal <= 7 ? goal : null;
}

export function weeklyGoalProgress(logs, today, goal) {
  const target = normalizeWeeklyGoal(goal);
  if (target === null) return null;
  const [monday] = weekDays(today);
  const days = new Set(logs.filter(({ day }) => day >= monday && day <= today).map(({ day }) => day));
  return { days: days.size, target };
}

export function scheduled(habits, day) {
  return habits.filter((habit) =>
    day >= habit.created && (!habit.archived || day < habit.archived) &&
    !habit.inactivePeriods?.some(({ from, to }) => day >= from && (!to || day < to)) &&
    (!Array.isArray(habit.weekdays) || habit.weekdays.includes(localDate(day).getDay()))
  );
}

export function partitionHabits(habits, logs, day) {
  const completedIds = new Set(logs.filter((log) => log.day === day).map((log) => log.id));
  const pending = [];
  const completed = [];
  for (const habit of habits) {
    (completedIds.has(habit.id) ? completed : pending).push(habit);
  }
  return { pending, completed };
}

export function entry(state, id, day) {
  return state.logs.find((log) => log.id === id && log.day === day);
}

export function logSession(state, id, day, minutes, golden = false) {
  if (entry(state, id, day)) return false;
  state.logs.push({ id, day, minutes });
  if (golden) (state.goldenSteps ??= []).push(state.logs.length);
  return true;
}

export function removeLog(state, id, day) {
  const original = state.logs.length;
  Object.assign(state, keepSessions(state, (log) => log.id !== id || log.day !== day));
  return original !== state.logs.length;
}

export function deleteHabit(state, id) {
  const habits = state.habits.filter((habit) => habit.id !== id);
  if (habits.length === state.habits.length) return state;

  return {
    ...state,
    habits,
    ...keepSessions(state, (log) => log.id !== id),
    timer: state.timer?.id === id ? null : state.timer,
  };
}

function keepSessions(state, keep) {
  // Step numbers follow save order. Reindex surviving golden sessions after a removal.
  const golden = new Set(state.goldenSteps);
  const logs = [];
  const goldenSteps = [];
  state.logs.forEach((log, index) => {
    if (!keep(log)) return;
    logs.push(log);
    if (golden.has(index + 1)) goldenSteps.push(logs.length);
  });
  return state.goldenSteps ? { logs, goldenSteps } : { logs };
}

export const stepsPerZone = 8;
export const zones = [
  { name: 'Ground level', distance: '0 km' },
  { name: 'Sky', distance: '10 km' },
  { name: 'Atmosphere edge', distance: '100 km' },
  { name: 'Low Earth orbit', distance: '400 km' },
  { name: 'The Moon', distance: '384,000 km' },
  { name: 'Solar system', distance: '150 million km' },
  { name: 'Milky Way', distance: '100,000 light-years' },
  { name: 'The universe', distance: '93 billion light-years' },
  { name: '', distance: '' },
];

export function zoneIndex(sessions) {
  return Math.min(zones.length - 1, Math.floor(Math.max(0, sessions) / stepsPerZone));
}

export function skyPhase(hour) {
  if (hour < 5 || hour >= 21) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}

export function nextDestination(sessions) {
  const next = zoneIndex(sessions) + 1;
  if (next >= zones.length) return null;
  return { name: zones[next].name || 'Beyond', remaining: next * stepsPerZone - sessions };
}

export function normalizeGoldenSteps(steps, total) {
  if (!Array.isArray(steps)) return [];
  return [...new Set(steps.filter((step) => Number.isInteger(step) && step > 0 && step <= total))].sort((a, b) => a - b);
}

const validDay = (day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && dayKey(localDate(day)) === day;
const validMinutes = (minutes) => Number.isInteger(minutes) && minutes >= 1 && minutes <= 180;
const validId = (id) => typeof id === 'string' && /^[a-z0-9_-]{1,80}$/i.test(id);
const invalidBackup = () => new Error('Choose a valid Step by Step JSON backup.');

function readHabit(habit) {
  if (!habit || !validId(habit.id) || typeof habit.name !== 'string' || !habit.name.trim() || habit.name.length > 48 ||
      !validMinutes(habit.minutes) || !validMinutes(habit.cap) || ![0, 1, 2, 5, 10].includes(habit.step) ||
      !validDay(habit.created) || !validDay(habit.targetSince ?? habit.created)) throw invalidBackup();
  const { id, name, minutes, step, cap, created, targetSince = created } = habit;
  const category = ['movement', 'read', 'calm', 'learn', 'write', 'other'].includes(habit.category) ? habit.category : 'other';
  const result = { id, name, minutes, step, cap, created, targetSince, category };
  if (habit.weekdays !== undefined) {
    if (!Array.isArray(habit.weekdays) || !habit.weekdays.length || habit.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw invalidBackup();
    result.weekdays = [...new Set(habit.weekdays)];
  }
  if (habit.archived !== undefined) {
    if (!validDay(habit.archived)) throw invalidBackup();
    result.archived = habit.archived;
  }
  if (habit.inactivePeriods !== undefined) {
    if (!Array.isArray(habit.inactivePeriods)) throw invalidBackup();
    result.inactivePeriods = habit.inactivePeriods.map((period) => {
      if (!period || !validDay(period.from) || (period.to !== undefined && !validDay(period.to))) throw invalidBackup();
      return period.to === undefined ? { from: period.from } : { from: period.from, to: period.to };
    });
  }
  return result;
}

export function mergeBackup(state, backup) {
  if (!Array.isArray(backup?.habits) || !Array.isArray(backup.logs)) throw invalidBackup();
  const habits = new Map(state.habits.map((habit) => [habit.id, habit]));
  const backupIds = new Set();
  for (const source of backup.habits) {
    const habit = readHabit(source);
    if (backupIds.has(habit.id)) throw invalidBackup();
    backupIds.add(habit.id);
    if (!habits.has(habit.id)) habits.set(habit.id, habit);
  }
  const sessionKey = (log) => log.id + ':' + log.day;
  const logs = [...state.logs];
  const indices = new Map(logs.map((log, index) => [sessionKey(log), index + 1]));
  const golden = new Set(normalizeGoldenSteps(state.goldenSteps, logs.length));
  const importedGold = new Set(normalizeGoldenSteps(backup.goldenSteps, backup.logs.length));
  backup.logs.forEach((log, index) => {
    if (!log || !backupIds.has(log.id) || !validDay(log.day) || !validMinutes(log.minutes)) throw invalidBackup();
    const key = sessionKey(log);
    if (!indices.has(key)) {
      logs.push({ id: log.id, day: log.day, minutes: log.minutes });
      indices.set(key, logs.length);
    }
    if (importedGold.has(index + 1)) golden.add(indices.get(key));
  });
  const result = { ...state, habits: [...habits.values()], logs, goldenSteps: [...golden].sort((a, b) => a - b) };
  const goal = normalizeWeeklyGoal(backup.weeklyGoal);
  if (state.weeklyGoal === undefined && goal !== null) result.weeklyGoal = goal;
  return result;
}

export function nextTarget(state, habit) {
  if (!habit.step || habit.minutes >= habit.cap) return null;
  const sessions = state.logs.filter((log) =>
    log.id === habit.id && log.day >= habit.targetSince && log.minutes >= habit.minutes
  ).length;
  return sessions >= TARGET_SESSIONS ? Math.min(habit.minutes + habit.step, habit.cap) : null;
}

export const milestones = [1, 3, 7, 14, 25];

export function dayCompletion(logs, day, scheduledTotal) {
  const done = logs.filter((log) => log.day === day).length;
  const total = Math.max(done, scheduledTotal);
  const ratio = total ? done / total : 0;
  return { done, total, ratio };
}

export function mastery(logs, id) {
  const sessions = logs.filter((log) => log.id === id).length;
  const level = milestones.filter((threshold) => sessions >= threshold).length;
  return { sessions, level, next: milestones[level] ?? null };
}

export function remaining(timer, now = Date.now()) {
  return timer.endsAt === null ? timer.remainingMs : Math.max(0, timer.endsAt - now);
}

export function timerProgress(timer, now = Date.now()) {
  return Math.min(1, Math.max(0, 1 - remaining(timer, now) / (timer.minutes * 60000)));
}

export function moveRocket(position, dx, dy, width, height) {
  if (!width || !height) return position;
  return {
    x: Math.max(-.22, Math.min(.18, position.x + dx / width)),
    y: Math.max(-.12, Math.min(.16, position.y + dy / height)),
  };
}
