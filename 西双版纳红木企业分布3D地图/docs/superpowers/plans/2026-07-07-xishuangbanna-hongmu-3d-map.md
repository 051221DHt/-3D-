# Xishuangbanna Hongmu 3D Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that shows all Xishuangbanna hongmu enterprises from the supplied Word file in an interactive 3D map plus data dashboard, with complete records and visible location-precision levels.

**Architecture:** Use a static Vite app with vanilla JavaScript modules, Three.js for the 3D scene, Python stdlib for DOCX extraction, and Node's built-in test runner for pure JavaScript logic. The app loads `data/enterprises.json`, derives filtered/grouped views in pure modules, and renders synchronized 3D map, dashboard, list, and detail panels.

**Tech Stack:** Python 3 stdlib (`zipfile`, `xml.etree.ElementTree`, `json`), Node.js 24, Vite, Three.js, vanilla HTML/CSS/JS, Playwright for final browser verification.

---

## File Structure

- Create `package.json`: project scripts and dependencies.
- Create `index.html`: single-page app shell.
- Create `assets/source/`: copied source DOCX and images from `/Users/tianhaodong/Downloads`.
- Create `data/enterprises.json`: generated complete enterprise dataset.
- Create `scripts/extract_enterprises.py`: DOCX table extraction, precision classification, region inference, schematic coordinate assignment, external search URL generation.
- Create `src/main.js`: app bootstrap and state wiring.
- Create `src/dataStore.js`: filtering, summaries, grouping, and record lookup.
- Create `src/mapGeometry.js`: schematic map coordinate and visual-height helpers.
- Create `src/scene.js`: Three.js scene, objects, picking, camera, resize, and render loop.
- Create `src/ui.js`: filters, stats, list, detail panel, and event binding.
- Create `src/styles.css`: dashboard and responsive layout.
- Create `tests/extract_enterprises_test.py`: Python data extraction tests.
- Create `tests/dataStore.test.mjs`: Node tests for filtering and summaries.
- Create `tests/mapGeometry.test.mjs`: Node tests for grouping geometry helpers.
- Create `tests/browser-smoke.mjs`: Playwright smoke test that the 3D canvas renders nonblank and the dataset count appears.

## Task 1: Scaffold App, Dependency Metadata, And Source Assets

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/styles.css`
- Create directory: `assets/source/`
- Copy source files into `assets/source/`

- [ ] **Step 1: Create package metadata**

Create `package.json` with:

```json
{
  "name": "xishuangbanna-hongmu-3d-map",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "node --test tests/*.test.mjs",
    "test:py": "python3 -m unittest tests/extract_enterprises_test.py -v",
    "test:browser": "node tests/browser-smoke.mjs"
  },
  "dependencies": {
    "three": "^0.166.1",
    "vite": "^5.4.0"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
pnpm install
```

Expected: `node_modules/`, `pnpm-lock.yaml`, and installed `three`/`vite`. If network sandboxing causes DNS, registry, or TLS errors, rerun the same command with escalation because Three.js is required by the approved design.

- [ ] **Step 3: Copy the user-provided source assets**

Run:

```bash
mkdir -p assets/source
cp "/Users/tianhaodong/Downloads/西双版纳红木企业不完全整理，部分附带谷歌地图电话号码.docx" "assets/source/西双版纳红木企业不完全整理，部分附带谷歌地图电话号码.docx"
cp "/Users/tianhaodong/Downloads/ChatGPT Image 2026年7月6日 20_47_57.png" "assets/source/ChatGPT Image 2026年7月6日 20_47_57.png"
cp "/Users/tianhaodong/Downloads/panorama_cropped.png" "assets/source/panorama_cropped.png"
```

Expected: the three source files exist under `assets/source/`.

- [ ] **Step 4: Create the HTML shell**

Create `index.html` with:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>西双版纳红木企业分布 3D 地图</title>
  </head>
  <body>
    <main class="app-shell">
      <section class="map-panel" aria-label="3D 企业分布地图">
        <div class="map-toolbar">
          <div>
            <p class="eyebrow">Xishuangbanna Hongmu Map</p>
            <h1>西双版纳红木企业分布 3D 地图</h1>
          </div>
          <div class="view-toggle" role="group" aria-label="地图视图">
            <button class="icon-button active" data-view="prefecture" title="全州视图" aria-label="全州视图">州</button>
            <button class="icon-button" data-view="jinghong" title="景洪主城区" aria-label="景洪主城区">景</button>
          </div>
        </div>
        <div id="sceneRoot" class="scene-root"></div>
        <div class="legend" id="legend"></div>
      </section>
      <aside class="dashboard" aria-label="数据看板">
        <section class="stats-grid" id="statsGrid"></section>
        <section class="filters" id="filters"></section>
        <section class="record-list" id="recordList"></section>
      </aside>
      <section class="detail-panel" id="detailPanel" aria-live="polite"></section>
    </main>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Create minimal bootstrap and base CSS**

Create `src/main.js` with:

```js
import './styles.css';

document.querySelector('#sceneRoot').textContent = '正在加载 3D 地图...';
```

Create `src/styles.css` with:

```css
:root {
  color-scheme: light;
  --ink: #2b1d17;
  --muted: #6f625b;
  --paper: #f7efe4;
  --panel: #fffaf2;
  --line: #d9c3aa;
  --hongmu: #8b2419;
  --gold: #c78b38;
  --river: #4e9eba;
  --forest: #4f7b54;
}

* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; font-family: system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; color: var(--ink); background: var(--paper); }
button, input, select { font: inherit; }
.app-shell { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) 380px; grid-template-rows: minmax(0, 1fr); }
.map-panel { min-width: 0; display: grid; grid-template-rows: auto minmax(420px, 1fr) auto; padding: 18px; gap: 12px; }
.map-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.eyebrow { margin: 0 0 4px; color: var(--hongmu); font-size: 12px; font-weight: 700; letter-spacing: 0; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(24px, 3vw, 36px); line-height: 1.15; letter-spacing: 0; }
.scene-root { position: relative; min-height: 420px; border: 1px solid var(--line); background: #eadcc8; overflow: hidden; }
.scene-root canvas { display: block; width: 100%; height: 100%; }
.dashboard { border-left: 1px solid var(--line); background: rgba(255, 250, 242, 0.86); padding: 16px; overflow: auto; }
.icon-button { width: 42px; height: 36px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; }
.icon-button.active { background: var(--hongmu); color: white; border-color: var(--hongmu); }
.stats-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.stat-card, .filter-block, .record-card, .detail-panel { border: 1px solid var(--line); background: var(--panel); border-radius: 8px; }
.stat-card { padding: 12px; }
.stat-value { display: block; font-size: 28px; font-weight: 800; color: var(--hongmu); }
.filters { display: grid; gap: 10px; margin-top: 14px; }
.filter-block { padding: 10px; }
.filter-block label { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 700; color: var(--muted); }
.filter-block input, .filter-block select { width: 100%; min-height: 36px; border: 1px solid var(--line); background: white; padding: 6px 8px; }
.record-list { display: grid; gap: 8px; margin-top: 14px; }
.record-card { padding: 10px; cursor: pointer; }
.record-card.active { border-color: var(--hongmu); box-shadow: 0 0 0 2px rgba(139, 36, 25, 0.12); }
.detail-panel { position: fixed; left: 20px; bottom: 20px; width: min(420px, calc(100vw - 40px)); max-height: 46vh; overflow: auto; padding: 14px; box-shadow: 0 18px 48px rgba(43, 29, 23, 0.18); display: none; }
.detail-panel.is-open { display: block; }
@media (max-width: 980px) { .app-shell { grid-template-columns: 1fr; } .dashboard { border-left: 0; border-top: 1px solid var(--line); } }
```

- [ ] **Step 6: Verify scaffold**

Run:

```bash
pnpm run build
```

Expected: Vite builds `dist/` with no syntax errors.

- [ ] **Step 7: Commit scaffold**

Run:

```bash
git add package.json pnpm-lock.yaml index.html src/main.js src/styles.css assets/source
git commit -m "chore: scaffold hongmu 3d map app"
```

## Task 2: Extract And Classify The Complete Enterprise Dataset

**Files:**
- Create: `scripts/extract_enterprises.py`
- Create: `tests/extract_enterprises_test.py`
- Create generated output: `data/enterprises.json`

- [ ] **Step 1: Write Python tests for extraction, precision, and representative rows**

Create `tests/extract_enterprises_test.py` with:

```python
import json
import unittest
from pathlib import Path

from scripts.extract_enterprises import (
    classify_precision,
    infer_region,
    load_docx_table,
    normalize_record,
)

ROOT = Path(__file__).resolve().parents[1]
DOCX = ROOT / "assets/source/西双版纳红木企业不完全整理，部分附带谷歌地图电话号码.docx"


class ExtractEnterprisesTest(unittest.TestCase):
    def test_loads_all_word_rows(self):
        rows = load_docx_table(DOCX)
        self.assertEqual(78, len(rows))
        self.assertEqual("红木坊", rows[0]["name"])
        self.assertEqual("勐腊奇奇旺红木高品家私店", rows[-1]["name"])

    def test_precision_classification(self):
        self.assertEqual("exact", classify_precision("环城南路1-8号"))
        self.assertEqual("exact", classify_precision("曼听公园大门对面红豆楼5号"))
        self.assertEqual("road", classify_precision("勐泐大道"))
        self.assertEqual("area", classify_precision("景洪市"))
        self.assertEqual("unknown", classify_precision(""))

    def test_region_inference(self):
        self.assertEqual("jinghong", infer_region("景洪市"))
        self.assertEqual("mengla", infer_region("勐腊县中心路"))
        self.assertEqual("menghai", infer_region("勐海县"))
        self.assertEqual("jinghong", infer_region("民航路"))

    def test_normalized_record_has_required_fields(self):
        row = {
            "id": "13",
            "name": "红木家具批发部",
            "pinyin": "Hongmu Furniture Wholesale Dept.",
            "type": "批发部",
            "address": "环城南路1-8号",
            "phone": "+86 691 221 7198",
        }
        record = normalize_record(row)
        self.assertEqual(13, record["id"])
        self.assertEqual("exact", record["locationPrecision"])
        self.assertEqual("jinghong", record["region"])
        self.assertIn("红木家具批发部", record["externalSearchUrl"])
        self.assertEqual("Word", record["source"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests and verify they fail before implementation**

Run:

```bash
python3 -m unittest tests/extract_enterprises_test.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.extract_enterprises'`.

- [ ] **Step 3: Implement extraction and classification**

Create `scripts/extract_enterprises.py` with:

```python
import argparse
import json
import re
import urllib.parse
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOCX = ROOT / "assets/source/西双版纳红木企业不完全整理，部分附带谷歌地图电话号码.docx"
DEFAULT_OUTPUT = ROOT / "data/enterprises.json"

REGION_ANCHORS = {
    "jinghong": {"label": "景洪市", "x": 0.08, "z": -0.08},
    "mengla": {"label": "勐腊县", "x": 0.58, "z": 0.12},
    "menghai": {"label": "勐海县", "x": -0.52, "z": -0.22},
    "other": {"label": "其他", "x": -0.18, "z": 0.42},
}

ADDRESS_ANCHORS = {
    "民航路": {"x": -0.04, "z": -0.13},
    "勐泐大道": {"x": 0.11, "z": -0.02},
    "景德路": {"x": 0.02, "z": -0.2},
    "环城南路": {"x": 0.09, "z": 0.02},
    "曼弄枫": {"x": 0.17, "z": 0.09},
    "会展": {"x": 0.15, "z": 0.03},
    "曼听": {"x": -0.02, "z": 0.04},
    "中心路": {"x": 0.57, "z": 0.1},
    "勐腊南路": {"x": 0.61, "z": 0.16},
    "勐腊路": {"x": 0.56, "z": 0.14},
    "曼它拉路": {"x": 0.53, "z": 0.18},
    "北路": {"x": 0.62, "z": 0.09},
}

TYPE_GROUPS = [
    ("factory", ("工厂", "加工", "木业", "制造")),
    ("institution", ("协会", "公司", "企业办公", "机构")),
    ("craft", ("根雕", "工艺", "礼品", "沉香", "木雕")),
    ("store", ("家具", "卖场", "商城", "商店", "批发", "展厅", "馆")),
]


def cell_text(cell):
    return "".join((node.text or "") for node in cell.findall(".//w:t", NS)).strip()


def load_docx_table(path):
    xml = zipfile.ZipFile(path).read("word/document.xml")
    root = ET.fromstring(xml)
    rows = []
    for tr in root.findall(".//w:tr", NS):
        cells = [cell_text(tc) for tc in tr.findall("w:tc", NS)]
        if not cells or cells[0] == "序号":
            continue
        if len(cells) < 6:
            cells += [""] * (6 - len(cells))
        rows.append({
            "id": cells[0],
            "name": cells[1],
            "pinyin": cells[2],
            "type": cells[3],
            "address": cells[4],
            "phone": cells[5],
        })
    return rows


def classify_precision(address):
    address = (address or "").strip()
    if not address:
        return "unknown"
    if re.search(r"[0-9０-９]+号|[A-Z0-9]{4}\+[A-Z0-9]{3}|楼|大门对面|红绿灯|旁", address):
        return "exact"
    if any(token in address for token in ("路", "大道", "街", "一条街", "中心路")):
        return "road"
    if any(token in address for token in ("景洪市", "勐腊县", "勐海县")):
        return "area"
    return "unknown"


def infer_region(address):
    address = address or ""
    if "勐腊" in address or "曼它拉" in address or "中心路" in address or address in {"北路208号", "北路"}:
        return "mengla"
    if "勐海" in address:
        return "menghai"
    if "景洪" in address or any(token in address for token in ("民航路", "勐泐大道", "景德路", "环城南路", "曼听", "曼弄枫", "会展")):
        return "jinghong"
    return "other"


def type_group(type_text):
    for group, tokens in TYPE_GROUPS:
        if any(token in type_text for token in tokens):
            return group
    return "other"


def anchor_for_address(address, region):
    for token, anchor in ADDRESS_ANCHORS.items():
        if token in address:
            return dict(anchor)
    return {"x": REGION_ANCHORS.get(region, REGION_ANCHORS["other"])["x"], "z": REGION_ANCHORS.get(region, REGION_ANCHORS["other"])["z"]}


def spread_anchor(anchor, record_id, precision):
    radius = {"exact": 0.018, "road": 0.035, "area": 0.06, "unknown": 0.075}[precision]
    angle = (record_id * 137.508) % 360
    return {
        "x": round(anchor["x"] + radius * __import__("math").cos(__import__("math").radians(angle)), 4),
        "z": round(anchor["z"] + radius * __import__("math").sin(__import__("math").radians(angle)), 4),
    }


def external_search_url(name, address):
    query = f"{name} 西双版纳 {address}".strip()
    return "https://www.google.com/maps/search/" + urllib.parse.quote(query)


def normalize_record(row):
    record_id = int(row["id"])
    address = row["address"].strip()
    precision = classify_precision(address)
    region = infer_region(address)
    anchor = anchor_for_address(address, region)
    schematic = spread_anchor(anchor, record_id, precision)
    return {
        "id": record_id,
        "name": row["name"].strip(),
        "pinyin": row["pinyin"].strip(),
        "type": row["type"].strip(),
        "typeGroup": type_group(row["type"]),
        "address": address,
        "phone": row["phone"].strip(),
        "region": region,
        "regionLabel": REGION_ANCHORS.get(region, REGION_ANCHORS["other"])["label"],
        "locationPrecision": precision,
        "source": "Word",
        "sourceFile": DEFAULT_DOCX.name,
        "coordinates": None,
        "schematic": schematic,
        "externalSearchUrl": external_search_url(row["name"].strip(), address),
        "notes": "" if precision != "unknown" else "地址信息不足，需人工核查",
    }


def build_dataset(docx_path):
    return [normalize_record(row) for row in load_docx_table(docx_path)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_DOCX))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()
    records = build_dataset(Path(args.input))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} records to {output}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run Python tests**

Run:

```bash
python3 -m unittest tests/extract_enterprises_test.py -v
```

Expected: 4 tests pass.

- [ ] **Step 5: Generate complete JSON dataset**

Run:

```bash
python3 scripts/extract_enterprises.py
```

Expected: `Wrote 78 records to .../data/enterprises.json`.

- [ ] **Step 6: Verify data counts**

Run:

```bash
python3 -c 'import json, collections; data=json.load(open("data/enterprises.json", encoding="utf-8")); print(len(data)); print(collections.Counter(r["locationPrecision"] for r in data)); print(sum(1 for r in data if r["phone"]))'
```

Expected: total `78`, phone count `49`, and precision counts matching the extracted dataset.

- [ ] **Step 7: Commit data extraction**

Run:

```bash
git add scripts/extract_enterprises.py tests/extract_enterprises_test.py data/enterprises.json
git commit -m "feat: extract complete hongmu enterprise dataset"
```

## Task 3: Implement Data Store, Filters, Summaries, And Grouping

**Files:**
- Create: `src/dataStore.js`
- Create: `tests/dataStore.test.mjs`

- [ ] **Step 1: Write data store tests**

Create `tests/dataStore.test.mjs` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FILTERS,
  filterEnterprises,
  groupForMap,
  summarizeEnterprises,
} from '../src/dataStore.js';

const sample = [
  { id: 1, name: '红木坊', type: '家具店', typeGroup: 'store', address: '景洪市', phone: '+86 1', region: 'jinghong', locationPrecision: 'area' },
  { id: 2, name: '森茂红木厂', type: '工厂', typeGroup: 'factory', address: '民航路', phone: '', region: 'jinghong', locationPrecision: 'road' },
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

test('summarizeEnterprises returns dashboard counts', () => {
  const summary = summarizeEnterprises(sample);
  assert.equal(summary.total, 4);
  assert.equal(summary.withPhone, 3);
  assert.equal(summary.byRegion.jinghong, 3);
  assert.equal(summary.byPrecision.area, 2);
  assert.equal(summary.byTypeGroup.store, 3);
});

test('groupForMap keeps exact records separate and aggregates broad records', () => {
  const groups = groupForMap(sample);
  const exact = groups.find((group) => group.kind === 'record' && group.records[0].id === 4);
  const road = groups.find((group) => group.kind === 'group' && group.groupKey === 'jinghong-road-民航路');
  const area = groups.find((group) => group.kind === 'group' && group.groupKey === 'jinghong-area-景洪市');
  assert.equal(exact.records.length, 1);
  assert.equal(road.records.length, 1);
  assert.equal(area.records.length, 1);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test tests/dataStore.test.mjs
```

Expected: FAIL with module export errors because `src/dataStore.js` does not exist.

- [ ] **Step 3: Implement data store**

Create `src/dataStore.js` with:

```js
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

export function filterEnterprises(records, filters = DEFAULT_FILTERS) {
  const query = filters.search.trim().toLowerCase();
  return records.filter((record) => {
    if (filters.region !== 'all' && record.region !== filters.region) return false;
    if (filters.typeGroup !== 'all' && record.typeGroup !== filters.typeGroup) return false;
    if (filters.precision !== 'all' && record.locationPrecision !== filters.precision) return false;
    if (filters.phone === 'with' && !record.phone) return false;
    if (filters.phone === 'without' && record.phone) return false;
    if (!query) return true;
    return [record.name, record.pinyin, record.type, record.address, record.phone]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

export function summarizeEnterprises(records) {
  const summary = {
    total: records.length,
    withPhone: records.filter((record) => Boolean(record.phone)).length,
    byRegion: {},
    byPrecision: {},
    byTypeGroup: {},
  };
  for (const record of records) {
    summary.byRegion[record.region] = (summary.byRegion[record.region] || 0) + 1;
    summary.byPrecision[record.locationPrecision] = (summary.byPrecision[record.locationPrecision] || 0) + 1;
    summary.byTypeGroup[record.typeGroup] = (summary.byTypeGroup[record.typeGroup] || 0) + 1;
  }
  return summary;
}

function roadKey(address) {
  const match = address.match(/(民航路|勐泐大道|景德路|环城南路|曼它拉路|勐腊南路|勐腊路|中心路|北路)/);
  return match ? match[1] : address || '待核查';
}

export function groupForMap(records) {
  const groups = new Map();
  const output = [];
  for (const record of records) {
    if (record.locationPrecision === 'exact') {
      output.push({
        id: `record-${record.id}`,
        kind: 'record',
        groupKey: `record-${record.id}`,
        label: record.name,
        precision: record.locationPrecision,
        typeGroup: record.typeGroup,
        region: record.region,
        records: [record],
        schematic: record.schematic,
      });
      continue;
    }
    const bucket = record.locationPrecision === 'road' ? roadKey(record.address) : (record.address || record.regionLabel || '待核查');
    const groupKey = `${record.region}-${record.locationPrecision}-${bucket}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        id: `group-${groupKey}`,
        kind: 'group',
        groupKey,
        label: bucket,
        precision: record.locationPrecision,
        typeGroup: record.typeGroup,
        region: record.region,
        records: [],
        schematic: record.schematic,
      });
    }
    groups.get(groupKey).records.push(record);
  }
  return output.concat([...groups.values()]);
}
```

- [ ] **Step 4: Run JS tests**

Run:

```bash
node --test tests/dataStore.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit data store**

Run:

```bash
git add src/dataStore.js tests/dataStore.test.mjs
git commit -m "feat: add enterprise filtering and grouping"
```

## Task 4: Implement Map Geometry Helpers And Three.js Scene

**Files:**
- Create: `src/mapGeometry.js`
- Create: `src/scene.js`
- Create: `tests/mapGeometry.test.mjs`

- [ ] **Step 1: Write geometry tests**

Create `tests/mapGeometry.test.mjs` with:

```js
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
  assert.equal(barHeightForCount(1), 0.55);
  assert.equal(barHeightForCount(9), 1.75);
  assert.equal(barHeightForCount(40), 3.6);
});

test('visual encodings are deterministic', () => {
  assert.equal(colorForTypeGroup('factory'), 0x8b2419);
  assert.equal(colorForTypeGroup('store'), 0xc78b38);
  assert.equal(precisionShape('road'), 'cylinder');
  assert.equal(precisionShape('unknown'), 'diamond');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test tests/mapGeometry.test.mjs
```

Expected: FAIL because `src/mapGeometry.js` does not exist.

- [ ] **Step 3: Implement map geometry helpers**

Create `src/mapGeometry.js` with:

```js
const SCALE = 12;

export function schematicToWorld(point) {
  return {
    x: Number((point.x * SCALE).toFixed(3)),
    z: Number((point.z * SCALE).toFixed(3)),
  };
}

export function barHeightForCount(count) {
  if (count >= 30) return 3.6;
  return Number((0.4 + Math.sqrt(count) * 0.15).toFixed(2));
}

export function colorForTypeGroup(typeGroup) {
  return {
    store: 0xc78b38,
    factory: 0x8b2419,
    institution: 0x3f6f88,
    craft: 0x5e7c4f,
    other: 0x7b6b61,
  }[typeGroup] || 0x7b6b61;
}

export function precisionShape(precision) {
  return {
    exact: 'pin',
    road: 'cylinder',
    area: 'block',
    unknown: 'diamond',
  }[precision] || 'diamond';
}

export function opacityForPrecision(precision) {
  return {
    exact: 1,
    road: 0.86,
    area: 0.66,
    unknown: 0.92,
  }[precision] || 0.92;
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
```

- [ ] **Step 4: Run geometry tests**

Run:

```bash
node --test tests/mapGeometry.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 5: Implement Three.js scene**

Create `src/scene.js` with these exported functions and behaviors:

```js
import * as THREE from 'three';
import {
  MAP_REGIONS,
  MAP_ROADS,
  barHeightForCount,
  colorForTypeGroup,
  opacityForPrecision,
  precisionShape,
  schematicToWorld,
} from './mapGeometry.js';

export function createMapScene(root, { onSelect }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1e4d2);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 8.5, 10.5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  root.replaceChildren(renderer.domElement);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const interactive = [];
  const group = new THREE.Group();
  scene.add(group);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a52, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  function resize() {
    const rect = root.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    camera.aspect = rect.width / Math.max(rect.height, 1);
    camera.updateProjectionMatrix();
  }

  function clearDynamicObjects() {
    for (const item of interactive.splice(0)) {
      group.remove(item);
      item.geometry.dispose();
      item.material.dispose();
    }
  }

  function makeRegion(region) {
    const shape = new THREE.Shape();
    region.points.forEach(([x, z], index) => {
      if (index === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0xd6c4a9, roughness: 0.9, metalness: 0.02 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -0.08;
    scene.add(mesh);
  }

  function makeRoad(road) {
    const curve = new THREE.CatmullRomCurve3(road.points.map(([x, z]) => new THREE.Vector3(x, 0.035, z)));
    const geometry = new THREE.TubeGeometry(curve, 32, road.id === 'river' ? 0.05 : 0.025, 8, false);
    const material = new THREE.MeshStandardMaterial({ color: road.id === 'river' ? 0x4e9eba : 0xc98f45, roughness: 0.75 });
    scene.add(new THREE.Mesh(geometry, material));
  }

  function makeObject(mapGroup) {
    const count = mapGroup.records.length;
    const height = barHeightForCount(count);
    const world = schematicToWorld(mapGroup.schematic);
    const color = colorForTypeGroup(mapGroup.typeGroup);
    const shape = precisionShape(mapGroup.precision);
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: opacityForPrecision(mapGroup.precision),
      roughness: 0.62,
      metalness: 0.08,
    });
    let geometry;
    if (shape === 'pin') geometry = new THREE.ConeGeometry(0.13, height, 18);
    else if (shape === 'diamond') geometry = new THREE.OctahedronGeometry(0.22);
    else if (shape === 'block') geometry = new THREE.BoxGeometry(0.34, height, 0.34);
    else geometry = new THREE.CylinderGeometry(0.17, 0.22, height, 20);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(world.x, height / 2, world.z);
    mesh.userData.mapGroup = mapGroup;
    interactive.push(mesh);
    group.add(mesh);
  }

  function renderGroups(mapGroups) {
    clearDynamicObjects();
    for (const mapGroup of mapGroups) makeObject(mapGroup);
  }

  function handlePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactive)[0];
    if (hit) onSelect(hit.object.userData.mapGroup);
  }

  for (const region of MAP_REGIONS) makeRegion(region);
  for (const road of MAP_ROADS) makeRoad(road);
  renderer.domElement.addEventListener('click', handlePointer);
  window.addEventListener('resize', resize);

  let rotation = 0;
  function animate() {
    rotation += 0.0015;
    group.rotation.y = rotation;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  resize();
  animate();

  return {
    renderGroups,
    setView(view) {
      if (view === 'jinghong') camera.position.set(1.2, 5.6, 5.8);
      else camera.position.set(0, 8.5, 10.5);
      camera.lookAt(0.2, 0, -0.2);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('click', handlePointer);
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 6: Commit geometry and scene**

Run:

```bash
git add src/mapGeometry.js src/scene.js tests/mapGeometry.test.mjs
git commit -m "feat: add 3d map scene"
```

## Task 5: Build Dashboard UI And Wire App State

**Files:**
- Modify: `src/main.js`
- Create: `src/ui.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Implement UI rendering helpers**

Create `src/ui.js` with:

```js
import {
  DEFAULT_FILTERS,
  PRECISION_LABELS,
  REGION_LABELS,
  TYPE_GROUP_LABELS,
} from './dataStore.js';

const PHONE_LABELS = { all: '全部电话', with: '带电话', without: '缺电话' };

export function createUi({ filtersRoot, statsRoot, listRoot, detailRoot, legendRoot, onFilterChange, onRecordSelect }) {
  const filters = { ...DEFAULT_FILTERS };

  function selectOptions(options, selected) {
    return Object.entries(options).map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
  }

  function renderFilters() {
    filtersRoot.innerHTML = `
      <div class="filter-block"><label for="search">搜索企业/地址/电话</label><input id="search" value="${filters.search}" placeholder="输入名称、道路或电话"></div>
      <div class="filter-block"><label for="region">区域</label><select id="region">${selectOptions(REGION_LABELS, filters.region)}</select></div>
      <div class="filter-block"><label for="typeGroup">类型</label><select id="typeGroup">${selectOptions(TYPE_GROUP_LABELS, filters.typeGroup)}</select></div>
      <div class="filter-block"><label for="precision">定位精度</label><select id="precision">${selectOptions(PRECISION_LABELS, filters.precision)}</select></div>
      <div class="filter-block"><label for="phone">电话</label><select id="phone">${selectOptions(PHONE_LABELS, filters.phone)}</select></div>
    `;
    for (const key of ['search', 'region', 'typeGroup', 'precision', 'phone']) {
      filtersRoot.querySelector(`#${key}`).addEventListener(key === 'search' ? 'input' : 'change', (event) => {
        filters[key] = event.target.value;
        onFilterChange({ ...filters });
      });
    }
  }

  function renderStats(summary, filteredCount) {
    statsRoot.innerHTML = `
      <article class="stat-card"><span class="stat-value">${summary.total}</span><span>当前记录</span></article>
      <article class="stat-card"><span class="stat-value">${filteredCount}</span><span>列表显示</span></article>
      <article class="stat-card"><span class="stat-value">${summary.withPhone}</span><span>带电话</span></article>
      <article class="stat-card"><span class="stat-value">${summary.byPrecision.exact || 0}</span><span>精确/近似精确</span></article>
    `;
  }

  function renderList(records, activeId) {
    listRoot.innerHTML = records.map((record) => `
      <article class="record-card ${record.id === activeId ? 'active' : ''}" data-id="${record.id}">
        <strong>${record.id}. ${record.name}</strong>
        <span>${record.regionLabel} · ${record.type} · ${PRECISION_LABELS[record.locationPrecision]}</span>
        <small>${record.address || '地址待核查'}${record.phone ? ` · ${record.phone}` : ' · 缺电话'}</small>
      </article>
    `).join('');
    for (const card of listRoot.querySelectorAll('.record-card')) {
      card.addEventListener('click', () => onRecordSelect(Number(card.dataset.id)));
    }
  }

  function renderDetail(selection) {
    if (!selection) {
      detailRoot.classList.remove('is-open');
      detailRoot.innerHTML = '';
      return;
    }
    const records = selection.records || [selection];
    const title = selection.kind === 'group' ? `${selection.label}（${records.length} 家）` : records[0].name;
    detailRoot.classList.add('is-open');
    detailRoot.innerHTML = `
      <button class="detail-close" aria-label="关闭">×</button>
      <h2>${title}</h2>
      <div class="detail-records">
        ${records.map((record) => `
          <section class="detail-record">
            <h3>${record.id}. ${record.name}</h3>
            <p>${record.type} · ${record.regionLabel} · ${PRECISION_LABELS[record.locationPrecision]}</p>
            <p>${record.address || '地址待核查'}</p>
            <p>${record.phone || '暂无电话'}</p>
            <a href="${record.externalSearchUrl}" target="_blank" rel="noreferrer">打开外部地图搜索</a>
          </section>
        `).join('')}
      </div>
    `;
    detailRoot.querySelector('.detail-close').addEventListener('click', () => renderDetail(null));
  }

  function renderLegend() {
    legendRoot.innerHTML = `
      <span><i style="background:#c78b38"></i>家具/门店</span>
      <span><i style="background:#8b2419"></i>工厂/加工</span>
      <span><i style="background:#3f6f88"></i>公司/机构</span>
      <span><i style="background:#5e7c4f"></i>工艺/根雕</span>
    `;
  }

  renderFilters();
  renderLegend();

  return { renderStats, renderList, renderDetail };
}
```

- [ ] **Step 2: Wire app state in main**

Replace `src/main.js` with:

```js
import './styles.css';
import records from '../data/enterprises.json' with { type: 'json' };
import { filterEnterprises, groupForMap, summarizeEnterprises, DEFAULT_FILTERS } from './dataStore.js';
import { createMapScene } from './scene.js';
import { createUi } from './ui.js';

const state = {
  filters: { ...DEFAULT_FILTERS },
  filtered: records,
  activeId: null,
};

const scene = createMapScene(document.querySelector('#sceneRoot'), {
  onSelect(mapGroup) {
    ui.renderDetail(mapGroup);
    if (mapGroup.records.length === 1) {
      state.activeId = mapGroup.records[0].id;
      ui.renderList(state.filtered, state.activeId);
    }
  },
});

const ui = createUi({
  filtersRoot: document.querySelector('#filters'),
  statsRoot: document.querySelector('#statsGrid'),
  listRoot: document.querySelector('#recordList'),
  detailRoot: document.querySelector('#detailPanel'),
  legendRoot: document.querySelector('#legend'),
  onFilterChange(nextFilters) {
    state.filters = nextFilters;
    render();
  },
  onRecordSelect(id) {
    const record = records.find((item) => item.id === id);
    state.activeId = id;
    ui.renderList(state.filtered, state.activeId);
    ui.renderDetail(record);
  },
});

function render() {
  state.filtered = filterEnterprises(records, state.filters);
  const summary = summarizeEnterprises(state.filtered);
  const groups = groupForMap(state.filtered);
  ui.renderStats(summary, state.filtered.length);
  ui.renderList(state.filtered, state.activeId);
  scene.renderGroups(groups);
}

for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
    scene.setView(button.dataset.view);
  });
}

render();
```

- [ ] **Step 3: Extend CSS for complete UI**

Append to `src/styles.css`:

```css
.legend { display: flex; flex-wrap: wrap; gap: 10px; color: var(--muted); font-size: 13px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 12px; height: 12px; display: inline-block; border-radius: 50%; }
.record-card strong, .record-card span, .record-card small { display: block; }
.record-card strong { font-size: 14px; line-height: 1.35; }
.record-card span { margin-top: 4px; color: var(--muted); font-size: 12px; }
.record-card small { margin-top: 4px; color: #7a6b62; line-height: 1.4; }
.detail-close { float: right; width: 34px; height: 34px; border: 1px solid var(--line); background: white; cursor: pointer; }
.detail-panel h2 { margin: 0 38px 10px 0; font-size: 20px; }
.detail-records { display: grid; gap: 10px; }
.detail-record { border-top: 1px solid var(--line); padding-top: 10px; }
.detail-record h3 { margin: 0 0 6px; font-size: 16px; }
.detail-record p { margin: 4px 0; color: var(--muted); line-height: 1.45; }
.detail-record a { display: inline-block; margin-top: 6px; color: var(--hongmu); font-weight: 700; }
```

- [ ] **Step 4: Run logic tests and build**

Run:

```bash
pnpm run test
pnpm run build
```

Expected: Node tests pass and Vite build succeeds.

- [ ] **Step 5: Commit UI wiring**

Run:

```bash
git add src/main.js src/ui.js src/styles.css
git commit -m "feat: wire dashboard and enterprise detail ui"
```

## Task 6: Browser Verification And Polish

**Files:**
- Create: `tests/browser-smoke.mjs`
- Modify as needed: `src/styles.css`, `src/scene.js`, `src/ui.js`

- [ ] **Step 1: Add browser smoke test**

Create `tests/browser-smoke.mjs` with:

```js
import { chromium } from 'playwright';

const url = process.env.APP_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas');
await page.waitForSelector('.record-card');
const recordCount = await page.locator('.record-card').count();
const title = await page.locator('h1').textContent();
const pixels = await page.locator('canvas').screenshot();
await browser.close();

if (!title.includes('西双版纳红木企业分布')) throw new Error('Title missing');
if (recordCount !== 78) throw new Error(`Expected 78 records, got ${recordCount}`);
if (pixels.length < 1000) throw new Error('Canvas screenshot looks empty');
console.log(`Browser smoke passed at ${url} with ${recordCount} records`);
```

- [ ] **Step 2: Run the app locally**

Run:

```bash
pnpm run dev
```

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`. Keep this session running until browser verification finishes.

- [ ] **Step 3: Run browser smoke test in another shell**

Run:

```bash
APP_URL=http://127.0.0.1:5173 pnpm run test:browser
```

Expected: `Browser smoke passed at http://127.0.0.1:5173 with 78 records`.

- [ ] **Step 4: Manual verification checklist**

Open the local URL and verify:

- 3D scene is nonblank and animated.
- Full list initially shows 78 records.
- Region, type, precision, phone, and search filters update list, stats, and 3D map.
- Clicking an exact point opens a single-enterprise detail.
- Clicking a road/area column opens a multi-enterprise group detail.
- Detail panel includes phone when present and an external map search link.
- Text does not overlap at desktop width around 1440 px.
- At mobile width around 390 px, the dashboard stacks below the map and text remains inside controls/cards.

- [ ] **Step 5: Commit verification test and polish**

Run:

```bash
git add tests/browser-smoke.mjs src/styles.css src/scene.js src/ui.js
git commit -m "test: add browser smoke verification"
```

## Task 7: Final Verification And Handoff

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Create usage README**

Create `README.md` with:

```markdown
# 西双版纳红木企业分布 3D 地图

本项目是一个本地网页应用，用于展示西双版纳红木企业、家具城、门店、加工厂及相关机构的三维分布和数据看板。

## 数据说明

首版数据来自 `assets/source/西双版纳红木企业不完全整理，部分附带谷歌地图电话号码.docx`，共 78 条记录。应用完整保留所有记录，并用 `locationPrecision` 标注定位精度：

- `exact`：精确/近似精确
- `road`：道路级
- `area`：片区/县市级
- `unknown`：待核查

概略地址不会被当作精确门牌展示；它们会以道路级或片区级聚合柱显示。

## 运行

```bash
pnpm install
pnpm run dev
```

打开终端显示的本地 URL。

## 重新生成数据

```bash
python3 scripts/extract_enterprises.py
```

## 验证

```bash
python3 -m unittest tests/extract_enterprises_test.py -v
pnpm run test
pnpm run build
pnpm run dev
APP_URL=http://127.0.0.1:5173 pnpm run test:browser
```
```

- [ ] **Step 2: Run all verification**

Run:

```bash
python3 -m unittest tests/extract_enterprises_test.py -v
pnpm run test
pnpm run build
```

Expected: Python tests pass, Node tests pass, Vite build succeeds.

- [ ] **Step 3: Check Git status**

Run:

```bash
git status --short
```

Expected: only intended changes are present, or clean after commit.

- [ ] **Step 4: Commit README**

Run:

```bash
git add README.md
git commit -m "docs: add local usage instructions"
```

- [ ] **Step 5: Final user handoff**

Report:

- Local dev URL.
- Data count: 78 records.
- Verification commands run and their results.
- Any remaining limitation: schematic coordinates show precision levels and are not survey-grade coordinates.

## Self-Review

- Spec coverage: Tasks cover complete Word extraction, location precision levels, A+B interactive 3D map plus dashboard, offline-first app, external map links, filtering, search, details, and verification.
- Placeholder scan: No forbidden placeholder phrases or unspecified edge-handling steps remain.
- Type consistency: `locationPrecision`, `typeGroup`, `region`, `schematic`, `externalSearchUrl`, `filterEnterprises`, `summarizeEnterprises`, and `groupForMap` are named consistently across extraction, tests, app state, UI, and scene.
