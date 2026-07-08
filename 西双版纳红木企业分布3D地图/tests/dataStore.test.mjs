import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_FILTERS,
  filterEnterprises,
  groupForMap,
  summarizeEnterprises,
} from '../src/dataStore.js';
import { schematicToWorld } from '../src/mapGeometry.js';

const data = JSON.parse(readFileSync(new URL('../data/enterprises.json', import.meta.url), 'utf8'));
const MIN_ENTERPRISE_POINT_DISTANCE = 0.38;

function closestWorldDistance(groups) {
  let closest = Infinity;

  for (let index = 0; index < groups.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < groups.length; nextIndex += 1) {
      const point = schematicToWorld(groups[index].schematic);
      const nextPoint = schematicToWorld(groups[nextIndex].schematic);
      closest = Math.min(closest, Math.hypot(point.x - nextPoint.x, point.z - nextPoint.z));
    }
  }

  return closest;
}

const sample = [
  { id: 1, name: '红木坊', pinyin: 'Hongmu Fang', type: '家具店', typeGroup: 'store', address: '景洪市', phone: '+86 1', region: 'jinghong', locationPrecision: 'area' },
  { id: 2, name: '森茂红木厂', pinyin: 'Senmao Hongmu Factory', type: '工厂', typeGroup: 'factory', address: '民航路', phone: '', region: 'jinghong', locationPrecision: 'road' },
  { id: 3, name: '志华红木', type: '家具城', typeGroup: 'store', address: '勐腊县', phone: '+86 2', region: 'mengla', locationPrecision: 'area' },
  { id: 4, name: '红木家具批发部', type: '批发部', typeGroup: 'store', address: '环城南路1-8号', phone: '+86 3', region: 'jinghong', locationPrecision: 'exact' },
];

test('filterEnterprises filters by region, precision, phone, and search', () => {
  const result = filterEnterprises(sample, {
    ...DEFAULT_FILTERS,
    region: 'jinghong',
    precision: 'exact',
    phone: 'with',
    search: '批发',
  });
  assert.deepEqual(result.map((record) => record.id), [4]);
});

test('filterEnterprises matches compact pinyin when search contains spaces', () => {
  const hongmu = filterEnterprises(sample, {
    ...DEFAULT_FILTERS,
    search: 'hong mu',
  });
  const senmao = filterEnterprises(sample, {
    ...DEFAULT_FILTERS,
    search: 'sen mao',
  });

  assert.deepEqual(hongmu.map((record) => record.id), [1, 2]);
  assert.deepEqual(senmao.map((record) => record.id), [2]);
});

test('summarizeEnterprises returns dashboard counts', () => {
  const summary = summarizeEnterprises(sample);
  assert.equal(summary.total, 4);
  assert.equal(summary.withPhone, 3);
  assert.equal(summary.byRegion.jinghong, 3);
  assert.equal(summary.byPrecision.area, 2);
  assert.equal(summary.byTypeGroup.store, 3);
});

test('groupForMap returns one visible map point per enterprise', () => {
  const groups = groupForMap(sample);
  assert.equal(groups.length, sample.length);
  assert.deepEqual(groups.map((group) => group.records[0].id), [1, 2, 3, 4]);

  for (const group of groups) {
    assert.equal(group.kind, 'record');
    assert.equal(group.records.length, 1);
    assert.equal(group.groupKey, `record-${group.records[0].id}`);
    assert.equal(Number.isFinite(group.schematic?.x), true);
    assert.equal(Number.isFinite(group.schematic?.z), true);
  }

  assert.ok(
    closestWorldDistance(groups) >= MIN_ENTERPRISE_POINT_DISTANCE,
    'Map points should be deconflicted even when raw schematic coordinates overlap',
  );
});

test('real enterprise data preserves dashboard and map grouping invariants', () => {
  const summary = summarizeEnterprises(data);
  const groups = groupForMap(data);

  assert.equal(data.length, 78);
  assert.equal(summary.total, 78);
  assert.equal(summary.withPhone, 49);
  assert.equal(summary.byRegion.jinghong, 69);
  assert.equal(summary.byRegion.mengla, 9);
  assert.equal(summary.byRegion.other, 0);
  assert.equal(summary.byRegion.menghai, 0);
  assert.equal(summary.byPrecision.exact, 10);
  assert.equal(summary.byPrecision.road, 21);
  assert.equal(summary.byPrecision.area, 47);
  assert.equal(summary.byPrecision.unknown, 0);
  assert.equal(summary.byTypeGroup.store, 61);
  assert.equal(summary.byTypeGroup.factory, 8);
  assert.equal(summary.byTypeGroup.institution, 3);
  assert.equal(summary.byTypeGroup.craft, 6);
  assert.equal(summary.byTypeGroup.other, 0);
  assert.equal(groups.length, 78);

  for (const group of groups) {
    assert.ok(group.id);
    assert.equal(group.kind, 'record');
    assert.ok(group.groupKey);
    assert.ok(group.label);
    assert.ok(group.precision);
    assert.ok(group.typeGroup);
    assert.ok(group.region);
    assert.ok(Array.isArray(group.records));
    assert.equal(group.records.length, 1);
    assert.equal(Number.isFinite(group.schematic?.x), true);
    assert.equal(Number.isFinite(group.schematic?.z), true);
  }

  assert.equal(new Set(groups.map((group) => group.records[0].id)).size, data.length);
  assert.ok(
    closestWorldDistance(groups) >= MIN_ENTERPRISE_POINT_DISTANCE,
    'Real enterprise map points should remain visually independent',
  );
});
