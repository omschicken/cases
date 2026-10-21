import { describe, expect, it } from "vitest";
import { csMoneyName, parseCsMoneyPage } from "../src/prices/cs-money";

const listing=(full:string,phase:string|null,price:number)=>({appId:730,asset:{names:{full},phase,images:{steam:"https://steamcommunity.com/economy/image/test"},rarity:"Covert"},pricing:{computed:price}});
const page=(items:unknown[],fx=84.5)=>`<script id="__app-params" type="application/json">${JSON.stringify({currency:{currencies:{RUB:{rates:{sell:fx}}}}})}</script><script id="__page-params" type="application/json">${JSON.stringify({inventory:{items}})}</script>`;
describe("CS.MONEY public price snapshots",()=>{
  it("keeps phases separate and converts the USD asking price using the site's sell rate",()=>{
    const q=parseCsMoneyPage(page([listing("★ Bayonet | Doppler Ruby (Factory New)","ruby",1000),listing("★ Bayonet | Doppler Sapphire (Factory New)","sapphire",1500)]));
    expect(q.size).toBe(2);
    expect(q.get("★ Bayonet | Doppler (Ruby) (Factory New)")?.rubMinor).toBe(8450000);
    expect(q.get("★ Bayonet | Doppler (Sapphire) (Factory New)")?.usdMinor).toBe(150000);
  });
  it("takes the lowest actual listing for each exact phase and wear",()=>{
    const q=parseCsMoneyPage(page([listing("MP7 | Fade (Factory New)",null,50),listing("MP7 | Fade (Factory New)",null,40),listing("MP7 | Fade (Minimal Wear)",null,30)]));
    expect(q.get("MP7 | Fade (Factory New)")?.usdMinor).toBe(4000);
    expect(q.get("MP7 | Fade (Factory New)")?.volume).toBe(2);
    expect(q.size).toBe(2);
  });
  it("fails closed on a challenge page or invalid FX",()=>{
    expect(()=>parseCsMoneyPage("<html>Just a moment</html>")).toThrow();
    expect(()=>parseCsMoneyPage(page([],0))).toThrow();
    expect(()=>csMoneyName("★ Bayonet | Doppler (Factory New)")).toThrow();
    expect(csMoneyName("★ Bayonet | Doppler Phase 1 (Factory New)","doppler-phase-1")).toBe("★ Bayonet | Doppler (Phase 1) (Factory New)");
  });
});
