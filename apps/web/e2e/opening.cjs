/* Safe UI checks: every API request is fulfilled locally. No production opens. */
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fixture = require('./fixtures/static.json');
const imageOverrides = require('../src/data/item-image-overrides.json');
const out = process.env.OPENING_ARTIFACT_DIR || path.resolve(__dirname, '../../../../artifacts/opening-v2');
const baseURL = process.env.OPENING_BASE_URL || 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw Error('These tests require a local preview.');
const report = [];
let browser;

async function setup(options = {}) {
  const context = await browser.newContext({ viewport: options.viewport || {width:1440,height:900}, reducedMotion: options.reduced ? 'reduce' : 'no-preference' });
  const data = structuredClone(fixture);
  const winner = data.items[0];
  const result = {inventoryItemId:'test-inventory',openEventId:'test-event',item:winner,roll:0.42,nonce:1,serverSeedHash:'local-test-hash',clientSeed:'local-test-seed'};
  let calls = 0;
  let release;
  const gate = options.delayed ? new Promise(resolve => {release = resolve;}) : Promise.resolve();
  const errors = [];
  await context.addInitScript(() => {
    localStorage.setItem('cs2cases.accessToken', 'local-fixture-token');
    localStorage.setItem('dz_onboarding_done', '1');
    localStorage.setItem('i18nextLng', 'ru');
  });
  const imageMap = new Map(data.items.map(item => [item.imageUrl, item.id]));
  for (const item of data.items) {
    const name = item.name.replace(/ \([^)]*\)$/, '').replace(/^★ /, '');
    if (imageOverrides[name]) imageMap.set(imageOverrides[name], item.id);
  }
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method()) && !url.pathname.startsWith('/api/')) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      let body = {};
      let status = 200;
      if (url.pathname === '/api/auth/me') body = {id:'local-user',email:'fixture@example.test',role:'USER'};
      else if (url.pathname === '/api/cases/static') body = data;
      else if (url.pathname === '/api/cases/open') {
        calls++;
        assert.equal(request.method(), 'POST');
        assert.equal(request.postDataJSON().caseId, fixture.id);
        await gate;
        status = options.error || 200;
        body = options.error ? {message:'Тест: открытие отклонено'} : result;
      } else if (url.pathname === '/api/cases/seed/me') body = {serverSeedHash:'local-test-hash',clientSeed:'local-test-seed'};
      else if (url.pathname.includes('wallet')) body = {balanceMinor:'100000'};
      else if (url.pathname === '/api/cases') body = [data];
      else if (url.pathname.includes('stats')) body = {totalOpens:'0',totalValueMinor:'0',playerCount:0};
      else body = [];
      try { await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)}); } catch { /* Navigation can cancel a held test response. */ }
      return;
    }
    if (url.hostname !== new URL(baseURL).hostname) {
      if (options.missingImages) return route.abort();
      const id = imageMap.get(request.url());
      if (id && process.env.OPENING_IMAGE_CACHE) {
        try { return await route.fulfill({contentType:'image/png',body:await fs.readFile(path.join(process.env.OPENING_IMAGE_CACHE,id + '.png'))}); } catch {}
      }
      return route.continue();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL + '/cases/static');
  await page.locator('.dza-open').waitFor();
  try { await page.locator('.dza-demo').waitFor({timeout:5000}); }
  catch (error) { console.log('SETUP',await page.locator('body').innerText(),errors); await page.screenshot({path:path.join(out,'setup-error.png')}); throw error; }
  return {context,page,winner,calls:()=>calls,release,errors};
}

async function shownResult(test) {
  await test.page.locator('.cc-opening-stage .dz-record').waitFor({timeout:10000});
  assert.equal(await test.page.locator('.dz-record__name').innerText(), test.winner.name);
  assert.match(await test.page.locator('.dz-record__value').innerText(), /85/);
  assert.equal(test.calls(), 1);
  assert.deepEqual(test.errors, []);
}

async function landing(page) {
  await page.locator('.dz-reel.is-landed').waitFor({timeout:10000});
  const error = await page.evaluate(() => {
    const marker = document.querySelector('.dz-reel__marker').getBoundingClientRect();
    const card = document.querySelector('.dz-reel__card.is-won').getBoundingClientRect();
    const scene = document.querySelector('.cc-opening-stage').getBoundingClientRect();
    return Math.max(Math.abs(card.x + card.width / 2 - marker.x), Math.abs(scene.x + scene.width / 2 - marker.x));
  });
  assert.ok(error <= 1, 'Winner must be centred; error: ' + error);
  return error;
}

async function run(name, callback) {
  if (process.env.OPENING_FILTER && !name.includes(process.env.OPENING_FILTER)) return;
  await callback(); report.push({name,status:'passed'}); console.log('PASS',name);
}

(async () => {
  await fs.mkdir(out,{recursive:true});
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);
  browser = await chromium.launch({headless:true,executablePath});
  try {
    for (const viewport of [{width:1672,height:940},{width:1440,height:900},{width:1920,height:1080},{width:390,height:844}]) {
      await run(`normal opening ${viewport.width}×${viewport.height}`, async () => {
        const test = await setup({viewport});
        await test.page.locator('.dza-open').dblclick();
        await test.page.locator('.dz-reel').waitFor();
        await test.page.waitForFunction(() => Number(document.querySelector('.dz-reel')?.style.getPropertyValue('--reel-progress')) > .35);
        const geometry = await test.page.evaluate(() => {
          const reel = document.querySelector('.dz-reel').getBoundingClientRect();
          const scene = document.querySelector('.cc-opening-stage').getBoundingClientRect();
          window.getSelection()?.removeAllRanges();
          return {reel:reel.width,scene:scene.width};
        });
        assert.ok(Math.abs(geometry.reel - geometry.scene) <= 1);
        await test.page.screenshot({path:path.join(out,`opening-${viewport.width}.png`)});
        const error = await landing(test.page);
        await shownResult(test);
        await test.page.screenshot({path:path.join(out,`result-${viewport.width}.png`)});
        assert.ok(await test.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        report.push({viewport,landingErrorPx:error});
        await test.context.close();
      });
    }
    await run('slow response, double click, skip before response', async () => {
      const test = await setup({delayed:true});
      await test.page.locator('.dza-open').dblclick();
      await test.page.locator('.cc-opening-wait').waitFor();
      assert.equal(await test.page.locator('.dz-reel').count(),0);
      await test.page.screenshot({path:path.join(out,'waiting.png')});
      await test.page.locator('.cc-skip').click();
      assert.equal(await test.page.locator('.cc-opening-stage .dz-record').count(),0);
      test.release();
      await shownResult(test);
      await test.context.close();
    });
    await run('skip after response; receipt recovery without another request', async () => {
      const test = await setup();
      await test.page.locator('.dza-open').click();
      await test.page.locator('.dz-reel').waitFor();
      await test.page.locator('.cc-skip').click();
      await shownResult(test);
      await test.page.reload();
      await test.page.locator('.dz-record__name').waitFor();
      assert.equal(await test.page.locator('.dz-record__name').innerText(),test.winner.name);
      assert.equal(test.calls(),1);
      assert.equal(await test.page.locator('.dze-opening').count(),0);
      await test.context.close();
    });
    await run('reload pending request never retries payment', async () => {
      const test = await setup({delayed:true});
      await test.page.locator('.dza-open').click();
      await test.page.locator('.cc-opening-wait').waitFor();
      await test.page.reload();
      await test.page.locator('.dze-recovery').waitFor();
      assert.equal(await test.page.locator('.dza-open').isEnabled(),false);
      assert.equal(test.calls(),1);
      test.release();
      await test.context.close();
    });
    await run('definitive error releases the opening lock', async () => {
      const test = await setup({error:400});
      await test.page.locator('.dza-open').click();
      await test.page.locator('.form-error').waitFor();
      assert.equal(await test.page.locator('.dze-opening').count(),0);
      assert.equal(await test.page.locator('.dza-open').isEnabled(),true);
      assert.equal(test.calls(),1);
      await test.context.close();
    });
    await run('uncertain server error requires inventory check', async () => {
      const test = await setup({error:503});
      await test.page.locator('.dza-open').click();
      await test.page.locator('.dze-recovery').waitFor();
      assert.equal(await test.page.locator('.dza-open').isEnabled(),false);
      await test.page.locator('.dze-recovery button').click();
      assert.equal(await test.page.locator('.dza-open').isEnabled(),true);
      assert.equal(test.calls(),1);
      await test.context.close();
    });
    await run('reduced motion and missing-image fallback', async () => {
      const test = await setup({reduced:true,missingImages:true,viewport:{width:390,height:844}});
      const start = Date.now();
      await test.page.locator('.dza-open').click();
      await shownResult(test);
      assert.ok(Date.now() - start < 2000);
      await test.page.locator('.dz-record__art[data-image-fallback=true]').waitFor();
      assert.equal(await test.page.locator('.dz-record__name').innerText(),test.winner.name);
      await test.page.screenshot({path:path.join(out,'fallback-mobile.png')});
      await test.context.close();
    });
    await run('resize while spinning keeps the winner centred', async () => {
      const test = await setup();
      await test.page.locator('.dza-open').click();
      await test.page.locator('.dz-reel').waitFor();
      await test.page.setViewportSize({width:390,height:844});
      await landing(test.page);
      await shownResult(test);
      await test.context.close();
    });
    await run('demo never posts an opening', async () => {
      const test = await setup();
      await test.page.locator('.dza-demo').click();
      await test.page.locator('.dz-reel').waitFor();
      await test.page.locator('.cc-skip').click();
      await test.page.locator('.cc-opening-stage .dz-record').waitFor();
      assert.equal(test.calls(),0);
      assert.match(await test.page.locator('.dz-record__label').innerText(),/ДЕМО/);
      await test.context.close();
    });
    if (process.env.OPENING_RECORD_FRAMES) await run('capture complete local opening', async () => {
      const test = await setup({viewport:{width:1440,height:900}});
      const frames = path.join(out,'frames');
      await fs.mkdir(frames,{recursive:true});
      await test.page.locator('.dza-open').click();
      await test.page.locator('.dz-reel').waitFor();
      let count = 0;
      const start = Date.now();
      while (Date.now() - start < 7000) {
        await test.page.screenshot({path:path.join(frames,String(count++).padStart(3,'0') + '.png')});
        await test.page.waitForTimeout(120);
      }
      await shownResult(test);
      await test.context.close();
    });
  } finally {
    await fs.writeFile(path.join(out,'browser-tests.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});
