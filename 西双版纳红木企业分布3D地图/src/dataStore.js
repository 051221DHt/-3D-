export const DEFAULT_FILTERS = {
  region: 'all',
  typeGroup: 'all',
  precision: 'all',
  phone: 'all',
  search: '',
};

export const REGION_LABELS = {
  all: '全部区域',
  jinghong: '景洪市',
  mengla: '勐腊县',
  menghai: '勐海县',
  other: '其他',
};

export const TYPE_GROUP_LABELS = {
  all: '全部类型',
  store: '家具/门店',
  factory: '工厂/加工',
  institution: '公司/机构',
  craft: '工艺/根雕',
  other: '其他',
};

export const PRECISION_LABELS = {
  all: '全部精度',
  exact: '精确/近似精确',
  road: '道路级',
  area: '片区/县市级',
  unknown: '待核查',
};

const MIN_SCHEMATIC_SEPARATION = 0.034;
const SEPARATION_ITERATIONS = 220;
const SEPARATION_PADDING = MIN_SCHEMATIC_SEPARATION * 5;

function hasPhone(record) {
  return Boolean(String(record.phone ?? '').trim());
}

function normalizeSearchValue(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase();
}

function compactSearchValue(value) {
  return normalizeSearchValue(value).replace(/[\p{White_Space}\p{Punctuation}]+/gu, '');
}

function matchesSearch(record, search) {
  const compactSearch = compactSearchValue(search);

  return [record.name, record.pinyin, record.type, record.address, record.phone]
    .some((value) => {
      const normalizedValue = normalizeSearchValue(value);
      return normalizedValue.includes(search)
        || (compactSearch && compactSearchValue(value).includes(compactSearch));
    });
}

function matchesSelectedFilter(value, selected) {
  return selected === 'all' || value === selected;
}

function summarizeBy(records, fieldName, fallback, labels) {
  const counts = Object.fromEntries(
    Object.keys(labels)
      .filter((key) => key !== 'all')
      .map((key) => [key, 0]),
  );

  for (const record of records) {
    const value = record[fieldName] || fallback;
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}

function averageSchematic(records) {
  const points = records
    .map((record) => record.schematic)
    .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.z));

  if (points.length === 0) {
    return { x: 0, z: 0 };
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundSchematic(value) {
  return Number(value.toFixed(5));
}

function layoutBounds(points) {
  const xs = points.map((point) => point.originX);
  const zs = points.map((point) => point.originZ);

  return {
    minX: Math.min(...xs) - SEPARATION_PADDING,
    maxX: Math.max(...xs) + SEPARATION_PADDING,
    minZ: Math.min(...zs) - SEPARATION_PADDING,
    maxZ: Math.max(...zs) + SEPARATION_PADDING,
  };
}

function stableAngle(point, nextPoint, iteration) {
  const seed = (
    (point.recordId * 73856093)
    ^ (nextPoint.recordId * 19349663)
    ^ (iteration * 83492791)
  ) >>> 0;

  return (seed % 62832) / 10000;
}

function deconflictMapGroups(groups) {
  if (groups.length < 2) {
    return groups;
  }

  const points = groups.map((group, index) => {
    const x = group.schematic.x;
    const z = group.schematic.z;

    return {
      index,
      x,
      z,
      originX: x,
      originZ: z,
      recordId: group.records[0]?.id ?? index + 1,
    };
  });
  const bounds = layoutBounds(points);

  for (let iteration = 0; iteration < SEPARATION_ITERATIONS; iteration += 1) {
    let moved = false;

    for (let index = 0; index < points.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < points.length; nextIndex += 1) {
        const point = points[index];
        const nextPoint = points[nextIndex];
        let dx = nextPoint.x - point.x;
        let dz = nextPoint.z - point.z;
        let distance = Math.hypot(dx, dz);

        if (distance >= MIN_SCHEMATIC_SEPARATION) {
          continue;
        }

        if (distance < 0.000001) {
          const angle = stableAngle(point, nextPoint, iteration);
          dx = Math.cos(angle);
          dz = Math.sin(angle);
          distance = 1;
        }

        const push = (MIN_SCHEMATIC_SEPARATION - distance) / 2 + 0.00035;
        const ux = dx / distance;
        const uz = dz / distance;

        point.x -= ux * push;
        point.z -= uz * push;
        nextPoint.x += ux * push;
        nextPoint.z += uz * push;
        moved = true;
      }
    }

    for (const point of points) {
      point.x = clamp(point.x, bounds.minX, bounds.maxX);
      point.z = clamp(point.z, bounds.minZ, bounds.maxZ);
    }

    if (!moved) {
      break;
    }
  }

  return groups.map((group, index) => ({
    ...group,
    schematic: {
      x: roundSchematic(points[index].x),
      z: roundSchematic(points[index].z),
    },
  }));
}

export function filterEnterprises(records, filters = DEFAULT_FILTERS) {
  const activeFilters = { ...DEFAULT_FILTERS, ...filters };
  const search = normalizeSearchValue(activeFilters.search).trim();

  return records.filter((record) => {
    if (!matchesSelectedFilter(record.region || 'other', activeFilters.region)) {
      return false;
    }

    if (!matchesSelectedFilter(record.typeGroup || 'other', activeFilters.typeGroup)) {
      return false;
    }

    if (!matchesSelectedFilter(record.locationPrecision || 'unknown', activeFilters.precision)) {
      return false;
    }

    if (activeFilters.phone === 'with' && !hasPhone(record)) {
      return false;
    }

    if (activeFilters.phone === 'without' && hasPhone(record)) {
      return false;
    }

    if (!search) {
      return true;
    }

    return matchesSearch(record, search);
  });
}

export function summarizeEnterprises(records) {
  return {
    total: records.length,
    withPhone: records.filter(hasPhone).length,
    byRegion: summarizeBy(records, 'region', 'other', REGION_LABELS),
    byPrecision: summarizeBy(records, 'locationPrecision', 'unknown', PRECISION_LABELS),
    byTypeGroup: summarizeBy(records, 'typeGroup', 'other', TYPE_GROUP_LABELS),
  };
}

export function groupForMap(records) {
  const groups = records.map((record) => {
    const precision = record.locationPrecision || 'unknown';
    const region = record.region || 'other';
    return {
      id: `record-${record.id}`,
      kind: 'record',
      groupKey: `record-${record.id}`,
      label: record.name || record.address || '未命名企业',
      precision,
      typeGroup: record.typeGroup || 'other',
      region,
      records: [record],
      schematic: averageSchematic([record]),
    };
  });

  return deconflictMapGroups(groups);
}
