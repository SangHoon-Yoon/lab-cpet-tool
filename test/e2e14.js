// Oxynet charts: "Use these lines" moves VT1/VT2; (i) explains the model.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d=require('./paths').SAMPLES,f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const ctx=await b.newContext({viewport:{width:1400,height:1100}});const errs=[];
 const open=async file=>{const pg=await ctx.newPage();pg.on('pageerror',x=>errs.push(x.message));await pg.goto(url);await pg.setInputFiles('#fileIn',[file]);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');await pg.click('[data-tab=incremental]');await pg.waitForFunction(()=>LabApp.S.oxy&&LabApp.S.oxy.done,{timeout:120000});await pg.waitForTimeout(800);return pg;};
 for(const [nm,file] of [['GXT',f(/TREAD_CHAR/)],['two-phase',f(/TWO_PHASE/)]]){
  const pg=await open(file);
  for(const m of ['lstm','cnn']){
   const st=await pg.evaluate(m=>{const r=LabApp.S.oxy.res[m];return{dis:document.getElementById('oxUse_'+m).disabled,prob:r.problem||null,v1:r.vt1&&r.vt1.vo2,v2:r.vt2&&r.vt2.vo2}},m);console.log(' ',nm,m,JSON.stringify(st));
   if(st.dis){ok(!!st.prob||nm==='two-phase',nm+' '+m+': button off only when the model gave nothing usable');continue;}
   await pg.click('#oxUse_'+m);await pg.waitForTimeout(500);
   const p=await pg.evaluate(()=>({inc:LabApp.S.picks.inc,src:LabApp.S.picks.incSrc,note:null}));const note=await pg.$eval('#oxm_'+m,e=>e.textContent);console.log('   ',JSON.stringify(p),note);
   ok(p.src.vt1==='Oxynet '+m.toUpperCase()&&Math.abs(p.inc.vt1-st.v1)<0.001,nm+' '+m+': VT1 moved to the model value');
   ok(nm==='two-phase'||Math.abs(p.inc.vt2-st.v2)<0.001,nm+' '+m+': VT2 moved too');
   const line=await pg.evaluate(()=>{const l=document.querySelector('#vc_vs .vtov [data-q=vt1]');return l&&+l.dataset.x});ok(Math.abs(line-p.inc.vt1)<0.01,nm+' '+m+': V-slope line shifted');
   const thr=await pg.evaluate(()=>LabApp.results().thr.filter(r=>r.test==='incremental').map(r=>r.source));ok(thr[0]==='Oxynet '+m.toUpperCase(),nm+' '+m+': export names the source');
  }
  await pg.click('#oxh_lstm .ib');await pg.waitForTimeout(150);ok(/one second at a time/.test(await pg.$eval('#ipop',e=>e.innerText)),nm+': LSTM (i) explains the model');await pg.keyboard.press('Escape');
  await pg.click('#oxh_cnn .ib');await pg.waitForTimeout(150);ok(/templates/.test(await pg.$eval('#ipop',e=>e.innerText)),nm+': CNN (i) explains the model');
  await pg.evaluate(()=>document.getElementById('oxh_cnn').scrollIntoView({block:'start'}));await pg.waitForTimeout(200);await pg.screenshot({path:out+'oxy_use_'+nm+'.png'});await pg.close();
 }
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
