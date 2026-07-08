import './styles.css';
import records from '../data/enterprises.json';
import flatMapReference from '../assets/source/ChatGPT Image 2026年7月6日 20_47_57.png';
import panoramaReference from '../assets/source/panorama_cropped.png';
import {
  DEFAULT_FILTERS,
  filterEnterprises,
  groupForMap,
  summarizeEnterprises,
} from './dataStore.js';
import { createMapScene } from './scene.js';
import { createUi } from './ui.js';

const state = {
  filters: { ...DEFAULT_FILTERS },
  filtered: records,
  activeId: null,
};

const sourceReferences = [
  {
    src: flatMapReference,
    alt: 'GPT 平面分布图参考',
    caption: '平面分布图参考',
  },
  {
    src: panoramaReference,
    alt: '谷歌地图截图参考',
    caption: '谷歌地图截图参考',
  },
];

function clearSelection() {
  state.activeId = null;
  scene.setActiveId(null);
  ui.renderList(state.filtered, state.activeId);
  ui.renderDetail(null);
}

const scene = createMapScene(document.querySelector('#sceneRoot'), {
  onSelect(mapGroup) {
    ui.renderDetail(mapGroup);

    state.activeId = mapGroup.records.length === 1 ? mapGroup.records[0].id : null;
    scene.setActiveId(state.activeId);
    ui.renderList(state.filtered, state.activeId);
  },
});

const ui = createUi({
  filtersRoot: document.querySelector('#filters'),
  statsRoot: document.querySelector('#statsGrid'),
  listRoot: document.querySelector('#recordList'),
  detailRoot: document.querySelector('#detailPanel'),
  legendRoot: document.querySelector('#legend'),
  referenceRoot: document.querySelector('#sourceReference'),
  insightRoot: document.querySelector('#insightPanel'),
  sourceReferences,
  onFilterChange(nextFilters) {
    state.filters = nextFilters;
    clearSelection();
    render();
  },
  onRecordSelect(id) {
    const record = state.filtered.find((item) => item.id === id) ?? records.find((item) => item.id === id);

    if (!record) {
      return;
    }

    state.activeId = id;
    scene.setActiveId(id);
    ui.renderList(state.filtered, state.activeId);
    ui.renderDetail(record);
  },
  onDetailClose() {
    clearSelection();
  },
});

function render() {
  state.filtered = filterEnterprises(records, state.filters);

  if (state.activeId !== null && !state.filtered.some((record) => record.id === state.activeId)) {
    clearSelection();
  }

  const summary = summarizeEnterprises(state.filtered);
  const groups = groupForMap(state.filtered);

  ui.renderStats(summary, state.filtered.length, records.length);
  ui.renderInsights(summary, groups);
  ui.renderList(state.filtered, state.activeId);
  scene.renderGroups(groups);
  scene.setActiveId(state.activeId);
}

for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => {
    for (const item of document.querySelectorAll('[data-view]')) {
      item.classList.toggle('active', item === button);
    }

    scene.setView(button.dataset.view);
  });
}

render();
