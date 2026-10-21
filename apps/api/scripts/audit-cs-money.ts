import fs from "node:fs/promises";
import { parseCsMoneyPage } from "../src/prices/cs-money";

async function main(){
 const root="work/theme-audit/";
 const skins=JSON.parse(await fs.readFile(root+"skins.json","utf8"));
 const pairs=new Map<string,{weapon:string;phase:string}>();
 for(const s of skins)if(s.pattern?.name==="Doppler"&&s.phase&&s.weapon?.name)pairs.set(`${s.weapon.name}|${s.phase}`,{weapon:s.weapon.name,phase:s.phase});
 const requests=[...pairs.values()].map(p=>({search:`★ ${p.weapon} | Doppler ${p.phase}`,phase:p.phase}));
 for(const weapon of new Set(skins.filter(s=>s.pattern?.name==="Fade").map(s=>s.weapon.name))) requests.push({search:`${weapon} | Fade`,phase:"Fade"});
 const previous=await fs.readFile(root+"cs-money-quotes.json","utf8").then(JSON.parse).catch(()=>({quotes:[]}));
 const quotes=new Map<string,unknown>(previous.quotes.map(q=>[q.name,q]));const missing:string[]=[];
 const done=new Set(previous.quotes.map(q=>new URL(q.source).searchParams.get("search")));
 const pending=requests.filter(q=>!done.has(q.search));
 requests.splice(0,requests.length,...pending);
 for(let offset=0;offset<requests.length;offset+=1){
  await Promise.all(requests.slice(offset,offset+1).map(async spec=>{
   const url=new URL("https://cs.money/market/buy/");url.searchParams.set("search",spec.search);url.searchParams.set("sort","price");url.searchParams.set("order","asc");
   const res=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!res.ok)throw new Error(`${spec.search}: HTTP ${res.status}`);
   const html=await res.text();const page=parseCsMoneyPage(html);
   let matched=0;for(const [name,q]of page){
    if(spec.phase==="Fade"?!/ \| Fade \(/.test(name):!name.startsWith(spec.search.replace(/ Doppler (.+)$/," Doppler ($1)")))continue;
    const old=quotes.get(name) as {rubMinor:number}|undefined;
    if(!old||q.rubMinor<old.rubMinor)quotes.set(name,{...q,name,phase:spec.phase,source:url.href,observedAt:new Date().toISOString()});matched++;
   }
   if(!matched)missing.push(spec.search);
  }));
  await fs.writeFile(root+"cs-money-quotes.json",JSON.stringify({quotes:[...quotes.values()],missing},null,2));
  await new Promise(resolve=>setTimeout(resolve,1800));
  console.log(`CS.MONEY ${Math.min(offset+1,requests.length)}/${requests.length}: ${quotes.size} exact quotes`);
 }
 await fs.writeFile(root+"cs-money-quotes.json",JSON.stringify({quotes:[...quotes.values()],missing},null,2));
 console.log(JSON.stringify({count:quotes.size,missing}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
