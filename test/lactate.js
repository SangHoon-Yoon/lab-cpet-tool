// Lactate methods against Exphyslab (lactater demo data; 3rd degree polynomial, no baseline in the fit, Log-log on the first 75%).
const LT=require('../src/lactate.js');let bad=0;const ok=(c,m)=>{if(!c)bad++;console.log((c?' pass ':' FAIL ')+m);};
const p=[0,50,75,100,125,150,175,191.67],la=[0.93,0.98,1.23,1.88,2.80,4.21,6.66,8.64],hr=[96,114,134,154,170,182,193,198];
const r=LT.analyse(p.map((v,i)=>({p:v,la:la[i],hr:hr[i]})),{fit:'poly3',baseline:false,restrain:0.75});
const ex={'Log-log':[83.7,1.4,140],'OBLA 2.0':[104.6,2,152],'OBLA 2.5':[117.9,2.5,160],'OBLA 3.0':[128.8,3,167],'OBLA 3.5':[137,3.5,171],'OBLA 4.0':[145.2,4,176],'Bsln + 0.5':[81.6,1.43,139],'Bsln + 1.0':[102.7,1.93,151],'Bsln + 1.5':[116,2.43,159],'Dmax':[131.1,3.1,168],'ModDmax':[139.9,3.6,173],'Exp-Dmax':[135,3.3,170],'Log-Poly-ModDmax':[143.1,3.8,175]};
Object.entries(ex).forEach(([n,[pp,l,h]])=>{const m=r.methods.find(x=>x.name===n);ok(m&&Math.abs(m.p-pp)<=(n==='Log-log'?0.11:0.001)&&Math.abs(m.la-l)<1e-9&&m.hr===h,`${n}: ${m&&m.p} ${m&&m.la} ${m&&m.hr} (Exphyslab ${pp} ${l} ${h})`);});
// lactater's own golden test (baseline in the fit, all data for Log-log; values given to 3 figures)
const g=LT.analyse([0,50,75,100,125,150,175,191].map((v,i)=>({p:v,la:la[i],hr:hr[i]})),{fit:'poly3',baseline:true,restrain:1});
const gx={'Log-log':83.4,'LTP1':88.8,'LTratio':71.2,'Bsln + 0.5':82.5,'OBLA 4.0':145,'Log-Poly-ModDmax':143};Object.entries(gx).forEach(([n,v])=>{const m=g.methods.find(x=>x.name===n);ok(Math.abs(m.p-v)<=0.06*Math.max(1,v/100)+0.05,`golden ${n}: ${m.p} (${v})`);});
ok(LT.analyse([{p:0,la:1},{p:50,la:1},{p:75,la:2},{p:100,la:3}]).problems.length===1,'too few stages is reported');
console.log(bad?bad+' failed':'all passed');process.exit(bad?1:0);
