// What's new on the start page (0.33.0): shown, closed for good, back for a newer note.
const {chromium}=require('playwright'),path=require('path');
const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html');
let fail=0;const ok=(c,m)=>{console.log((c?'  ok ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch(),pg=await (await b.newContext({viewport:{width:1300,height:900}})).newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(url);ok(await pg.$eval('#whatsnew',e=>!e.hidden&&/change the stages visually/.test(e.textContent)),'What\'s new shows on the start page');
 await pg.screenshot({path:path.resolve(__dirname,'shots')+'/zz_whatsnew.png'});
 await pg.click('#wnClose');ok(await pg.$eval('#whatsnew',e=>e.hidden),'× closes it');
 await pg.reload();ok(await pg.$eval('#whatsnew',e=>e.hidden),'stays closed after a reload');
 await pg.evaluate(()=>localStorage.setItem('labcpet.whatsnew','0.1'));await pg.reload();ok(await pg.$eval('#whatsnew',e=>!e.hidden),'comes back when there is a newer note');
 console.log(' errors:',errs.length?errs.join(' | '):'none');if(errs.length)fail++;await b.close();console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);})();
