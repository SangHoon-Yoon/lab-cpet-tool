// Incremental tab: highlight the analysis window on a time chart.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d=require('./paths').SAMPLES,f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const ctx=await b.newContext({viewport:{width:1400,height:1100}});const errs=[];
 const open=async files=>{const pg=await ctx.newPage();pg.on('pageerror',x=>errs.push(x.message));await pg.goto(url);await pg.setInputFiles('#fileIn',files);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');await pg.click('[data-tab=incremental]');await pg.waitForTimeout(2500);return pg;};
 const win=pg=>pg.evaluate(()=>[LabApp.S.D.inc.t0,LabApp.S.D.inc.t1,+LabApp.S.D.inc.sugg?.vt1?.toFixed?.(2)||null]);
 const px=(pg,m)=>pg.evaluate(m=>{const gd=document.getElementById('iSelC');const xa=gd._fullLayout.xaxis,r=gd.getBoundingClientRect();return{x:r.left+xa._offset+xa.l2p(m),y:r.top+gd._fullLayout.margin.t+60}},m);
 for(const [nm,file] of [['GXT',f(/TREAD_CHAR/)],['two-phase',f(/TWO_PHASE/)]]){
  const pg=await open([file]);await pg.evaluate(()=>document.getElementById('iSelC').scrollIntoView({block:'center'}));await pg.waitForTimeout(200);
  const w0=await win(pg);console.log(' '+nm+' default',JSON.stringify(w0));ok(await pg.$$eval('#iSelC .shapelayer path',p=>p.length)>2,nm+': window highlighted on the time chart');
  const a=Math.ceil(w0[0]/60)+2,bb=Math.floor(w0[1]/60)-1;let p1=await px(pg,a),p2=await px(pg,bb);
  await pg.mouse.move(p1.x,p1.y);await pg.mouse.down();await pg.mouse.move(p2.x,p2.y,{steps:5});await pg.mouse.up();await pg.waitForTimeout(2500);
  const w1=await win(pg);ok(Math.abs(w1[0]-a*60)<8&&Math.abs(w1[1]-bb*60)<8,nm+': drag sets the window '+JSON.stringify(w1));ok(await pg.$eval('#cA',(e,w)=>Math.abs(+e.value-(w/60))<0.01,w1[0]),nm+': typed boxes follow');
  p2=await px(pg,w1[1]/60);const p3=await px(pg,w0[1]/60);await pg.mouse.move(p2.x-1,p2.y);await pg.mouse.down();await pg.mouse.move(p3.x,p3.y,{steps:5});await pg.mouse.up();await pg.waitForTimeout(2500);
  const w2=await win(pg);ok(Math.abs(w2[0]-w1[0])<2&&Math.abs(w2[1]-w0[1])<8,nm+': dragging the right side extends it '+JSON.stringify(w2));
  const pc=await px(pg,0.5);await pg.mouse.click(pc.x,pc.y);await pg.waitForTimeout(2500);const w3=await win(pg);ok(w3[0]===w0[0]&&w3[1]===w0[1],nm+': click elsewhere returns to the default window');
  await pg.screenshot({path:out+'inc_sel_'+nm+'.png',clip:{x:0,y:0,width:1400,height:900}});await pg.close();
 }
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
