import {
  DEFAULT_FILTERS,
  PRECISION_LABELS,
  REGION_LABELS,
  TYPE_GROUP_LABELS,
} from './dataStore.js';

const PHONE_LABELS = {
  all: '全部电话',
  with: '带电话',
  without: '缺电话',
};

const TYPE_COLORS = {
  store: '#c78b38',
  factory: '#8b2419',
  institution: '#3f6f88',
  craft: '#5e7c4f',
  other: '#7b6b61',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function selectOptions(options, selected) {
  return Object.entries(options)
    .map(([value, label]) => (
      `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`
    ))
    .join('');
}

function formatCount(value) {
  return Number.isFinite(value) ? value : 0;
}

function safeExternalMapUrl(value) {
  const urlText = String(value ?? '').trim();

  if (!urlText) {
    return '';
  }

  try {
    const url = new URL(urlText);
    const isGoogleMapsSearch = url.protocol === 'https:'
      && ['www.google.com', 'google.com'].includes(url.hostname)
      && url.pathname.startsWith('/maps/search/');

    return isGoogleMapsSearch ? url.href : '';
  } catch {
    return '';
  }
}

function precisionLabel(record) {
  return PRECISION_LABELS[record.locationPrecision] ?? PRECISION_LABELS.unknown;
}

function externalMapLink(record) {
  const safeUrl = safeExternalMapUrl(record.externalSearchUrl);

  if (!safeUrl) {
    return '<span class="detail-disabled-link">暂无外部地图链接</span>';
  }

  return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">打开外部地图搜索</a>`;
}

function detailTitle(selection, records) {
  if (selection.kind === 'group') {
    return `${selection.label || '聚合点'}（${records.length} 家）`;
  }

  return records[0]?.name || '未命名企业';
}

export function createUi({
  filtersRoot,
  statsRoot,
  listRoot,
  detailRoot,
  legendRoot,
  referenceRoot,
  insightRoot,
  sourceReferences = [],
  onFilterChange,
  onRecordSelect,
  onDetailClose,
}) {
  const filters = { ...DEFAULT_FILTERS };

  function renderFilters() {
    filtersRoot.innerHTML = `
      <div class="filter-block">
        <label for="search">搜索企业/地址/电话</label>
        <input id="search" value="${escapeHtml(filters.search)}" placeholder="输入名称、道路或电话" autocomplete="off">
      </div>
      <div class="filter-block">
        <label for="region">区域</label>
        <select id="region">${selectOptions(REGION_LABELS, filters.region)}</select>
      </div>
      <div class="filter-block">
        <label for="typeGroup">类型</label>
        <select id="typeGroup">${selectOptions(TYPE_GROUP_LABELS, filters.typeGroup)}</select>
      </div>
      <div class="filter-block">
        <label for="precision">定位精度</label>
        <select id="precision">${selectOptions(PRECISION_LABELS, filters.precision)}</select>
      </div>
      <div class="filter-block">
        <label for="phone">电话</label>
        <select id="phone">${selectOptions(PHONE_LABELS, filters.phone)}</select>
      </div>
    `;

    for (const key of ['search', 'region', 'typeGroup', 'precision', 'phone']) {
      const control = filtersRoot.querySelector(`#${key}`);
      control.addEventListener(key === 'search' ? 'input' : 'change', (event) => {
        filters[key] = event.target.value;
        onFilterChange({ ...filters });
      });
    }
  }

  function renderStats(summary, filteredCount, totalCount) {
    statsRoot.innerHTML = `
      <article class="stat-card">
        <span class="stat-value">${formatCount(totalCount)}</span>
        <span>全部记录</span>
      </article>
      <article class="stat-card">
        <span class="stat-value">${formatCount(filteredCount)}</span>
        <span>筛选结果</span>
      </article>
      <article class="stat-card">
        <span class="stat-value">${formatCount(summary.withPhone)}</span>
        <span>带电话</span>
      </article>
      <article class="stat-card">
        <span class="stat-value">${formatCount(summary.byPrecision?.exact)}</span>
        <span>精确/近似精确</span>
      </article>
    `;
  }

  function rankedEntries(counts, labels, limit = 5) {
    return Object.entries(counts ?? {})
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1] || String(labels[a[0]] ?? a[0]).localeCompare(String(labels[b[0]] ?? b[0])))
      .slice(0, limit)
      .map(([key, count]) => ({ key, label: labels[key] ?? key, count }));
  }

  function rankList(title, entries, tone) {
    return `
      <section class="rank-card ${tone}">
        <h2>${escapeHtml(title)}</h2>
        <ol class="rank-list">
          ${entries.map((entry, index) => `
            <li>
              <span class="rank-index">${index + 1}</span>
              <span class="rank-name">${escapeHtml(entry.label)}</span>
              <strong>${formatCount(entry.count)}</strong>
            </li>
          `).join('')}
        </ol>
      </section>
    `;
  }

  function renderInsights(summary, groups = []) {
    if (!insightRoot) {
      return;
    }

    const regionEntries = rankedEntries(summary.byRegion, REGION_LABELS);
    const typeEntries = rankedEntries(summary.byTypeGroup, TYPE_GROUP_LABELS);
    const hottestGroup = [...groups]
      .sort((a, b) => b.records.length - a.records.length)
      .find((group) => group.records.length > 1);

    insightRoot.innerHTML = `
      <p class="panel-kicker">分布态势</p>
      ${rankList('Top 区域聚集', regionEntries, 'rank-region')}
      ${rankList('Top 类型热度', typeEntries, 'rank-type')}
      <section class="flow-summary">
        <span>${formatCount(groups.length)}</span>
        <p>个热力节点 / 企业流向弧线围绕 ${escapeHtml(hottestGroup?.label ?? '景洪市')} 聚集</p>
      </section>
    `;
  }

  function renderList(records, activeId) {
    if (records.length === 0) {
      listRoot.innerHTML = '<p class="empty-state">没有符合当前筛选条件的企业。</p>';
      return;
    }

    listRoot.innerHTML = records
      .map((record) => `
        <article class="record-card ${record.id === activeId ? 'active' : ''}" data-id="${escapeHtml(record.id)}" role="button" tabindex="0">
          <strong>${escapeHtml(record.id)}. ${escapeHtml(record.name || '未命名企业')}</strong>
          <span>${escapeHtml(record.regionLabel || REGION_LABELS[record.region] || REGION_LABELS.other)} · ${escapeHtml(record.type || '类型待核查')} · ${escapeHtml(precisionLabel(record))}</span>
          <small>${escapeHtml(record.address || '地址待核查')}${record.phone ? ` · ${escapeHtml(record.phone)}` : ' · 缺电话'}</small>
        </article>
      `)
      .join('');

    for (const card of listRoot.querySelectorAll('.record-card')) {
      card.addEventListener('click', () => onRecordSelect(Number(card.dataset.id)));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onRecordSelect(Number(card.dataset.id));
        }
      });
    }

    const activeCard = listRoot.querySelector('.record-card.active');
    if (activeCard) {
      const scrollActiveCard = () => activeCard.scrollIntoView({ block: 'nearest' });
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(scrollActiveCard);
      } else {
        scrollActiveCard();
      }
    }
  }

  function renderDetail(selection) {
    if (!selection) {
      detailRoot.classList.remove('is-open');
      detailRoot.innerHTML = '';
      return;
    }

    const records = selection.records || [selection];
    const title = detailTitle(selection, records);

    detailRoot.classList.add('is-open');
    detailRoot.innerHTML = `
      <button class="detail-close" type="button" aria-label="关闭">×</button>
      <h2>${escapeHtml(title)}</h2>
      <div class="detail-records">
        ${records.map((record) => `
          <section class="detail-record">
            <h3>${escapeHtml(record.id)}. ${escapeHtml(record.name || '未命名企业')}</h3>
            <p>${escapeHtml(record.type || '类型待核查')} · ${escapeHtml(record.regionLabel || REGION_LABELS[record.region] || REGION_LABELS.other)} · ${escapeHtml(precisionLabel(record))}</p>
            <p>${escapeHtml(record.address || '地址待核查')}</p>
            <p>${record.phone ? escapeHtml(record.phone) : '暂无电话'}</p>
            ${externalMapLink(record)}
          </section>
        `).join('')}
      </div>
    `;

    detailRoot.querySelector('.detail-close').addEventListener('click', () => {
      renderDetail(null);
      onDetailClose?.();
    });
  }

  function renderLegend() {
    legendRoot.innerHTML = Object.entries(TYPE_GROUP_LABELS)
      .filter(([value]) => value !== 'all')
      .map(([value, label]) => `
        <span><i style="background:${TYPE_COLORS[value] ?? TYPE_COLORS.other}"></i>${escapeHtml(label)}</span>
      `)
      .join('');
  }

  function renderSourceReferences() {
    if (!referenceRoot || sourceReferences.length === 0) {
      return;
    }

    referenceRoot.innerHTML = sourceReferences
      .map((reference) => `
        <figure class="draggable-reference" data-draggable="true">
          <div class="reference-viewport">
            <img src="${escapeHtml(reference.src)}" alt="${escapeHtml(reference.alt)}">
          </div>
          <figcaption>${escapeHtml(reference.caption)}</figcaption>
        </figure>
      `)
      .join('');

    attachReferenceDraggers();
  }

  function attachReferenceDraggers() {
    for (const frame of referenceRoot.querySelectorAll('.draggable-reference')) {
      const image = frame.querySelector('img');
      const state = {
        x: 0,
        y: 0,
        startX: 0,
        startY: 0,
        dragging: false,
      };

      const applyTransform = () => {
        image.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
      };

      applyTransform();

      frame.addEventListener('pointerdown', (event) => {
        state.dragging = true;
        state.startX = event.clientX - state.x;
        state.startY = event.clientY - state.y;
        frame.classList.add('is-dragging');
        frame.setPointerCapture?.(event.pointerId);
      });

      frame.addEventListener('pointermove', (event) => {
        if (!state.dragging) {
          return;
        }

        state.x = event.clientX - state.startX;
        state.y = event.clientY - state.startY;
        applyTransform();
      });

      const endDrag = (event) => {
        if (!state.dragging) {
          return;
        }

        state.dragging = false;
        frame.classList.remove('is-dragging');
        frame.releasePointerCapture?.(event.pointerId);
      };

      frame.addEventListener('pointerup', endDrag);
      frame.addEventListener('pointercancel', endDrag);
      frame.addEventListener('dblclick', () => {
        state.x = 0;
        state.y = 0;
        applyTransform();
      });
    }
  }

  renderFilters();
  renderLegend();
  renderSourceReferences();

  return { renderStats, renderInsights, renderList, renderDetail };
}
