import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {current,ruleAt,validate,parseCSV,deduplicate,coverage,frequencies,patterns,generate,filterDraws,match,csv} from '../dist/engine.mjs';
const raw=await Promise.all(['powerball.csv','megamillions.csv','early-powerball.json','provenance.json'].map(p=>readFile(new URL('../dist/data/'+p,import.meta.url),'utf8')));
const provenance=JSON.parse(raw[3]);
const draws=deduplicate([...parseCSV(raw[0],'pb',provenance.updatedAt),...parseCSV(raw[1],'mm',provenance.updatedAt),...JSON.parse(raw[2]).map(d=>validate({...d,game:'pb'}))]);
test('official snapshot covers every scheduled drawing through its publication date',()=>{
 for(const game of ['pb','mm']){const data=draws.filter(d=>d.game===game);assert.ok(data.length>2000);assert.deepEqual(coverage(data,game,new Date(provenance.updatedAt)).missing,[]);assert.equal(new Set(data.map(d=>d.date)).size,data.length);}
});
test('historical rule transitions use first drawing dates and current Mega Ball pool is 24',()=>{
 assert.equal(ruleAt('pb','2009-01-03').white,55);assert.equal(ruleAt('pb','2009-01-07').special,39);assert.equal(ruleAt('pb','2012-01-18').special,35);assert.equal(ruleAt('pb','2015-10-07').white,69);
 assert.equal(ruleAt('mm','2013-10-18').white,56);assert.equal(ruleAt('mm','2013-10-22').white,75);assert.equal(ruleAt('mm','2017-10-31').special,25);assert.equal(current('mm').special,24);
});
test('validation rejects duplicates, wrong matrix, bad dates, and weekdays',()=>{
 const base={game:'pb',date:'2006-10-04',white:[1,2,3,4,5],special:42};assert.doesNotThrow(()=>validate(base));
 assert.throws(()=>validate({...base,white:[1,2,3,4,56]}));assert.throws(()=>validate({...base,white:[1,2,3,4,4]}));assert.throws(()=>validate({...base,date:'2006-10-05'}));assert.throws(()=>validate({...base,date:'2006-02-30'}));
});
test('deduplication never silently overrides a conflicting result',()=>{
 const d=draws[0];assert.equal(deduplicate([d,d]).length,1);assert.throws(()=>deduplicate([d,{...d,special:d.special===1?2:1}]));
});
test('frequency normalizes historical exposure and separates special from white balls',()=>{
 const sample=[{game:'pb',date:'2015-10-03',white:[1,2,3,4,5],special:1},{game:'pb',date:'2015-10-07',white:[1,2,3,4,69],special:1}].map(validate);
 const white=frequencies(sample,'pb'),special=frequencies(sample,'pb',true);assert.equal(white[68].eligible,1);assert.equal(white[68].count,1);assert.ok(Math.abs(white[0].expected-(5/59+5/69))<1e-12);assert.ok(Math.abs(special[0].expected-(1/35+1/26))<1e-12);
});
test('pairs, triplets and completed gaps count actual events',()=>{
 const s=[{game:'pb',date:'2026-10-05',white:[1,2,3,4,5],special:1},{game:'pb',date:'2026-10-07',white:[6,7,8,9,10],special:2},{game:'pb',date:'2026-10-10',white:[1,2,3,4,5],special:1}].map(validate);
 const p=patterns(s);assert.equal(p.pairs.find(p=>p.label==='1 · 2').count,2);assert.equal(p.triplets.find(p=>p.label==='1 · 2 · 3').count,2);assert.equal(p.repeatedSets[0].count,2);const n=frequencies(s,'pb')[0];assert.equal(n.average,1);assert.equal(n.longest,1);assert.equal(n.gap,0);
});
test('all ten strategies generate valid sorted duplicate-free current tickets',()=>{
 const data=draws.filter(d=>d.game==='mm').slice(-100);
 for(const strategy of ['random','hot','cold','mix','recent','long','balanced','pairing','custom','ensemble']){
  const tickets=generate(data,'mm',{strategy,count:100});assert.equal(tickets.length,100);assert.equal(new Set(tickets.map(t=>t.white.join(',')+'+'+t.special)).size,100);
  for(const t of tickets){assert.equal(new Set(t.white).size,5);assert.deepEqual(t.white,[...t.white].sort((a,b)=>a-b));assert.ok(t.white.every(n=>n>=1&&n<=70));assert.ok(t.special>=1&&t.special<=24);if(strategy==='balanced'){assert.ok(t.odd>=2&&t.odd<=3);assert.ok(t.low>=2&&t.low<=3);assert.ok(t.sum>=80&&t.sum<=250);}}
 }
});
test('locked numbers, exclusions and impossible constraints are honored',()=>{
 const t=generate([],'pb',{count:5,locked:[7,21],excluded:[1,2],specialLocked:9})[0];assert.ok(t.white.includes(7)&&t.white.includes(21));assert.ok(!t.white.includes(1)&&!t.white.includes(2));assert.equal(t.special,9);
 assert.throws(()=>generate([],'pb',{locked:[7],excluded:[7]}));assert.throws(()=>generate([],'mm',{specialLocked:25}));assert.throws(()=>generate([],'pb',{strategy:'custom',weights:Object.fromEntries(Array.from({length:69},(_,i)=>[i+1,0]))}));assert.throws(()=>generate([],'pb',{strategy:'balanced',minSum:9999}));
});
test('random special balls pass a broad statistical sanity check',()=>{
 const counts=Array(26).fill(0);for(let i=0;i<30;i++)for(const t of generate([],'pb',{count:100}))counts[t.special-1]++;
 const expected=3000/26;const chi=counts.reduce((s,c)=>s+(c-expected)**2/expected,0);assert.ok(chi<100,'Gross nonuniformity detected; this is a smoke test, not proof of uniformity');
});
test('filters, match checking, and CSV export use actual selected data',()=>{
 const result=filterDraws(draws,{game:'mm',period:'25',format:'current'});assert.equal(result.length,25);assert.ok(result.every(d=>d.version==='2025-04-08'));assert.equal(filterDraws(draws,{game:'pb',period:'custom',format:'all',from:'2006-10-01',to:'2006-10-31'}).length,8);assert.deepEqual(match(result[0],result[0]),{white:5,special:true});assert.equal(csv(result).split('\n').length,26);
});
