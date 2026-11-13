// Lactate tab: entry, methods (checked against Exphyslab), LT lines, copy to and from the gas thresholds.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d=require('./paths').SAMPLES,f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const ctx=await b.newContext({viewport:{width:1400,height:1000}});const errs=[];
 const open=async files=>{const pg=await ctx.newPage();pg.on('pageerror',x=>errs.push(x.message));await pg.goto(url);await pg.setInputFiles('#fileIn',files);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(400);return pg;};
 // Treadmill incremental, lactate typed for the first stages
 let pg=await open([f(/TREAD_CHAR/)]);
 await pg.click('[data-tab=lactate]');await pg.waitForTimeout(600);
 ok(await pg.$$eval('.lacT tbody tr',x=>x.length)>5,'a row per stage plus the baseline');
 const typ=async(k,v)=>{await pg.fill(`[data-lk="${k}"]`,String(v));await pg.dispatchEvent(`[data-lk="${k}"]`,'change');await pg.waitForTimeout(250);};
 const la=[1.1,1.2,1.4,1.9,2.6,3.6,5.2];await typ('la:b',0.9);for(let i=0;i<la.length;i++)await typ('la:'+i,la[i]);
 await pg.waitForTimeout(500);
 const tl=await pg.$eval('#lt0',e=>e.innerText);console.log(' tiles:',tl.replace(/\n/g,' | '));ok(/LT1 · Bsln \+ 0\.5 \(default\)/.test(tl)&&/LT2 · ModDmax \(default\)/.test(tl),'LT1 Bsln + 0.5 and LT2 ModDmax by default');
 ok(/min\/km/.test(tl),'treadmill shows pace');
 const n=await pg.$$eval('#lmT0 tbody tr',x=>x.length);ok(n===17,'all 17 methods listed: '+n);
 // use a method as LT2
 await pg.click('details[data-fold=lm0] summary');await pg.click('#lmT0 [data-luse^="lt2:"][data-luse$=":OBLA 4.0"]');await pg.waitForTimeout(300);ok(/LT2 · OBLA 4.0/.test(await pg.$eval('#lt0',e=>e.innerText)),'Use as LT2 works');
 // copy LT to gas, then check the incremental tab
 await pg.click('#lcpTo0');await pg.waitForTimeout(400);const src=await pg.evaluate(()=>LabApp.S.picks.incSrc);ok(src.vt1==='Lactate LT1'&&src.vt2==='Lactate LT2','LT copied to VT: '+JSON.stringify(src));
 const ltp=await pg.evaluate(()=>{const f=LabApp.S.D.inc.fit,v=LabApp.S.picks.inc;return [f.m*v.vt1+f.b,f.m*v.vt2+f.b]});console.log('  VT as speed',ltp.map(x=>x.toFixed(2)));
 ok(await pg.$$eval('#lc0 .shapelayer path',x=>x.length)>=2,'gas VT lines drawn on the lactate chart');
 // copy VT back after moving VT1
 await pg.evaluate(()=>{LabApp.S.picks.inc.vt1=2.9;});await pg.click('#lcpFrom0');await pg.waitForTimeout(400);
 const lt1=await pg.evaluate(()=>LabApp.S.picks.lt.inc.lt1),exp1=await pg.evaluate(()=>{const f=LabApp.S.D.inc.fit;return f.m*2.9+f.b});ok(Math.abs(lt1-exp1)<0.01,'VT1 copied to LT1 through the regression');
 // Ctrl+Z undoes the copy
 await pg.mouse.click(5,700);await pg.keyboard.press('Control+z');await pg.waitForTimeout(800);ok(Math.abs((await pg.evaluate(()=>((LabApp.S.picks.lt||{}).inc||{}).lt1??-99))-exp1)>0.01,'undo reverts the copy');
 await pg.screenshot({path:out+'lactate_tab.png',fullPage:true});
 // export has LT rows
 const thr=await pg.evaluate(()=>LabApp.results().thr.map(r=>r.threshold+':'+r.source));console.log('  thr',thr.join(', '));ok(thr.some(x=>/^LT1/.test(x))&&thr.some(x=>/^LT2/.test(x)),'export includes LT1 and LT2');
 ok(/lactater/.test(await pg.evaluate(()=>LabApp.methodsText())),'methods paragraph mentions lactater');
 await pg.close();
 // Exphyslab check: enter the lactater demo data by hand on a cycling file
 pg=await open([f(/Example_GXT/)]);await pg.click('[data-tab=lactate]');await pg.waitForTimeout(500);
 const P=[50,75,100,125,150,175,191.67],LA=[0.98,1.23,1.88,2.80,4.21,6.66,8.64],HR=[114,134,154,170,182,193,198];
 await typ('la:b',0.93);for(let i=0;i<P.length;i++){await pg.click('[data-ladd="0"]');await pg.waitForTimeout(150);await typ('p:x'+i,P[i]);await typ('la:x'+i,LA[i]);await typ('hr:x'+i,HR[i]);}
 const res=await pg.evaluate(()=>{const se=LabApp._lac.series()[0];return LabApp._lac.analyse(se).methods.map(m=>[m.name,m.p,m.hr])});
 const ex={'Log-log':83.7,'OBLA 2.0':104.6,'OBLA 2.5':117.9,'OBLA 3.0':128.8,'OBLA 3.5':137,'OBLA 4.0':145.2,'Bsln + 0.5':81.6,'Bsln + 1.0':102.7,'Bsln + 1.5':116,'Dmax':131.1,'ModDmax':139.9,'Exp-Dmax':135,'Log-Poly-ModDmax':143.1};
 const diffs=res.filter(r=>ex[r[0]]!==undefined).map(r=>[r[0],r[1],ex[r[0]],+(r[1]-ex[r[0]]).toFixed(2)]);console.log('  vs Exphyslab',JSON.stringify(diffs.filter(x=>x[3]!==0)));
 ok(diffs.every(x=>Math.abs(x[3])<=0.11),'all 13 methods within 0.1 W of Exphyslab');
 await pg.close();
 // Step tests: one lactate curve per test
 pg=await open(fs.readdirSync(d).filter(x=>/MORNING/.test(x)).map(x=>d+x));await pg.click('[data-tab=lactate]');await pg.waitForTimeout(600);
 const np=await pg.$$eval('.lacT',x=>x.length);ok(np===2,'a lactate table for each step test: '+np);
 await typ('la:b',1.0);for(const [i,v] of [[0,1.1],[1,1.3],[2,1.8],[3,2.9],[4,4.6]].entries())await typ('la:'+v[0],v[1]);
 const t2=await pg.$eval('#lt0',e=>e.innerText);console.log('  step test 1:',t2.replace(/\n/g,' | '));ok(/km\/h|W/.test(t2)&&!/enter lactate/.test(t2),'step test 1 gets LT1 and LT2');
 ok(await pg.$eval('#lt1',e=>/enter lactate/.test(e.innerText)),'step test 2 untouched');
 await pg.click('#lcpTo0');await pg.waitForTimeout(400);ok(await pg.evaluate(()=>LabApp.S.set.st.vt2&&Object.values(LabApp.S.picks.tests).length>=1),'copying to the gas charts sets VT1 and turns on VT2 for step tests');
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
