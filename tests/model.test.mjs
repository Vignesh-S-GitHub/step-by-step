import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, scheduled, logSession, removeLog, deleteHabit, entry, nextTarget, dayCompletion, remaining, weekDays, mergeBackup, zoneIndex, zones, nextDestination, canEditCheckIn, checkInDays, weeklyGoalProgress, skyPhase, timerProgress, moveRocket } from '../dist/model.mjs';

test('date helpers give predictable local dates', () => {
  assert.equal(dayKey(new Date(2026, 10, 15, 12)), '2026-11-15');
  assert.equal(weekDays('2026-11-15').length, 7);
  assert.equal(weekDays('2026-11-15')[0], '2026-11-09');
});

test('existing habits without weekday selection remain daily', () => {
  const h={id:'legacy',created:'2026-11-01'};
  assert.equal(scheduled([h],'2026-11-15').length,1);
});

test('selected weekdays only show on matching dates', () => {
  const h={id:'mon',created:'2026-11-01',weekdays:[1]};
  assert.equal(scheduled([h],'2026-11-16').length,1);
  assert.equal(scheduled([h],'2026-11-15').length,0);
});

test('archived and paused periods do not appear in schedule', () => {
  assert.equal(scheduled([{id:'a',created:'2026-11-01',archived:'2026-11-12'}],'2026-11-15').length,0);
  assert.equal(scheduled([{id:'b',created:'2026-11-01',inactivePeriods:[{from:'2026-11-14'}]}],'2026-11-15').length,0);
});

test('completions are unique per habit/day and reversible', () => {
  const state={logs:[]};
  assert.equal(logSession(state,'h','2026-11-15',5),true);
  assert.equal(logSession(state,'h','2026-11-15',5),false);
  assert.equal(entry(state,'h','2026-11-15').minutes,5);
  assert.equal(removeLog(state,'h','2026-11-15'),true);
  assert.equal(state.logs.length,0);
});

test('optional growth is offered only after five target sessions', () => {
  const habit={id:'h',minutes:5,step:5,cap:20,targetSince:'2026-11-01'};
  const state={logs:[]};
  for(let i=1;i<=4;i++)logSession(state,'h','2026-11-'+String(i).padStart(2,'0'),5);
  assert.equal(nextTarget(state,habit),null);
  logSession(state,'h','2026-11-05',5);
  assert.equal(nextTarget(state,habit),10);
});

test('day completion and countdown are bounded', () => {
  assert.equal(dayCompletion([{id:'h',day:'2026-11-15'}],'2026-11-15',2).ratio,.5);
  assert.equal(remaining({endsAt:5000,remainingMs:10000},6000),0);
});

test('deleting an active or archived habit removes only its history and timer', () => {
  for (const archived of [undefined, '2026-11-15']) {
    const habit = { id: 'delete', archived };
    const keptHabit = { id: 'keep' };
    const deletedLog = { id: habit.id, day: '2026-11-14', minutes: 5 };
    const keptLog = { id: keptHabit.id, day: '2026-11-14', minutes: 10 };
    const state = { habits: [habit, keptHabit], logs: [deletedLog, keptLog], timer: { id: habit.id } };

    assert.deepEqual(deleteHabit(state, habit.id), { habits: [keptHabit], logs: [keptLog], timer: null });
    assert.deepEqual(state, { habits: [habit, keptHabit], logs: [deletedLog, keptLog], timer: { id: habit.id } });
    assert.equal(deleteHabit(state, keptHabit.id).timer, state.timer);
    assert.equal(deleteHabit(state, 'missing'), state);
  }
});

test('golden steps stay attached to their session when earlier logs are removed', () => {
  const state = { habits: [{ id: 'a' }, { id: 'b' }], logs: [], goldenSteps: [] };
  logSession(state, 'a', '2026-11-12', 5, false);
  logSession(state, 'a', '2026-11-13', 5, true);
  logSession(state, 'b', '2026-11-13', 5, true);
  assert.deepEqual(state.goldenSteps, [2, 3]);
  assert.equal(logSession(state, 'b', '2026-11-13', 5, true), false);
  removeLog(state, 'a', '2026-11-12');
  assert.deepEqual(state.goldenSteps, [1, 2]);
  assert.deepEqual(deleteHabit(state, 'a').goldenSteps, [1]);
});

test('backup merge deduplicates sessions, remaps golden steps and accepts legacy files', () => {
  const makeHabit = (id) => ({ id, name: id, category: 'other', minutes: 5, step: 0, cap: 5, created: '2026-11-01', targetSince: '2026-11-01' });
  const existingLog = { id: 'a', day: '2026-11-15', minutes: 5 };
  const newLog = { id: 'b', day: '2026-11-14', minutes: 5 };
  const state = { habits: [makeHabit('a')], logs: [existingLog], goldenSteps: [], timer: null };
  const backup = { habits: [makeHabit('a'), makeHabit('b')], logs: [newLog, existingLog], goldenSteps: [1] };
  const merged = mergeBackup(state, backup);
  assert.deepEqual(merged.logs, [existingLog, newLog]);
  assert.deepEqual(merged.goldenSteps, [2]);
  assert.deepEqual(mergeBackup(merged, backup), merged);
  assert.deepEqual(mergeBackup(state, { habits: [], logs: [] }), state);
  assert.throws(() => mergeBackup(state, { habits: [], logs: [newLog] }));
  assert.throws(() => mergeBackup(state, { habits: [makeHabit('"><svg')], logs: [] }));
});

test('zones unlock at eight-session intervals and debug preview stays separate', () => {
  assert.deepEqual([0, 7, 8, 39, 40, 63, 64, 30000].map(zoneIndex), [0, 0, 1, 4, 5, 7, 8, 8]);
  assert.equal(zones[4].name, 'The Moon');
  assert.equal(zones[8].name, '');
});

test('next destination uses remaining steps and ends at Beyond', () => {
  assert.deepEqual(nextDestination(0), { name: 'Sky', remaining: 8 });
  assert.deepEqual(nextDestination(7), { name: 'Sky', remaining: 1 });
  assert.deepEqual(nextDestination(8), { name: 'Atmosphere edge', remaining: 8 });
  assert.deepEqual(nextDestination(63), { name: 'Beyond', remaining: 1 });
  assert.equal(nextDestination(64), null);
});

test('yesterday is editable across Monday and year boundaries', () => {
  for (const [today, yesterday] of [['2026-11-16', '2026-11-15'], ['2027-01-01', '2026-12-31']]) {
    assert.ok(checkInDays(today).includes(yesterday));
    assert.ok(checkInDays(today).includes(today));
    assert.equal(checkInDays(today).length, 7);
    assert.ok(canEditCheckIn(yesterday, today));
    assert.ok(canEditCheckIn(today, today));
  }
  assert.equal(canEditCheckIn('2026-11-14', '2026-11-16'), false);
  assert.equal(canEditCheckIn('2026-11-17', '2026-11-16'), false);
});

test('weekly goal counts distinct days, resets Monday, and skips future records', () => {
  const logs = ['2026-11-15', '2026-11-16', '2026-11-16', '2026-11-17', '2026-11-23'].map(day => ({ day }));
  assert.deepEqual(weeklyGoalProgress(logs, '2026-11-16', 4), { days: 1, target: 4 });
  assert.deepEqual(weeklyGoalProgress(logs, '2026-11-17', 4), { days: 2, target: 4 });
  assert.equal(weeklyGoalProgress(logs, '2026-11-17', null), null);
  assert.equal(weeklyGoalProgress(logs, '2026-11-17', 8), null);
});

test('backup restores an optional weekly goal and keeps an existing preference', () => {
  const backup = { habits: [], logs: [], weeklyGoal: 4 };
  const state = { habits: [], logs: [], goldenSteps: [] };
  assert.equal(mergeBackup(state, backup).weeklyGoal, 4);
  assert.equal(mergeBackup({ ...state, weeklyGoal: 3 }, backup).weeklyGoal, 3);
  assert.equal(mergeBackup({ ...state, weeklyGoal: null }, backup).weeklyGoal, null);
  assert.equal(mergeBackup(state, { ...backup, weeklyGoal: 8 }).weeklyGoal, undefined);
});

test('the sky tint transitions at local morning, midday, evening and night', () => {
  assert.deepEqual([0, 4, 5, 11, 12, 16, 17, 20, 21, 23].map(skyPhase),
    ['night', 'night', 'morning', 'morning', 'day', 'day', 'evening', 'evening', 'night', 'night']);
});

test('habit ring tracks elapsed timer fraction, including paused and expired timers', () => {
  const timer = { minutes: 1, remainingMs: 45000, endsAt: 60000 };
  assert.equal(timerProgress(timer, 15000), .25);
  assert.equal(timerProgress({ ...timer, endsAt: null }, 30000), .25);
  assert.equal(timerProgress(timer, 62000), 1);
  assert.equal(timerProgress(timer, -10000), 0);
});

test('rocket follows horizontal and vertical drags within its flight card', () => {
  const center = { x: 0, y: 0 };
  const moved = moveRocket(center, -40, 12, 400, 200);
  assert.deepEqual(moved, { x: -.1, y: .06 });
  assert.deepEqual(moveRocket(moved, 40, -12, 400, 200), center);
  assert.deepEqual(moveRocket(center, -900, 900, 400, 200), { x: -.22, y: .16 });
  assert.deepEqual(moveRocket(center, 900, -900, 400, 200), { x: .18, y: -.12 });
  assert.equal(moveRocket(center, 20, 20, 0, 0), center);
});
