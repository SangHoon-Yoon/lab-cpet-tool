// Stage table with Unlock, rests between stages, units locked to the chosen sport, dragging a stage edge (0.27.0). Uses simulated files and the example.
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
const {SIM}=require('./paths');
const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';fs.mkdirSync(out,{recursive:true});
let fail=0;const ok=(c,m)=>{console.log((c?'  ok ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch(),ctx=await b.newContext({viewport:{width:1300,height:1000}}),pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 const choose=async(...ch)=>{await pg.evaluate(()=>localStorage.removeItem('labcpet.choice'));await pg.reload();for(const c of ch)await pg.click(`[data-ch="${c}"]`);};
 const load=async f=>{if(f){await pg.setInputFiles('#fileIn',f);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled);}await pg.click('#bGo');await pg.waitForTimeout(1500);};
 const st=()=>pg.evaluate(()=>{const p=LabApp.S.proto;return {type:p.type,n:p.inc&&p.inc.stages?p.inc.stages.length:0,sp:p.inc&&p.inc.stages?p.inc.stages.map(q=>q.p):[],rests:p.inc&&p.inc.rests?p.inc.rests.length:0};});
 await pg.goto(url);
 // 1. a running file with 30-s rests: one incremental test of 9 stages, rests left out of the threshold data
 await choose('test:inc','sport:run','data:both');await load(SIM+'sim_run_incremental_rests_COSMED.xlsx');
 const a=await st();ok(a.type==='incremental'&&a.n===9&&a.rests===8&&a.sp[0]===8&&a.sp[8]===16,'rests between stages: one test, 9 stages, 8 rests '+JSON.stringify(a));
 const dropped=await pg.evaluate(()=>{const r=LabApp.S.proto.inc.rests[2],R=LabApp.S.D.R0;return R.t.filter(t=>t>r[0]+1&&t<r[1]-1).length;});ok(dropped===0,'breaths in the rests are left out');
 ok(await pg.$('#mRest')!==null,'a box to keep or leave out the rests');
 await pg.evaluate(()=>{document.querySelector('#dBox').open=true});await pg.click('#mRest');await pg.waitForTimeout(800);
 ok(await pg.evaluate(()=>{const r=LabApp.S.proto.inc.rests[2],R=LabApp.S.D.R0;return R.t.filter(t=>t>r[0]+1&&t<r[1]-1).length>0;}),'unticking keeps the rests');
 await pg.screenshot({path:out+'zz_rests.png',fullPage:true});
 // 2. the same test without speed: entered steps with a rest; only km/h on offer
 await choose('test:inc','sport:run','data:both');await load(SIM+'sim_run_incremental_rests_nospeed_COSMED.xlsx');
 await pg.evaluate(()=>{document.querySelector('#sBox').open=true;document.querySelector('#planD').open=true;});
 ok((await pg.$$eval('#plU option',x=>x.map(o=>o.value))).join()==='km/h','running: only km/h for the steps');
 ok((await pg.$$eval('#bUnit option',x=>x.map(o=>o.value))).join()==='km/h','running: only km/h for blocks');
 await pg.fill('#plS','8');await pg.fill('#plI','1');await pg.fill('#plD','3');await pg.fill('#plR','30');await pg.fill('#plE','29.5');await pg.click('#plGo');await pg.waitForTimeout(1200);
 const c=await st();ok(c.n===9&&c.rests===8,'entered steps with 30-s rests: 9 stages, 8 rests '+JSON.stringify(c));
 // 3. cycling: only W
 await choose('test:inc','sport:cycle','data:both');await load(SIM+'sim_run_incremental_rests_nospeed_COSMED.xlsx');
 await pg.evaluate(()=>{document.querySelector('#sBox').open=true;document.querySelector('#planD').open=true;});
 ok((await pg.$$eval('#plU option',x=>x.map(o=>o.value))).join()==='W','cycling: only W for the steps');
 // 4. stage table on the example: locked, unlock, edit, undo, reset
 await pg.click('#bLoad');await pg.click('#bExample');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(800);
 ok(await pg.$eval('#sBox',e=>!e.closest('#dBox')),'Stages is its own block, not inside Test details');
 await pg.evaluate(()=>{document.querySelector('#sBox').open=true;});await pg.waitForTimeout(600);
 ok(await pg.$$eval('.stT tbody tr',x=>x.length)===9&&await pg.$('[data-st]')===null&&await pg.$('#stc .main-svg')!==null,'stage block: chart and 9 stages, locked');
 ok(/9 stages/.test(await pg.$eval('#sSum',e=>e.textContent)),'summary line: '+await pg.$eval('#sSum',e=>e.textContent));
 await pg.click('#stLock');await pg.waitForTimeout(500);ok(await pg.$('[data-st="p:2"]')!==null&&!(await pg.$eval('#sto',e=>e.hidden)),'Unlock: table editable, chart editable');
 await pg.fill('[data-st="dur:0"]','2:30');await pg.keyboard.press('Tab');await pg.waitForTimeout(1000);
 const e1=await pg.evaluate(()=>({s:LabApp.S.set.stages.list.slice(0,2).map(q=>[q.t0,q.dur]),d0:Math.round(LabApp.S.proto.inc.stages[0].dur)}));
 ok(e1.d0===150&&e1.s[1][0]===e1.s[0][0]+150,'shorter first stage moves the next stages along '+JSON.stringify(e1));
 await pg.fill('[data-st="p:1"]','135');await pg.keyboard.press('Tab');await pg.waitForTimeout(1000);ok(await pg.evaluate(()=>LabApp.S.proto.inc.stages[1].p)===135,'intensity typed');
 await pg.fill('[data-st="rest:3"]','0:30');await pg.keyboard.press('Tab');await pg.waitForTimeout(1000);ok(await pg.evaluate(()=>LabApp.S.proto.inc.rests.length)===1,'rest typed after stage 4');
 await pg.evaluate(()=>document.activeElement.blur());await pg.waitForTimeout(500);await pg.keyboard.press('Control+z');await pg.waitForTimeout(1200);
 ok(await pg.evaluate(()=>(LabApp.S.proto.inc.rests||[]).length)===0,'undo takes the rest out again');
 await pg.fill('#stL','3:00');await pg.fill('#stR','0:30');await pg.click('#stAll');await pg.waitForTimeout(1000);
 const al=await pg.evaluate(()=>({n:LabApp.S.proto.inc.rests.length,d:LabApp.S.set.stages.list.slice(0,-1).every(q=>q.dur===180)}));ok(al.n===8&&al.d,'same length and rest for every stage '+JSON.stringify(al));
 await pg.click('#stReset');await pg.waitForTimeout(1000);ok(await pg.evaluate(()=>LabApp.S.set.stages===null&&LabApp.S.proto.inc.stages.length===9&&Math.round(LabApp.S.proto.inc.stages[0].dur)>170),'Reset to original');
 // the chart editor
 await pg.$eval('#stc',e=>e.scrollIntoView({block:'center'}));await pg.waitForTimeout(300);
 const at=(t,y)=>pg.evaluate(([t,y])=>{const gd=document.getElementById('stc'),fl=gd._fullLayout,r=gd.getBoundingClientRect();return {x:fl.xaxis.l2p(t/60)+fl.xaxis._offset+r.left,y:(y===null?fl.yaxis._offset+fl.yaxis._length*0.8:fl.yaxis.l2p(y)+fl.yaxis._offset)+r.top};},[t,y]);
 const cur=()=>pg.$eval('#sto',e=>e.style.cursor);
 const st2=await pg.evaluate(()=>LabApp.S.proto.inc.stages[2]);
 let p=await at(st2.t1,null);await pg.mouse.move(p.x,p.y);await pg.waitForTimeout(100);ok(await cur()==='ew-resize','pointer shows ↔ over a stage edge');
 await pg.mouse.down();await pg.mouse.move(p.x+30,p.y,{steps:5});await pg.mouse.up();await pg.waitForTimeout(1200);
 const d=await pg.evaluate(()=>{const s=LabApp.S.proto.inc.stages;return [s[2].t1,s[3].t0];});ok(d[0]>st2.t1+10&&Math.abs(d[0]-d[1])<1,'dragging the edge between stages 3 and 4 moves both '+JSON.stringify([st2.t1,d]));
 const s5=await pg.evaluate(()=>LabApp.S.proto.inc.stages[5]);
 p=await at(s5.t0+60,s5.p);await pg.mouse.move(p.x,p.y);await pg.waitForTimeout(100);ok(await cur()==='ns-resize','pointer shows ⇕ over the top of a stage');
 const q=await at(s5.t0+60,s5.p+15);await pg.mouse.down();await pg.mouse.move(q.x,q.y,{steps:5});await pg.mouse.up();await pg.waitForTimeout(1200);
 const np=await pg.evaluate(()=>LabApp.S.proto.inc.stages[5].p);ok(Math.abs(np-(s5.p+15))<6,'dragging the top changes the power: '+s5.p+' → '+np);
 const s7=await pg.evaluate(()=>LabApp.S.proto.inc.stages[7]);
 p=await at(s7.t1-30,null);await pg.mouse.move(p.x,p.y);await pg.waitForTimeout(100);ok(await cur()==='crosshair','pointer shows + inside a stage');
 const e=await at(s7.t1,null);await pg.mouse.down();await pg.mouse.move(e.x,e.y,{steps:5});await pg.mouse.up();await pg.waitForTimeout(1200);
 const rs=await pg.evaluate(()=>LabApp.S.proto.inc.rests);ok(rs.length===1&&Math.abs(rs[0][1]-rs[0][0]-30)<4,'dragging across the end of a stage adds a 30-s rest '+JSON.stringify(rs));
 await pg.screenshot({path:out+'zz_edit.png',fullPage:true});
 p=await at((rs[0][0]+rs[0][1])/2,null);await pg.mouse.move(p.x,p.y);await pg.waitForTimeout(100);ok(await cur()==='pointer','pointer shows a hand over a rest');
 await pg.mouse.down();await pg.mouse.up();await pg.waitForTimeout(1200);ok(await pg.evaluate(()=>(LabApp.S.proto.inc.rests||[]).length)===0&&await pg.evaluate(()=>LabApp.S.proto.inc.stages.length)===9,'clicking the rest removes it');
 // the Protocol tab button opens the block, unlocked
 await pg.click('#stLock');await pg.evaluate(()=>{document.querySelector('#sBox').open=false;});await pg.click('[data-tab=protocol]');await pg.waitForTimeout(500);await pg.click('#stEdit');await pg.waitForTimeout(800);
 ok(await pg.$eval('#sBox',e=>e.open)&&await pg.$('[data-st]')!==null,'Edit stages on the Protocol tab opens the Stages block, unlocked');
 // folding sections look clickable
 await pg.evaluate(()=>{document.querySelector('#dBox').open=true;});ok(await pg.$eval('details[data-fold=dchk]>summary',e=>getComputedStyle(e,'::after').content.includes('Show')),'Data checks shows a Show button');
 console.log(' errors:',errs.length?errs.join(' | '):'none');if(errs.length)fail++;
 await b.close();console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);})();
