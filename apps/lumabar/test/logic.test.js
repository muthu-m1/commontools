'use strict';
const assert = require('assert');
const { DEFAULTS, mergeState, sanitize, isAllowedUrl, cpuPercent, isLaunchable, isValidTimeZone } = require('../logic');
const { fmtDuration, clockElapsed, clockPatch, fmtBytes, fmtMoney } = require('../renderer/widgets');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('mergeState merges one level into plain objects and replaces arrays', () => {
  const s = mergeState(DEFAULTS, { settings: { position: 'top', widgets: ['clock'] }, data: { pomodoro: { focusMin: 50 } } });
  assert.strictEqual(s.settings.position, 'top');
  assert.deepStrictEqual(s.settings.widgets, ['clock']);
  assert.strictEqual(s.data.pomodoro.focusMin, 50);
  assert.strictEqual(s.data.pomodoro.breakMin, 5);        // untouched sibling
  assert.strictEqual(DEFAULTS.settings.position, 'bottom'); // input not mutated
});

t('mergeState ignores unknown keys and bad sections', () => {
  const s = mergeState(DEFAULTS, { settings: { evil: 1 }, data: 'nope', other: {} });
  assert.ok(!('evil' in s.settings));
  assert.deepStrictEqual(s.data, DEFAULTS.data);
});

t('sanitize repairs invalid values', () => {
  const s = sanitize({ settings: { position: 'left', width: 'huge', style: 'neon', widgets: ['clock', 'clock', 'nope', 'cpu'], githubUser: 'bad user!', cryptoIds: ['bitcoin', 'Bad Id', 'a'.repeat(50)], clocks: [{ label: 'X', tz: 'Mars/Base' }, { label: 'Y', tz: 'Asia/Tokyo' }] }, data: { todos: 'x', notes: 5 } });
  assert.strictEqual(s.settings.position, 'bottom');
  assert.strictEqual(s.settings.width, 'pill');
  assert.strictEqual(s.settings.style, 'glass');
  assert.deepStrictEqual(s.settings.widgets, ['clock', 'cpu']);
  assert.strictEqual(s.settings.githubUser, '');
  assert.deepStrictEqual(s.settings.cryptoIds, ['bitcoin']);
  assert.deepStrictEqual(s.settings.clocks, [{ label: 'Y', tz: 'Asia/Tokyo' }]);
  assert.deepStrictEqual(s.data.todos, []);
  assert.strictEqual(s.data.notes, '');
});

t('sanitize(null) yields defaults', () => assert.deepStrictEqual(sanitize(null), DEFAULTS));

t('isAllowedUrl only allows https to listed hosts', () => {
  assert.ok(isAllowedUrl('https://api.github.com/users/x'));
  assert.ok(isAllowedUrl('https://api.open-meteo.com/v1/forecast?x=1'));
  assert.ok(!isAllowedUrl('http://api.github.com/users/x'));
  assert.ok(!isAllowedUrl('https://evil.example.com/'));
  assert.ok(!isAllowedUrl('https://api.github.com.evil.com/'));
  assert.ok(!isAllowedUrl('file:///etc/passwd'));
  assert.ok(!isAllowedUrl('nonsense'));
});

t('isLaunchable accepts paths and http(s) only', () => {
  assert.ok(isLaunchable('https://example.com'));
  assert.ok(isLaunchable('C:\\Program Files\\App\\app.exe'));
  assert.ok(isLaunchable('/usr/bin/thing'));
  assert.ok(!isLaunchable('javascript:alert(1)'));
  assert.ok(!isLaunchable('ms-settings:network'));
  assert.ok(!isLaunchable(''));
  assert.ok(!isLaunchable(42));
});

t('cpuPercent computes busy share between snapshots', () => {
  const snap = (idle, busy) => [{ times: { user: busy, nice: 0, sys: 0, idle, irq: 0 } }];
  assert.strictEqual(Math.round(cpuPercent(snap(100, 0), snap(150, 50))), 50);
  assert.strictEqual(cpuPercent(snap(100, 0), snap(100, 0)), 0);
  assert.strictEqual(Math.round(cpuPercent(snap(0, 0), snap(0, 100))), 100);
});

t('isValidTimeZone', () => { assert.ok(isValidTimeZone('Europe/London')); assert.ok(!isValidTimeZone('Nope/Zone')); assert.ok(!isValidTimeZone('')); });

t('start/pause clock maths', () => {
  const c = { running: false, startedAt: 0, elapsed: 0 };
  const started = clockPatch(c, 'start');
  assert.ok(started.running);
  assert.ok(clockElapsed({ running: true, startedAt: 1000, elapsed: 500 }, 4000) === 3500);
  const paused = clockPatch({ running: true, startedAt: Date.now() - 2000, elapsed: 1000 }, 'pause');
  assert.ok(!paused.running && paused.elapsed >= 3000 && paused.elapsed < 3200);
  assert.deepStrictEqual(clockPatch({ running: true, startedAt: 5, elapsed: 99, x: 1 }, 'reset'), { running: false, startedAt: 0, elapsed: 0, x: 1 });
});

t('formatters', () => {
  assert.strictEqual(fmtDuration(25 * 60000), '25:00');
  assert.strictEqual(fmtDuration(3725000), '1:02:05');
  assert.strictEqual(fmtDuration(-5), '00:00');
  assert.strictEqual(fmtDuration(61230, true), '01:01.23');
  assert.strictEqual(fmtBytes(512e6), '512 MB');
  assert.strictEqual(fmtBytes(16e9), '16.0 GB');
  assert.strictEqual(fmtMoney(67234), '$67.2k');
  assert.strictEqual(fmtMoney(1.5), '$1.50');
});

console.log(`\n${n} tests passed`);
