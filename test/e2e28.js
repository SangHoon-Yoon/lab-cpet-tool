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
 await pg.waitForTimeout(500);p=await at(s5.t0+60,s5.p);await pg.mouse.move(p.x,p.y-3);await pg.mouse.move(p.x,p.y);await pg.waitForTimeout(150);ok(await cur()==='ns-resize','pointer shows ⇕ over the top of a stage');
 const q=await at(s5.t0+60,s5.p+15);await pg.mouse.down();await pg.mouse.move(q.x,q.y,{steps:5});await pg.mouse.up();await pg.waitForTimeout(1200);
 const np=await pg.evaluate(()=>LabApp.S.proto.inc.stages[5].p);ok(Math.abs(np-(s5.p+15))<6,'dragging the top changes the power: '+s5.p+' → '+np);
 const s7=await pg.evaluate(()=>LabApp.S.proto.inc.stages[7]);
 p=await at(s7.t1-30,null);await pg.mouse.move(p.x,p.y);await pg.waitForTimeout(100);ok(await cur()==='pointer','pointer shows a hand inside a stage (click to select)');
await pg.mouse.click(p.x,p.y);await pg.waitForTimeout(400);ok(/Stage 8/.test(await pg.$eval('#stsel',e=>e.textContent)),'clicking a stage opens its bar');await pg.click('#stAddR');await pg.waitForTimeout(1200);
 const rs=await pg.evaluate(()=>LabApp.S.proto.inc.rests);ok(rs.length===1&&Math.abs(rs[0][1]-rs[0][0]-30)<4,'Add rest after (in the stage bar) adds a 30-s rest '+JSON.stringify(rs));
 await pg.screenshot({path:out+'zz_edit.png',fullPage:true});
 p=await at((rs[0][0]+rs[0][1])/2,null);await pg.mouse.move(p.x,p.y);await pg.waitForTimeout(100);ok(await cur()==='pointer','pointer shows a hand over a rest');
 await pg.mouse.down();await pg.mouse.up();await pg.waitForTimeout(500);await pg.keyboard.press('Delete');await pg.waitForTimeout(1200);ok(await pg.evaluate(()=>(LabApp.S.proto.inc.rests||[]).length)===0&&await pg.evaluate(()=>LabApp.S.proto.inc.stages.length)===9,'clicking the rest selects it and Delete removes it');
 // ⌘ + scroll changes a stage's length by 5 s; plain scroll does not
 const s4=await pg.evaluate(()=>LabApp.S.proto.inc.stages[4]),s5b=await pg.evaluate(()=>LabApp.S.proto.inc.stages[5].t0);
 p=await at(s4.t0+60,null);await pg.mouse.move(p.x,p.y);await pg.mouse.wheel(0,-40);await pg.waitForTimeout(800);ok(Math.round(await pg.evaluate(()=>LabApp.S.proto.inc.stages[4].dur))===Math.round(s4.dur),'plain scrolling leaves the stage alone');
 await pg.keyboard.down('Meta');for(let k=0;k<2;k++){await pg.mouse.wheel(0,-25);await pg.waitForTimeout(60);}await pg.keyboard.up('Meta');await pg.waitForTimeout(1500);
 const w=await pg.evaluate(()=>[LabApp.S.set.stages.list[4].dur,LabApp.S.set.stages.list[5].t0]);const want=(Math.floor(s4.dur/5+1e-6)+2)*5;ok(Math.abs(w[0]-want)<0.01&&Math.abs(w[1]-(s5b+want-s4.dur))<0.6,'⌘ + scroll up twice: stage 5 first rounds to 5 s, then +5 s ('+s4.dur.toFixed(1)+' → '+w[0]+'), later stages move along');
 // click a stage to select it, then delete it
 p=await at(s4.t0+60,null);await pg.mouse.click(p.x,p.y);await pg.waitForTimeout(400);ok(!(await pg.$eval('#stsel',e=>e.hidden)),'clicking a stage selects it and offers Delete');
 await pg.click('#stDel');await pg.waitForTimeout(1200);ok(await pg.evaluate(()=>LabApp.S.set.stages.list.length)===8,'Delete stage removes it');
 // zoom buttons and height
 const r0=await pg.evaluate(()=>{const r=document.getElementById('stc')._fullLayout.xaxis.range;return r[1]-r[0];});await pg.click('[data-sz=in]');await pg.waitForTimeout(400);const r1=await pg.evaluate(()=>{const r=document.getElementById('stc')._fullLayout.xaxis.range;return r[1]-r[0];});ok(r1<r0*0.8,'zoom in button');
 await pg.click('[data-sz=all]');await pg.waitForTimeout(400);
 const hb=await (await pg.$('#stsize')).boundingBox(),h0=await pg.evaluate(()=>document.getElementById('stc').getBoundingClientRect().height);await pg.mouse.move(hb.x+hb.width/2,hb.y+7);await pg.mouse.down();await pg.mouse.move(hb.x+hb.width/2,hb.y+107,{steps:6});await pg.mouse.up();await pg.waitForTimeout(500);
 ok(Math.abs(await pg.evaluate(()=>document.getElementById('stc').getBoundingClientRect().height)-(h0+100))<4,'dragging the bar makes the chart taller');
 // the home button, clicked like a person would (pointer moved onto it), while unlocked
 await pg.click('[data-sz=in]');await pg.click('[data-sz=in]');await pg.waitForTimeout(300);
 const zr=await pg.evaluate(()=>{const r=document.getElementById('stc')._fullLayout.xaxis.range;return r[1]-r[0];});
 await pg.click('#stc .modebar-btn');await pg.waitForTimeout(500);
 const hr2=await pg.evaluate(()=>{const r=document.getElementById('stc')._fullLayout.xaxis.range;return r[1]-r[0];});ok(hr2>zr*2,'home button (unlocked) shows all the stages again '+[zr.toFixed(1),hr2.toFixed(1)]);
 // ⌥ also works, with small trackpad-like steps
 const s3=await pg.evaluate(()=>LabApp.S.proto.inc.stages[3]);p=await at(s3.t0+60,null);await pg.mouse.move(p.x,p.y);
 await pg.keyboard.down('Alt');for(let k=0;k<12;k++){await pg.mouse.wheel(0,-5);await pg.waitForTimeout(16);}await pg.keyboard.up('Alt');await pg.waitForTimeout(1500);
 const a3=await pg.evaluate(()=>LabApp.S.proto.inc.stages[3].dur);ok(a3%5===0&&a3>s3.dur&&a3-s3.dur<=10,'⌥ + small scroll steps: stage 4 is 10 s longer '+[s3.dur,a3]);
 // arrow keys on a selected stage
 const s2b=await pg.evaluate(()=>LabApp.S.proto.inc.stages[2]);p=await at(s2b.t0+40,null);await pg.mouse.click(p.x,p.y);await pg.waitForTimeout(400);
 await pg.keyboard.press('ArrowLeft');await pg.keyboard.press('ArrowUp');await pg.waitForTimeout(1500);
 const k2=await pg.evaluate(()=>LabApp.S.proto.inc.stages[2]);ok(k2.dur%5===0&&k2.dur<s2b.dur&&s2b.dur-k2.dur<=5&&k2.p===s2b.p+5,'arrow keys: ← 5 s shorter, ↑ 5 W more '+JSON.stringify([s2b.dur,s2b.p,k2.dur,k2.p]));
 // ⌘ + scroll over a time in the table
 const t0v=await pg.$eval('[data-st="dur:1"]',e=>e.value);await pg.hover('[data-st="dur:1"]');await pg.keyboard.down('Meta');for(let k=0;k<5;k++){await pg.mouse.wheel(0,-5);await pg.waitForTimeout(16);}await pg.keyboard.up('Meta');await pg.waitForTimeout(1500);
 const t1v=await pg.$eval('[data-st="dur:1"]',e=>e.value);ok(t1v!==t0v,'⌘ + scroll over a length in the table changes it: '+t0v+' → '+t1v);
 // hover gives the length; a rest is selected by a click, then removed from its bar
 await pg.click('#stReset');await pg.waitForTimeout(1200);
 const SL=()=>pg.evaluate(()=>LabApp._stRows());
 let L0=await SL();p=await at(L0[1].t0+50,null);await pg.mouse.move(p.x,p.y);await pg.waitForTimeout(150);
 const hv=await pg.$eval('#stpop',e=>e.textContent);ok(/^Stage 2: \d:\d\d at /.test(hv),'hover over a stage shows its length: '+hv.split('\n')[0]);
p=await at(L0[6].t0+60,null);await pg.mouse.click(p.x,p.y);await pg.waitForTimeout(400);await pg.click('#stAddR');await pg.waitForTimeout(1200);await pg.keyboard.press('Escape');await pg.waitForTimeout(300);
 const rr=await pg.evaluate(()=>LabApp.S.proto.inc.rests[0]);p=await at((rr[0]+rr[1])/2,null);await pg.mouse.move(p.x,p.y);await pg.waitForTimeout(150);ok(/^Rest after stage 7: 0:3\d/.test(await pg.$eval('#stpop',e=>e.textContent)),'hover over a rest shows its length: '+(await pg.$eval('#stpop',e=>e.textContent)).split('\n')[0]);
 await pg.mouse.click(p.x,p.y);await pg.waitForTimeout(400);ok(await pg.evaluate(()=>LabApp.S.proto.inc.rests.length)===1&&/Rest after stage 7/.test(await pg.$eval('#stsel',e=>e.hidden?'':e.textContent)),'clicking a rest selects it (not removed yet)');
 await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(1300);const rr2=await pg.evaluate(()=>LabApp.S.proto.inc.rests[0]);ok((rr2[1]-rr2[0])%5<0.6&&rr2[1]-rr2[0]>rr[1]-rr[0],'→ makes the selected rest longer, to a round 5 s: '+(rr[1]-rr[0])+' → '+(rr2[1]-rr2[0]));
 await pg.click('#stDel');await pg.waitForTimeout(1200);ok(await pg.evaluate(()=>(LabApp.S.proto.inc.rests||[]).length)===0,'Remove rest removes it');
 // pinch (Ctrl + scroll) zooms around the selected stage
 const s4z=(await SL())[4];p=await at(s4z.t0+60,null);await pg.mouse.click(p.x,p.y);await pg.waitForTimeout(400);
 const far=await at(s4z.t0+600,null),rz0=await pg.evaluate(()=>document.getElementById('stc')._fullLayout.xaxis.range.slice());await pg.mouse.move(far.x,far.y);
 await pg.keyboard.down('Control');for(let k=0;k<4;k++){await pg.mouse.wheel(0,-20);await pg.waitForTimeout(40);}await pg.keyboard.up('Control');await pg.waitForTimeout(600);
 const rz1=await pg.evaluate(()=>document.getElementById("stc")._fullLayout.xaxis.range.slice()),cz=(s4z.t0+s4z.dur/2)/60,fr=r=>(cz-r[0])/(r[1]-r[0]);
 ok(rz1[1]-rz1[0]<(rz0[1]-rz0[0])*0.8&&Math.abs(fr(rz1)-fr(rz0))<0.02,'pinch zooms in around the selected stage, which stays in place on the chart');
 await pg.keyboard.press('Escape');await pg.click('[data-sz=all]');await pg.waitForTimeout(300);
 // locked: a hint instead of editing
 await pg.click('#stLock');await pg.waitForTimeout(500);p=await at(s2b.t0+40,null);await pg.mouse.click(p.x,p.y);await pg.waitForTimeout(300);ok(await pg.$eval('.stT tbody tr:nth-child(3)',e=>e.classList.contains('on'))&&await pg.$eval('#stsel',e=>e.hidden),'locked: clicking a stage highlights its row (no editing bar)');
 await pg.keyboard.down('Alt');await pg.mouse.wheel(0,-30);await pg.keyboard.up('Alt');await pg.waitForTimeout(200);ok(/Unlock to edit/.test(await pg.$eval('#stpop',e=>e.hidden?'':e.textContent)),'locked: ⌥ + scroll says how to unlock');
 await pg.click('#stLock');await pg.waitForTimeout(400);
 // the new editing bar, row clicks, scrolling with a selection, full screen, blocks (0.31.0)
 await pg.click('#stReset');await pg.waitForTimeout(1200);
 await pg.click('.stT tbody tr:nth-child(4) td:first-child');await pg.waitForTimeout(400);ok(/Stage 4/.test(await pg.$eval('#stsel',e=>e.textContent))&&await pg.evaluate(()=>LabApp.S._stSel===undefined||true),'clicking a table row selects that stage on the chart');
 await pg.fill('#stbL','2:00');await pg.keyboard.press('Enter');await pg.waitForTimeout(1300);let R=await pg.evaluate(()=>LabApp._stRows());ok(R[3].dur===120&&Math.abs(R[4].t0-(R[3].t0+120))<1,'typing a length in the bar: 2:00, later stages move along');
 await pg.click('#stAddS');await pg.waitForTimeout(1300);R=await pg.evaluate(()=>LabApp._stRows());ok(R.length===10&&R[4].dur===120&&R[4].t0===R[3].t0+120&&/Stage 5/.test(await pg.$eval('#stsel',e=>e.textContent)),'Add stage after: a new stage 5, selected');
 const far2=await at(R[8].t0+30,null);await pg.mouse.move(far2.x,far2.y);await pg.keyboard.down('Meta');for(let k=0;k<2;k++){await pg.mouse.wheel(0,-25);await pg.waitForTimeout(40);}await pg.keyboard.up('Meta');await pg.waitForTimeout(1500);
 const R2=await pg.evaluate(()=>LabApp._stRows());ok(R2[4].dur===130&&R2[8].dur===R[8].dur,'with stage 5 selected, ⌘ + scroll over another stage still changes stage 5: '+R[4].dur+' → '+R2[4].dur);
 await pg.click('#stFS');await pg.waitForTimeout(800);const fsb=await pg.evaluate(()=>{const r=document.getElementById('stedit').getBoundingClientRect(),c=document.getElementById('stc').getBoundingClientRect();return {w:r.width/innerWidth,h:r.height/innerHeight,cw:c.width/innerWidth,back:!!document.getElementById('stback')};});
 ok(fsb.w>0.9&&fsb.h>0.9&&fsb.cw>0.55&&fsb.back,'full screen fills most of the window over a dimmed page '+JSON.stringify(fsb));
 await pg.click('.stT tbody tr:nth-child(2) td:first-child');await pg.waitForTimeout(400);await pg.click('#stAddR');await pg.waitForTimeout(1300);ok(await pg.evaluate(()=>LabApp.S.proto.inc.rests.length)===1&&/Rest after stage 2/.test(await pg.$eval('#stsel',e=>e.textContent)),'editing works in full screen (rest added after stage 2)');
 await pg.screenshot({path:out+'zz_fullscreen.png'});
 await pg.keyboard.press('Escape');await pg.waitForTimeout(300);await pg.keyboard.press('Escape');await pg.waitForTimeout(600);ok(!(await pg.$('#stedit.fs')),'Esc clears the selection, then leaves full screen');
 await pg.click('#stReset');await pg.waitForTimeout(1200);
 await pg.evaluate(()=>{document.querySelector('#blkD').open=true;});await pg.click('#bAdd');await pg.waitForTimeout(200);const bs=await pg.$$eval('#bT [data-f=start]',x=>x.map(e=>+e.value));ok(bs[1]===21,'Add block: the next block starts 1 min after the last ends: '+bs);
 await pg.fill('#bT [data-b="1"][data-f=start]','22');await pg.keyboard.press('Tab');await pg.click('#bApply');await pg.waitForTimeout(1500);ok(await pg.evaluate(()=>LabApp.S.set.blocks&&LabApp.S.set.blocks.length===2&&LabApp._stRows().length>5),'Apply with two blocks uses both');
 await pg.click('#bClear');await pg.waitForTimeout(1200);
 // the Protocol tab button opens the block, unlocked
 await pg.click('#stLock');await pg.evaluate(()=>{document.querySelector('#sBox').open=false;});await pg.click('[data-tab=protocol]');await pg.waitForTimeout(500);await pg.click('#stEdit');await pg.waitForTimeout(800);
 ok(await pg.$eval('#sBox',e=>e.open)&&await pg.$('[data-st]')!==null,'Edit stages on the Protocol tab opens the Stages block, unlocked');
 // folding sections look clickable
 await pg.evaluate(()=>{document.querySelector('#dBox').open=true;});ok(await pg.$eval('details[data-fold=dchk]>summary',e=>getComputedStyle(e,'::after').content.includes('Show')),'Data checks shows a Show button');
 console.log(' errors:',errs.length?errs.join(' | '):'none');if(errs.length)fail++;
 await b.close();console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);})();
