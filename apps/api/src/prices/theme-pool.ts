import { matchesCaseTheme } from './case-theme';
import { marketCasePrice } from './case-pricing';
import { assessCaseEconomics } from '../common/util/case-economics';

export interface ThemeQuote { name: string; rubMinor: number; imageUrl: string; rarity: string | null }
const RARITY: Record<string,string> = {rarity_common_weapon:'CONSUMER',rarity_uncommon_weapon:'INDUSTRIAL',rarity_rare_weapon:'MIL_SPEC',rarity_mythical_weapon:'RESTRICTED',rarity_legendary_weapon:'CLASSIFIED',rarity_ancient_weapon:'COVERT',rarity_ancient:'GOLD'};
// Preserve the original sixteen ranked probability slots (60/25/10/4/1).
// Integrate that same probability curve across the expanded number of items.
const SLOTS = [15,15,15,15,6.25,6.25,6.25,6.25,10/3,10/3,10/3,4/3,4/3,4/3,.5,.5];
export function buildThemePool(slug: string, quotes: readonly ThemeQuote[], minimumMinor: number) {
  if (!['fade','doppler','ruby-crystal','sapphire-crystal'].includes(slug)) throw Error('Unsupported theme');
  const unique = new Map<string,ThemeQuote>();
  for (const q of quotes) {
    if (!matchesCaseTheme(slug,q.name)) continue;
    if (!Number.isSafeInteger(q.rubMinor)||q.rubMinor<=0||!q.imageUrl.startsWith('https://')||!q.rarity||!RARITY[q.rarity]) throw Error('Invalid quoted theme item');
    if (!unique.has(q.name)||unique.get(q.name)!.rubMinor>q.rubMinor) unique.set(q.name,q);
  }
  const ranked=[...unique.values()].sort((a,b)=>a.rubMinor-b.rubMinor||a.name.localeCompare(b.name));
  if(ranked.length<16) throw Error('Insufficient theme pool');
  const items=ranked.map((q,i)=>{
    const lo=i*16/ranked.length,hi=(i+1)*16/ranked.length;
    const weight=SLOTS.reduce((sum,w,j)=>sum+w*Math.max(0,Math.min(hi,j+1)-Math.max(lo,j)),0);
    return {name:q.name,imageUrl:q.imageUrl,rarity:RARITY[q.rarity!],valueMinor:q.rubMinor,weight};
  });
  const priceMinor=marketCasePrice(items,minimumMinor);
  const economics=assessCaseEconomics(items.map(i=>({...i,valueMinor:BigInt(i.valueMinor)})),BigInt(priceMinor));
  if(!economics.canOpen||!economics.canBattle) throw Error('Theme economics rejected');
  return {slug,items,priceMinor,...economics};
}
