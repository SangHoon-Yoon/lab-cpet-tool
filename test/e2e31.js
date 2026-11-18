// Shorter stages at the end (0.33.2): 3-min stages, then 1-min stages from 340 W, stopped 24 s into 375 W.
// The client report lists every stage (lactate only where taken) with 375 W as (part); the method list keeps values beside names.
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html');
let fail=0;const ok=(c,m)=>{console.log((c?'  ok ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch(),pg=await (await b.newContext({viewport:{width:760,height:1000},acceptDownloads:true})).newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(url);await pg.evaluate(()=>localStorage.removeItem('labcpet.choice'));await pg.reload();
 for(const c of ['test:inc','sport:cycle','data:lac'])await pg.click(`[data-ch="${c}"]`);await pg.click('#bGo');await pg.waitForTimeout(1200);
 await pg.evaluate(()=>{document.querySelector('#sBox').open=true;document.querySelector('#planD').open=true;});
 await pg.fill('#plS','95');await pg.fill('#plI','35');await pg.fill('#plD','3');await pg.selectOption('#plHasSh','1');await pg.fill('#plSw','340');await pg.fill('#plSd','1');await pg.fill('#plE','22.4');await pg.click('#plGo');await pg.waitForTimeout(1200);
 const st=await pg.evaluate(()=>LabApp.S.proto.inc.stages.map(q=>q.p+':'+Math.round(q.dur)+(q.full?'':'p')));ok(st.join(' ')==='95:180 130:180 165:180 200:180 235:180 270:180 305:180 340:60 375:24p','stages: 7 × 3 min, 340 W for 1 min, 375 W part: '+st.join(' '));
 const rows=await pg.$$eval('.lacT tbody tr',x=>x.map(r=>r.cells[0].innerText));ok(rows.length===8&&rows[7]==='Stage 7','lactate rows stop at stage 7 (no rows for the 1-min stages)');
 await pg.click('[data-lk="la:b"]');await pg.keyboard.type('1.8');await pg.keyboard.press('Enter');for(const v of [1.7,1.9,1.5,1.5,2.3,6.2,7.9]){await pg.keyboard.type(String(v));await pg.keyboard.press('Enter');await pg.waitForTimeout(100);}
 await pg.click('[data-lk="hr:0"]');for(const v of [89,103,118,133,148,163,174]){await pg.keyboard.type(String(v));await pg.keyboard.press('Enter');await pg.waitForTimeout(100);}
 await pg.waitForTimeout(500);
 // the method list: each value right beside its name
 const gapPx=await pg.evaluate(()=>Math.max(...[...document.querySelectorAll('.lacms label.chk')].map(l=>l.querySelector('.hint').getBoundingClientRect().right-l.querySelector('span').getBoundingClientRect().left)));ok(gapPx<250,'each method value sits within 250 px of its name: '+Math.round(gapPx));
 await pg.click('[data-tab=summary]');await pg.waitForTimeout(500);await pg.evaluate(()=>{document.querySelector('details[data-fold=rep]').open=true;});
 const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#rClient')]);const raw=fs.readFileSync(await dl.path()).toString('latin1');
 const txt=raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 ok(/340 \S*\s*\S*\s*1?7?9?/.test(txt)&&txt.includes('375 (part)')&&!txt.includes('340 (part)'),'report: 340 W is a full stage and 375 W is (part)');
 ok(/You completed 7 three-minute stages and 1 one-minute stage, and stopped at 0:24 into the next one-minute stage \(375 W\)/.test(txt),'report sentence names the stage lengths: '+(txt.match(/You completed[^.]*\./)||[''])[0]);
 const zt=txt.slice(txt.indexOf('Thresholds'));ok(/Moderate.*Heavy.*Severe/.test(zt)&&!/Light|Hard/.test(zt),'threshold table: Moderate, Heavy and Severe');ok(!/RPE \(6–20\)/.test(zt.slice(0,zt.indexOf('HR, heart rate')))&&!/rating of perceived exertion/.test(zt),'threshold table has no RPE column');
 console.log(' errors:',errs.length?errs.join(' | '):'none');if(errs.length)fail++;await b.close();console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);})();
