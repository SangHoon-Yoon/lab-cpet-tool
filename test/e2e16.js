// Undo/redo with Ctrl+Z; unsaved-work warning.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d=require('./paths').SAMPLES,f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html');
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const ctx=await b.newContext({viewport:{width:1400,height:1000},acceptDownloads:true});const errs=[];
 const pg=await ctx.newPage();pg.on('pageerror',x=>errs.push(x.message));await pg.goto(url);await pg.setInputFiles('#fileIn',[f(/TREAD_CHAR/)]);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');
 await pg.click('[data-tab=incremental]');await pg.waitForFunction(()=>LabApp.S.oxy&&LabApp.S.oxy.done,{timeout:90000});await pg.waitForTimeout(800);
 const vt=()=>pg.evaluate(()=>[LabApp.S.picks.inc.vt1??null,LabApp.S.picks.inc.vt2??null]);
 const uses=await pg.$$('[data-use^="vt1:"]');await uses[0].click();await pg.waitForTimeout(700);const a=await vt();
 await uses.length>1&&(await pg.$$('[data-use^="vt1:"]'))[1].click();await pg.waitForTimeout(700);const b2=await vt();ok(a[0]!==b2[0],'two different VT1 picks: '+a[0]+' then '+b2[0]);
 await pg.mouse.click(5,600);await pg.keyboard.press('Control+z');await pg.waitForTimeout(1200);ok((await vt())[0]===a[0],'Ctrl+Z goes back one step');
 ok(await pg.$eval('#toast',e=>e.textContent)==='Undone','shows Undone');
 await pg.keyboard.press('Control+z');await pg.waitForTimeout(1200);ok((await vt())[0]===null,'Ctrl+Z again goes back to the start');
 await pg.keyboard.press('Control+Shift+z');await pg.waitForTimeout(1200);ok((await vt())[0]===a[0],'Ctrl+Shift+Z redoes');
 await pg.keyboard.press('Control+y');await pg.waitForTimeout(1200);ok((await vt())[0]===b2[0],'Ctrl+Y redoes');
 ok(await pg.evaluate(()=>!!document.querySelector('[data-tab=incremental][aria-selected=true]')),'stays on the same tab');
 // highlight window change and undo
 const w0=await pg.evaluate(()=>LabApp.S.D.inc.t0);await pg.fill('#cA','4');await pg.dispatchEvent('#cA','change');await pg.waitForTimeout(1500);await pg.mouse.click(5,600);await pg.waitForTimeout(600);ok(await pg.evaluate(()=>LabApp.S.D.inc.t0)===240,'window changed');
 await pg.keyboard.press('Control+z');await pg.waitForTimeout(1500);ok(await pg.evaluate(()=>LabApp.S.D.inc.t0)===w0,'undo restores the window');
 // unsaved warning
 const unsaved=()=>pg.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;});
 ok(await unsaved(),'warns about unsaved changes');
 const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#bSave')]);await pg.waitForTimeout(300);ok(!(await unsaved()),'no warning right after saving');
 await (await pg.$$('[data-use^="vt1:"]'))[0].click();await pg.waitForTimeout(700);ok(await unsaved(),'warns again after a new change');
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
