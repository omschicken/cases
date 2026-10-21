/** Public server-rendered CS.MONEY listings; no session cookies or protected API. */
export interface CsMoneyQuote { rubMinor: number; usdMinor: number; volume: number; imageUrl: string; rarity: string | null }
const PHASES: Record<string,string> = {phase1:"Phase 1",phase2:"Phase 2",phase3:"Phase 3",phase4:"Phase 4",ruby:"Ruby",sapphire:"Sapphire",blackpearl:"Black Pearl"};
const RARITIES: Record<string,string> = {"Consumer Grade":"rarity_common_weapon","Industrial Grade":"rarity_uncommon_weapon","Mil-Spec Grade":"rarity_rare_weapon",Restricted:"rarity_mythical_weapon",Classified:"rarity_legendary_weapon",Covert:"rarity_ancient_weapon","Extraordinary":"rarity_ancient"};

export function csMoneyName(name: string, phase?: string | null): string {
  if (!/ \| Doppler(?: | \()/.test(name) || name.includes("Gamma Doppler")) return name;
  const label=phase ? PHASES[phase.toLowerCase().replace(/^doppler-/i, "").replace(/[ _-]/g,"")] : undefined;
  if (!label) throw new Error("CS.MONEY Doppler listing has no supported phase");
  return name.replace(/ \| Doppler(?: Phase [1-4]| Ruby| Sapphire| Black Pearl| \((?:Phase [1-4]|Ruby|Sapphire|Black Pearl)\))? (?=\((?:Factory New|Minimal Wear)\)$)/,` | Doppler (${label}) `);
}

export function parseCsMoneyPage(html: string): Map<string,CsMoneyQuote> {
  const read=(id:string)=>{const match=html.match(new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`));if(!match)throw new Error(`CS.MONEY missing ${id}`);return JSON.parse(match[1]);};
  const app=read("__app-params"),page=read("__page-params");
  // The public UI converts its USD asking price using the RUB sell rate.
  const fx=Number(app.currency?.currencies?.RUB?.rates?.sell);
  if(!Number.isFinite(fx)||fx<=0||!Array.isArray(page.inventory?.items))throw new Error("CS.MONEY snapshot schema or FX invalid");
  const out=new Map<string,CsMoneyQuote>();
  for(const row of page.inventory.items){
    const a=row.asset,usd=Number(row.pricing?.computed);
    if(row.appId!==730||typeof a?.names?.full!=="string"||!Number.isFinite(usd)||usd<=0||typeof a.images?.steam!=="string"||!a.images.steam.startsWith("https://"))continue;
    let name:string;try{name=csMoneyName(a.names.full,a.phase);}catch{continue;}
    const usdMinor=Math.round(usd*100),rubMinor=Math.round(usd*fx*100);
    if(!Number.isSafeInteger(rubMinor)||!Number.isSafeInteger(usdMinor)||rubMinor<1||usdMinor<1)continue;
    const old=out.get(name);
    const quote={usdMinor,rubMinor,volume:(old?.volume??0)+1,imageUrl:a.images.steam,rarity:RARITIES[a.rarity]??null};
    out.set(name,old&&old.usdMinor<usdMinor?{...old,volume:quote.volume}:quote);
  }
  return out;
}

export async function fetchCsMoneyPrices(names: readonly string[]): Promise<Map<string,CsMoneyQuote>> {
  const out=new Map<string,CsMoneyQuote>();
  // Small bounded batches keep each invocation within the serverless limit.
  for(let offset=0;offset<names.length;offset+=1){
    if(offset) await new Promise(resolve=>setTimeout(resolve,1500));
    const pages=await Promise.all(names.slice(offset,offset+1).map(async name=>{
      const search=name.replace(/ \| Doppler \((Phase [1-4]|Ruby|Sapphire|Black Pearl)\) /," | Doppler $1 ");
      const url=new URL("https://cs.money/market/buy/");url.searchParams.set("search",search);url.searchParams.set("sort","price");url.searchParams.set("order","asc");
      const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(`CS.MONEY price page HTTP ${response.status}; retry-after=${response.headers.get("retry-after")??"not provided"}`);
      const quotes=parseCsMoneyPage(await response.text());
      // Only exact names requested by this batch may replace an existing value.
      return {name,quote:quotes.get(name)};
    }));
    for(const {name,quote} of pages)if(quote)out.set(name,quote);
  }
  return out;
}
