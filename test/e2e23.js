// Threshold status: suggested until moved or confirmed; shown on tiles, tables, summary, export and reports.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d=require('./paths').SAMPLES,f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const ctx=await b.newContext({viewport:{width:1400,height:1000}});const errs=[];
 const pg=await ctx.newPage();pg.on('pageerror',x=>errs.push(x.message));await pg.goto(url);
 const load=async files=>{await pg.setInputFiles('#fileIn',files);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(500);};
 const thr=()=>pg.evaluate(()=>LabApp.results().thr.map(r=>[r.test,r.threshold,r.status,r.source]));
 await load([f(/TREAD_CHAR/)]);await pg.click('[data-tab=incremental]');await pg.waitForTimeout(2500);
 ok(/suggested, not checked/.test(await pg.$eval('#tiles .vt1b',e=>e.innerText)),'VT1 tile: suggested, not checked');
 let t=await thr();console.log('  ',JSON.stringify(t));ok(t.every(r=>r[2]==='suggested, not checked'),'export status: suggested');
 await pg.click('#tiles .vt1b [data-conf]');await pg.waitForTimeout(800);
 ok(/✓ checked/.test(await pg.$eval('#tiles .vt1b',e=>e.innerText)),'Confirm turns it to checked');t=await thr();ok(t[0][2]==='checked'&&t[0][3]==='suggestion, confirmed','export: checked, suggestion confirmed');
 const v2=await pg.evaluate(()=>LabApp.S.picks.inc.vt2);
 // dragging a line also checks it: use a Use button for VT2 if present, else type
 await pg.click('[data-tab=summary]');await pg.waitForTimeout(500);const wl=await pg.$eval('#views',e=>{const w=e.querySelector('.warnline');return w?w.innerText:''});console.log('  summary:',wl);
 ok(await pg.$$eval('#views table .tstat',x=>x.length)>=1,'summary table shows status');
 await pg.close();
 // step tests
 const p2=await ctx.newPage();p2.on('pageerror',x=>errs.push(x.message));await p2.goto(url);await p2.setInputFiles('#fileIn',fs.readdirSync(d).filter(x=>/MORNING/.test(x)).map(x=>d+x));await p2.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await p2.waitForTimeout(300);await p2.click('#bGo');await p2.waitForSelector('#pv .main-svg');
 await p2.click('[data-tab=steps]');await p2.waitForTimeout(1500);ok(await p2.$$eval('#vt1T .tstat.sug',x=>x.length)===2,'step tests: both VT1 suggested');
 await p2.click('#vt1T [data-conf="test:1:vt1"]');await p2.waitForTimeout(800);const st=await p2.evaluate(()=>LabApp.results().thr.map(r=>r.status+'|'+r.source));console.log('  ',JSON.stringify(st));ok(st[0].startsWith('suggested')&&st[1]==='checked|suggestion, confirmed','confirming test 2 only');
 await p2.fill('[data-tv="vt1:0"]','2.9');await p2.dispatchEvent('[data-tv="vt1:0"]','change');await p2.waitForTimeout(800);ok((await p2.evaluate(()=>LabApp.results().thr[0].status))==='checked','typing a value makes it checked');
 // lactate
 await p2.click('[data-tab=lactate]');await p2.waitForTimeout(500);for(const [k,v] of [['la:b',1],['la:0',1.1],['la:1',1.3],['la:2',1.8],['la:3',2.9],['la:4',4.6]]){await p2.fill(`[data-lk="${k}"]`,String(v));await p2.dispatchEvent(`[data-lk="${k}"]`,'change');await p2.waitForTimeout(200);}
 ok(/suggested, not checked/.test(await p2.$eval('#lt0',e=>e.innerText)),'LT tiles suggested');await p2.click('#lt0 [data-conf$=":lt1"]');await p2.waitForTimeout(600);
 const lt=await p2.evaluate(()=>LabApp.results().thr.filter(r=>/^LT/.test(r.threshold)).map(r=>r.threshold+'|'+r.status+'|'+r.source));console.log('  ',JSON.stringify(lt));ok(lt.some(x=>x==='LT1|checked|Bsln + 0.5, confirmed'),'LT1 confirmed');
 await p2.screenshot({path:out+'status_lac.png',clip:{x:0,y:0,width:1400,height:900}});
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
