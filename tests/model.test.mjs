import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, scheduled, logSession, removeLog, entry, nextTarget, coreCharge, remaining, weekDays } from '../dist/model.mjs';

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

test('crystal charge and countdown are bounded', () => {
  assert.equal(coreCharge([{id:'h',day:'2026-11-15'}],'2026-11-15',2).ratio,.5);
  assert.equal(remaining({endsAt:5000,remainingMs:10000},6000),0);
});