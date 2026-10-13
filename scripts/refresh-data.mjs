import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, 'dist/data');
await mkdir(target, {recursive:true});
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}
const sources = [];
for (const [game,file] of [['Powerball','powerball'],['Mega_Millions','megamillions']]) {
  const url = `https://www.texaslottery.com/export/sites/lottery/Games/${game}/Winning_Numbers/${file}.csv`;
  const raw = await download(url);
  if (!raw.startsWith(game === 'Powerball' ? 'Powerball,' : 'Mega Millions,')) throw new Error('Unexpected CSV content');
  await writeFile(join(target,`${file}.csv`),raw);
  sources.push({name:'Texas Lottery',game:game === 'Powerball'?'pb':'mm',url,sha256:createHash('sha256').update(raw).digest('hex'),retrievedAt:new Date().toISOString()});
}
let earlier=[];
for(let year=2006;year<=2010;year++) for(let month=1;month<=12;month++) {
  if(year===2006&&month<10 || year===2010&&month>2) continue;
  const url=`https://www.coloradolottery.com/en/games/powerball/drawings/${year}-${String(month).padStart(2,'0')}/`;
  const raw=await download(url);
  const blocks=raw.split('<!-- Start: Drawing -->').slice(1);
  if(!blocks.length) throw new Error(`No Colorado results in ${url}`);
  for(const block of blocks) {
    const date=block.match(/drawings\/(\d{4}-\d{2}-\d{2})\//)?.[1];
    const whites=[...(block.match(/<p class="draw">([\s\S]*?)<\/p>/)?.[1]||'').matchAll(/<span>(\d+)<\/span>/g)].map(m=>+m[1]);
    const special=block.match(/<p class="extra">\s*<span>(\d+)<\/span>/)?.[1];
    const multiplier=block.match(/<p class="multiplier">\s*<span>x(\d+)<\/span>/)?.[1];
    if(!date||whites.length!==5||!special) throw new Error(`Invalid Colorado drawing in ${url}`);
    if(date>='2006-10-01'&&date<'2010-02-03') earlier.push({date,white:whites.sort((a,b)=>a-b),special:+special,multiplier:multiplier?+multiplier:null,source:url,verifiedAt:new Date().toISOString()});
  }
  sources.push({name:'Colorado Lottery',game:'pb',url,sha256:createHash('sha256').update(raw).digest('hex'),retrievedAt:new Date().toISOString()});
  console.log(`Fetched ${year}-${month}`);
}
earlier.sort((a,b)=>a.date.localeCompare(b.date));
await writeFile(join(target,'early-powerball.json'),JSON.stringify(earlier));
await writeFile(join(target,'provenance.json'),JSON.stringify({updatedAt:new Date().toISOString(),sources},null,2));
console.log(`Saved ${earlier.length} early Powerball draws, plus official Texas CSVs.`);
