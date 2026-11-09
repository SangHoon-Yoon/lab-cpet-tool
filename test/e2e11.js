// Highlight editing (sides, click to clear, release outside), and (i) pop-ups on every tab.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d='/home/claude/samples/',fl=fs.readdirSync(d).filter(x=>/MORNING/.test(x)).map(x=>d+x),f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const ctx=await b.newContext({viewport:{width:1400,height:1100}});const errs=[];
 const open=async files=>{const pg=await ctx.newPage();pg.on('pageerror',x=>errs.push(x.message));await pg.goto(url);await pg.setInputFiles('#fileIn',files);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(400);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(500);return pg;};
 const sel=pg=>pg.evaluate(()=>{const k=Math.round(LabApp.S.proto.tests[0].t0);return (LabApp.S.set.st.sels||{})[k]||null;});
 const geo=pg=>pg.evaluate(()=>{const gd=document.getElementById('selC0');gd.scrollIntoView({block:'center'});const xa=gd._fullLayout.xaxis,r=gd.getBoundingClientRect();return{l:r.left+xa._offset,len:xa._length,x:m=>0,px:[...Array(25)].map((_,m)=>r.left+xa._offset+xa.l2p(m)),y:r.top+gd._fullLayout.margin.t+60,right:r.right};});
 let pg=await open(fl);
 const infos=async()=>pg.$$eval('#views .ib',x=>x.length);ok(await infos()>=1,'protocol tab has an (i) button');ok(await pg.$$eval('#views ul.notes',x=>x.length)===0,'protocol notes moved into a pop-up');
 await pg.click('#views .ib');await pg.waitForTimeout(150);const pt=await pg.$eval('#ipop',e=>!e.hidden&&e.innerText);ok(pt&&/Scroll to zoom/.test(pt),'pop-up shows the zoom help');await pg.mouse.click(5,5);await pg.waitForTimeout(100);ok(await pg.$eval('#ipop',e=>e.hidden),'click outside closes it');
 await pg.click('[data-tab=steps]');await pg.waitForTimeout(900);ok(await infos()>=3,'step tests tab has (i) buttons: '+await infos());ok(await pg.$$eval('#views ul.notes',x=>x.length)===0,'step notes moved');
 let g=await geo(pg);await pg.waitForTimeout(200);g=await geo(pg);
 // drag 4 -> 16 min, then let go outside the window: simulate by moving with no buttons
 await pg.mouse.move(g.px[4],g.y);await pg.mouse.down();await pg.mouse.move(g.px[10],g.y,{steps:3});await pg.mouse.move(g.right+200,g.y,{steps:3});
 await pg.evaluate(([x,y])=>window.dispatchEvent(new MouseEvent('mousemove',{clientX:x,clientY:y,buttons:0,bubbles:true})),[g.px[12],g.y]);await pg.waitForTimeout(1200);
 let s1=await sel(pg);ok(s1&&Math.abs(s1[0]-240)<8&&s1[1]>=(await pg.evaluate(()=>{const T=LabApp.S.proto.tests[0];return T.t1-T.t0}))-8||s1===null&&false,'release outside ends the drag at the edge: '+JSON.stringify(s1));
 await pg.mouse.up();await pg.waitForTimeout(800);ok(JSON.stringify(await sel(pg))===JSON.stringify(s1),'no second click needed');
 ok(await pg.evaluate(()=>{const sh=document.getElementById('selC0').layout.shapes;const rect=sh.find(q=>q.type==='rect');return rect&&rect.line.width===0&&sh.filter(q=>q.type==='line'&&q.line.width===1.5).length===2}),'highlight has side lines only');
 // drag right side in to 16 min
 g=await geo(pg);const rpx=await pg.evaluate(s=>{const gd=document.getElementById('selC0'),xa=gd._fullLayout.xaxis,r=gd.getBoundingClientRect();return r.left+xa._offset+xa.l2p(s/60)},s1[1]);
 await pg.mouse.move(rpx-1,g.y);await pg.waitForTimeout(80);ok(await pg.$eval('#selWrap0',e=>e.style.cursor)==='ew-resize','cursor shows a side can be dragged');
 await pg.mouse.down();await pg.mouse.move(g.px[16],g.y,{steps:5});await pg.mouse.up();await pg.waitForTimeout(1200);let s2=await sel(pg);ok(s2&&Math.abs(s2[0]-s1[0])<2&&Math.abs(s2[1]-960)<8,'dragging the right side shortens it: '+JSON.stringify(s2));
 g=await geo(pg);const lpx=await pg.evaluate(s=>{const gd=document.getElementById('selC0'),xa=gd._fullLayout.xaxis,r=gd.getBoundingClientRect();return r.left+xa._offset+xa.l2p(s/60)},s2[0]);
 await pg.mouse.move(lpx+1,g.y);await pg.mouse.down();await pg.mouse.move(g.px[2],g.y,{steps:5});await pg.mouse.up();await pg.waitForTimeout(1200);let s3=await sel(pg);ok(s3&&Math.abs(s3[0]-120)<8&&s3[1]===s2[1],'dragging the left side extends it: '+JSON.stringify(s3));
 g=await geo(pg);await pg.mouse.click(g.px[20],g.y);await pg.waitForTimeout(1200);ok(await sel(pg)===null,'a click elsewhere clears it');
 await pg.mouse.move(g.px[5],g.y);await pg.mouse.down();await pg.mouse.move(g.px[9],g.y,{steps:4});await pg.mouse.up();await pg.waitForTimeout(1200);const s4=await sel(pg);ok(s4&&Math.abs(s4[0]-300)<8&&Math.abs(s4[1]-540)<8,'and a new highlight can be drawn: '+JSON.stringify(s4));
 await pg.click('#selH .ib');await pg.waitForTimeout(150);ok(/Drag either side/.test(await pg.$eval('#ipop',e=>e.innerText)),'choose-the-data pop-up explains editing');await pg.keyboard.press('Escape');
 await pg.screenshot({path:out+'sel_edit.png',clip:{x:0,y:0,width:1400,height:700}});
 await pg.click('[data-tab=summary]');await pg.waitForTimeout(400);ok(await pg.$$eval('details.fold',d=>['chk','meth','cred'].every(k=>d.some(x=>x.dataset.fold===k&&!x.open))),'summary: three closed sections');
 await pg.click('details[data-fold=meth] summary');await pg.waitForTimeout(150);ok(await pg.$eval('#meth',e=>e.innerText.length>100),'methods opens');await pg.click('[data-tab=steps]');await pg.waitForTimeout(600);await pg.click('[data-tab=summary]');await pg.waitForTimeout(400);ok(await pg.$eval('details[data-fold=meth]',d=>d.open)&&await pg.$eval('details[data-fold=chk]',d=>!d.open),'open section stays open after changing tabs');
 await pg.click('details[data-fold=chk] summary');await pg.waitForTimeout(150);await pg.screenshot({path:out+'summary_folds.png',fullPage:true});
 await pg.click('[data-tab=prolonged]');await pg.waitForTimeout(900);ok(await pg.$$eval('#views ul.notes',x=>x.length)===0&&await pg.$$eval('#recH .ib',x=>x.length)===1,'prolonged notes in a pop-up');
 await pg.close();
 pg=await open([f(/TREAD_CHAR/)]);
 await pg.click('[data-tab=incremental]');await pg.waitForTimeout(2500);ok(await pg.$$eval('#views ul.notes',x=>x.length)===0,'incremental notes moved');ok(await pg.$$eval('#winInfo .ib,#plotInfo .ib,#oxH .ib,#thrH .ib',x=>x.length)===4,'incremental has four (i) buttons');
 await pg.screenshot({path:out+'inc_info.png',clip:{x:0,y:0,width:1400,height:500}});
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
