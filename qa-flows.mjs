import { chromium } from './apps/web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome'}); const results=[];
for (const mode of ['success','skipPending','error','reduced','fallback']) {
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:mode==='reduced'?'reduce':'no-preference'});
 await context.addInitScript(()=>localStorage.setItem('cs2cases.accessToken','TEST-ONLY-NOT-REAL'));
 if(mode==='fallback') await context.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
 const page=await context.newPage();let posts=0;const phases=[]; const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const send=(json,status=200)=>route.fulfill({status,json});
  if(path==='/api/auth/me')return send({id:'raven-test',email:'test@example.test',displayName:'QA',role:'USER'});
  if(path==='/api/wallet/me')return send({balanceMinor:'10000000',currency:'RUB'});
  if(path==='/api/cases/seed/me')return send({serverSeedHash:'test-only',clientSeed:'test-only'});
  if(path==='/api/cases/open') {posts++; await new Promise(r=>setTimeout(r,1800));if(mode==='error')return send({message:'TEST: rejected'},400); const c=await page.request.get('http://127.0.0.1:5173/api/cases/raven').then(r=>r.json()); return send({item:c.items[2],openEventId:'TEST-ONLY',inventoryItemId:'TEST-ONLY',roll:.2,nonce:1,serverSeedHash:'TEST-ONLY',clientSeed:'TEST-ONLY'});}
  if(route.request().method()==='POST')return send({message:'Unapproved test mutation'},400);
  if(path==='/api/cases/raven')return route.continue();
  return send([]);
 });
 await page.goto('http://127.0.0.1:5173/cases/raven');
 await page.waitForSelector('.dza-open');
 if(mode!=='fallback')await page.waitForSelector('.raven-stage[data-phase=idle]',{timeout:60000});
 await page.locator('.dza-open').click();
 if(mode==='skipPending')await page.getByRole('button',{name:'Пропустить',exact:true}).click();
 if(mode==='error')await page.waitForSelector('.form-error');
 else await page.waitForSelector('.dz-record',{timeout:30000});
 results.push({mode,posts,errors,result:await page.locator('.dz-record__name').textContent().catch(()=>null),fallback:mode==='fallback'?await page.locator('.raven-stage').count()===0:undefined});
 await page.screenshot({path:`../../outputs/qa/test-${mode}.png`}); await context.close();
}
await fs.writeFile('../../outputs/qa/flows.json',JSON.stringify(results,null,2));await browser.close();
