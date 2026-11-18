// Charts follow the size of their box, not only the window (0.33.1): narrowing the page area must shrink every chart.
const {chromium}=require('playwright'),path=require('path');
const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html');
let fail=0;const ok=(c,m)=>{console.log((c?'  ok ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch(),pg=await (await b.newContext({viewport:{width:1500,height:900}})).newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(url);await pg.click('#bExample');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(800);
 const fits=id=>pg.evaluate(id=>{const c=document.getElementById(id),s=c.querySelector('.main-svg');return Math.abs(s.getBoundingClientRect().width-c.getBoundingClientRect().width)<2;},id);
 const narrow=async w=>{await pg.evaluate(w=>{document.querySelector('main').style.maxWidth=w+'px';},w);await pg.waitForTimeout(900);};
 await narrow(900);ok(await fits('pv'),'Protocol chart shrinks with the page area');
 await pg.click('[data-tab=lactate]');await pg.waitForTimeout(800);await narrow(1300);await narrow(1000);
 ok(await fits('lc0')&&await pg.evaluate(()=>document.querySelector('#lc0 .main-svg').getBoundingClientRect().right<=document.querySelector('.lacside').getBoundingClientRect().left+1),'lactate chart shrinks and does not run under the side panel');
 await pg.evaluate(()=>{document.querySelector('#sBox').open=true;});await pg.waitForTimeout(700);await narrow(800);ok(await fits('stc'),'stage chart shrinks too');
 console.log(' errors:',errs.length?errs.join(' | '):'none');if(errs.length)fail++;await b.close();console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);})();
