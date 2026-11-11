// Left-out periods; Protocol panels resized by dragging edges; Oxynet works on a file with extreme breaths; home button on the right.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d=require('./paths').SAMPLES,f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const ctx=await b.newContext({viewport:{width:1400,height:1000}});const errs=[];
 const pg=await ctx.newPage();pg.on('pageerror',x=>errs.push(x.message));await pg.goto(url);
 const load=async files=>{await pg.setInputFiles('#fileIn',files);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(600);};
 await load([f(/TREAD_CHAR/)]);
 const px=()=>pg.evaluate(()=>{const fl=document.getElementById('pv')._fullLayout;return Object.keys(fl).filter(k=>/^yaxis\d*$/.test(k)).sort().map(k=>Math.round(fl[k]._length))});
 ok(await pg.$$eval('.psz',x=>x.length)===0&&await pg.$$eval('.pgrip',x=>x.length)>=6,'edge grips instead of +/− buttons');
 ok(await pg.evaluate(()=>document.getElementById('pv').layout.shapes.filter(s=>/domain/.test(s.yref||'')).length)>=3,'each panel framed');
 // drag bottom edge of the first panel down by 80 px
 const p0=await px();const g=await pg.$eval('[data-pg$=":bot"]',e=>{const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+5,k:e.dataset.pg}});
 await pg.mouse.move(g.x,g.y);await pg.mouse.down();await pg.mouse.move(g.x,g.y+80,{steps:6});await pg.mouse.up();await pg.waitForTimeout(800);
 const p1=await px();console.log('  ',g.k,JSON.stringify(p0),JSON.stringify(p1));ok(p1.some((v,i)=>v>p0[i]+60)&&p1.filter((v,i)=>Math.abs(v-p0[i])>3).length===1,'dragging one edge changes only that panel');
 const gt=await pg.$eval('[data-pg$=":top"]',e=>{const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+5}});
 await pg.mouse.move(gt.x,gt.y);await pg.mouse.down();await pg.mouse.move(gt.x,gt.y-40,{steps:4});await pg.mouse.up();await pg.waitForTimeout(800);const p2=await px();ok(p2.some((v,i)=>v>p1[i]+25),'dragging a top edge works too');
 // leave out a period: 10–12 min
 const n0=await pg.evaluate(()=>LabApp.S.D.R0.t.length);
 await pg.click('#exBtn');await pg.waitForTimeout(500);ok(await pg.$eval('#exBtn',e=>e.getAttribute('aria-pressed'))==='true','leave-out mode on');
 const xy=await pg.evaluate(()=>{const gd=document.getElementById('pv'),xa=gd._fullLayout.xaxis,r=gd.getBoundingClientRect();return{a:r.left+xa._offset+xa.l2p(10),b:r.left+xa._offset+xa.l2p(12),y:r.top+gd._fullLayout.margin.t+60}});
 await pg.mouse.move(xy.a,xy.y);await pg.mouse.down();await pg.mouse.move(xy.b,xy.y,{steps:6});await pg.mouse.up();await pg.waitForTimeout(1200);
 const lo=await pg.evaluate(()=>LabApp.S.set.leaveOut);console.log('  left out',JSON.stringify(lo));ok(lo.length===1&&Math.abs(lo[0][0]-600)<6&&Math.abs(lo[0][1]-720)<6,'period marked 10–12 min');
 const n1=await pg.evaluate(()=>[LabApp.S.D.R0.t.length,LabApp.S.D.R0.t.filter(t=>t>605&&t<715).length,LabApp.S.D.X.t.filter(t=>t>610&&t<710).length]);ok(n1[0]<n0&&n1[1]===0&&n1[2]===0,'breaths and averages in the period are gone: '+JSON.stringify(n1));
 ok(/Left out by you: 10:0\d–1\d:\d\d/.test(await pg.evaluate(()=>JSON.stringify(LabApp.S.checks))),'listed in data checks');
 ok(/judged noisy or erroneous were left out/.test(await pg.evaluate(()=>LabApp.methodsText())),'in the methods paragraph');
 await pg.screenshot({path:out+'leftout.png',clip:{x:0,y:200,width:1400,height:800}});
 await pg.click('[data-tab=incremental]');await pg.waitForTimeout(2500);ok(await pg.evaluate(()=>LabApp.S.D.inc&&LabApp.S.D.inc.values.length>0),'thresholds tab still works');
 await pg.click('[data-tab=protocol]');await pg.waitForTimeout(600);await pg.click('[data-lo="0"]');await pg.waitForTimeout(1000);ok(await pg.evaluate(()=>LabApp.S.set.leaveOut.length===0&&LabApp.S.D.R0.t.length)===n0,'× puts the period back');
 // undo brings it back
 await pg.mouse.click(5,900);await pg.keyboard.press('Control+z');await pg.waitForTimeout(1200);ok(await pg.evaluate(()=>LabApp.S.set.leaveOut.length)===1,'Ctrl+Z restores the left-out period');
 // home button on the right of a figure
 await pg.click('[data-tab=incremental]');await pg.waitForTimeout(2500);const hb=await pg.evaluate(()=>{const gd=document.getElementById('vc_vs');const m=gd.querySelector('.modebar'),r=gd.getBoundingClientRect(),mr=m.getBoundingClientRect();return [mr.left-r.left,r.right-mr.right]});ok(hb[1]<hb[0],'home button on the right: '+JSON.stringify(hb.map(Math.round)));
 // step tests: leave-out works there too
 await pg.click('#bLoad');await load(fs.readdirSync(d).filter(x=>/MORNING/.test(x)).map(x=>d+x));
 await pg.click('#exBtn');await pg.waitForTimeout(400);const xy2=await pg.evaluate(()=>{const gd=document.getElementById('pv'),xa=gd._fullLayout.xaxis,r=gd.getBoundingClientRect();return{a:r.left+xa._offset+xa.l2p(30),b:r.left+xa._offset+xa.l2p(31),y:r.top+gd._fullLayout.margin.t+60}});
 await pg.mouse.move(xy2.a,xy2.y);await pg.mouse.down();await pg.mouse.move(xy2.b,xy2.y,{steps:4});await pg.mouse.up();await pg.waitForTimeout(1200);const lo2=await pg.evaluate(()=>[LabApp.S.set.leaveOut,LabApp.S.D.R0.t.filter(t=>t>LabApp.S.set.leaveOut[0][0]+2&&t<LabApp.S.set.leaveOut[0][1]-2).length]);console.log('  ',JSON.stringify(lo2));ok(lo2[0].length===1&&lo2[1]===0,'leave out works for step-test sessions');
 // Oxynet with extreme breaths
 await pg.click('#bLoad');await load([f(/SPIKES_session_1/)]);await pg.click('[data-tab=incremental]');await pg.waitForFunction(()=>LabApp.S.oxy&&LabApp.S.oxy.done,{timeout:120000});await pg.waitForTimeout(500);
 const ox=await pg.evaluate(()=>Object.fromEntries(Object.entries(LabApp.S.oxy.res).map(([k,v])=>[k,[v.vt1&&+v.vt1.vo2.toFixed(2),v.vt2&&+v.vt2.vo2.toFixed(2),v.problem||'']])));console.log('  SPIKES Oxynet',JSON.stringify(ox));
 ok(ox.lstm[0]&&ox.lstm[1]&&ox.cnn[0],'Oxynet places thresholds although outliers are kept elsewhere');
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
