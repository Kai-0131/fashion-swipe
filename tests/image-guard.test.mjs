import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImageGuard } from '../docs/js/image-guard.js';

test('guard trips after 5 image errors in a row', () => {
  const g = createImageGuard(5);
  for (let i = 0; i < 4; i++) assert.equal(g.fail(), false);
  assert.equal(g.fail(), true);
  assert.equal(g.tripped, true);
});

test('a loaded image resets the count', () => {
  const g = createImageGuard(3);
  g.fail(); g.fail(); g.ok();
  assert.equal(g.fail(), false);
  assert.equal(g.tripped, false);
});

test('reset clears a tripped guard', () => {
  const g = createImageGuard(1);
  g.fail();
  g.reset();
  assert.equal(g.tripped, false);
});
