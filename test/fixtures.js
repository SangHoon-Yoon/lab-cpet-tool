// Simulated test files. They copy the real export layouts, but the physiology is made up, so they only prove the parsing and detection logic.
const X=require('xlsx'),fs=require('fs');
const P=require('../src/parse.js');
const dir='/home/claude/samples/';
const find=re=>dir+fs.readdirSync(dir).find(f=>re.test(f));
const ep=X.read(fs.readFileSync(find(/TREAD_CHAR/)));
const rows=X.utils.sheet_to_json(ep.Sheets.Data,{header:1,raw:true,defval:null});
const h=rows[0],c=n=>h.indexOf(n,9);
// 1. Cycling incremental: the treadmill gas data with speed mapped to Lode power (9 km/h -> 100 W, +25 W per km/h), plus a warm-up-free Lode file.
function lodeWB(t,p){const wb=X.utils.book_new();
 X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['Test','ID','First Name','Last Name','Gender','Weight'],[1,'x','EP','108','Male',72.54]]),'Participant');
 X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['Participant ID','Date','Duration'],['x',46170.5,t[t.length-1]]]),'Devices');
 X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['Time','Load','RPM'],...t.map((x,i)=>[x,p[i],85])]),'Bicycle-1-x');return wb;}
function cosmedWB(R){const wb=X.utils.book_new();X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet(R),'Data');return wb;}
const out='/home/claude/lab-cpet-tool/test/sim/';fs.mkdirSync(out,{recursive:true});
{ const R=rows.map((r,i)=>{ if(i<3)return r; const q=r.slice(); q[c('Speed')]=null;q[c('Grade')]=null;return q;});
  const stages=[];for(const r of rows.slice(3)){ if(r[c('t')]==null)continue; const s=(typeof r[c('t')]==='number'?r[c('t')]*86400:0); stages.push([s,r[c('Speed')]]);}
  const t=[],p=[];for(let x=0.2;x<=stages[stages.length-1][0];x+=0.2){const st=stages.find(q=>q[0]>=x)||stages[stages.length-1];t.push(+x.toFixed(2));p.push(100+25*(st[1]-9));}
  X.writeFile(cosmedWB(R),out+'sim_cycle_incremental_COSMED.xlsx');X.writeFile(lodeWB(t,p),out+'sim_cycle_incremental_Lode.xlsx');}
// 2. Running 5-step, ~1 h run, short rest, 5-step, built from the same gas rows, repeated with speed set by the design.
{ const base=rows.slice(3).filter(r=>r[c('t')]!=null), R=rows.slice(0,3).map(r=>r.slice());
  const design=[]; const add=(n,sp)=>{for(let i=0;i<n;i++)design.push(sp);};
  // 15-s rows: 5 stages of 4 min (8..12 km/h), 60 min at 10, 5 min rest, 5 stages again.
  [8,9,10,11,12].forEach(s=>add(16,s)); add(240,10); add(20,0); [8,9,10,11,12].forEach(s=>add(16,s));
  design.forEach((sp,i)=>{ const idx=Math.min(base.length-1,Math.round((sp?sp-8:0)*14)+20+(i%7)), q=base[idx].slice(); q[c('t')]=(i+1)*15/86400; q[c('Speed')]=sp; q[c('Grade')]=1; q[c('Marker')]=null; if(sp===0){['VO2','VCO2','VE'].forEach(k=>q[c(k)]=q[c(k)]*0.25);} R.push(q);});
  X.writeFile(cosmedWB(R),out+'sim_run_5ST_60min_5ST_COSMED.xlsx');}
console.log('ok',fs.readdirSync(out));
