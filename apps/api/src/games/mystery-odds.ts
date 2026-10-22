/** Fixed, publicly disclosed Mystery Upgrade payout bands. */
export const MYSTERY_REWARDS = [
 { min:30, max:60, weight:20 },
 { min:60, max:90, weight:15 },
 { min:90, max:110, weight:50 },
 { min:110, max:150, weight:10 },
 { min:150, max:200, weight:5 },
] as const;
export function mysteryBandIndex(roll:number):number {
 if (!Number.isFinite(roll) || roll<0 || roll>=1) throw new RangeError("Invalid roll");
 let total=0;
 for (let i=0;i<MYSTERY_REWARDS.length;i++){total+=MYSTERY_REWARDS[i].weight/100;if(roll<total)return i}
 return MYSTERY_REWARDS.length-1;
}
export function mysteryBounds(source:bigint, min:number, max:number) {
 if (source<=0n || min<30 || max>200 || min>=max) throw new RangeError("Invalid band");
 return {from:(source*BigInt(min)+99n)/100n,to:source*BigInt(max)/100n};
}
export function mysteryIndex(roll:number,count:number):number {
 if(!Number.isFinite(roll)||roll<0||roll>=1||!Number.isSafeInteger(count)||count<1)throw new RangeError("Invalid pick");
 return Math.floor(roll*count);
}
