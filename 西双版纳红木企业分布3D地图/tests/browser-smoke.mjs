import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const url = process.env.APP_URL || 'http://127.0.0.1:5173';
const desktopViewport = { width: 1440, height: 920 };
const mobileViewport = { width: 390, height: 844 };
const bundledPlaywrightPath = process.env.PLAYWRIGHT_MODULE_PATH
  || '/Users/tianhaodong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') {
      throw error;
    }

    if (!existsSync(bundledPlaywrightPath)) {
      throw new Error(
        `Project-local playwright was not found, and no fallback Playwright module exists at ${bundledPlaywrightPath}. `
        + 'Set PLAYWRIGHT_MODULE_PATH to a Playwright ESM entry or install Playwright with `pnpm add -D playwright`.',
        { cause: error },
      );
    }

    if (process.env.PLAYWRIGHT_MODULE_PATH) {
      console.warn(`[browser-smoke] Using Playwright from PLAYWRIGHT_MODULE_PATH: ${bundledPlaywrightPath}`);
    } else {
      console.warn('[browser-smoke] Using bundled Playwright; override with PLAYWRIGHT_MODULE_PATH.');
    }

    return import(bundledPlaywrightPath);
  }
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function decodePng(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  assert.equal(signature, '89504e470d0a1a0a', 'Canvas screenshot is not a PNG');

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (type === 'IHDR') {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  assert.equal(bitDepth, 8, `Unsupported PNG bit depth: ${bitDepth}`);
  const channelsByType = new Map([
    [0, 1],
    [2, 3],
    [4, 2],
    [6, 4],
  ]);
  const channels = channelsByType.get(colorType);
  assert.ok(channels, `Unsupported PNG color type: ${colorType}`);

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let inputOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let row = 0; row < height; row += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const current = Buffer.alloc(stride);

    for (let index = 0; index < stride; index += 1) {
      const raw = inflated[inputOffset + index];
      const left = index >= channels ? current[index - channels] : 0;
      const up = previous[index] ?? 0;
      const upperLeft = index >= channels ? previous[index - channels] : 0;
      let predicted = 0;

      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = Math.floor((left + up) / 2);
      else if (filter === 4) predicted = paethPredictor(left, up, upperLeft);
      else assert.equal(filter, 0, `Unsupported PNG filter: ${filter}`);

      current[index] = (raw + predicted) & 0xff;
    }

    current.copy(pixels, row * stride);
    previous = current;
    inputOffset += stride;
  }

  return { width, height, channels, pixels };
}

function assertCanvasLooksRendered(buffer) {
  assert.ok(buffer.length > 1000, 'Canvas screenshot looks empty');

  const { width, height, channels, pixels } = decodePng(buffer);
  assert.ok(width >= 300, `Canvas screenshot is too narrow: ${width}px`);
  assert.ok(height >= 300, `Canvas screenshot is too short: ${height}px`);

  const uniqueColors = new Set();
  const pixelCount = width * height;
  const step = Math.max(1, Math.floor(pixelCount / 8000));
  let brightSamples = 0;
  let maxLuminance = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += step) {
    const index = pixel * channels;
    const alpha = channels === 4 ? pixels[index + 3] : 255;
    if (alpha === 0) continue;
    const red = pixels[index];
    const green = pixels[index + 1] ?? red;
    const blue = pixels[index + 2] ?? red;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    if (luminance > 72) {
      brightSamples += 1;
    }
    maxLuminance = Math.max(maxLuminance, luminance);
    uniqueColors.add(`${red},${green},${blue}`);
  }

  assert.ok(uniqueColors.size > 12, `Canvas screenshot looks trivially blank (${uniqueColors.size} colors)`);
  assert.ok(maxLuminance > 120, `Canvas lacks bright simulated-map highlights (max luminance ${maxLuminance.toFixed(1)})`);
  assert.ok(brightSamples > 80, `Canvas has too few visible map/highlight pixels (${brightSamples} bright samples)`);
}

function isLikelyMissingBrowserError(error) {
  const message = `${error?.message ?? ''}\n${error?.stack ?? ''}`;
  return /Executable doesn't exist|playwright install|browser was just installed|install.*browser/i.test(message);
}

async function launchBrowser(chromium) {
  try {
    return await chromium.launch();
  } catch (error) {
    if (
      process.platform === 'darwin'
      && !process.env.PLAYWRIGHT_SKIP_CHROME_FALLBACK
      && isLikelyMissingBrowserError(error)
    ) {
      console.warn(`[browser-smoke] Bundled Chromium launch failed; falling back to system Chrome.\n${error.stack ?? error.message}`);
      return chromium.launch({ channel: 'chrome' });
    }

    throw error;
  }
}

async function expectRecordCount(page, expected, label) {
  await page.waitForFunction(
    (count) => document.querySelectorAll('.record-card').length === count,
    expected,
  );
  const actual = await page.locator('.record-card').count();
  assert.equal(actual, expected, `${label}: expected ${expected} records, got ${actual}`);

  const statsValue = Number(await page.locator('.stat-card .stat-value').nth(1).textContent());
  assert.equal(statsValue, expected, `${label}: expected stats count ${expected}, got ${statsValue}`);
}

async function resetFilters(page) {
  await page.fill('#search', '');
  await page.selectOption('#region', 'all');
  await page.selectOption('#typeGroup', 'all');
  await page.selectOption('#precision', 'all');
  await page.selectOption('#phone', 'all');
  await expectRecordCount(page, 78, 'reset filters');
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `${label}: page has ${overflow}px horizontal overflow`);
}

async function assertReferenceImagesLoaded(page) {
  const imageStates = await page.locator('.source-reference img').evaluateAll((images) => images.map((image) => ({
    alt: image.getAttribute('alt') || '',
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    complete: image.complete,
  })));

  assert.equal(imageStates.length, 2, `Expected 2 source reference images, got ${imageStates.length}`);
  assert.ok(imageStates.some((image) => image.alt.includes('平面分布图')), 'Flat map reference image is missing');
  assert.ok(imageStates.some((image) => image.alt.includes('谷歌地图截图')), 'Panorama reference image is missing');

  for (const image of imageStates) {
    assert.equal(image.complete, true, `${image.alt} did not finish loading`);
    assert.ok(image.naturalWidth > 100, `${image.alt} has invalid natural width ${image.naturalWidth}`);
    assert.ok(image.naturalHeight > 40, `${image.alt} has invalid natural height ${image.naturalHeight}`);
  }
}

async function assertReferenceImageIsDraggable(page) {
  const firstReference = page.locator('.draggable-reference').first();
  await firstReference.waitFor();
  const box = await firstReference.boundingBox();
  assert.ok(box, 'Reference image viewport is not visible');

  const initialTransform = await firstReference.locator('img').evaluate((image) => image.style.transform);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 42, box.y + box.height / 2 + 28, { steps: 6 });
  await page.mouse.up();

  const movedTransform = await firstReference.locator('img').evaluate((image) => image.style.transform);
  assert.notEqual(movedTransform, initialTransform, 'Dragging reference image did not change its transform');
  assert.match(movedTransform, /translate3d/, 'Reference image drag transform is missing translate3d');
}

async function assertSimulationDashboard(page) {
  await page.waitForSelector('.app-shell.sim-stage');
  await page.waitForSelector('.hud-panel');
  await page.waitForSelector('.rank-list');
  await page.waitForSelector('.flow-summary');

  const hudCount = await page.locator('.hud-panel').count();
  assert.ok(hudCount >= 2, `Expected at least 2 HUD panels, got ${hudCount}`);

  const shellBackground = await page.locator('.app-shell').evaluate((element) => (
    window.getComputedStyle(element).backgroundImage
  ));
  assert.match(shellBackground, /radial-gradient|linear-gradient/, 'Simulation shell lacks layered map-screen background');

  const sceneRect = await page.locator('.scene-root').boundingBox();
  assert.ok(sceneRect.height >= desktopViewport.height * 0.66, `Scene is too short for dashboard layout: ${sceneRect.height}px`);
  assert.ok(sceneRect.height <= desktopViewport.height * 0.84, `Scene is too tall and clips the 3D map: ${sceneRect.height}px`);
  const pointCount = await page.locator('#sceneRoot').getAttribute('data-map-point-count');
  assert.equal(Number(pointCount), 78, `Expected 78 individual enterprise map points, got ${pointCount}`);

  const rankText = await page.locator('.rank-list').first().textContent();
  assert.match(rankText, /景洪市|工厂|家具/, 'Rank list did not render enterprise distribution content');

  const flowText = await page.locator('.flow-summary').textContent();
  assert.match(flowText, /热力|流向|聚集/, 'Flow summary did not render simulation-map content');
}

const { chromium } = await loadPlaywright();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: desktopViewport });
const pageErrors = [];
page.on('pageerror', (error) => {
  pageErrors.push(error.stack ?? error.message ?? String(error));
});

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas');
  await page.waitForSelector('.record-card');

  const title = await page.locator('h1').textContent();
  assert.ok(title.includes('西双版纳红木企业分布'), 'Title missing');
  await expectRecordCount(page, 78, 'initial list');
  await assertNoHorizontalOverflow(page, 'desktop layout');
  await assertSimulationDashboard(page);
  await assertReferenceImagesLoaded(page);
  await assertReferenceImageIsDraggable(page);

  const pixels = await page.locator('canvas').screenshot();
  assertCanvasLooksRendered(pixels);

  await page.selectOption('#region', 'jinghong');
  await expectRecordCount(page, 69, 'region filter');
  await resetFilters(page);

  await page.selectOption('#typeGroup', 'factory');
  await expectRecordCount(page, 8, 'type filter');
  await resetFilters(page);

  await page.selectOption('#precision', 'exact');
  await expectRecordCount(page, 10, 'precision filter');
  await resetFilters(page);

  await page.selectOption('#phone', 'with');
  await expectRecordCount(page, 49, 'phone filter');
  await resetFilters(page);

  await page.fill('#search', 'ZZZ_NO_MATCH');
  await page.waitForSelector('.empty-state');
  await expectRecordCount(page, 0, 'empty search');
  assert.match(await page.locator('.empty-state').textContent(), /没有符合当前筛选条件/);

  await page.fill('#search', '');
  await expectRecordCount(page, 78, 'search recovery');

  await page.locator('.record-card').nth(1).click();
  await page.waitForSelector('#detailPanel.is-open');
  await page.waitForFunction(() => document.querySelector('#sceneRoot')?.dataset.activeId === '2');
  assert.match(await page.locator('#detailPanel').textContent(), /明檀红木/, 'Detail panel did not show the second enterprise');
  assert.match((await page.locator('.record-card.active').textContent()).trim(), /^2\./, 'Second list card was not highlighted');

  await page.locator('.record-card').first().click();
  await page.waitForFunction(() => document.querySelector('#sceneRoot')?.dataset.activeId === '1');
  await page.waitForSelector('#detailPanel.is-open');
  const detailText = await page.locator('#detailPanel').textContent();
  assert.ok(detailText.includes('红木坊'), 'Detail panel did not show the selected enterprise');
  assert.ok(detailText.includes('+86 691 212 0873'), 'Detail panel did not include phone text');
  await page.waitForSelector('#detailPanel a[href^="https://www.google.com/maps/search/"]');
  assert.equal(await page.locator('.record-card.active').count(), 1, 'Selected card was not highlighted');

  await page.locator('.detail-close').click();
  await page.waitForFunction(() => !document.querySelector('#detailPanel')?.classList.contains('is-open'));
  assert.equal(await page.locator('.record-card.active').count(), 0, 'Active highlight remained after closing detail');

  await page.setViewportSize(mobileViewport);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.record-card');
  await expectRecordCount(page, 78, 'mobile initial list');
  await assertNoHorizontalOverflow(page, 'mobile layout');

  const dashboardStacksBelowMap = await page.evaluate(() => {
    const mapPanel = document.querySelector('.map-panel')?.getBoundingClientRect();
    const dashboard = document.querySelector('.dashboard')?.getBoundingClientRect();
    return Boolean(mapPanel && dashboard && dashboard.top >= mapPanel.bottom - 1);
  });
  assert.equal(dashboardStacksBelowMap, true, 'Mobile dashboard did not stack below the map');
  assert.deepEqual(pageErrors, [], `Page had uncaught errors:\n${pageErrors.join('\n\n')}`);
} finally {
  await browser.close();
}

console.log(`Browser smoke passed at ${url} with 78 records`);
