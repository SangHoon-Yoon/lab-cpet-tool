const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const dir='/home/claude/samples/',f=re=>dir+fs.readdirSync(dir).find(x=>re.test(x)),sim=path.resolve(__dirname,'sim')+'/';
const page_url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const cases={tread:[f(/TREAD_CHAR/)],cyc5:[f(/CPET_BxB/),f(/Admin/)],cycinc:[sim+'sim_cycle_incremental_COSMED.xlsx',sim+'sim_cycle_incremental_Lode.xlsx'],run5:[sim+'sim_run_5ST_60min_5ST_COSMED.xlsx']};
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const only=process.argv[2];
 for(const [name,files] of Object.entries(cases)){ if(only&&only!==name)continue;
  const pg=await b.newPage({viewport:{width:1400,height:1000}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto(page_url);await pg.setInputFiles('#fileIn',files);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);
  console.log(name,await pg.$eval('#flist',e=>e.innerText.replace(/\n/g,' | ')));
  await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg',{timeout:60000});await pg.waitForTimeout(1200);
  await pg.screenshot({path:out+name+'_1_protocol.png',fullPage:true});
  console.log(' sum:',await pg.$eval('#dSum',e=>e.innerText));console.log(' checks:',await pg.$eval('#chk',e=>e.innerText.replace(/\n/g,' ')));
  // interactions: zoom button, cursor
  const rng=await pg.evaluate(()=>document.getElementById('pv')._fullLayout.xaxis.range);console.log(' zoom range',rng.map(x=>+x.toFixed(1)));
  const box=await (await pg.$('#pv')).boundingBox();await pg.mouse.move(box.x+500,box.y+200);await pg.waitForTimeout(150);console.log(' cursor:',await pg.$eval('#cur',e=>e.innerText));
  const tabs=await pg.$$eval('#tabs button[data-tab]',a=>a.map(x=>x.dataset.tab));
  await pg.click('#dBox>summary');
  for(const t of tabs.slice(1)){await pg.click(`[data-tab=${t}]`);await pg.waitForTimeout(1200);await pg.screenshot({path:out+name+'_'+t+'.png',fullPage:true});}
  await pg.click('[data-tab='+tabs[1]+']');await pg.waitForTimeout(600);
  const res=await pg.evaluate(()=>{const r=LabApp.results();return{rows:r.rows.length,stages:r.stages.length,thr:r.thr,meth:LabApp.methodsText()}});console.log(' results:',JSON.stringify(res).slice(0,900));
  console.log(' errors:',errs.length?errs:'none');await pg.close();}
 await b.close();})().catch(e=>{console.error(e);process.exit(1)});
