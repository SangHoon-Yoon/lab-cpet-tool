// Lactate tab controls, typing with Enter, Add a row, chart height, Baseline label, report figure choice, status wrapping (0.24.0). Uses the example test only.
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';fs.mkdirSync(out,{recursive:true});
let fail=0;const ok=(c,m)=>{console.log((c?'  ok ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch(),ctx=await b.newContext({viewport:{width:1400,height:1000},acceptDownloads:true}),pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(url);await pg.click('#bExample');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(1000);
 await pg.click('[data-tab=lactate]');await pg.waitForTimeout(800);
 const st=()=>pg.evaluate(()=>({base:LabApp.S.set.lac.baseline,fit:LabApp.S.set.lac.fit,lt1:LabApp.S.set.lac.lt1,marked:(document.querySelector('#lc0').data[2]||{x:[]}).x.length,ticked:document.querySelectorAll('#lms0 [data-lshow]:checked').length,tiles:document.querySelector('#lt0').innerText}));
 const s0=await st();ok(s0.marked===2&&s0.ticked===2,'chart starts with only the two starting methods marked: '+s0.marked);
 await pg.click('#lms0 [data-lshow="OBLA 4.0"]');await pg.waitForTimeout(500);const s1=await st();ok(s1.marked===3&&s1.ticked===3,'ticking a method marks it on the chart');ok(await pg.evaluate(()=>document.activeElement&&document.activeElement.dataset.lshow)==='OBLA 4.0','the tab is not redrawn when a box is ticked');
 await pg.click('#lms0 [data-lall="1"]');await pg.waitForTimeout(500);ok((await st()).marked>8,'All marks every method');
 await pg.click('#lms0 [data-lall="0"]');await pg.waitForTimeout(500);ok((await st()).marked===2,'back to the starting methods');
 const pos=await pg.evaluate(()=>{const t=document.querySelector('.lacT').getBoundingClientRect(),c=document.querySelector('#lc0').getBoundingClientRect();return c.top>t.bottom&&c.width>700;});ok(pos,'chart sits under the table, wide');
 await pg.selectOption('#lBase','1');await pg.waitForTimeout(500);const s2=await st();ok(s2.base&&s2.tiles!==s1.tiles,'Baseline in the fit changes the result');
 await pg.selectOption('#lFit','poly4');await pg.waitForTimeout(500);const s3=await st();ok(s3.fit==='poly4','curve fit changes');
 ok(await pg.$('#lD1')===null,'no starting-method menus');
 await pg.waitForTimeout(600);await pg.evaluate(()=>document.activeElement.blur());await pg.keyboard.press('Control+z');await pg.waitForTimeout(800);ok((await pg.evaluate(()=>LabApp.S.set.lac.fit))==='poly3','undo restores the curve fit');
 // Enter moves down, Tab across, values land in the right rows
 await pg.click('[data-lk="la:b"]');await pg.evaluate(()=>document.activeElement.select());await pg.keyboard.type('1.1');await pg.keyboard.press('Enter');await pg.waitForTimeout(300);
 ok(await pg.evaluate(()=>document.activeElement.dataset.lk)==='la:0','Enter moves to the next row');
 await pg.keyboard.type('1.3');await pg.keyboard.press('Enter');await pg.waitForTimeout(300);
 const v=await pg.evaluate(()=>[LabApp.S.set.lac.series.inc.base.la,LabApp.S.set.lac.series.inc.rows[0].la,document.activeElement.dataset.lk]);ok(v[0]===1.1&&v[1]===1.3&&v[2]==='la:1','typed values replace the old ones: '+JSON.stringify(v));
 await pg.keyboard.press('Tab');ok(await pg.evaluate(()=>document.activeElement.dataset.lk)==='hr:1','Tab moves across');
 await pg.keyboard.press('ArrowUp');const up=await pg.evaluate(()=>document.activeElement.dataset.lk);await pg.keyboard.press('ArrowDown');ok(up==='hr:0'&&await pg.evaluate(()=>document.activeElement.dataset.lk)==='hr:1','arrow keys move up and down');
 // Add a row stays put
 const bb=await (await pg.$('[data-ladd="0"]')).boundingBox();for(let i=0;i<3;i++){await pg.mouse.click(bb.x+5,bb.y+5);await pg.waitForTimeout(200);}
 ok(await pg.evaluate(()=>LabApp.S.set.lac.series.inc.extra.length)===3,'three rows added without moving the mouse');
 // Baseline label and chart height
 const ticks=await pg.$$eval('#lc0 .xtick text',x=>x.map(t=>t.textContent));ok(ticks[0]==='Baseline','x-axis says Baseline: '+ticks.slice(0,3).join(', '));
 {await pg.$eval('[data-lsize="0"]',e=>e.scrollIntoView({block:'center'}));await pg.waitForTimeout(200);const bb=await (await pg.$('[data-lsize="0"]')).boundingBox(),h0=await pg.evaluate(()=>document.querySelector('#lc0').getBoundingClientRect().height);await pg.mouse.move(bb.x+bb.width/2,bb.y+7);await pg.mouse.down();await pg.mouse.move(bb.x+bb.width/2,bb.y+7+60,{steps:6});await pg.waitForTimeout(100);const live=await pg.evaluate(()=>document.querySelector('#lc0 .main-svg').getBoundingClientRect().height);await pg.mouse.move(bb.x+bb.width/2,bb.y+7+(480-h0),{steps:4});await pg.mouse.up();await pg.waitForTimeout(300);ok(Math.abs(live-(h0+60))<4,'the chart follows the bar while it is dragged');}
 await pg.selectOption('#lFit','poly3');await pg.waitForTimeout(500);ok(Math.round(await pg.evaluate(()=>document.querySelector('#lc0').getBoundingClientRect().height))===480,'chart height is kept after a redraw');
 await pg.screenshot({path:out+'z_lac.png',fullPage:true});
 // shorter stages at the end get no row
 const rows=await pg.evaluate(()=>{const se=LabApp._lac.series()[0];se.key='none';se.stages=[180,180,180,180,60,60,45].map((d,i)=>({p:100+30*i,dur:d,full:true}));return LabApp._lac.rows?LabApp._lac.rows(se).rows.map(r=>r.i):null;});
 ok(rows&&rows.join()==='0,1,2,3','rows only for the longer stages: '+JSON.stringify(rows));
 // narrow window: status stays inside its box
 await pg.setViewportSize({width:520,height:900});await pg.click('[data-tab=incremental]');await pg.waitForTimeout(2500);
 const ov=await pg.$$eval('.stat',x=>x.filter(e=>e.querySelector('.tstat')).map(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('.tstat,.tconf')].every(c=>c.getBoundingClientRect().right<=r.right+1);}));ok(ov.length>0&&ov.every(Boolean),'status badges stay inside their boxes at 520 px');
 // reports: figure choice
 await pg.setViewportSize({width:1400,height:1000});await pg.click('[data-tab=summary]');await pg.waitForTimeout(500);await pg.evaluate(()=>{document.querySelector('details[data-fold=rep]').open=true});await pg.waitForTimeout(300);
 const size=async btn=>{const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click(btn)]);return fs.statSync(await dl.path()).size;};
 const c1=await size('#rClient');await pg.click('[data-rfig=cGas]');const c2=await size('#rClient');await pg.click('[data-rfig=cGas]');await pg.click('[data-rfig=cLac]');const c0=await size('#rClient');
 ok(c2>c1+20000&&c0<c1-20000,'client report: one figure by default, two when both ticked, none when unticked ('+[c0,c1,c2].join(', ')+' bytes)');
 await pg.click('[data-rfig=rPet]');const r3=await size('#rResearch');await pg.click('[data-rfig=rPet]');const r2=await size('#rResearch');await pg.click('[data-rfig=rGas]');const r1=await size('#rResearch');ok(r1<r2-20000,'research report without the breathing chart is smaller');ok(r3>r2+15000,'research report with the PETCO2 figure is larger');ok(!/then \d+ min stages/.test(await pg.$eval('#rProt',e=>e.value)),'protocol text: no shorter stages in the example: '+(await pg.$eval('#rProt',e=>e.value)).replace(/\n/g,' / '));
 console.log(' errors:',errs.length?errs.join(' | '):'none');if(errs.length)fail++;
 await b.close();console.log(fail?'FAILED '+fail:'all passed');process.exit(fail?1:0);})();
