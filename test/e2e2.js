const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),X=require('xlsx');
const dir='/home/claude/samples/',f=re=>dir+fs.readdirSync(dir).find(x=>re.test(x)),sim=path.resolve(__dirname,'sim')+'/';
const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/',dl='/tmp/claude-0/-home-claude/f2a3b0f6-b28d-5952-946e-21cdf36e71d8/scratchpad/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const ctx=await b.newContext({viewport:{width:1400,height:1000},acceptDownloads:true});
 let ext=0;await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:')||u.startsWith('blob:')||u.startsWith('data:'))return r.continue();ext++;console.log('external request',u);return r.abort();});
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(url);await pg.setViewportSize({width:1400,height:1400});await pg.setInputFiles('#fileIn',[f(/TREAD_CHAR/)]);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(800);
 ok(ext===0,'no external requests: works offline');
 // Protocol: wheel zoom, panel rescale, chip
 const pv=await (await pg.$('#pv')).boundingBox();await pg.mouse.move(pv.x+600,pv.y+80);for(let i=0;i<4;i++){await pg.mouse.wheel(0,-120);await pg.waitForTimeout(150);}await pg.waitForTimeout(1200);
 const r1=await pg.evaluate(()=>{const l=document.getElementById('pv')._fullLayout;return{x:l.xaxis.range,y:l.yaxis.range}});ok(r1.x[1]-r1.x[0]<26,'scroll zooms time: '+r1.x.map(v=>v.toFixed(1)));ok(r1.y[1]<4.2,'VO2 panel rescaled to view: '+r1.y.map(v=>v.toFixed(2)));
 await pg.mouse.move(pv.x+600,pv.y+150);await pg.mouse.move(pv.x+620,pv.y+150);await pg.waitForTimeout(100);console.log(' ',await pg.$eval('#cur',e=>e.innerText));
 await pg.mouse.dblclick(pv.x+600,pv.y+80);await pg.waitForTimeout(700);const r2=await pg.evaluate(()=>document.getElementById('pv')._fullLayout.xaxis.range);ok(r2[0]===0,'double-click resets the view');await pg.click('[data-sv=eqo2]');await pg.waitForTimeout(500);await pg.click('[data-sv=rer]');await pg.waitForTimeout(500);
 await pg.selectOption('#vAvg','bin:30');await pg.waitForTimeout(700);ok(await pg.evaluate(()=>LabApp.S.set.avg.bin===30),'averaging menu');await pg.screenshot({path:out+'x_protocol_more.png',fullPage:true});
 await pg.selectOption('#vAvg','bin:15');await pg.waitForTimeout(500);
 // Incremental: drag VT1 on V-slope
 await pg.click('[data-tab=incremental]');await pg.waitForTimeout(900);
 const g=await pg.$('#vc_vs');const pos=await pg.evaluate(()=>{const gd=document.getElementById('vc_vs'),xa=gd._fullLayout.xaxis,ya=gd._fullLayout.yaxis,r=gd.getBoundingClientRect();return{x:r.left+xa._offset+xa.l2p(gd.layout.shapes[0].x0),y:r.top+ya._offset+60,scroll:0}});
 await pg.evaluate(()=>window.scrollTo(0,0));const before=await pg.evaluate(()=>LabApp.results().thr[0].vo2_L_min);
 const p2=await pg.evaluate(()=>{document.getElementById('vc_vs').scrollIntoView({block:'center'});const gd=document.getElementById('vc_vs'),xa=gd._fullLayout.xaxis,ya=gd._fullLayout.yaxis,r=gd.getBoundingClientRect();return{x:r.left+xa._offset+xa.l2p(gd.layout.shapes[0].x0),y:r.top+ya._offset+60}});
 await pg.mouse.move(p2.x,p2.y);await pg.mouse.down();await pg.mouse.move(p2.x-50,p2.y,{steps:5});await pg.mouse.up();await pg.waitForTimeout(500);
 const th=await pg.evaluate(()=>LabApp.results().thr[0]);ok(th.source==='placed by user'&&th.vo2_L_min<before,'VT1 dragged from '+before+' to '+th.vo2_L_min);
 const sync=await pg.evaluate(()=>{const a=document.getElementById('vc_eq').layout.shapes[0].x0,b=document.getElementById('vc_vs').layout.shapes[0].x0;return[a,b]});ok(Math.abs(sync[0]-sync[1])<1e-6,'line moved on all charts');
 ok((await pg.$eval('[data-vti=vt1]',e=>e.value))===th.vo2_L_min.toFixed(2),'table follows the line');
 // Add VT2, numeric entry, time axis
 await pg.click('#addV2');await pg.waitForTimeout(300);await pg.fill('[data-vti=vt2]','3.65');await pg.dispatchEvent('[data-vti=vt2]','change');await pg.waitForTimeout(400);const t2=await pg.evaluate(()=>LabApp.results().thr[1]);ok(t2&&Math.abs(t2.vo2_L_min-3.65)<1e-9,'VT2 typed in: '+JSON.stringify([t2.vo2_L_min,t2.pct_vo2peak,t2.intensity_regression,t2.intensity_stage,t2.hr_bpm]));
 await pg.click('[data-x=t]');await pg.waitForTimeout(900);await pg.screenshot({path:out+'x_inc_time.png',fullPage:true});
 const t3=await pg.evaluate(()=>{const gd=document.getElementById('vc_eq');return gd.layout.shapes.map(s=>s.x0)});console.log('  time-view line positions (min)',t3.map(v=>v.toFixed(2)));
 await pg.click('[data-x=vo2]');await pg.waitForTimeout(500);
 // Exports
 const [d1]=await Promise.all([pg.waitForEvent('download'),pg.click('#bExport')]);const px=dl+'t.xlsx';await d1.saveAs(px);const wb=X.readFile(px);console.log('  sheets',wb.SheetNames.join(', '));const st=X.utils.sheet_to_json(wb.Sheets.Stages);ok(st.length===12&&st[0].vo2_L_min>2,'Stages sheet: '+JSON.stringify(st[0]).slice(0,240));const lf=X.utils.sheet_to_json(wb.Sheets['Long format']);ok(lf.some(r=>r.variable==='vo2peak'),'long format has VO2peak '+JSON.stringify(lf.find(r=>r.variable==='vo2peak')).slice(0,180));
 console.log('  settings',JSON.stringify(X.utils.sheet_to_json(wb.Sheets.Settings)).slice(0,300));
 const [d2]=await Promise.all([pg.waitForEvent('download'),pg.click('#bCsv')]);const pc=dl+'t.csv';await d2.saveAs(pc);console.log('  csv:',fs.readFileSync(pc,'utf8').split('\n').slice(0,2).join(' // ').slice(0,260));
 // Save and reopen
 const [d3]=await Promise.all([pg.waitForEvent('download'),pg.click('#bSave')]);const pj=dl+'t.json';await d3.saveAs(pj);console.log('  saved',(fs.statSync(pj).size/1024).toFixed(0),'kB');
 const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push('reopen: '+e.message));await pg2.goto(url);await pg2.setInputFiles('#fileIn',[pj]);await pg2.waitForSelector('#pv .main-svg');await pg2.waitForTimeout(600);await pg2.click('[data-tab=incremental]');await pg2.waitForTimeout(800);const t4=await pg2.evaluate(()=>LabApp.results().thr.map(r=>r.vo2_L_min));ok(t4[0]===th.vo2_L_min&&Math.abs(t4[1]-3.65)<1e-9,'reopened analysis keeps the lines: '+t4);await pg2.close();
 // Manual protocol and test type switch
 await pg.click('#dBox>summary').catch(()=>{});await pg.evaluate(()=>{document.getElementById('dBox').open=true;document.querySelectorAll('#dForm details').forEach(d=>d.open=true)});
 await pg.selectOption('#mType','prolonged');await pg.waitForTimeout(800);ok(await pg.evaluate(()=>LabApp.S.proto.type==='prolonged'),'test type can be overridden');await pg.selectOption('#mType','incremental');await pg.waitForTimeout(800);
 await pg.evaluate(()=>{document.querySelectorAll('#dForm details').forEach(d=>d.open=true)});await pg.fill('[data-b="0"][data-f=n]','7');await pg.dispatchEvent('[data-b="0"][data-f=n]','change');await pg.fill('[data-b="0"][data-f=dur]','3');await pg.dispatchEvent('[data-b="0"][data-f=dur]','change');await pg.fill('[data-b="0"][data-f=first]','9');await pg.dispatchEvent('[data-b="0"][data-f=first]','change');await pg.click('#bApply');await pg.waitForTimeout(800);ok(await pg.evaluate(()=>LabApp.S.proto.inc&&LabApp.S.proto.inc.stages.length===7&&LabApp.S.I.source==='manual'),'hand-entered protocol applied');
 await pg.close();
 // Dark mode, Pilot step tests with raw averaging
 const c2=await b.newContext({viewport:{width:1400,height:1000},colorScheme:'dark'});const p3=await c2.newPage();p3.on('pageerror',e=>errs.push(e.message));await p3.goto(url);await p3.setInputFiles('#fileIn',[f(/CPET_BxB/),f(/Admin/)]);await p3.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await p3.click('#bGo');await p3.waitForSelector('#pv .main-svg');await p3.waitForTimeout(1500);
 const bb=await (await p3.$('#pv')).boundingBox();await p3.evaluate(()=>document.getElementById('pv').scrollIntoView());await p3.waitForTimeout(300);const b3=await (await p3.$('#pv')).boundingBox();await p3.mouse.move(b3.x+400,b3.y+200);await p3.mouse.move(b3.x+420,b3.y+200);await p3.waitForTimeout(800);console.log('  cursor bxb:',await p3.$eval('#cur',e=>e.innerText));
 await p3.click('[data-j=t1]');await p3.waitForTimeout(800);console.log('  ro:',await p3.$eval('#ro',e=>e.innerText));await p3.evaluate(()=>window.scrollTo(0,0));await p3.click('#dBox>summary');await p3.waitForTimeout(200);await p3.screenshot({path:out+'x_dark_protocol.png'});
 await p3.click('[data-tab=steps]');await p3.waitForTimeout(1500);await p3.screenshot({path:out+'x_dark_steps.png'});
 console.log(' errors:',errs.length?errs:'none');await b.close();})().catch(e=>{console.error(e);process.exit(1)});
