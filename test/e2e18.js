// Word reports: client (clinic template) and research. Saves the files to test/shots for a visual check.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d=require('./paths').SAMPLES,f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const ctx=await b.newContext({viewport:{width:1400,height:1000},acceptDownloads:true});const errs=[];
 const open=async files=>{const pg=await ctx.newPage();pg.on('pageerror',x=>errs.push(x.message));await pg.goto(url);await pg.setInputFiles('#fileIn',files);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(400);return pg;};
 const typ=async(pg,k,v)=>{await pg.fill(`[data-lk="${k}"]`,String(v));await pg.dispatchEvent(`[data-lk="${k}"]`,'change');await pg.waitForTimeout(200);};
 let pg=await open([f(/TREAD_CHAR/)]);
 await pg.click('[data-tab=lactate]');await pg.waitForTimeout(500);
 const la=[1.1,1.2,1.4,1.9,2.6,3.6,5.2];await typ(pg,'la:b',0.9);await typ(pg,'hr:b',62);for(let i=0;i<la.length;i++){await typ(pg,'la:'+i,la[i]);await typ(pg,'rpe:'+i,8+i);}
 await pg.click('[data-tab=summary]');await pg.waitForTimeout(500);await pg.click('details[data-fold=rep] summary');await pg.waitForTimeout(200);
 ok(await pg.$eval('#rSrc',e=>e.value)==='lactate','lactate thresholds chosen when lactate was entered');
 await pg.fill('#rTester','Andrew Yoon');await pg.dispatchEvent('#rTester','change');await pg.fill('#rDob','01/02/1995');await pg.dispatchEvent('#rDob','change');
 console.log('  protocol:',JSON.stringify(await pg.$eval('#rProt',e=>e.value)));
 for(const [id,nm] of [['#rClient','client'],['#rResearch','research']]){const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:60000}),pg.click(id)]);const p=out+nm+'_report.docx';await dl.saveAs(p);const sz=fs.statSync(p).size;ok(sz>20000,nm+' report saved: '+sz+' bytes');console.log('  ',await pg.$eval('#rMsg',e=>e.textContent));}
 ok(await pg.evaluate(()=>{try{return localStorage.getItem('labcpet.tester')}catch(e){return null}})==='Andrew Yoon','tester remembered for next time');
 await pg.close();
 // gas-only client report (no lactate), cycling file with entered steps
 pg=await open([f(/TWO_PHASE/)]);await pg.click('[data-tab=summary]');await pg.waitForTimeout(500);await pg.click('details[data-fold=rep] summary');
 ok(await pg.$eval('#rSrc',e=>e.value)==='gas','gas thresholds when no lactate');
 {const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:60000}),pg.click('#rClient')]);await dl.saveAs(out+'client_gas_report.docx');ok(fs.statSync(out+'client_gas_report.docx').size>20000,'gas client report saved');}
 await pg.close();
 // step tests: research report only
 pg=await open(fs.readdirSync(d).filter(x=>/MORNING/.test(x)).map(x=>d+x));await pg.click('[data-tab=summary]');await pg.waitForTimeout(500);await pg.click('details[data-fold=rep] summary');
 ok(await pg.$eval('#rClient',e=>e.disabled),'client report off for step tests');
 {const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:60000}),pg.click('#rResearch')]);await dl.saveAs(out+'research_steps_report.docx');ok(fs.statSync(out+'research_steps_report.docx').size>5000,'step-test research report saved');}
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
