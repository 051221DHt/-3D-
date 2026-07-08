import test from 'node:test';
import assert from 'node:assert/strict';
import {
  barHeightForCount,
  colorForTypeGroup,
  precisionShape,
  schematicToWorld,
} from '../src/mapGeometry.js';

test('schematicToWorld maps normalized coordinates to scene space', () => {
  assert.deepEqual(schematicToWorld({ x: 0, z: 0 }), { x: 0, z: 0 });
  assert.deepEqual(schematicToWorld({ x: 0.5, z: -0.25 }), { x: 6, z: -3 });
});

test('barHeightForCount grows with count but has a usable minimum', () => {
  assert.equal(barHeightForCount(1), 0.38);
  assert.equal(barHeightForCount(9), 1.22);
  assert.equal(barHeightForCount(40), 2.4);
});

test('visual encodings are deterministic', () => {
  assert.equal(colorForTypeGroup('factory'), 0x8b2419);
  assert.equal(colorForTypeGroup('store'), 0xc78b38);
  assert.equal(precisionShape('road'), 'cylinder');
  assert.equal(precisionShape('unknown'), 'diamond');
});
