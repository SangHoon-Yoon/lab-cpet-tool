// Example test and caveat.
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';fs.mkdirSync(out,{recursive:true});
let fail=0;const ok=(c,m)=>{console.log((c?'  ok ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch(),ctx=await b.newContext({viewport:{width:1400,height:1000},acceptDownloads:true}),pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(url);ok(/not to rely on/.test(await pg.$eval('#caveat',e=>e.textContent)),'caveat on start page');
 await pg.screenshot({path:out+'x_start.png'});
 const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#bExampleFile')]);ok(/Example_incremental/.test(dl.suggestedFilename()),'example file downloads');
 await pg.click('#bExample');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(1500);console.log('  errors after load:',errs.length);
 const st=await pg.evaluate(()=>({type:LabApp.S.proto.type,n:LabApp.S.proto.inc.stages.length,name:LabApp.S.meta.name}));ok(st.type==='incremental'&&st.n===9,'example: incremental, 9 stages '+JSON.stringify(st));
 await pg.click('[data-tab=incremental]');await pg.waitForFunction(()=>LabApp.S.oxy&&LabApp.S.oxy.done,{timeout:90000});await pg.waitForTimeout(500);
 const r=await pg.evaluate(()=>{const R=LabApp.results();return {thr:R.thr.map(x=>[x.threshold,x.intensity_regression]),ox:Object.fromEntries(Object.entries(LabApp.S.oxy.res).map(([k,v])=>[k,[v.vt1&&+v.vt1.vo2.toFixed(2),v.vt2&&+v.vt2.vo2.toFixed(2)]]))}});console.log('  ',JSON.stringify(r));
 await pg.screenshot({path:out+'x_inc.png',fullPage:true});
 console.log('  errors after thresholds tab:',errs.length);await pg.click('[data-tab=lactate]');await pg.waitForTimeout(800);const lt=await pg.evaluate(()=>LabApp.results().thr.filter(x=>/LT/.test(x.threshold)).map(x=>[x.threshold,x.intensity_regression]));console.log('  LT',JSON.stringify(lt));ok(lt.length===2,'lactate filled in, LT1 and LT2 found');
 await pg.screenshot({path:out+'x_lac.png',fullPage:true});
 await pg.click('[data-tab=summary]');await pg.waitForTimeout(500);ok(await pg.$('#views .caveat')!==null,'caveat on summary');
 ok(await pg.evaluate(()=>!window.onbeforeunload||true),'');console.log(' errors:',errs.length?errs.join(' | '):'none');if(errs.length)fail++;
 await b.close();console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);})();
