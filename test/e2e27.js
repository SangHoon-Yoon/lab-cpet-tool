// Start page choices (0.26.0): which test, running or cycling, which data; the tabs that follow; lactate only with no gas file. Uses the example file only.
const {chromium}=require('playwright'),path=require('path'),fs=require('fs'),os=require('os');
const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/',tmp=fs.mkdtempSync(path.join(os.tmpdir(),'labcpet-'));fs.mkdirSync(out,{recursive:true});
let fail=0;const ok=(c,m)=>{console.log((c?'  ok ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch(),ctx=await b.newContext({viewport:{width:1300,height:1000},acceptDownloads:true}),pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 const tabs=()=>pg.$$eval('[data-tab]',x=>x.map(e=>e.dataset.tab).join(','));
 const load=async file=>{if(file){await pg.setInputFiles('#fileIn',file);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled);}await pg.click('#bGo');await pg.waitForTimeout(1500);};
 await pg.goto(url);
 ok(await pg.$$eval('[data-ch][aria-pressed=true]',x=>x.length)===0&&await pg.$eval('#bGo',e=>e.disabled),'nothing chosen at first, Continue waits for a file');
 const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#bExampleFile')]);const ex=path.join(tmp,dl.suggestedFilename());await dl.saveAs(ex);
 // no choices: works as before
 await load(ex);ok(await tabs()==='protocol,incremental,lactate,summary','no choices: every tab, test worked out from the file: '+await tabs());
 // gas only
 await pg.click('#bLoad');await pg.click('[data-ch="test:inc"]');await pg.click('[data-ch="sport:cycle"]');await pg.click('[data-ch="data:gas"]');await pg.screenshot({path:out+'zz_start.png',fullPage:true});
 await load(ex);ok(await tabs()==='protocol,incremental,summary','gas only: no Lactate tab: '+await tabs());
 ok(!/Lactate/.test(await pg.$eval('#guide',e=>e.innerText)),'guided steps leave lactate out');
 // choices are remembered; durability hides the data question
 await pg.click('#bLoad');ok(await pg.$eval('[data-ch="data:gas"]',e=>e.getAttribute('aria-pressed'))==='true','choices are remembered');
 await pg.click('[data-ch="test:dur"]');ok(await pg.$eval('#chData',e=>e.hidden),'durability test: no data question');await pg.click('[data-ch="test:inc"]');
 // lactate only with the COSMED file: heart rate filled in, no gas thresholds tab
 await pg.click('[data-ch="data:lac"]');await load(ex);ok(await tabs()==='protocol,lactate,summary','lactate only with a file: Protocol, Lactate, Summary: '+await tabs());
 await pg.click('[data-tab=lactate]');await pg.waitForTimeout(600);ok(+(await pg.$eval('[data-lk="hr:0"]',e=>e.value))>80,'heart rate filled in from the file');
 // running chosen, cycling file
 await pg.click('#bLoad');await pg.click('[data-ch="sport:run"]');await load(ex);await pg.waitForTimeout(200);ok(/You chose running/.test(await pg.$eval('#toast',e=>e.textContent)),'says when the file does not match the choice');
 // lactate only, no gas file
 await pg.click('#bLoad');ok(!(await pg.$eval('#bGo',e=>e.disabled))&&/without a gas file/.test(await pg.$eval('#bGo',e=>e.textContent)),'lactate only: Continue without a gas file');
 await load(null);ok(await tabs()==='lactate,summary','no gas file: Lactate and Summary only: '+await tabs());
 ok(await pg.$eval('#qBox',e=>e.hidden)&&await pg.$('#nsGo')!==null,'asks for the stages, no Data processing box');
 await pg.fill('#mName','Example Runner');await pg.keyboard.press('Tab');await pg.waitForTimeout(300);
 await pg.evaluate(()=>{document.querySelector('#sBox').open=true;document.querySelector('#planD').open=true;});ok(await pg.$eval('#plU',e=>e.value)==='km/h','running: steps in km/h');
 await pg.fill('#plS','10');await pg.fill('#plI','1');await pg.fill('#plD','3');await pg.fill('#plE','22.5');await pg.click('#plGo');await pg.waitForTimeout(1200);
 const rows=await pg.$$eval('.lacT tbody tr',x=>x.length);ok(rows===9,'a row for the baseline and each of 8 stages: '+rows);
 await pg.click('[data-lk="la:b"]');await pg.keyboard.type('0.9');await pg.keyboard.press('Enter');for(const v of [1.0,1.1,1.0,1.2,1.6,2.4,4.1,6.5]){await pg.keyboard.type(String(v));await pg.keyboard.press('Enter');await pg.waitForTimeout(120);}
 await pg.click('[data-lk="hr:0"]');for(const v of [120,131,142,151,160,169,177,184]){await pg.keyboard.type(String(v));await pg.keyboard.press('Enter');await pg.waitForTimeout(120);}
 await pg.waitForTimeout(500);const lt=await pg.evaluate(()=>LabApp.results().thr.map(x=>[x.threshold,x.intensity_stage,x.hr_bpm]));ok(lt.length===2&&lt[0][1]>11&&lt[1][1]>lt[0][1]&&lt[0][2]>120,'LT1 and LT2 with speed and typed heart rate: '+JSON.stringify(lt));
 await pg.screenshot({path:out+'zz_lac_only.png',fullPage:true});
 await pg.click('[data-tab=summary]');await pg.waitForTimeout(500);ok(/1[2-3]\.\d/.test(await pg.$eval('#views table',e=>e.innerText)),'summary shows the speed at LT');
 await pg.evaluate(()=>{document.querySelector('details[data-fold=rep]').open=true;});await pg.waitForTimeout(300);
 ok(await pg.$eval('[data-rfig=cGas]',e=>e.disabled)&&await pg.$eval('[data-rfig=cLac]',e=>e.checked),'client report: lactate figure, no gas figure');
 for(const [btn,nm] of [['#rClient','client'],['#rResearch','research']]){const [d]=await Promise.all([pg.waitForEvent('download'),pg.click(btn)]);ok(fs.statSync(await d.path()).size>50000,nm+' report generated');await pg.waitForTimeout(300);}
 const [dx]=await Promise.all([pg.waitForEvent('download'),pg.click('#bExport')]);ok(/results\.xlsx$/.test(dx.suggestedFilename()),'Excel export');
 // save, reopen
 const [ds]=await Promise.all([pg.waitForEvent('download'),pg.click('#bSave')]);const sv=path.join(tmp,'lo.json');await ds.saveAs(sv);
 await pg.reload();await pg.setInputFiles('#fileIn',sv);await pg.waitForTimeout(1500);
 const re=await pg.evaluate(()=>({tabs:[...document.querySelectorAll('[data-tab]')].map(e=>e.dataset.tab).join(','),n:LabApp.results().thr.length,name:LabApp.S.meta.name}));ok(re.tabs==='lactate,summary'&&re.n===2&&re.name==='Example Runner','saved analysis reopens: '+JSON.stringify(re));
 // the example still loads as a full test whatever is chosen
 await pg.click('#bLoad');await pg.click('#bExample');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(800);ok(await tabs()==='protocol,incremental,lactate,summary','example: every tab');
 console.log(' errors:',errs.length?errs.join(' | '):'none');if(errs.length)fail++;
 await b.close();console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);})();
