'use strict';

/**
 * @fileoverview Tests for dockclean.
 * @author idirdev
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getStoppedContainers,
  getDanglingImages,
  getUnusedVolumes,
  getUnusedNetworks,
  dryRun,
  clean,
  summary,
} = require('../src/index.js');

// ── Parser correctness with simulated output ──────────────────────────────────

test('getStoppedContainers: returns containers array + warning field', () => {
  const result = getStoppedContainers();
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'containers'));
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'warning'));
  assert.ok(Array.isArray(result.containers));
});

test('getDanglingImages: returns images array + warning field', () => {
  const result = getDanglingImages();
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'images'));
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'warning'));
  assert.ok(Array.isArray(result.images));
});

test('getUnusedVolumes: returns volumes array + warning field', () => {
  const result = getUnusedVolumes();
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'volumes'));
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'warning'));
  assert.ok(Array.isArray(result.volumes));
});

test('getUnusedNetworks: returns networks array + warning field', () => {
  const result = getUnusedNetworks();
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'networks'));
  assert.ok(Object.prototype.hasOwnProperty.call(result, 'warning'));
  assert.ok(Array.isArray(result.networks));
});

// ── dryRun ────────────────────────────────────────────────────────────────────

test('dryRun: returns correct shape', () => {
  const result = dryRun();
  assert.ok(Array.isArray(result.containers));
  assert.ok(Array.isArray(result.images));
  assert.ok(Array.isArray(result.volumes));
  assert.ok(Array.isArray(result.networks));
  assert.ok(Array.isArray(result.warnings));
});

test('dryRun: does not remove anything (non-destructive)', () => {
  // Just verify it returns without throwing and has no side effects we can detect
  const r1 = dryRun();
  const r2 = dryRun();
  assert.deepEqual(r1.warnings.length, r2.warnings.length);
});

// ── clean ─────────────────────────────────────────────────────────────────────

test('clean: returns removed object with all category arrays', () => {
  const result = clean({});
  assert.ok(Array.isArray(result.removed.containers));
  assert.ok(Array.isArray(result.removed.images));
  assert.ok(Array.isArray(result.removed.volumes));
  assert.ok(Array.isArray(result.removed.networks));
  assert.ok(Array.isArray(result.warnings));
});

test('clean: with no options does not attempt to remove anything', () => {
  const result = clean({});
  assert.equal(result.removed.containers.length, 0);
  assert.equal(result.removed.images.length, 0);
  assert.equal(result.removed.volumes.length, 0);
  assert.equal(result.removed.networks.length, 0);
});

// ── summary ───────────────────────────────────────────────────────────────────

test('summary: returns a non-empty string', () => {
  const results = {
    removed: { containers: ['abc'], images: [], volumes: ['vol1'], networks: [] },
    warnings: ['something happened'],
  };
  const out = summary(results);
  assert.ok(typeof out === 'string' && out.length > 0);
  assert.ok(out.includes('1'));
});

test('summary: counts match input arrays', () => {
  const results = {
    removed: { containers: ['a', 'b'], images: ['c'], volumes: [], networks: [] },
    warnings: [],
  };
  const out = summary(results);
  assert.ok(out.includes('2'));
  assert.ok(out.includes('1'));
});

test('summary: no warnings section when empty', () => {
  const results = {
    removed: { containers: [], images: [], volumes: [], networks: [] },
    warnings: [],
  };
  const out = summary(results);
  assert.ok(!out.includes('Warnings'));
});
