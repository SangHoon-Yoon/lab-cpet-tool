// Remove a wrongly added file; Test details start closed.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d=require('./paths').SAMPLES,f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1300,height:900}});const errs=[];pg.on('pageerror',x=>errs.push(x.message));
 await pg.goto(url);await pg.setInputFiles('#fileIn',[f(/TWO_PHASE/),f(/Administrator/)]);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);
 ok(await pg.$$eval('#flist li',x=>x.length)===2&&await pg.$$eval('#flist .rm',x=>x.length)===2,'each file has a remove button');await pg.screenshot({path:out+'files_rm.png'});
 await pg.click('#flist li:nth-child(1) .rm');await pg.waitForTimeout(200);ok(await pg.$$eval('#flist li',x=>x.length)===1&&/Administrator/.test(await pg.$eval('#flist',e=>e.innerText)),'wrong file removed');ok(await pg.$eval('#bGo',e=>e.disabled),'Continue disabled with no COSMED file');
 await pg.setInputFiles('#fileIn',[f(/TWO_PHASE/)]);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.click('#flist li:nth-child(1) .rm');await pg.waitForTimeout(200);ok(await pg.$$eval('#flist li',x=>x.length)===1,'Lode file removed too');
 await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');ok(await pg.$eval('#dBox',e=>!e.open),'Test details collapsed by default');
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
