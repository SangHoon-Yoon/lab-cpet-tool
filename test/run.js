const P=require('../src/parse.js'),C=require('../src/gdcore.js'),L=require('../src/protocol.js'),fs=require('fs');
const dir='/home/claude/samples/';const f=re=>dir+fs.readdirSync(dir).find(x=>re.test(x));
const rd=p=>P.readWorkbook(fs.readFileSync(p));
const sim='/home/claude/lab-cpet-tool/test/sim/';
let fails=0;const ok=(c,m)=>{console.log((c?'  pass ':'  FAIL ')+m);if(!c)fails++;};
const prep=(g,I)=>{const keep=g.t.map((_,i)=>Number.isFinite(g.v.vo2[i])&&g.v.vo2[i]>0);const S=C.series(g,keep,'bin',g.kind==='avg'?g.avgWidth:15);return S;};
console.log('TREAD_CHAR treadmill');
{const g=P.parseCosmed(rd(f(/TREAD_CHAR/)));const av=L.availableIntensity(g,null);ok(av[0]==='speed','speed found');
 const I=L.buildIntensity(g,null,'speed');const pr=L.detect(I);ok(pr.type==='incremental','incremental');ok(pr.inc.stages.length===12,'12 stages, got '+pr.inc.stages.length);
 console.log(pr.inc.stages.map(s=>[s.p,s.dur].join('@')).join(' '));
 ok(pr.inc.stages[0].t0===0&&pr.inc.stages[1].t0===180,'stage 2 starts at 180 s');ok(pr.inc.stages[7].p===16&&pr.inc.stages[7].t0===1260,'16 km/h at 21:00');
 const S=prep(g);const t0=pr.inc.t0+90,t1=pr.inc.t1;const s=L.suggestIncremental(S,t0,t1);
 console.log(' VT1',s.vt1,s.vt1Methods.map(m=>m.key+':'+(m.ok?m.vo2.toFixed(2):'-')).join(' '));console.log(' VT2',s.vt2,s.vt2Methods.map(m=>m.key+':'+(m.ok?m.vo2.toFixed(2):'-')).join(' '));
 ['vt1','vt2'].forEach(q=>console.log(' ',q,'t',s.map.tOf(s[q]).toFixed(0)));
 const pk=L.rollingPeak(S,'vo2',30,t0,t1);console.log(' peak30',pk);
 const raw=[];g.t.forEach((t,i)=>raw.push(g.v.vo2[i]));let b=0;for(let i=1;i<raw.length;i++)b=Math.max(b,(raw[i]+raw[i-1])/2);ok(Math.abs(b-pk.value)<1e-6,'VO2peak equals highest 2-sample mean '+b.toFixed(3));
 const vals=pr.inc.stages.map(st=>L.stageValues(S,st,60,g.meta.mass,'treadmill'));
 console.log(vals.map(v=>[v.p,v.m.vo2.toFixed(2),v.m.hr.toFixed(0),v.economy.toFixed(0)].join('/')).join(' '));
 // hand check: 9 km/h, last 60 s = rows 2:15..3:00
 const hand=(2030+2258+2276+2118)/4/1000; ok(Math.abs(vals[0].m.vo2-hand)<0.002,'stage 1 last-minute VO2 matches the file: '+vals[0].m.vo2.toFixed(3)+' vs '+hand.toFixed(3));
 const fit=L.intensityFit(vals);console.log(' fit',fit.m.toFixed(2),fit.b.toFixed(2),fit.r2.toFixed(3),fit.nStages);ok(fit.nStages===7,'regression uses the 7 three-minute stages');
 const rpe=L.stageRPE(g,pr.inc.stages);console.log(' rpe',rpe);ok(rpe[0]===8&&rpe[6]===15,'RPE per stage');
}
console.log('Pilot cycling');
{const g=P.parseCosmed(rd(f(/CPET_BxB/))),lo=P.parseLode(rd(f(/Admin/)));const I=L.buildIntensity(g,lo,'lode',0);const pr=L.detect(I);
 ok(pr.type==='prolonged','prolonged');ok(pr.tests.length===3&&pr.tests.every(t=>t.complete),'three complete 5STs');ok(pr.base===133,'base 133 W');ok(pr.maot&&Math.round(pr.maot.t0)===10421,'all-out found');ok(Math.round(pr.ttf)===10117,'task failure');
 console.log(pr.phases.map(p=>p.label+'['+Math.round(p.t0)+'-'+Math.round(p.t1)+']').join(' '));
 const A=L.alignment(g,I);console.log(' align',A);ok(!A.shift,'no shift suggested');
 // same as old app core
 const old=C.detectProtocol(lo);ok(old.tests.length===pr.tests.length&&old.tests.every((t,i)=>Math.abs(t.t0-pr.tests[i].t0)<.01),'matches the study app detection');
}
console.log('Simulated cycling incremental');
{const g=P.parseCosmed(rd(sim+'sim_cycle_incremental_COSMED.xlsx')),lo=P.parseLode(rd(sim+'sim_cycle_incremental_Lode.xlsx'));const a=L.availableIntensity(g,lo);ok(a[0]==='lode'&&a.length===1,'Lode is the source: '+a);
 const pr=L.detect(L.buildIntensity(g,lo,'lode',0));ok(pr.type==='incremental','incremental');ok(pr.inc.stages.length===12,'12 stages '+pr.inc.stages.length);ok(!pr.maot,'no all-out test invented');console.log(pr.inc.stages.map(s=>s.p+'@'+Math.round(s.dur)).join(' '));}
console.log('Simulated running 5ST / 60 min / 5ST');
{const g=P.parseCosmed(rd(sim+'sim_run_5ST_60min_5ST_COSMED.xlsx'));const pr=L.detect(L.buildIntensity(g,null,'speed'));ok(pr.type==='prolonged','prolonged');ok(pr.tests.length===2&&pr.tests.every(t=>t.complete),'two complete 5STs, got '+pr.tests.length);ok(pr.base===10,'steady 10 km/h');ok(pr.pattern.stepDur===240,'4-min steps');console.log(pr.phases.map(p=>p.label+'['+Math.round(p.t0/60)+'-'+Math.round(p.t1/60)+']').join(' '));
 const S=prep(g);const A=C.assignSteps(S,{t:L.buildIntensity(g,null,'speed').t,p:L.buildIntensity(g,null,'speed').p},pr);const SM=C.stepMeans(S,A,pr,60);ok(SM[0][0].n===4,'4 rows per last minute');}
console.log('Manual protocol');
{const g=P.parseCosmed(rd(f(/TREAD_CHAR/)));const blocks=[{start:0,n:6,dur:3,first:9,inc:1}];blocks.unit='km/h';const pr=L.detect(L.buildIntensity(g,null,null,0,blocks));ok(pr.inc&&pr.inc.stages.length===6,'manual stages');}

console.log('Other protocol shapes');
{ const mk=(segs,unit='W')=>{const t=[],p=[];let x=0;segs.forEach(([d,v])=>{const end=x+d;while(x<end){t.push(+x.toFixed(2));p.push(v);x+=1;}});return {t,p,unit,label:unit==='W'?'Power':'Speed',mode:unit==='W'?'cycling':'treadmill',source:'lode',tolerance:unit==='W'?1:.11,gapTol:3};};
  // Warm-up then steps, followed by low-load recovery
  let pr=L.detect(mk([[300,50],...[...Array(8).keys()].map(i=>[120,100+25*i]),[180,50]]));ok(pr.type==='incremental','warm-up + 8 steps is incremental');ok(pr.inc.stages[0].warm&&pr.inc.stages[0].p===50,'first stage marked warm-up');ok(pr.inc.t0===300,'test starts after warm-up');ok(!pr.maot,'no all-out test');
  // Ramp: 5 W every 15 s
  pr=L.detect(mk([[180,50],...[...Array(50).keys()].map(i=>[15,100+5*i]),[120,50]]));ok(pr.type==='incremental'&&pr.inc.ramp,'ramp recognised');ok(pr.inc.t1-pr.inc.t0>=700,'ramp length '+(pr.inc.t1-pr.inc.t0));
  // Prolonged with a final test cut short at stage 3
  const five=[100,120,140,160,180].map(v=>[240,v]);pr=L.detect(mk([...five,[2400,130],...five,[2400,130],[240,100],[240,120],[100,140],[60,0]]));ok(pr.type==='prolonged','prolonged');ok(pr.tests.length===3,'three tests '+pr.tests.length);ok(pr.tests[0].complete&&!pr.tests[2].complete&&pr.tests[2].steps.length===3,'third test partial with 3 stages');ok(pr.tests[2].steps[2].full===false,'short last stage not full');
  // Three-minute steps on a treadmill, 0.5 km/h increments, 6 steps, with rest between
  const six=[8,8.5,9,9.5,10,10.5].map(v=>[180,v]);pr=L.detect(mk([...six,[3600,9],[300,0],...six],'km/h'));ok(pr.tests.length===2&&pr.pattern.powers.length===6&&pr.pattern.stepDur===180,'6 steps of 3 min at 0.5 km/h');
  // A final stage under half the previous length counts as cut short; a longer one stays
  pr=L.detect(mk([...[...Array(7).keys()].map(i=>[180,100+25*i]),[60,275],[60,0]]));ok(pr.inc.stages.at(-1).full===false,'60 s after 180 s is cut short');
  pr=L.detect(mk([...[...Array(7).keys()].map(i=>[180,100+25*i]),[100,275],[60,0]]));ok(pr.inc.stages.at(-1).full===true,'100 s after 180 s is kept');
}
console.log('Files that do not belong together');
{const g=P.parseCosmed(rd(f(/TREAD_CHAR/))),lo=P.parseLode(rd(f(/Admin/)));const I=L.buildIntensity(g,lo,'lode',0);const ss={gas:g,lode:lo,I,proto:L.detect(I),meta:{mass:g.meta.mass},align:L.alignment(g,I)};const c=L.dataChecks(ss).filter(x=>x.level==='warn').map(x=>x.text);console.log(c.map(t=>'   '+t.slice(0,90)).join('\n'));ok(c.some(t=>/different dates/.test(t)),'date mismatch');ok(c.some(t=>/names differ/.test(t)),'name mismatch');ok(c.some(t=>/lengths differ/.test(t)),'length mismatch');}
console.log('Offset');
{const g=P.parseCosmed(rd(f(/CPET_BxB/))),lo=P.parseLode(rd(f(/Admin/)));const shifted={...lo,t:lo.t.map(x=>x+120)};const I=L.buildIntensity(g,shifted,'lode',0);const A=L.alignment(g,I);console.log(' ',A);ok(A.shift&&Math.abs(A.best.off+120)<=40,'a 120-s misalignment is noticed');const I2=L.buildIntensity(g,lo,'lode',60);ok(Math.abs(I2.t[0]-lo.t[0]-60)<1e-9,'offset applied');}
console.log('Cycling file with no power (real file), steps entered by hand');
{const g=P.parseCosmed(rd(f(/GXT/)));ok(L.availableIntensity(g,null).length===0,'leftover 5.3 mph speed is ignored');ok(L.exerciseEnd(g)===1500,'exercise ends at 25:00 where recovery begins');ok(g.meta.id==='P01','participant ID read');ok(Math.abs(g.meta.saved.vt1-2.321)<1e-9&&Math.abs(g.meta.saved.vt2-2.933)<1e-9,'thresholds saved in the file read');
 const pl={unit:'W',warmMin:5,warmP:50,startP:75,inc:25,stageMin:3,switchMin:20,shortMin:1,shortInc:NaN,endMin:25};const I=L.buildIntensity(g,null,null,0,null,pl),pr=L.detect(I,{type:'incremental'});const st=pr.inc.stages;console.log('  ',st.map(s=>s.p+'@'+s.dur+(s.warm?'w':'')).join(' '));
 ok(st.length===11,'warm-up + 5 three-min + 5 one-min stages: '+st.length);ok(st[0].warm&&pr.inc.t0===300,'warm-up excluded');ok(st[1].p===75&&st[5].p===175&&st[6].p===200&&st.at(-1).p===300,'powers 75..175, then 200..300');ok(st[5].dur===180&&st[6].dur===60,'stage lengths');ok(!pr.maot,'no all-out test invented');
 const S=C.series(g,g.t.map((_,i)=>g.v.vo2[i]>0),'raw',0);const v=st.map(q=>L.stageValues(S,q,60,g.meta.mass,'cycling'));const fit=L.intensityFit(v);ok(fit.nStages===5,'regression on the 5 three-min stages');
 const hand=[1743,1835,1961,1675].length;const pl2={...pl,shortInc:10};const st2=L.detect(L.buildIntensity(g,null,null,0,null,pl2),{type:'incremental'}).inc.stages;ok(st2[6].p===185&&st2[7].p===195,'separate increment for short stages: '+st2.slice(5,8).map(q=>q.p));
 const pl3={...pl,switchMin:NaN};const st3=L.detect(L.buildIntensity(g,null,null,0,null,pl3),{type:'incremental'}).inc.stages;ok(st3.at(-1).t1===1500&&st3.length===8,'no switch: 3-min stages to the end, '+st3.map(q=>q.dur).join(','));
 const pl4={...pl,warmMin:0,warmP:NaN};const st4=L.detect(L.buildIntensity(g,null,null,0,null,pl4),{type:'incremental'}).inc.stages;ok(st4[0].p===75&&st4[0].t0===0,'no warm-up');
 const pl5={...pl,warmP:NaN};const pr5=L.detect(L.buildIntensity(g,null,null,0,null,pl5),{type:'incremental'});ok(pr5.inc.stages[0].p===75&&pr5.inc.t0===300,'warm-up with no power entered');
 const iOld=L.availableIntensity(P.parseCosmed(rd(f(/TREAD_CHAR/))),null);ok(iOld[0]==='speed','a real changing speed still counts');}
console.log('Real running session in three files');
{const fs3=fs.readdirSync(dir).filter(x=>/MORNING/.test(x));const g3=[fs3[1],fs3[2],fs3[0]].map(n=>({gas:P.parseCosmed(rd(dir+n)),name:n}));
 const J=L.joinCosmed(g3,P.cosmedStartEpoch);ok(!J.problem,'joined');const g=J.gas;console.log('  ',JSON.stringify(g.files.map(f=>[f.protocol,f.start,f.end])));ok(g.files[1].start===1464&&g.files[2].start===6452,'clock offsets 7:50:23 to 8:14:47 and 9:37:55');ok(g.files[0].protocol==='EP 5-step test'&&g.files[1].protocol==='EP 60-min','clock order, whatever the upload order');
 const I=L.buildIntensity(g,null,L.availableIntensity(g,null)[0]),pr=L.detect(I);console.log('  ',pr.phases.map(p=>p.label+'['+Math.round(p.t0)+'-'+Math.round(p.t1)+']').join(' '));ok(pr.type==='prolonged','prolonged');ok(pr.tests.length===2&&pr.tests.every(t=>t.complete),'two complete 5STs');ok(pr.tests[1].t0>=6452&&pr.tests[1].t0<6460,'second test on the shared clock');ok(pr.base===11.7,'steady 11.7 km/h');ok(pr.pattern.powers.join()==='11,12,13,14,15','11 to 15 km/h');
 const keep=g.t.map((_,i)=>g.v.vo2[i]>0),S0=C.series(g,keep,'raw',0);
 const v0=pr.tests.map(T=>T.steps.map(st=>L.stageValues(S0,st,60,72.54,'treadmill')));console.log('   VO2',v0.map(v=>v.map(q=>q.m.vo2.toFixed(2)).join(' ')).join(' | '),'HR',v0.map(v=>v.map(q=>q.m.hr.toFixed(0)).join(' ')).join(' | '));
 const single=g3[0].gas,S1=C.series(single,single.t.map((_,i)=>single.v.vo2[i]>0),'raw',0);const pr1=L.detect(L.buildIntensity(single,null,'speed'));const v1=pr1.tests[0].steps.map(st=>L.stageValues(S1,st,60,72.54,'treadmill'));ok(v1.every((q,i)=>Math.abs(q.m.vo2-v0[0][i].m.vo2)<1e-9),'first test is the same alone or joined');
 const r=L.stageRPE(g,pr.tests[1].steps);ok([10,10,11,13,14].every((x,i)=>r[i]===x),'RPE of second test from markers');
 const other=P.parseCosmed(rd(f(/TREAD_CHAR/)));ok(/different days/.test(L.joinCosmed([g3[0],{gas:other,name:'x'}],P.cosmedStartEpoch).problem||''),'different days are refused');
 const gx=P.parseCosmed(rd(f(/GXT/)));ok(/different people/.test(L.joinCosmed([g3[0],{gas:gx,name:'x'}],P.cosmedStartEpoch).problem||''),'different people are refused');
 ok(L.joinCosmed([g3[0],{gas:g3[0].gas,name:'copy'}],P.cosmedStartEpoch).gas===g3[0].gas,'same recording twice counts once');
 const c=L.dataChecks({gas:g,I,proto:pr,meta:{mass:72.54},set:{},hr:null});console.log(c.map(x=>'   '+x.level+': '+x.text).join('\n'));ok(!c.some(x=>/grade changes/.test(x.text)),'recovery grade does not trigger a warning');}
console.log('Real running test with threshold and VO2max phases');
{const g=P.parseCosmed(rd(f(/TWO_PHASE/)));const I=L.buildIntensity(g,null,'speed'),pr=L.detect(I);ok(pr.type==='incremental'&&pr.max,'two phases found');ok(pr.inc.stages[0].warm&&pr.inc.stages.filter(q=>!q.warm).map(q=>q.p).join()==='8,9,10,11','threshold stages 8 to 11 km/h after the walk');ok(pr.max.stages.map(q=>q.p).join()==='8,9,10,11,12,13,14,15,16','VO2max stages 8 to 16 km/h');ok(pr.max.stages.at(-1).full===false,'16 km/h not completed');
 const pr2=L.detect(I,{type:'incremental'});ok(!pr2.max,'can be treated as one test');const pr3=L.detect(I,{type:'prolonged'});ok(pr3.type==='prolonged'&&!pr3.max,'can be treated as a trial');}
{const mk=(segs,unit='km/h')=>{const t=[],p=[];let x=0;segs.forEach(([d,v])=>{const end=x+d;while(x<end){t.push(+x.toFixed(2));p.push(v);x+=1;}});return {t,p,unit,label:'Speed',mode:'treadmill',source:'cosmed',tolerance:.11,gapTol:10};};
 const five=[11,12,13,14,15].map(v=>[240,v]);ok(!L.detect(mk([...five,[3600,11.7],[300,5],...five])).max,'5-step, run, 5-step is not two-phase');ok(!L.detect(mk([...five,[300,5],...five])).max,'two 5-step tests are not two-phase');const one=[...Array(12).keys()].map(i=>[180,8+i]);ok(!L.detect(mk([[300,5],...one,[300,5]])).max,'a single incremental test is not two-phase');}
console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0);
