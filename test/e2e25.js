// "What to look for" reference charts.
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';fs.mkdirSync(out,{recursive:true});
let fail=0;const ok=(c,m)=>{console.log((c?'  ok ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch();for(const scheme of ['light','dark']){const ctx=await b.newContext({viewport:{width:1300,height:950},colorScheme:scheme,deviceScaleFactor:scheme==='light'?2:1}),pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(url);await pg.click('#bExample');await pg.waitForSelector('#pv .main-svg');await pg.click('[data-tab=incremental]');await pg.waitForSelector('#lookFor');
 await pg.click('#lookFor');await pg.waitForTimeout(1200);
 const n=await pg.$$eval('#lookDlg .lookgrid .main-svg',a=>a.length);ok(n>=8,scheme+': 8 charts drawn ('+n+')');
 ok(await pg.$eval('#lookDlg',d=>d.open),scheme+': dialog open');
 await pg.screenshot({path:out+'look_'+scheme+'.png'});
 await pg.click('#lookX');ok(!(await pg.$eval('#lookDlg',d=>d.open)),scheme+': closes');
 await pg.click('#lookFor');await pg.waitForTimeout(400);ok(await pg.$eval('#lookDlg',d=>d.open),scheme+': opens again');
 console.log(' errors:',errs.length?errs.join(' | '):'none');if(errs.length)fail++;await ctx.close();}
 await b.close();console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);})();
