// Steps form closes after Apply and its title says the steps were applied; Data checks and Lab presets fold; panels resize while dragging.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const d='/home/claude/samples/',f=re=>d+fs.readdirSync(d).find(x=>re.test(x));const url='file://'+path.resolve(__dirname,'../dist/lab-cpet-tool.html'),out=path.resolve(__dirname,'shots')+'/';
const ok=(c,m)=>console.log((c?' pass ':' FAIL ')+m);
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const ctx=await b.newContext({viewport:{width:1400,height:1000}});const errs=[];
 const pg=await ctx.newPage();pg.on('pageerror',x=>errs.push(x.message));await pg.goto(url);
 const load=async files=>{await pg.setInputFiles('#fileIn',files);await pg.waitForFunction(()=>!document.querySelector('#bGo').disabled,{timeout:60000});await pg.waitForTimeout(300);await pg.click('#bGo');await pg.waitForSelector('#pv .main-svg');await pg.waitForTimeout(600);};
 await load([f(/Example_GXT/)]);
 await pg.click('#nsGo');await pg.waitForTimeout(500);ok(await pg.$eval('#planD',e=>e.open),'steps form open from the prompt');
 for(const [id,v] of [['#plWm',5],['#plS',100],['#plI',25],['#plD',3],['#plE',26]])await pg.fill(id,String(v));
 await pg.click('#plGo');await pg.waitForTimeout(1500);
 ok(await pg.$eval('#planD',e=>!e.open),'steps form closed after Apply');
 const sum=await pg.$eval('#planD>summary',e=>e.innerText);console.log('  summary:',sum);ok(/Change the entered steps/.test(sum)&&/100 W, \+25 every 3 min/.test(sum),'title says the steps were applied');
 ok(await pg.$eval('#needSteps',e=>e.innerText.trim()==='' ),'no-power prompt gone');
 ok(await pg.$$eval('details[data-fold=dchk],details[data-fold=dpre]',d=>d.length===2&&d.every(x=>!x.open)),'Data checks and Lab presets fold, closed');
 ok(/all passed|to look at/.test(await pg.$eval('#chkSum',e=>e.textContent)),'Data checks title gives the count');
 await pg.click('details[data-fold=dchk]>summary');await pg.waitForTimeout(200);ok(await pg.$eval('details[data-fold=dchk]',e=>e.open)&&await pg.$$eval('#chk li',x=>x.length)>0,'Data checks opens');
 // live resize
 await pg.evaluate(()=>{document.getElementById('dBox').open=false});await pg.waitForTimeout(200);
 const len=()=>pg.evaluate(()=>Math.round(document.getElementById('pv')._fullLayout.yaxis._length));
 const g=await pg.$eval('[data-pg$=":bot"]',e=>{e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+5}});
 const g2=await pg.$eval('[data-pg$=":bot"]',e=>{const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+5}});
 const l0=await len();await pg.mouse.move(g2.x,g2.y);await pg.mouse.down();await pg.mouse.move(g2.x,g2.y+60,{steps:5});await pg.waitForTimeout(300);const mid=await len();
 await pg.mouse.move(g2.x,g2.y+100,{steps:3});await pg.waitForTimeout(300);const mid2=await len();await pg.mouse.up();await pg.waitForTimeout(400);const l1=await len();
 console.log('  heights',l0,mid,mid2,l1);ok(mid>l0+40&&mid2>mid+25,'panel grows while the edge is still held');ok(Math.abs(l1-mid2)<3,'and keeps that size on release');
 const grip=await pg.$eval('[data-pg$=":bot"]',e=>parseFloat(e.style.top));console.log('  grips',await pg.$$eval('[data-pg]',x=>x.map(e=>e.dataset.pg+'@'+e.style.top).join(' ')),await pg.evaluate(()=>JSON.stringify(LabApp.S.set.view)));const ax=await pg.evaluate(()=>{const fl=document.getElementById('pv')._fullLayout;return fl.yaxis._offset+fl.yaxis._length});console.log('  grip',grip+5,'edge',ax);ok(Math.abs(grip+5-ax)<4,'grip follows the panel edge');
 console.log(' errors:',errs.length?errs:'none');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
