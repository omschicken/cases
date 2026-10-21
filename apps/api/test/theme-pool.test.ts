import {describe,it,expect} from 'vitest';
import {buildThemePool} from '../src/prices/theme-pool';
describe('expanded theme pool',()=>{
 it('keeps every exact phase item, original probability mass and EV formula',()=>{
  const quotes=Array.from({length:35},(_,i)=>({name:`★ Knife ${i} | Doppler (Ruby) (Factory New)`,rubMinor:1000000+i*100000,imageUrl:'https://example.com/item.webp',rarity:'rarity_ancient_weapon'}));
  const p=buildThemePool('ruby-crystal',quotes,999900);
  expect(p.items).toHaveLength(35);expect(p.items.reduce((s,i)=>s+i.weight,0)).toBeCloseTo(100,10);
  expect(p.items.every(i=>i.weight>0&&i.rarity==='COVERT')).toBe(true);
  const ev=p.items.reduce((s,i)=>s+i.weight*i.valueMinor,0)/100;
  expect(Math.abs(p.priceMinor-Math.ceil(ev/.9))).toBeLessThanOrEqual(1);
  expect(p.canOpen&&p.canBattle).toBe(true);
  expect(buildThemePool('ruby-crystal',[...quotes,{...quotes[0],name:'MP9 | Ruby Poison Dart (Factory New)'}],999900).items).toHaveLength(35);
 });
 it('rejects missing prices rather than inventing themed filler',()=>{
  expect(()=>buildThemePool('sapphire-crystal',[],999900)).toThrow();
 });
});
