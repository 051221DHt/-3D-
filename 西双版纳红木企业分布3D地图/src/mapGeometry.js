const SCALE = 12;

const TYPE_GROUP_COLORS = {
  store: 0xc78b38,
  factory: 0x8b2419,
  institution: 0x3f6f88,
  craft: 0x5e7c4f,
  other: 0x7b6b61,
};

const PRECISION_SHAPES = {
  exact: 'pin',
  road: 'cylinder',
  area: 'block',
  unknown: 'diamond',
};

const PRECISION_OPACITY = {
  exact: 1,
  road: 0.86,
  area: 0.66,
  unknown: 0.92,
};

function roundTo(value, places) {
  return Number(value.toFixed(places));
}

export function schematicToWorld(point) {
  return {
    x: roundTo((point?.x ?? 0) * SCALE, 3),
    z: roundTo((point?.z ?? 0) * SCALE, 3),
  };
}

export function barHeightForCount(count) {
  const safeCount = Math.max(1, Number(count) || 1);

  if (safeCount >= 30) {
    return 2.4;
  }

  return roundTo(0.38 + (Math.sqrt(safeCount) - 1) * 0.42, 2);
}

export function colorForTypeGroup(typeGroup) {
  return TYPE_GROUP_COLORS[typeGroup] ?? TYPE_GROUP_COLORS.other;
}

export function precisionShape(precision) {
  return PRECISION_SHAPES[precision] ?? PRECISION_SHAPES.unknown;
}

export function opacityForPrecision(precision) {
  return PRECISION_OPACITY[precision] ?? PRECISION_OPACITY.unknown;
}

export const MAP_REGIONS = [
  { id: 'menghai', label: '勐海县', points: [[-6.2, -3.6], [-3.1, -5.2], [-1.6, -2.8], [-2.6, -0.6], [-5.6, -0.8]] },
  { id: 'jinghong', label: '景洪市', points: [[-2.4, -2.6], [1.7, -3.2], [2.6, -0.6], [1.1, 2.6], [-1.8, 2.0], [-2.9, -0.2]] },
  { id: 'mengla', label: '勐腊县', points: [[2.2, -1.6], [6.4, -0.8], [5.5, 3.7], [1.6, 3.1], [1.1, 0.6]] },
];

export const MAP_ROADS = [
  { id: 'minhang', label: '民航路', points: [[-1.2, -1.55], [0.8, -1.45], [2.0, -1.25]] },
  { id: 'mengle', label: '勐泐大道', points: [[0.8, -2.2], [1.0, -0.5], [1.3, 1.2]] },
  { id: 'jingde', label: '景德路', points: [[-0.8, -2.3], [1.5, -2.1]] },
  { id: 'huancheng', label: '环城南路', points: [[-0.7, 0.25], [1.6, 0.15]] },
  { id: 'river', label: '澜沧江', points: [[-6.6, 3.0], [-4.2, 2.2], [-2.2, 2.8], [0.6, 2.2], [2.8, 2.8], [6.5, 2.4]] },
];
