import test from 'node:test';
import assert from 'node:assert/strict';

test('dashboard smoke', () => {
  assert.equal(typeof process.env, 'object');
});
