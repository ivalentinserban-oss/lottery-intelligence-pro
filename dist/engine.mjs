export const RULES={pb:[{start:'2006-10-01',white:55,special:42},{start:'2009-01-07',white:59,special:39},{start:'2012-01-18',white:59,special:35},{start:'2015-10-07',white:69,special:26}],mm:[{start:'2006-10-01',white:56,special:46},{start:'2013-10-22',white:75,special:15},{start:'2017-10-31',white:70,special:25},{start:'2025-04-08',white:70,special:24}]};
export const current=game=>RULES[game].at(-1);
export function ruleAt(game,date) { const rule=RULES[game]?.findLast(r=>r.start<=date);if(!rule)throw new Error('No historical rules for this date');return rule; }
export function validate(draw) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(draw.date)||new Date(draw.date).toISOString().slice(0,10)!==draw.date) throw new Error('Invalid date');
  const rule=ruleAt(draw.game,draw.date);
  if(draw.white.length!==5||new Set(draw.white).size!==5||draw.white.some(n=>!Number.isInteger(n)||n<1||n>rule.white)||!Number.isInteger(draw.special)||draw.special<1||draw.special>rule.special)throw new Error('Drawing is outside its historical matrix');
  const day=new Date(draw.date+'T12:00:00Z').getUTCDay();
  if(!(draw.game==='mm'?[2,5]:draw.date>='2021-08-23'?[1,3,6]:[3,6]).includes(day)) throw new Error('Unexpected drawing weekday');
  return {...draw,white:[...draw.white].sort((a,b)=>a-b),version:rule.start};
}
export function parseCSV(raw,game,verifiedAt) {
  return raw.trim().split(/\r?\n/).filter(Boolean).map(line=>{
    const fields=line.split(','); const date=`${fields[3]}-${fields[1].padStart(2,'0')}-${fields[2].padStart(2,'0')}`;
    return {game,date,white:fields.slice(4,9).map(Number),special:+fields[9],multiplier:fields[10]?.trim()?+fields[10]:null,source:`https://www.texaslottery.com/export/sites/lottery/Games/${game==='pb'?'Powerball':'Mega_Millions'}/Winning_Numbers/${game==='pb'?'powerball':'megamillions'}.csv`,verifiedAt};
  }).filter(d=>d.date>='2006-10-01').map(validate);
}
export function deduplicate(draws) {
  const records=new Map();let conflicts=[];
  for(const draw of draws) { const key=draw.game+draw.date;const existing=records.get(key);if(existing&&(existing.white.join(',')!==draw.white.join(',')||existing.special!==draw.special))conflicts.push(key);else if(!existing)records.set(key,draw); }
  if(conflicts.length)throw new Error('Conflicting source records: '+conflicts.join(', '));
  return [...records.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function easternDate(now=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function coverage(draws,game,now=new Date()) {
  const dates=new Set(draws.map(d=>d.date));let missing=[];const today=easternDate(now);const time=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false,minute:'2-digit'}).format(now).split(':').map(Number);
  for(let d=new Date('2006-10-01T12:00:00Z');d.toISOString().slice(0,10)<=today;d.setUTCDate(d.getUTCDate()+1)) {
    const date=d.toISOString().slice(0,10),day=d.getUTCDay();const days=game==='mm'?[2,5]:date>='2021-08-23'?[1,3,6]:[3,6];
    if(days.includes(day)&&(date<today || time[0]*60+time[1]>=23*60+30)&&!dates.has(date))missing.push(date);
  }return {missing,first:draws[0]?.date,last:draws.at(-1)?.date,total:draws.length};
}
export function filterDraws(draws,{game,period='100',format='current',from='',to=''},now=new Date()) {
  let data=draws.filter(d=>d.game===game&&d.date<=easternDate(now));
  if(format==='current')data=data.filter(d=>d.version===current(game).start);
  else if(format!=='all')data=data.filter(d=>d.version===format);
  if(period==='custom')data=data.filter(d=>(!from||d.date>=from)&&(!to||d.date<=to));
  else if(period.endsWith('y')) {const start=new Date(now);start.setUTCFullYear(start.getUTCFullYear()-parseInt(period)); data=data.filter(d=>d.date>=start.toISOString().slice(0,10));}
  else if(period!=='all')data=data.slice(-Number(period));return data;
}
export function frequencies(draws,game,special=false) {
  const max=Math.max(current(game)[special?'special':'white'],...draws.map(d=>ruleAt(game,d.date)[special?'special':'white']));
  return Array.from({length:max},(_,i)=>{
    const number=i+1,eligible=draws.filter(d=>number<=ruleAt(game,d.date)[special?'special':'white']);
    const appears=d=>special?d.special===number:d.white.includes(number); const indices=eligible.map((d,i)=>appears(d)?i:-1).filter(i=>i>=0);
    let expected=0,variance=0;for(const d of eligible){const p=(special?1:5)/ruleAt(game,d.date)[special?'special':'white'];expected+=p;variance+=p*(1-p);}
    const recent=window=>{const data=draws.slice(-window).filter(d=>number<=ruleAt(game,d.date)[special?'special':'white']);return data.length?100*data.filter(appears).length/data.length:0;};
    const gaps=indices.slice(1).map((index,j)=>index-indices[j]-1);const count=indices.length;const gap=count?eligible.length-1-indices.at(-1):eligible.length;
    const completedGaps=indices.length?[indices[0],...gaps]:[];
    const recentData=draws.slice(-25).filter(d=>number<=ruleAt(game,d.date)[special?'special':'white']);const recentExpected=recentData.reduce((sum,d)=>sum+(special?1:5)/ruleAt(game,d.date)[special?'special':'white'],0);
    const recentRatio=recentExpected?recentData.filter(appears).length/recentExpected:0;
    return {number,count,eligible:eligible.length,frequency:eligible.length?100*count/eligible.length:0,expected,expectedPercent:eligible.length?100*expected/eligible.length:0,ratio:expected?count/expected:0,delta:count-expected,z:variance?(count-expected)/Math.sqrt(variance):0,gap,last:count?eligible[indices.at(-1)].date:null,longest:Math.max(0,...completedGaps,gap),average:gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null,recent25:recent(25),recent50:recent(50),recent100:recent(100),recent500:recent(500),trend:recentRatio-(expected?count/expected:0)};
  });
}
export function combinations(numbers,size) {let result=[];function visit(start,chosen){if(chosen.length===size){result.push(chosen);return;}for(let i=start;i<numbers.length;i++)visit(i+1,[...chosen,numbers[i]]);}visit(0,[]);return result;}
export function patterns(draws) {
  const pairs=new Map(),triplets=new Map(),odd=new Map(),sums=new Map(),spreads=new Map(),decades=new Map(),digits=new Map(),years=new Map(),months=new Map(),repeatedSets=new Map(),specialPairs=new Map();let consecutive=0,repeat=0;
  const inc=(m,key)=>m.set(key,(m.get(key)||0)+1);
  for(let i=0;i<draws.length;i++) { const d=draws[i];for(const pair of combinations(d.white,2))inc(pairs,pair.join(' · '));for(const triplet of combinations(d.white,3))inc(triplets,triplet.join(' · '));
    inc(odd,d.white.filter(n=>n%2).length);inc(sums,Math.floor(d.white.reduce((a,b)=>a+b,0)/20)*20);inc(spreads,Math.floor((d.white.at(-1)-d.white[0])/10)*10);inc(years,d.date.slice(0,4));inc(months,d.date.slice(0,7));inc(repeatedSets,d.white.join(' · '));
    for(const n of d.white){inc(decades,`${Math.floor((n-1)/10)*10+1}–${Math.floor((n-1)/10)*10+10}`);inc(digits,n%10);inc(specialPairs,`${n} + ${d.special}`);}
    if(d.white.some((n,j)=>j>0&&n===d.white[j-1]+1))consecutive++;
    if(i>0&&draws[i-1].version===d.version)repeat+=d.white.filter(n=>draws[i-1].white.includes(n)).length;
  }
  const list=m=>[...m].map(([label,count])=>({label:String(label),count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
  return {pairs:list(pairs),triplets:list(triplets),odd:list(odd),sums:list(sums).sort((a,b)=>+a.label-+b.label),spreads:list(spreads).sort((a,b)=>+a.label-+b.label),decades:list(decades),digits:list(digits),years:list(years).sort((a,b)=>a.label.localeCompare(b.label)),months:list(months).sort((a,b)=>a.label.localeCompare(b.label)),repeatedSets:list(repeatedSets).filter(x=>x.count>1),specialPairs:list(specialPairs),consecutive,repeat,averageSum:draws.length?draws.reduce((sum,d)=>sum+d.white.reduce((a,b)=>a+b,0),0)/draws.length:0};
}
export function secureInt(max) {
  if(!Number.isInteger(max)||max<1||max>4294967296)throw new Error('Invalid random bound');
  const limit=4294967296-(4294967296%max);const buffer=new Uint32Array(1);do{globalThis.crypto.getRandomValues(buffer);}while(buffer[0]>=limit);return buffer[0]%max;
}
const unit=()=>secureInt(16777216)/16777216;
function weighted(pool,weights) {const sum=pool.reduce((s,n)=>s+weights[n],0);if(!(sum>0)&&pool.length)throw new Error('No positive weights remain');let pick=unit()*sum;for(const n of pool){pick-=weights[n];if(pick<0)return n;}return pool.at(-1);}
export const STRATEGIES={random:'Pure Random',hot:'Hot Numbers',cold:'Cold Numbers',mix:'Hot & Cold Mix',recent:'Recent Trends',long:'Long-Term Frequency',balanced:'Balanced Combinations',pairing:'Number Pairing',custom:'Custom Weights',ensemble:'Ensemble'};
export function generate(draws,game,{strategy='random',count=5,locked=[],excluded=[],specialLocked=null,specialExcluded=[],weights={},specialWeights={},minSum=80,maxSum=250,minOdd=2,maxOdd=3,minLow=2,maxLow=3,minSpread=20,maxSpread=68,unique=true,ensemble={hot:1,cold:1,recent:1},trendWindow=25}={},rule=current(game)) {
  if(!STRATEGIES[strategy]||!Number.isInteger(count)||count<1||count>100)throw new Error('Choose 1–100 tickets and a valid strategy');
  if(locked.length>5||new Set(locked).size!==locked.length||locked.some(n=>!Number.isInteger(n)||n<1||n>rule.white||excluded.includes(n))||excluded.some(n=>!Number.isInteger(n)||n<1||n>rule.white))throw new Error('Invalid locked or excluded white balls');
  if(specialLocked!==null&&(!Number.isInteger(specialLocked)||specialLocked<1||specialLocked>rule.special||specialExcluded.includes(specialLocked)))throw new Error('Invalid locked special ball');
  if(specialExcluded.some(n=>!Number.isInteger(n)||n<1||n>rule.special))throw new Error('Invalid special-ball exclusions');
  const pool=Array.from({length:rule.white},(_,i)=>i+1).filter(n=>!excluded.includes(n));const specials=Array.from({length:rule.special},(_,i)=>i+1).filter(n=>!specialExcluded.includes(n));
  if(pool.length<5||!specials.length)throw new Error('Leave at least five white balls and one special ball available');
  if(Object.values({...weights,...specialWeights,...ensemble}).some(w=>!Number.isFinite(w)||w<0))throw new Error('Weights must be finite and nonnegative');
  if([minSum,maxSum,minOdd,maxOdd,minLow,maxLow,minSpread,maxSpread].some(n=>!Number.isFinite(n))||minSum>maxSum||minOdd>maxOdd||minLow>maxLow||minSpread>maxSpread)throw new Error('Invalid balance constraints');
  const stats=frequencies(draws,game),spStats=frequencies(draws,game,true),recentStats=frequencies(draws.slice(-trendWindow),game),recentSpecial=frequencies(draws.slice(-trendWindow),game,true);const maps=[stats,spStats,recentStats,recentSpecial].map(s=>Object.fromEntries(s.map(x=>[x.number,x])));
  const score=(kind,n,special=false)=>{const s=maps[special?1:0][n];const ratio=s?.ratio||0;return kind==='hot'||kind==='long'?ratio+.25:kind==='cold'?1/(ratio+.25):kind==='recent'?(maps[special?3:2][n]?.ratio||0)+.25:kind==='mix'? .5*(ratio+.25+1/(ratio+.25)):1;};
  const weightMap=special=>Object.fromEntries((special?specials:pool).map(n=>[n,strategy==='custom'?(special?specialWeights[n]:weights[n])??1:strategy==='ensemble'?Object.entries(ensemble).reduce((s,[kind,w])=>s+w*score(kind,n,special),0):score(strategy,n,special)]));
  const whiteWeights=weightMap(false),ballWeights=weightMap(true);const pairs=(strategy==='pairing'?patterns(draws).pairs:[]).slice(0,30).map(p=>({numbers:p.label.split(' · ').map(Number),count:p.count})).filter(p=>p.numbers.every(n=>pool.includes(n)));
  let tickets=[],seen=new Set(),attempts=0;
  while(tickets.length<count&&attempts++<30000){let white=[...locked];if(strategy==='pairing'&&pairs.length&&white.length<=3){const total=pairs.reduce((s,p)=>s+p.count,0);let pick=unit()*total;const pair=pairs.find(p=>(pick-=p.count)<0)||pairs.at(-1);white=[...new Set([...white,...pair.numbers])];}
    while(white.length<5){const available=pool.filter(n=>!white.includes(n));white.push(strategy==='random'||strategy==='balanced'?available[secureInt(available.length)]:weighted(available,whiteWeights));}
    white.sort((a,b)=>a-b);const odd=white.filter(n=>n%2).length,low=white.filter(n=>n<=Math.floor(rule.white/2)).length,sum=white.reduce((a,b)=>a+b,0),spread=white[4]-white[0];
    if(strategy==='balanced'&&(sum<minSum||sum>maxSum||odd<minOdd||odd>maxOdd||low<minLow||low>maxLow||spread<minSpread||spread>maxSpread))continue;
    const special=specialLocked??(strategy==='random'||strategy==='balanced'?specials[secureInt(specials.length)]:weighted(specials,ballWeights));const key=white.join('-')+'-'+special;
    if(unique&&seen.has(key))continue;const duplicate=seen.has(key);seen.add(key);tickets.push({game,white,special,strategy,odd,low,sum,spread,duplicate,frequencies:white.map(n=>maps[0][n]?.frequency||0),createdAt:new Date().toISOString()});
  }if(tickets.length<count)throw new Error('Cannot produce this batch with the selected constraints. Reduce the count or loosen constraints.');return tickets;
}
export function match(ticket,draw){return {white:ticket.white.filter(n=>draw.white.includes(n)).length,special:ticket.special===draw.special};}
export function csv(draws){return 'game,date,n1,n2,n3,n4,n5,special,multiplier,source\n'+draws.map(d=>[d.game,d.date,...d.white,d.special,d.multiplier??'',d.source].join(',')).join('\n');}
