// Lab presets (save, apply on load, export/import) and pasting lactate from Excel.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d='/home/claude/samples/',f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const ctx=await b.newContext({viewport:{width:1400,height:1000},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});const errs=[];
 const pg=await ctx.newPage();pg.on('pageerror',x=>errs.push(x.message));await pg.goto(url);
 const load=async(files,preset)=>{await pg.setInputFiles('#fileIn',files);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);if(preset!==undefined)await pg.selectOption('#sPreset',preset);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(500);};
 ok(await pg.$eval('#sPreset',e=>e.closest('.tools').hidden),'no preset menu before any preset exists');
 // cycling file without power: enter steps, change settings, save as preset
 await load([f(/Example_GXT/)]);
 const fill=async(id,v)=>{await pg.fill(id,String(v));};await fill('#plWm',5);await fill('#plS',100);await fill('#plI',25);await fill('#plD',3);await fill('#plE',26);await pg.click('#plGo');await pg.waitForTimeout(1500);
 await pg.evaluate(()=>{LabApp.S.set.inc.stageWin=30;LabApp.S.set.inc.peakWin=15;LabApp.S.set.lac={fit:'poly4',baseline:true,restrain:0.8,lt1:'Bsln + 0.5',lt2:'OBLA 4.0',show:true,series:{}};LabApp.S.meta.rep={title:'Test Clinic',protocol:'3 min stages, 25 W'};LabApp.S.meta.name='Should not be saved';});
 await pg.evaluate(()=>{document.getElementById('dBox').open=true});await pg.fill('#pName','Clinic bike');await pg.click('#pSave');await pg.waitForTimeout(300);
 const saved=await pg.evaluate(()=>JSON.parse(localStorage.getItem('labcpet.presets')));ok(saved.length===1&&saved[0].name==='Clinic bike'&&saved[0].set.plan&&saved[0].set.inc.stageWin===30&&saved[0].set.lac.fit==='poly4','preset saved with steps, windows and lactate settings');
 ok(!JSON.stringify(saved).includes('Should not be saved')&&!('picks' in saved[0]),'no participant data or thresholds in the preset');
 // new test with the preset chosen at load
 await pg.click('#bLoad');await pg.waitForTimeout(300);ok(!(await pg.$eval('#sPreset',e=>e.closest('.tools').hidden)),'preset menu on the load screen');
 await load([f(/Example_GXT/)],'Clinic bike');
 const st=await pg.evaluate(()=>({plan:!!LabApp.S.set.plan,sw:LabApp.S.set.inc.stageWin,pk:LabApp.S.set.inc.peakWin,fit:LabApp.S.set.lac.fit,lt1:LabApp.S.set.lac.lt1,title:(LabApp.S.meta.rep||{}).title,stages:(LabApp.S.proto.inc.stages||[]).length,toast:document.getElementById('toast')&&document.getElementById('toast').textContent}));
 console.log('  ',JSON.stringify(st));ok(st.plan&&st.sw===30&&st.pk===15&&st.fit==='poly4'&&st.lt1==='Bsln + 0.5'&&st.title==='Test Clinic'&&st.stages>5,'preset applied when loading');
 // a file with its own speed ignores the preset steps
 await pg.click('#bLoad');await load([f(/TREAD_CHAR/)],'Clinic bike');
 ok(await pg.evaluate(()=>!LabApp.S.set.plan&&LabApp.S.set.inc.stageWin===30),'steps not used on a file with its own speed; other settings are');
 // export and import
 await pg.evaluate(()=>{document.getElementById('dBox').open=true});const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#pExp')]);const pf=out+'presets.json';await dl.saveAs(pf);
 await pg.evaluate(()=>localStorage.setItem('labcpet.presets','[]'));await pg.evaluate(()=>{});
 const [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#pImp')]);await fc.setFiles(pf);await pg.waitForTimeout(500);
 ok(await pg.evaluate(()=>JSON.parse(localStorage.getItem('labcpet.presets')).length)===1&&/Imported 1 preset/.test(await pg.$eval('#pMsg',e=>e.textContent)),'export and import presets');
 // paste lactate: three columns (lactate, HR, RPE) into stage 1
 await pg.click('[data-tab=lactate]');await pg.waitForTimeout(500);
 await pg.click('[data-lk="la:0"]');await pg.evaluate(()=>{const el=document.querySelector('[data-lk="la:0"]');const dt=new DataTransfer();dt.setData('text/plain','1,1\t130\t9\r\n1.3\t140\t10\r\n1.9\t150\t12\r\n2.8\t160\t13\r\n');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
 await pg.waitForTimeout(400);
 const rows=await pg.evaluate(()=>LabApp.S.set.lac.series.inc.rows);console.log('  ',JSON.stringify(rows));
 ok(rows[0].la===1.1&&rows[0].hr===130&&rows[0].rpe===9&&rows[3].la===2.8&&rows[3].rpe===13,'pasted values fill down and across (comma decimals too)');
 ok(/Pasted 12 values/.test(await pg.$eval('#lmsg0',e=>e.textContent)),'paste message');
 await pg.click('[data-lk="la:b"]');await pg.evaluate(()=>{const el=document.querySelector('[data-lk="la:b"]');const dt=new DataTransfer();dt.setData('text/plain','0.8\n1.0\n1.2');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});await pg.waitForTimeout(400);
 const r2=await pg.evaluate(()=>[LabApp.S.set.lac.series.inc.base.la,LabApp.S.set.lac.series.inc.rows[0].la,LabApp.S.set.lac.series.inc.rows[1].la]);ok(JSON.stringify(r2)==='[0.8,1,1.2]','paste starting at the baseline');
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
