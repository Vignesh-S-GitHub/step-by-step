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

export function scheduled(habits, day) {
  return habits.filter((habit) =>
    day >= habit.created && (!habit.archived || day < habit.archived) &&
    !habit.inactivePeriods?.some(({ from, to }) => day >= from && (!to || day < to)) &&
    (!Array.isArray(habit.weekdays) || habit.weekdays.includes(localDate(day).getDay()))
  );
}

export function entry(state, id, day) {
  return state.logs.find((log) => log.id === id && log.day === day);
}

export function logSession(state, id, day, minutes) {
  if (entry(state, id, day)) return false;
  state.logs.push({ id, day, minutes });
  return true;
}

export function removeLog(state, id, day) {
  const original = state.logs.length;
  state.logs = state.logs.filter((log) => log.id !== id || log.day !== day);
  return original !== state.logs.length;
}

export function deleteHabit(state, id) {
  const habits = state.habits.filter((habit) => habit.id !== id);
  if (habits.length === state.habits.length) return state;

  return {
    ...state,
    habits,
    logs: state.logs.filter((log) => log.id !== id),
    timer: state.timer?.id === id ? null : state.timer,
  };
}

export function nextTarget(state, habit) {
  if (!habit.step || habit.minutes >= habit.cap) return null;
  const sessions = state.logs.filter((log) =>
    log.id === habit.id && log.day >= habit.targetSince && log.minutes >= habit.minutes
  ).length;
  return sessions >= TARGET_SESSIONS ? Math.min(habit.minutes + habit.step, habit.cap) : null;
}

export const milestones = [1, 3, 7, 14, 25];

export function coreCharge(logs, day, scheduledTotal) {
  const done = logs.filter((log) => log.day === day).length;
  const total = Math.max(done, scheduledTotal);
  const ratio = total ? done / total : 0;
  const crystals = total <= 12 ? done : Math.ceil(ratio * 12);
  return { done, total, ratio, crystals };
}

export function coreEvolution(count) {
  const finalMilestone = milestones.at(-1);
  if (count >= finalMilestone) {
    const tier = Math.floor(count / finalMilestone);
    return { level: milestones.length - 1 + tier, previous: tier * finalMilestone, next: (tier + 1) * finalMilestone };
  }
  const level = milestones.filter((value) => count >= value).length;
  return { level, previous: milestones[level - 1] ?? 0, next: milestones[level] };
}

export function mastery(logs, id) {
  const sessions = logs.filter((log) => log.id === id).length;
  const level = milestones.filter((threshold) => sessions >= threshold).length;
  return { sessions, level, next: milestones[level] ?? null };
}

export function remaining(timer, now = Date.now()) {
  return timer.endsAt === null ? timer.remainingMs : Math.max(0, timer.endsAt - now);
}
