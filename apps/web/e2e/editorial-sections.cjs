/* Local API simulation only. Never performs paid production operations. */
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fixture = require('./fixtures/static.json');
const overrides = require('../src/data/item-image-overrides.json');
const base = process.env.EDITORIAL_BASE_URL || 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local preview required');
const out = process.env.EDITORIAL_ARTIFACT_DIR || path.resolve(__dirname, '../../../../artifacts/editorial-v2');
const cache = process.env.EDITORIAL_IMAGE_CACHE;
const report = [];
let browser;
async function setup(routeName, options = {}) {
  const context = await browser.newContext({viewport:options.viewport || {width:1600,height:1000},reducedMotion:options.reduced ? 'reduce' : 'no-preference'});
  await context.addInitScript(({anonymous}) => {if(!anonymous)localStorage.setItem('cs2cases.accessToken','local-test');localStorage.setItem('i18nextLng','ru');localStorage.setItem('dz_onboarding_done','1');},{anonymous:options.anonymous});
  const inventory = (options.empty ? [] : fixture.items).map((caseItem,i)=>({id:'local-inv-'+i,status:'IN_INVENTORY',acquiredAt:new Date(Date.now()-i*1000).toISOString(),caseItem}));
  const operations = [], ledger = [], posts = [], errors = [];
  let balance = options.poor ? 0n : 1245000n, release;
  const gate = options.delayed ? new Promise(resolve=>release=resolve) : Promise.resolve();
  const imageMap = new Map(fixture.items.map(item=>[item.imageUrl,item.id]));
  for(const item of fixture.items){const name=item.name.replace(/ \([^)]*\)$/, '').replace(/^★ /,'');if(overrides[name])imageMap.set(overrides[name],item.id);}
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname.startsWith('/api/')){
      let body=[],status=200;
      const p=url.pathname.replace('/api','');
      if(p==='/auth/me')body={id:'local-user',displayName:'Игрок',email:'local@example.test',role:'USER'};
      else if(p==='/cases')body=[fixture];
      else if(p==='/wallet/me')body={balanceMinor:String(balance)};
      else if(p==='/wallet/me/ledger')body=ledger;
      else if(p==='/cases/inventory/me'){body=inventory.filter(item=>item.status==='IN_INVENTORY');if(options.loadError){status=503;body={message:'Тестовая ошибка загрузки'};}}
      else if(p==='/games/upgrade-targets')body=fixture.items;
      else if(p==='/games/operations/me')body=operations;
      else if(request.method()==='POST' && (p.startsWith('/games/') || /inventory.*sell/.test(p))){
        posts.push({path:p,body:request.postDataJSON()});await gate;
        const error=options.error || (options.failSecond && posts.length===2 ? 503 : 0);
        if(error){status=error;body={message:'Тестовая ошибка операции'};}
        else if(p.endsWith('/sell')){const id=p.split('/')[3],item=inventory.find(x=>x.id===id);assert.equal(item.status,'IN_INVENTORY');item.status='SOLD';balance+=BigInt(item.caseItem.valueMinor);ledger.push({id:'sale-'+id,reason:'ITEM_SELL',referenceId:id,amountMinor:item.caseItem.valueMinor,balanceAfterMinor:String(balance),createdAt:new Date().toISOString()});body=item;}
        else {
          const input=request.postDataJSON(),type=p.endsWith('contracts')?'CONTRACT':p.endsWith('upgrades')?'UPGRADE':'BATTLE';
          const op={id:'local-op-'+posts.length,type,status:options.lost?'LOST':'WON',roll:options.lost?.99:.1,chance:.31,nonce:1,serverSeedHash:'local-test-hash',createdAt:new Date().toISOString(),inputInventoryItemIds:input.inventoryItemIds || (input.inventoryItemId?[input.inventoryItemId]:[]),metadata:{caseId:fixture.id}};
          operations.unshift(op);
          if(type==='CONTRACT'){assert.ok(input.inventoryItemIds.length>=3&&input.inventoryItemIds.length<=10);for(const id of input.inventoryItemIds)inventory.find(x=>x.id===id).status='CONSUMED';const item=fixture.items[1];inventory.push({id:'contract-result',status:'IN_INVENTORY',acquiredAt:new Date().toISOString(),caseItem:item});body={operation:op,item,inventoryItemId:'contract-result',inputValueMinor:'1000'};}
          else if(type==='UPGRADE'){const item=fixture.items.find(x=>x.id===input.targetCaseItemId);inventory.find(x=>x.id===input.inventoryItemId).status='CONSUMED';if(!options.lost)inventory.push({id:'upgrade-result',status:'IN_INVENTORY',acquiredAt:new Date().toISOString(),caseItem:item});body={operation:op,won:!options.lost,item:options.lost?null:item,target:item,chance:.31};}
          else{balance-=BigInt(fixture.priceMinor);body={operation:op,won:true,battleCase:{id:fixture.id,name:fixture.name},playerItem:fixture.items[1],botItem:fixture.items[0],winnings:['battle-1','battle-2']};}
        }
      } else if(request.method()!=='GET' && p!=='/auth/me') throw Error('Unexpected mutation '+p);
      try{return await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});}catch{return;}
    }
    if(imageMap.has(request.url())&&!options.missingImages){if(cache){try{return await route.fulfill({contentType:'image/png',body:await fs.readFile(path.join(cache,imageMap.get(request.url())+'.png'))});}catch{}}return route.continue();}
    if(url.hostname!==new URL(base).hostname)return route.abort();
    return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/'+routeName,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  return {page,context,posts,errors,inventory,operations,release,ledger};
}
async function close(test){assert.deepEqual(test.errors,[]);await test.context.close();}
async function selectContract(test,count=3){for(let i=0;i<count;i++)await test.page.locator('.edv2-item').nth(i).click();}
async function selectUpgrade(test){await test.page.locator('.edv2-item').first().click();await test.page.locator('.edv2-item').first().click();}
async function confirmTwice(test){await test.page.getByRole('button',{name:'Продать выбранное',exact:true}).click();await test.page.locator('dialog').getByRole('button',{name:'Продолжить',exact:true}).click();await test.page.locator('dialog').getByRole('button',{name:/Продать за/}).evaluate(el=>{el.click();el.click();});}
async function check(name,fn){if(process.env.EDITORIAL_SKIP_LAYOUT&&name.startsWith('layout'))return;if(process.env.EDITORIAL_FILTER&&!name.includes(process.env.EDITORIAL_FILTER))return;await fn();report.push({name,status:'passed'});console.log('PASS '+name);}
(async()=>{
 await fs.mkdir(out,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  for(const route of ['battles','contracts','upgrader','inventory'])for(const viewport of [{width:1600,height:1000},{width:1440,height:900},{width:390,height:844}])await check('layout '+route+' '+viewport.width,async()=>{const t=await setup(route,{viewport});if(route==='contracts')await selectContract(t,4);if(route==='upgrader')await selectUpgrade(t);if(route==='inventory')for(let i=0;i<3;i++)await t.page.locator('.edv2-item').nth(i).click();await t.page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.race([Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;}))),new Promise(resolve=>setTimeout(resolve,2000))]);window.scrollTo({top:0,behavior:'instant'});});assert.equal(await t.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await t.page.locator('.fidelity-header').count(),1);assert.equal(await t.page.locator('.fidelity-rail').count(),1);await t.page.screenshot({path:path.join(out,route+'-'+viewport.width+'.png'),fullPage:viewport.width!==1600});if(viewport.width!==1600)await t.page.screenshot({path:path.join(out,route+'-'+viewport.width+'-viewport.png'),fullPage:false});if(viewport.width===1600)await t.page.screenshot({path:path.join(out,route+'-1600-full.png'),fullPage:true});const missing=await t.page.locator('[data-image-fallback=true]').count();assert.equal(missing,0);if(viewport.width===390){const nav=t.page.locator('.bottom-nav');if(await nav.count())assert.equal(await nav.isVisible(),true);}await close(t);});
  await check('contract min max removal success double click',async()=>{const t=await setup('contracts');const submit=t.page.getByRole('button',{name:'Создать контракт',exact:true});assert.equal(await submit.isEnabled(),false);await selectContract(t,10);assert.equal(await t.page.locator('.edv2-item:not(.is-selected)').first().isEnabled(),false);await t.page.locator('.edv2-slot button').first().click();assert.equal(await t.page.locator('.edv2-item:not(.is-selected)').first().isEnabled(),true);await submit.click();await t.page.locator('dialog').getByRole('button',{name:'Использовать предметы'}).evaluate(el=>{el.click();el.click();});await t.page.getByRole('heading',{name:'Контракт выполнен'}).waitFor();assert.equal(t.posts.length,1);assert.equal(t.inventory.filter(x=>x.status==='CONSUMED').length,9);await close(t);});
  for(const lost of [false,true])await check('upgrade '+(lost?'loss':'success')+' and reduced motion',async()=>{const t=await setup('upgrader',{lost,reduced:true});await selectUpgrade(t);await t.page.getByRole('button',{name:'Апгрейд',exact:true}).click();await t.page.locator('dialog').getByRole('button',{name:'Выполнить апгрейд'}).evaluate(el=>{el.click();el.click();});await t.page.getByRole('heading',{name:lost?'Попытка завершена':'Апгрейд успешен'}).waitFor();assert.equal(t.posts.length,1);assert.equal(t.inventory.filter(x=>x.status==='CONSUMED').length,1);await close(t);});
  await check('battle server result wallet history',async()=>{const t=await setup('battles');await t.page.getByRole('button',{name:/Начать ·/}).click();await t.page.locator('dialog').getByRole('button',{name:/Списать/}).evaluate(el=>{el.click();el.click();});await t.page.getByText('Победа — оба предмета ваши',{exact:true}).waitFor();assert.equal(t.posts.length,1);await t.page.getByRole('button',{name:/Моя история/}).click();await t.page.getByRole('button',{name:'Подробнее'}).click();assert.ok((await t.page.locator('dialog').innerText()).includes('local-op-1'));await close(t);});
  await check('battle insufficient balance',async()=>{const t=await setup('battles',{poor:true});assert.equal(await t.page.getByRole('button',{name:'Недостаточно средств'}).isEnabled(),false);assert.equal(t.posts.length,0);await close(t);});
  await check('cross tab battle requests never queue a second debit',async()=>{const t=await setup('battles',{delayed:true});const second=await t.context.newPage();await second.goto(base+'/battles',{waitUntil:'networkidle'});await t.page.getByRole('button',{name:/Начать ·/}).click();await second.getByRole('button',{name:/Начать ·/}).click();await t.page.locator('dialog').getByRole('button',{name:/Списать/}).click();await t.page.getByText('Сервер обрабатывает операцию…').waitFor();await second.locator('dialog').getByRole('button',{name:/Списать/}).click();await second.locator('dialog').waitFor({state:'detached'});t.release();await t.page.getByText('Победа — оба предмета ваши',{exact:true}).waitFor();assert.equal(t.posts.length,1);await close(t);});
  await check('inventory bulk sale and double confirmation',async()=>{const t=await setup('inventory');await selectContract(t,3);await confirmTwice(t);await t.page.getByText(/Продано предметов: 3/).waitFor();assert.equal(t.posts.length,3);assert.equal(t.inventory.filter(x=>x.status==='SOLD').length,3);await close(t);});
  await check('inventory partial failure stops queue and reload blocks replay',async()=>{const t=await setup('inventory',{failSecond:true});await selectContract(t,3);await confirmTwice(t);await t.page.getByText('Проверяем предыдущую продажу').waitFor();assert.equal(t.posts.length,2);await t.page.reload({waitUntil:'networkidle'});await t.page.getByText('Проверяем предыдущую продажу').waitFor();assert.equal(t.posts.length,2);assert.equal(await t.page.getByRole('button',{name:'Продать выбранное'}).isEnabled(),false);await close(t);});
  await check('pending contract reload never replays request',async()=>{const t=await setup('contracts',{delayed:true});await selectContract(t);await t.page.getByRole('button',{name:'Создать контракт'}).click();await t.page.locator('dialog').getByRole('button',{name:'Использовать предметы'}).click();await t.page.getByText('Сервер обрабатывает операцию…').waitFor();await t.page.reload({waitUntil:'domcontentloaded'});await t.page.getByText('Проверяем предыдущую операцию').waitFor();assert.equal(t.posts.length,1);assert.equal(await t.page.getByRole('button',{name:'Создать контракт'}).isEnabled(),false);t.release();await close(t);});
  for(const error of [400,503])await check('contract error '+error,async()=>{const t=await setup('contracts',{error});await selectContract(t);await t.page.getByRole('button',{name:'Создать контракт'}).click();await t.page.locator('dialog').getByRole('button',{name:'Использовать предметы'}).click();await t.page.getByRole('alert').waitFor();assert.equal(t.posts.length,1);assert.equal(await t.page.getByRole('button',{name:'Создать контракт'}).isEnabled(),error===400);await close(t);});
  await check('inventory search filters sorting and cross page selection',async()=>{const t=await setup('inventory');await t.page.getByRole('textbox',{name:'Поиск скинов'}).fill('M4A1');assert.equal(await t.page.locator('.edv2-item').count(),1);await t.page.locator('.edv2-item').click();await t.page.getByRole('link',{name:'В апгрейд →'}).click();await t.page.locator('.edv2-upgrade-art img').waitFor();assert.ok((await t.page.locator('.edv2-upgrade-choice').first().innerText()).includes('M4A1-S'));await close(t);});
  for(const mode of ['empty','loadError'])await check('inventory '+mode,async()=>{const t=await setup('inventory',{[mode]:true});await t.page.getByText(mode==='empty'?'Ваша коллекция пока пуста':'Тестовая ошибка загрузки',{exact:false}).waitFor();assert.equal(await t.page.getByRole('button',{name:'Продать выбранное'}).isEnabled(),false);await close(t);});
  await check('anonymous games require auth',async()=>{const t=await setup('contracts',{anonymous:true});await t.page.getByRole('heading',{name:'Войдите в CaseCrow'}).waitFor();assert.equal(await t.page.getByRole('button',{name:'Создать контракт'}).isEnabled(),false);assert.equal(t.posts.length,0);await close(t);});
  await check('missing image fallback and keyboard confirmation',async()=>{const t=await setup('contracts',{missingImages:true});await t.page.locator('[data-image-fallback=true]').first().waitFor();await selectContract(t);await t.page.getByRole('button',{name:'Создать контракт'}).click();assert.equal(await t.page.locator('dialog').isVisible(),true);await t.page.keyboard.press('Escape');assert.equal(await t.page.locator('dialog').count(),0);assert.equal(t.posts.length,0);await close(t);});
 }finally{const old=JSON.parse(await fs.readFile(path.join(out,'test-results.json'),'utf8').catch(()=> '[]'));await fs.writeFile(path.join(out,'test-results.json'),JSON.stringify([...old.filter(x=>!report.some(y=>x.name===y.name)),...report],null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
