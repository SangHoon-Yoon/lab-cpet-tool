/* Lab CPET tool — browser app. Depends on Plotly, XLSX, GDParse, GDCore, LabCore. */
(function () {
  'use strict';
  const VERSION = '0.5.0', AUTHOR = 'SangHoon Yoon';
  const P = GDParse, C = GDCore, L = LabCore, F = Number.isFinite;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fx = (v, d) => (F(v) ? v.toFixed(d) : '–');
  const mmss = s => { if (!F(s)) return '–'; const m = Math.floor(s / 60), r = Math.round(s - m * 60); return r === 60 ? (m + 1) + ':00' : m + ':' + String(r).padStart(2, '0'); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const later = fn => setTimeout(fn, 0); // a redraw inside a change event would remove the input while it still has focus

  const VARS = {
    vo2: { l: 'VO₂', h: 'VO<sub>2</sub>', u: 'L/min', dp: 2 }, vo2kg: { l: 'VO₂/kg', h: 'VO<sub>2</sub>/kg', u: 'mL/kg/min', dp: 1 },
    vco2: { l: 'VCO₂', h: 'VCO<sub>2</sub>', u: 'L/min', dp: 2 }, ve: { l: 'VE', h: 'VE', u: 'L/min', dp: 1 },
    hr: { l: 'Heart rate', h: 'Heart rate', u: 'bpm', dp: 0 }, rer: { l: 'RER', h: 'RER', u: '', dp: 2 },
    eqo2: { l: 'VE/VO₂', h: 'VE/VO<sub>2</sub>', u: '', dp: 1 }, eqco2: { l: 'VE/VCO₂', h: 'VE/VCO<sub>2</sub>', u: '', dp: 1 },
    peto2: { l: 'PETO₂', h: 'P<sub>ET</sub>O<sub>2</sub>', u: 'mmHg', dp: 1 }, petco2: { l: 'PETCO₂', h: 'P<sub>ET</sub>CO<sub>2</sub>', u: 'mmHg', dp: 1 },
    rf: { l: 'Breathing frequency', h: 'Breathing frequency', u: 'breaths/min', dp: 1 }, vt: { l: 'Tidal volume', h: 'Tidal volume', u: 'L', dp: 2 },
    cho: { l: 'Carbohydrate oxidation', h: 'Carbohydrate oxidation', u: 'g/min', dp: 2 }, fat: { l: 'Fat oxidation', h: 'Fat oxidation', u: 'g/min', dp: 2 },
    rpm: { l: 'Cadence', h: 'Cadence', u: 'rpm', dp: 0 }
  };
  const vlab = k => VARS[k].h + (VARS[k].u ? ' (' + VARS[k].u + ')' : '');

  const defaults = () => ({
    source: null, offset: 0, type: null, blocks: null, plan: null, excluded: [], oxyWin: 'analysis', fits: {},
    outl: { local: true, nsd: 4, half: 5, vars: ['vo2', 'vco2', 've'], limits: true, rfMin: 5, rfMax: 100, vtMin: 0.3, remove: false, show: false },
    avg: { mode: 'bin', bin: 15, ma: 7, roll: 15 },
    view: { vars: ['vo2', 'hr', 've'] },
    inc: { t0: null, t1: null, stageWin: 60, peakWin: 30, x: 'vo2' },
    st: { meas: ['eqo2', 'vco2'], win: null, regWin: 60, cmp: ['vo2', 'hr', 'rer'] }, per: { avgMin: 1, vars: ['vo2', 'hr', 'cho', 'fat', 'econ'] }, hrOffset: 0
  });
  const S = { pending: [], gas: null, lode: null, hr: null, meta: {}, set: defaults(), picks: { inc: {}, tests: {} }, I: null, proto: null, D: null, view: 'protocol', align: null, oxy: null, oxyCache: {} };
  let cmode = 'light';

  /* ---------------- Files ---------------- */
  const fileIn = $('#fileIn');
  $('#bPick').onclick = () => { fileIn.accept = '.xlsx,.xls,.csv,.tcx,.gpx,.json'; fileIn.click(); };
  $('#bLoad').onclick = () => { S.pending = []; listFiles(); $('#app').hidden = true; $('#start').hidden = false; };
  $('#bOpen').onclick = () => { fileIn.accept = '.json'; fileIn.click(); };
  fileIn.onchange = () => { addFiles([...fileIn.files]); fileIn.value = ''; };
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', ev => addFiles([...ev.dataTransfer.files]));

  async function addFiles(files) {
    for (const f of files) {
      const item = { name: f.name, kind: '?', status: 'reading', obj: null, err: '' };
      S.pending.push(item); listFiles();
      try {
        if (S.addLode && !/\.xlsx?$/i.test(f.name)) throw new Error('Choose the Lode .xlsx export.');
        if (/\.json$/i.test(f.name)) { openAnalysis(JSON.parse(await f.text())); S.pending = []; return; }
        if (/\.(csv|tcx|gpx)$/i.test(f.name)) { item.obj = P.parseHR(await f.text(), f.name); item.kind = 'hr'; item.desc = item.obj.t.length + ' heart-rate samples'; }
        else {
          const wb = P.readWorkbook(await f.arrayBuffer()), id = P.identify(wb);
          if (id === 'cosmed') { item.obj = P.parseCosmed(wb); item.kind = 'cosmed'; const hasSp = L.speedChanges(item.obj); item.desc = (item.obj.kind === 'bxb' ? item.obj.t.length + ' breaths' : item.obj.t.length + ' × ' + item.obj.avgWidth + '-s averages') + (hasSp ? ', with treadmill speed' : ''); }
          else if (id === 'lode' && S.addLode) { S.addLode = false; S.pending = []; S.lode = P.parseLode(wb); S.set.source = 'lode'; S.set.plan = null; S.set.blocks = null; S.set.inc.t0 = S.set.inc.t1 = null; if (S.view !== 'summary') S.view = 'protocol'; rebuild(); S.align = L.alignment(S.gas, S.I); buildDetails(); buildTabs(); recompute(); return; }
          else if (id === 'lode') { item.obj = P.parseLode(wb); item.kind = 'lode'; item.desc = (item.obj.t.at(-1) / 60).toFixed(1) + ' min of power'; }
          else throw new Error('Not recognised as a COSMED or Lode export.');
        }
        item.status = 'ok';
      } catch (e) { item.status = 'bad'; item.err = e.message; }
      listFiles();
    }
  }
  function listFiles() {
    const K = { cosmed: 'COSMED', lode: 'Lode', hr: 'Heart rate', '?': '…' };
    $('#flist').innerHTML = S.pending.map(it => `<li><span class="pill ${it.status === 'ok' ? 'ok' : it.status === 'bad' ? 'bad' : 'warn'}">${K[it.kind] || it.kind}</span><b>${esc(it.name)}</b><span class="hint">${esc(it.status === 'bad' ? it.err : it.desc || '')}</span></li>`).join('');
    const ok = S.pending.filter(i => i.status === 'ok'), cos = ok.filter(i => i.kind === 'cosmed');
    let msg = '', blocked = false;
    if (S.pending.length && !cos.length) msg = 'Add the COSMED export.';
    else if (cos.length > 1) { const j = L.joinCosmed(cos.map(i => ({ gas: i.obj, name: i.name })), P.cosmedStartEpoch); msg = j.problem || (j.gas.files ? `${j.gas.files.length} COSMED files will be joined into one session by their clock times: ${j.gas.files.map(f => mmss(f.start)).join(', ')}.` : j.note); blocked = !!j.problem; }
    else if (cos.length && !ok.some(i => i.kind === 'lode') && !L.speedChanges(cos[0].obj)) msg = 'This file has no usable speed or power. Add the Lode export if you have it, or continue and enter the power steps on the next screen.';
    $('#fmsg').textContent = msg;
    $('#bGo').disabled = !cos.length || blocked;
  }
  $('#bGo').onclick = () => {
    const ok = S.pending.filter(i => i.status === 'ok'), cos = ok.filter(i => i.kind === 'cosmed');
    S.gas = L.joinCosmed(cos.map(i => ({ gas: i.obj, name: i.name })), P.cosmedStartEpoch).gas;
    const lo = ok.find(i => i.kind === 'lode'); S.lode = lo ? lo.obj : null;
    const h = ok.find(i => i.kind === 'hr'); S.hr = h ? h.obj : null;
    S.set = defaults(); S.picks = { inc: {}, tests: {} }; S.oxy = null; S.oxyCache = {}; S.meta = {}; S.view = 'protocol';
    start();
  };

  function start() {
    const g = S.gas, m = g.meta, lm = (S.lode && S.lode.meta) || {};
    S.meta = Object.assign({
      name: [m.firstName || lm.firstName, m.lastName || lm.lastName].map(x => String(x || '').trim()).filter(Boolean).join(' ') || 'Participant',
      date: m.testDate || '', sex: /^f/i.test(m.sex || lm.sex || '') ? 'F' : /^m/i.test(m.sex || lm.sex || '') ? 'M' : '',
      mass: F(m.mass) ? m.mass : lm.mass, age: m.age, studyId: m.id ? String(m.id) : ''
    }, S.meta);
    const av = L.availableIntensity(g, S.lode);
    if (!S.set.source || !av.includes(S.set.source)) S.set.source = av[0] || null;
    if (g.kind === 'avg' && S.set.avg.bin < g.avgWidth) S.set.avg.bin = g.avgWidth;
    if (S.hr && !S.set.hrOffset) { const ce = P.cosmedStartEpoch(m); if (S.hr.start && ce) S.set.hrOffset = Math.round(S.hr.start - ce); }
    rebuild();
    S.align = L.alignment(S.gas, S.I);
    $('#start').hidden = true; $('#app').hidden = false; $('#dBox').open = true;
    ['#bSave', '#bExport', '#bCsv'].forEach(b => ($(b).disabled = false));
    buildDetails(); buildProc(); buildTabs(); recompute();
  }
  // Intensity channel and protocol, from the current settings.
  function rebuild() {
    const set = S.set;
    S.I = L.buildIntensity(S.gas, S.lode, set.source, set.offset, set.blocks, set.plan);
    S.proto = S.I ? L.detect(S.I, { type: set.plan ? 'incremental' : set.type }) : { type: set.type || 'incremental', unit: '', label: 'Intensity', tests: [], phases: [], inc: { none: true, ramp: false, stages: [], t0: S.gas.t[0], t1: L.exerciseEnd(S.gas), peak: NaN }, plateaus: [], pauses: [], base: NaN, maot: null, ttf: null, pattern: null };
    S.proto.allTests = S.proto.tests;
    S.proto.tests = S.proto.tests.filter(T => !set.excluded.includes(Math.round(T.t0)));
  }

  /* ---------------- Compute ---------------- */
  function bisect(t, x) { let lo = 0, hi = t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < x) lo = m + 1; else hi = m; } return lo; }
  function decorate(Y) {
    const set = S.set, mass = S.meta.mass, g = S.gas;
    Y.v.vo2kg = Y.v.vo2.map(x => (F(mass) && mass > 0 ? x * 1000 / mass : NaN));
    Y.v.cho = Y.v.vo2.map((x, i) => C.cho(x, Y.v.vco2[i])); Y.v.fat = Y.v.vo2.map((x, i) => C.fat(x, Y.v.vco2[i]));
    const hw = t => (Y.mode === 'bin' ? [t - Y.param, t] : [t - 5, t + 5]);
    if (S.lode && S.I && S.I.source === 'lode' && S.lode.rpm.some(F)) {
      const lt = S.I.t, ps = [0]; S.lode.rpm.forEach((r, i) => ps.push(ps[i] + (F(r) ? r : 0)));
      Y.v.rpm = Y.t.map(t => { const [a, b] = hw(t), i = bisect(lt, a), j = bisect(lt, b); return j > i ? (ps[j] - ps[i]) / (j - i) : NaN; });
    }
    const hasHR = g.v.hr && g.v.hr.some(x => F(x) && x > 0);
    if (!hasHR && S.hr) { const ht = S.hr.t.map(t => t + set.hrOffset), hv = S.hr.hr; Y.v.hr = Y.t.map(t => { const [a, b] = hw(t), i = bisect(ht, a), j = bisect(ht, b); let s = 0, c = 0; for (let q = i; q < j; q++) { s += hv[q]; c++; } return c ? s / c : NaN; }); }
  }
  function computeD() {
    const g = S.gas, set = S.set, pr = S.proto, I = S.I, mass = S.meta.mass, mode = I ? I.mode : '';
    const fl = C.flagOutliers(g, Object.assign({}, set.outl, { limits: set.outl.local && set.outl.limits }));
    const keep = Array.from(fl.flag, f => f === 0 || (!set.outl.remove && f !== 3));
    const av = set.avg, par = avgParOf(set), w0 = g.kind === 'avg' ? g.avgWidth : 15;
    const X = C.series(g, keep, av.mode, par), ref = av.mode === 'bin' && par === w0 ? X : C.series(g, keep, 'bin', w0), R0 = C.series(g, keep, 'raw', 0);
    [...new Set([X, ref, R0])].forEach(decorate);
    const D = { fl, keep, X, ref, R0, mode };
    // Incremental test
    if (pr.type === 'incremental' && pr.inc) {
      const inc = pr.inc, t0 = F(set.inc.t0) ? set.inc.t0 : inc.t0 + (inc.none ? 0 : 90), t1 = F(set.inc.t1) ? set.inc.t1 : inc.t1;
      const sugg = L.suggestIncremental(ref, t0, t1);
      const stages = inc.stages, values = stages.map(st => L.stageValues(R0, st, set.inc.stageWin, mass, mode));
      const fit = L.intensityFit(values), rpe = L.stageRPE(g, stages);
      const peak = {}; ['vo2', 'vo2kg', 'vco2', 've', 'hr', 'rer'].forEach(k => (peak[k] = L.rollingPeak(R0, k, set.inc.peakWin, t0, t1 + 1e-6)));
      const atPeak = peak.vo2 ? { hr: L.meanInWindow(R0, 'hr', peak.vo2.t0, peak.vo2.t1), rer: L.meanInWindow(R0, 'rer', peak.vo2.t0, peak.vo2.t1) } : {};
      D.inc = { t0, t1, sugg, stages, values, fit, rpe, peak, atPeak, map: sugg.map, effort: L.effortChecks(R0, g, inc, S.meta.age, values, peak, rpe) };
    }
    // Step tests
    if (pr.tests.length && I) {
      const A = C.assignSteps(X, I, pr), Aref = C.assignSteps(ref, I, pr);
      const SM = pr.tests.map(T => T.steps.map(st => L.stageValues(R0, st, set.st.regWin, mass, mode)));
      const fits = SM.map(v => { const u = v.filter(q => q.full && F(q.m.vo2)); return u.length >= 3 ? C.linreg(u.map(q => q.m.vo2), u.map(q => q.p)) : null; });
      D.st = { A, SM, fits, sugg: C.suggestVT1(ref, Aref, pr, Math.min(120, stepLength())), rpe: pr.tests.map(T => L.stageRPE(g, T.steps)) };
      if (F(pr.base)) D.per = L.splitLongPeriods(C.periods(X, I, pr, { gapSec: 20, dropSec: w0, periodSec: 240, avgSec: set.per.avgMin * 60 }, ref), X, I, pr.base, { avgSec: set.per.avgMin * 60 });
    } else if (F(pr.base) && I) D.per = L.splitLongPeriods(C.periods(X, I, pr, { gapSec: 20, dropSec: w0, periodSec: 240, avgSec: set.per.avgMin * 60 }, ref), X, I, pr.base, { avgSec: set.per.avgMin * 60 });
    return D;
  }
  // Time used from the end of each stage on the step-test charts. The default is the whole stage.
  const stepLength = () => (S.proto.pattern ? S.proto.pattern.stepDur : 240);
  const isWholeStage = () => !F(S.set.st.win) || S.set.st.win >= stepLength();
  const stWin = () => (isWholeStage() ? stepLength() + 15 : S.set.st.win); // a little extra, so a stage a fraction longer than planned stays whole
  function recompute() { S.D = computeD(); S.checks = L.dataChecks(S); summaries(); render(); }
  function avgParOf(set) { const a = set.avg; return a.mode === 'bin' ? a.bin : a.mode === 'ma' ? a.ma : a.mode === 'roll' ? a.roll : 0; }
  function avgLabel() { const a = S.set.avg, bxb = S.gas.kind === 'bxb'; return { raw: bxb ? 'breath-by-breath' : S.gas.avgWidth + '-s averages from the file', bin: a.bin + '-s bins', ma: a.ma + '-' + (bxb ? 'breath' : 'sample') + ' moving average', roll: a.roll + '-s rolling average' }[a.mode]; }
  const iLab = () => (S.I ? S.I.label + ' (' + S.I.unit + ')' : 'Intensity');
  const iDp = () => (S.I && S.I.unit === 'W' ? 0 : 1);
  const iVal = v => (S.I && F(v) ? v.toFixed(iDp()) + ' ' + S.I.unit : '–');
  const availVars = () => Object.keys(VARS).filter(k => { const X = S.D.X; return X.v[k] && X.v[k].some(x => F(x) && x !== 0); });

  // Thresholds: a pick when the user has moved the line, otherwise the suggestion.
  const incVT = q => { const p = S.picks.inc[q]; return F(p) ? p : S.D.inc ? S.D.inc.sugg[q] : NaN; };
  const testKey = T => Math.round(T.t0);
  const testVT1 = i => { const T = S.proto.tests[i], p = (S.picks.tests[testKey(T)] || {}).vt1; return F(p) ? p : S.D.st && S.D.st.sugg[i] ? S.D.st.sugg[i].vt1 : NaN; };

  /* ---------------- Test details ---------------- */
  function buildDetails() {
    const set = S.set, pr = S.proto, I = S.I, av = L.availableIntensity(S.gas, S.lode), m = S.meta;
    const srcName = { lode: 'Cycling: Lode power', speed: 'Treadmill: COSMED speed', power: 'Cycling: COSMED power' };
    const stageTxt = pr.type === 'incremental' ? (pr.inc && !pr.inc.none ? (pr.inc.ramp ? `Ramp from ${iVal(S.proto.ramp.p0)} to ${iVal(S.proto.ramp.p1)}, ${mmss(pr.inc.t1 - pr.inc.t0)} long` : groupStages(pr.inc.stages)) : 'No stages found') : '';
    $('#dForm').innerHTML = `
      <div class="form">
        <label class="f"><span>Name</span><input type="text" id="mName" value="${esc(m.name)}"></label>
        <label class="f"><span>Study ID (optional)</span><input type="text" id="mId" value="${esc(m.studyId || '')}"></label>
        <label class="f"><span>Test date</span><input type="text" id="mDate" value="${esc(m.date)}"></label>
        <label class="f"><span>Sex</span><select id="mSex"><option value="F">Female</option><option value="M">Male</option><option value="">Not set</option></select></label>
        <label class="f"><span>Body mass (kg)</span><input type="number" step="0.1" id="mMass" value="${F(m.mass) ? m.mass : ''}"></label>
        <label class="f"><span>Age (years)</span><input type="number" step="0.1" id="mAge" value="${F(m.age) ? +m.age.toFixed(1) : ''}"></label>
      </div>
      <div class="form">
        <label class="f"><span>Exercise and intensity data</span><select id="mSrc" ${av.length > 1 ? '' : 'disabled'}>${av.length ? av.map(a => `<option value="${a}">${srcName[a]}</option>`).join('') : '<option>None found</option>'}</select></label>
        <label class="f"><span>Test type</span><select id="mType"><option value="incremental">Incremental test</option><option value="prolonged">Prolonged trial with step tests</option></select></label>
        ${I && I.source === 'lode' ? `<label class="f"><span>Lode time offset (s)</span><input type="number" step="1" id="mOff" value="${set.offset}"></label>` : ''}
        ${S.hr ? `<label class="f"><span>Heart-rate offset (s)</span><input type="number" step="1" id="mHR" value="${set.hrOffset}"></label>` : ''}
      </div>
      <div class="step"><h4>What was detected</h4>${protoSummary(stageTxt)}</div>
      ${planForm()}
      <details class="adv" ${set.blocks ? 'open' : ''}><summary>Any other protocol, such as step tests within a trial: enter blocks of stages by hand</summary>
        <div class="step" style="padding-top:8px">
          <p class="hint">One row per block of stages. Times are from the start of the COSMED recording. This replaces the detected intensity everywhere.</p>
          <div class="tools"><span>Unit</span><select id="bUnit"><option value="km/h">km/h</option><option value="W">W</option></select></div>
          <div class="tblwrap"><table class="blocks" id="bT"></table></div>
          <div class="tools"><button id="bAdd">Add block</button><button id="bApply" class="primary">Apply</button><button id="bClear" ${set.blocks ? '' : 'disabled'}>Back to detected stages</button></div>
        </div></details>
      <div class="step"><h4>Data checks</h4><ul class="checks" id="chk"></ul></div>`;
    bindPlan();
    $('#mSex').value = m.sex || ''; if (av.length) $('#mSrc').value = set.source; $('#mType').value = pr.type;
    const on = (id, fn) => { const el = $(id); if (el) el.onchange = e => later(() => fn(e)); };
    on('#mName', e => { m.name = e.target.value; summaries(); });
    on('#mId', e => { m.studyId = e.target.value; summaries(); });
    on('#mDate', e => { m.date = e.target.value; summaries(); });
    on('#mSex', e => { m.sex = e.target.value; });
    on('#mMass', e => { m.mass = parseFloat(e.target.value); recompute(); });
    on('#mAge', e => { m.age = parseFloat(e.target.value); recompute(); });
    const full = () => { rebuild(); S.align = L.alignment(S.gas, S.I); buildDetails(); buildTabs(); recompute(); };
    on('#mSrc', e => { set.source = e.target.value; set.blocks = null; full(); });
    on('#mType', e => { set.type = e.target.value; S.view = 'protocol'; full(); });
    on('#mOff', e => { set.offset = parseFloat(e.target.value) || 0; full(); });
    on('#mHR', e => { set.hrOffset = parseFloat(e.target.value) || 0; recompute(); });
    // Manual blocks
    const rowsNow = set.blocks ? clone([...set.blocks]) : [{ start: 0, n: 5, dur: 4, first: I && I.unit === 'W' ? 100 : 8, inc: I && I.unit === 'W' ? 20 : 1 }];
    $('#bUnit').value = (set.blocks && set.blocks.unit) || (I && I.unit) || 'km/h';
    const drawB = () => {
      $('#bT').innerHTML = '<tr><th>Start (min)</th><th>Stages</th><th>Stage length (min)</th><th>First stage</th><th>Increment</th><th></th></tr>' + rowsNow.map((b, i) => `<tr><td><input type="number" step="0.5" data-b="${i}" data-f="start" value="${b.start}"></td><td><input type="number" step="1" min="1" data-b="${i}" data-f="n" value="${b.n}"></td><td><input type="number" step="0.5" data-b="${i}" data-f="dur" value="${b.dur}"></td><td><input type="number" step="0.5" data-b="${i}" data-f="first" value="${b.first}"></td><td><input type="number" step="0.5" data-b="${i}" data-f="inc" value="${b.inc}"></td><td><button data-rm="${i}" aria-label="Remove block">Remove</button></td></tr>`).join('');
      $$('[data-b]').forEach(el => (el.onchange = () => { rowsNow[+el.dataset.b][el.dataset.f] = parseFloat(el.value); }));
      $$('[data-rm]').forEach(el => (el.onclick = () => { rowsNow.splice(+el.dataset.rm, 1); drawB(); }));
    };
    drawB();
    $('#bAdd').onclick = () => { const l = rowsNow.at(-1) || { start: 0, n: 5, dur: 4, first: 8, inc: 1 }; rowsNow.push({ start: l.start + l.n * l.dur + 60, n: l.n, dur: l.dur, first: l.first, inc: l.inc }); drawB(); };
    $('#bApply').onclick = () => { if (!rowsNow.length) return; const b = clone(rowsNow); b.unit = $('#bUnit').value; set.blocks = b; set.excluded = []; full(); };
    $('#bClear').onclick = () => { set.blocks = null; full(); };
    drawChecks();
  }
  function groupStages(st) { // "warm-up 5:00 at 50 W; 7 × 3:00 from 9 to 15 km/h; 5 × 1:00 from 16 to 20 km/h"
    const out = [], rest = st.filter(q => !q.warm); st.filter(q => q.warm).forEach(q => out.push(`warm-up ${mmss(q.dur)} at ${iVal(q.p)}`));
    let a = 0;
    for (let i = 1; i <= rest.length; i++) if (i === rest.length || Math.abs(rest[i].dur - rest[a].dur) > 20) { out.push(i - a === 1 ? `${mmss(rest[a].dur)} at ${iVal(rest[a].p)}` : `${i - a} × ${mmss(Math.round(rest[a].dur / 5) * 5)} from ${+rest[a].p.toFixed(1)} to ${iVal(rest[i - 1].p)}`); a = i; }
    return out.join('; ');
  }
  // The usual incremental test: warm-up, longer stages, then shorter stages to failure.
  function planDefaults() { let last = {}; try { last = JSON.parse(localStorage.getItem('labcpet:plan') || '{}'); } catch (e) { } const u = last.unit || 'W'; return { unit: u, warmMin: last.warmMin, warmP: last.warmP, startP: last.startP, inc: last.inc, stageMin: last.stageMin || 3, switchMin: NaN, shortMin: last.shortMin || 1, shortInc: NaN, endMin: +(L.exerciseEnd(S.gas) / 60).toFixed(2) }; }
  function planForm() {
    const set = S.set, q = set.plan || planDefaults(), need = !S.I, show = need || set.plan, val = v => (F(v) ? v : ''), uu = q.unit === 'W' ? 'W' : 'km/h', fld = (id, lab, v, extra) => `<label class="f"><span>${lab}</span><input type="number" step="any" id="${id}" value="${val(v)}" ${extra || ''}></label>`;
    return `<details class="adv" id="planD" ${show ? 'open' : ''}><summary>${S.lode || S.I && !S.I.plan ? 'Replace the detected stages with entered ones' : 'Enter the incremental test steps'}</summary><div class="plan ${need ? 'need' : ''}" style="margin-top:8px">
      <h4>Incremental test steps</h4>
      ${need ? '<p class="hint">This COSMED file has no power recording. Enter the steps here, or <button id="bAddLode">add the Lode file</button>. Times are from the start of the COSMED recording.</p>' : ''}
      <div class="form">
        <label class="f"><span>Unit</span><select id="plU"><option value="W">W (cycling)</option><option value="km/h">km/h (treadmill)</option></select></label>
        ${fld('plWm', 'Warm-up length (min)', q.warmMin)}${fld('plWp', `Warm-up intensity (${uu}, optional)`, q.warmP)}
        ${fld('plS', `Starting intensity (${uu})`, q.startP)}${fld('plI', `Increment (${uu})`, q.inc)}${fld('plD', 'Stage length (min)', q.stageMin)}
        ${fld('plSw', 'Shorter stages started at (min, optional)', q.switchMin)}${fld('plSd', 'Shorter stage length (min)', q.shortMin)}${fld('plSi', `Increment in shorter stages (${uu}, optional)`, q.shortInc)}
        ${fld('plE', 'Test ended at (min)', q.endMin)}
      </div>
      <div class="tools"><button class="primary" id="plGo">Apply steps</button><button id="plOff" ${set.plan ? '' : 'disabled'}>Remove entered steps</button><span class="msg" id="plMsg"></span></div>
    </div></details>`;
  }
  function bindPlan() {
    const set = S.set, g = id => parseFloat($(id).value), u = $('#plU'), q = set.plan || planDefaults(); u.value = q.unit === 'W' ? 'W' : 'km/h';
    const lode = $('#bAddLode'); if (lode) lode.onclick = ev => { ev.preventDefault(); S.addLode = true; fileIn.accept = '.xlsx,.xls'; fileIn.click(); };
    $('#plGo').onclick = () => {
      const pl = { unit: u.value, warmMin: g('#plWm') || 0, warmP: g('#plWp'), startP: g('#plS'), inc: g('#plI'), stageMin: g('#plD'), switchMin: g('#plSw'), shortMin: g('#plSd') || 1, shortInc: g('#plSi'), endMin: g('#plE') };
      if (!F(pl.startP) || !F(pl.inc) || !(pl.stageMin > 0) || !(pl.endMin > pl.warmMin)) { $('#plMsg').textContent = 'Enter the starting intensity, increment, stage length and test end.'; return; }
      if (F(pl.switchMin) && (pl.switchMin <= pl.warmMin || pl.switchMin >= pl.endMin)) { $('#plMsg').textContent = 'The shorter stages must start between the warm-up and the test end.'; return; }
      set.plan = pl; set.blocks = null; set.type = 'incremental'; set.inc.t0 = set.inc.t1 = null;
      try { localStorage.setItem('labcpet:plan', JSON.stringify({ unit: pl.unit, warmMin: pl.warmMin, warmP: pl.warmP, startP: pl.startP, inc: pl.inc, stageMin: pl.stageMin, shortMin: pl.shortMin })); } catch (e) { }
      later(() => { rebuild(); buildDetails(); buildTabs(); recompute(); });
    };
    $('#plOff').onclick = () => { set.plan = null; set.inc.t0 = set.inc.t1 = null; later(() => { rebuild(); buildDetails(); buildTabs(); recompute(); }); };
  }
  function protoSummary(stageTxt) {
    const pr = S.proto;
    if (!S.I) return '<p class="hint">Gas data only. No power or speed has been entered yet.</p>';
    if (pr.type === 'incremental') return `<p class="hint">${S.I.mode === 'cycling' ? 'Cycling' : 'Treadmill'} incremental test. Stages: ${esc(stageTxt)}${S.set.blocks || S.set.plan ? ' (entered by hand)' : ''}.</p>`;
    const tests = (pr.allTests || []).map((T, i) => `<label class="chk"><input type="checkbox" data-ex="${Math.round(T.t0)}" ${S.set.excluded.includes(Math.round(T.t0)) ? '' : 'checked'}>${L.testName(pr, i)}: ${mmss(T.t0)}–${mmss(T.t1)}, ${T.steps.map(s => +s.p.toFixed(1)).join(', ')} ${S.I.unit}${T.complete ? '' : ' (partial)'}</label>`).join('<br>');
    setTimeout(() => $$('[data-ex]').forEach(el => (el.onchange = () => { const k = +el.dataset.ex, a = S.set.excluded; if (el.checked) a.splice(a.indexOf(k), 1); else a.push(k); rebuild(); buildTabs(); recompute(); })), 0);
    return `<p class="hint">${S.I.mode === 'cycling' ? 'Cycling' : 'Treadmill'} prolonged trial. Steady work: ${F(pr.base) ? iVal(pr.base) : 'none found'}${pr.ttf && pr.maot ? `; work ends at ${mmss(pr.ttf)}; all-out test at ${mmss(pr.maot.t0)}` : ''}.${pr.pauses.length ? ' ' + pr.pauses.length + ' pause(s).' : ''} ${tests ? 'Tick the step tests to include:' : 'No step tests found.'}</p>${tests ? `<div class="hint">${tests}</div>` : ''}`;
  }
  function drawChecks() { const el = $('#chk'); if (!el || !S.checks) return; const ic = { ok: '✓', warn: '!', info: 'i' }; el.innerHTML = S.checks.map(c => `<li class="${c.level}"><span class="ic" aria-hidden="true">${ic[c.level]}</span><span>${esc(c.text)}</span></li>`).join(''); }

  function buildProc() {
    const o = S.set.outl, av = S.set.avg, bxb = S.gas.kind === 'bxb', unit = bxb ? 'breaths' : 'samples', on = (id, fn) => { const el = $(id); if (el) el.onchange = e => later(() => fn(e)); };
    const modes = [['raw', bxb ? 'Breath by breath' : 'As in file'], ['bin', 'Time bins'], ['ma', 'Moving average'], ['roll', 'Rolling average']];
    $('#qForm').innerHTML = `
      <div class="step"><h4>Averaging <span>for the charts; VO₂peak and stage means use the recorded data in their own windows</span></h4>
        <div class="tools">${modes.map(([m, l]) => `<button data-am="${m}" aria-pressed="${av.mode === m}">${l}</button>`).join('')}
        ${av.mode === 'raw' ? '' : `<label class="chk"><input type="number" min="1" step="1" id="aPar" value="${avgParOf(S.set)}" style="width:4.5em"> ${av.mode === 'ma' ? unit : 's'}</label>`}</div></div>
      <div class="step"><h4>Outliers</h4>
        <div class="tools"><label class="chk"><input type="checkbox" id="oLocal" ${o.local ? 'checked' : ''}>Flag outliers</label>
        <select id="oNsd" ${o.local ? '' : 'disabled'}><option value="3">Strict (3 SD)</option><option value="4">Standard (4 SD)</option><option value="5">Lenient (5 SD)</option></select>
        <label class="chk"><input type="checkbox" id="oRem" ${o.remove ? 'checked' : ''} ${o.local ? '' : 'disabled'}>Remove flagged ${unit}</label>
        <label class="chk"><input type="checkbox" id="oShow" ${o.show && !o.remove && o.local ? 'checked' : ''} ${o.remove || !o.local ? 'disabled' : ''}>Show them on the Protocol chart</label></div>
        <p class="hint">${o.local ? `A ${bxb ? 'breath' : 'sample'} is flagged if VO₂, VCO₂ or VE is more than ${o.nsd} SD from the mean of the 5 ${unit} on each side${bxb ? `, breathing frequency is outside ${o.rfMin}–${o.rfMax} breaths/min, or tidal volume is under ${o.vtMin} L` : ''}. Flagged ${unit} stay in every calculation unless you remove them; removed ${unit} also leave the charts.` : 'Flagging is off, so every recorded ' + (bxb ? 'breath' : 'sample') + ' is used.'} ${unit[0].toUpperCase() + unit.slice(1)} with no VO₂ are always left out.</p></div>`;
    $('#oNsd').value = String(o.nsd);
    $$('[data-am]').forEach(b => (b.onclick = () => { av.mode = b.dataset.am; if (S.gas.kind === 'avg' && av.mode === 'bin' && av.bin < S.gas.avgWidth) av.bin = S.gas.avgWidth; buildProc(); recompute(); }));
    on('#aPar', e => { const v = Math.max(1, parseFloat(e.target.value) || 1); if (av.mode === 'bin') av.bin = Math.max(v, S.gas.kind === 'avg' ? S.gas.avgWidth : 1); else if (av.mode === 'ma') av.ma = Math.round(v); else av.roll = v; buildProc(); recompute(); });
    on('#oLocal', e => { o.local = e.target.checked; buildProc(); recompute(); }); on('#oNsd', e => { o.nsd = parseFloat(e.target.value); buildProc(); recompute(); });
    on('#oRem', e => { o.remove = e.target.checked; buildProc(); recompute(); }); on('#oShow', e => { o.show = e.target.checked; render(); });
  }
  function summaries() {
    const pr = S.proto, I = S.I, m = S.meta;
    $('#who').textContent = [m.studyId, m.name, m.date].filter(Boolean).join(' · ');
    const what = !I ? 'Gas data only, no power entered' : (I.mode === 'cycling' ? 'Cycling' : 'Treadmill') + ' · ' + (pr.type === 'incremental' ? 'Incremental' + (pr.inc && !pr.inc.ramp && pr.inc.stages.length ? ', ' + pr.inc.stages.length + ' stages' : '') : pr.tests.length + ' step test' + (pr.tests.length === 1 ? '' : 's'));
    const nw = (S.checks || []).filter(c => c.level === 'warn').length;
    $('#dSum').textContent = what + (F(m.mass) ? ' · ' + m.mass + ' kg' : '') + (nw ? ` · ${nw} check${nw > 1 ? 's' : ''} to review` : ' · checks passed');
    const fl = S.D.fl.flag, n = fl.length, f = fl.filter(x => x === 1 || x === 2).length;
    $('#qSum').textContent = `${avgLabel()} · ${f} of ${n} flagged, ${S.set.outl.remove ? 'removed' : 'kept'}`;
    drawChecks();
  }

  /* ---------------- Tabs ---------------- */
  function tabs() { return [['protocol', 'Protocol'], ...(S.proto.type === 'incremental' ? [['incremental', 'Incremental test']] : [['steps', 'Step tests'], ...(F(S.proto.base) ? [['prolonged', 'Prolonged exercise']] : [])]), ['summary', 'Summary']]; }
  function buildTabs() {
    const T = tabs(); if (!T.some(t => t[0] === S.view)) S.view = 'protocol';
    $('#tabs').innerHTML = T.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === S.view}">${l}</button>`).join('');
    $$('[data-tab]').forEach(b => (b.onclick = () => { S.view = b.dataset.tab; $$('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b)); render(); }));
  }
  function render() {
    $$('#views .js-plotly-plot').forEach(el => Plotly.purge(el));
    ({ protocol: vProtocol, incremental: vIncremental, steps: vSteps, prolonged: vProlonged, summary: vSummary })[S.view]();
  }

  /* ---------------- Plot helpers ---------------- */
  const CFG = { responsive: true, displaylogo: false, displayModeBar: true, scrollZoom: true, showTips: false, doubleClick: false, modeBarButtons: [['pan2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'resetScale2d']] };
  function ax(title, extra) { return Object.assign({ showline: true, linecolor: css('--axis'), linewidth: 1.2, ticks: 'outside', tickcolor: css('--axis'), ticklen: 4, gridcolor: css('--grid'), zeroline: false, automargin: false, tickfont: { color: css('--muted'), size: 11 }, title: { text: title || '', font: { color: css('--fg'), size: 12 } } }, extra || {}); }
  function lay(extra) { return Object.assign({ paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { family: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', color: css('--fg') }, dragmode: 'pan', hovermode: 'closest', margin: { l: 62, r: 16, t: 26, b: 48 }, showlegend: false }, extra || {}); }
  function robustRange(vals) { const v = vals.filter(F); if (!v.length) return undefined; const a = C.quant(v, .01), b = C.quant(v, .99), p = Math.max((b - a) * .1, Math.abs(b) * .01, 1e-3); return [a - p, b + p]; }
  const chips = (keys, sel, attr) => keys.map(k => `<button ${attr}="${k}" aria-pressed="${sel.includes(k)}">${VARS[k].h}</button>`).join('');
  function multiToggle(attr, arr, max, cb) { $$(`[${attr}]`).forEach(b => (b.onclick = () => { const k = b.getAttribute(attr), i = arr.indexOf(k); if (i >= 0) { if (arr.length > 1) arr.splice(i, 1); } else { arr.push(k); if (arr.length > max) arr.shift(); } cb(); })); }

  /* ---------------- Protocol: the whole test, stacked panels on one time axis ---------------- */
  function vProtocol() {
    const set = S.set, av = availVars(), I = S.I, pr = S.proto, Xs = S.D.X, g = S.gas;
    set.view.vars = set.view.vars.filter(k => av.includes(k)); if (!set.view.vars.length) set.view.vars = [av[0]];
    const end = Math.max(g.t.at(-1), I ? I.t.at(-1) : 0) / 60;
    const jumps = [['all', 'Whole test', [0, end]]];
    if (pr.type === 'incremental' && pr.inc) jumps.push(['inc', 'Incremental', [pr.inc.t0 / 60 - .5, pr.inc.t1 / 60 + .5]]);
    pr.tests.forEach((T, i) => { if (pr.type !== 'incremental') jumps.push(['t' + i, L.testName(pr, i), [T.t0 / 60 - 1, T.t1 / 60 + 1]]); });
    if (pr.maot) jumps.push(['m', 'All-out', [pr.maot.t0 / 60 - 3, pr.maot.t1 / 60 + 2]]);
    const vars = set.view.vars, n = vars.length, panelPx = 132, iPx = I ? 112 : 0, gapPx = 12, sliderPx = 46, topPx = 44, H = topPx + n * (panelPx + gapPx) + iPx + sliderPx + 30;
    $('#views').innerHTML = `
      <div class="tools"><span>Show (up to 6):</span>${chips(av, vars, 'data-sv')}</div>
      <div class="tools"><span>Averaging:</span><select id="vAvg">${[['raw', S.gas.kind === 'bxb' ? 'Breath by breath' : 'As in file'], ['bin:15', '15-s bins'], ['bin:30', '30-s bins'], ['bin:60', '60-s bins'], ['roll:30', '30-s rolling'], ['custom', 'Custom (under Data processing)']].map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
        <span class="sep"></span><span>Go to:</span>${jumps.map(j => `<button data-j="${j[0]}">${j[1]}</button>`).join('')}</div>
      <div class="panel"><div class="readout big" id="cur">Move over the chart to read every variable at one moment.</div>
        <div class="chartwrap" id="cwrap"><div class="chart" id="pv" style="height:${H}px"></div><div class="cursor" id="cline"></div><div class="zshade" id="zshade"></div></div>
        <div class="readout" id="ro"></div></div>
      <ul class="notes"><li>Scroll to zoom, or use the tools at the top right of the chart: with the move tool, drag along time; with the zoom tool, drag across the period you want. You can also drag the handles of the strip under the chart. Each panel rescales to the data in view. Double-click resets. The line under the chart gives the mean ± SD of what is in view.</li>
      ${I ? `<li>Shaded: test stages (blue)${pr.maot ? ', all-out test (red)' : ''}. The ${I.label.toLowerCase()} panel gives each stage’s ${I.label.toLowerCase()}, with RPE and any other COSMED markers above it.</li>` : ''}</ul>`;
    multiToggle('data-sv', vars, 6, () => vProtocol());
    const curAvg = set.avg.mode === 'raw' ? 'raw' : set.avg.mode + ':' + avgParOf(set);
    const sel = $('#vAvg'); sel.value = [...sel.options].some(o => o.value === curAvg) ? curAvg : 'custom';
    sel.onchange = () => { const v = sel.value; if (v === 'custom') { $('#qBox').open = true; return; } const [m, p] = v.split(':'); set.avg.mode = m; if (m === 'bin') set.avg.bin = Math.max(+p, g.kind === 'avg' ? g.avgWidth : 1); if (m === 'roll') set.avg.roll = +p; buildProc(); recompute(); };

    const totalPlot = H - topPx - sliderPx - 30, toDom = px => px / H; // paper fractions; the slider and x axis sit below y = 0 via margin
    const gapX = Math.max(g.kind === 'bxb' ? 20 : 1.5 * (g.avgWidth || 15), 1.5 * (Xs.width || 0), set.avg.mode === 'bin' ? 1.5 * set.avg.bin : 0);
    const tr = [], layH = totalPlot, L2 = lay({ margin: { l: 66, r: 18, t: topPx, b: sliderPx + 30 }, hovermode: false, shapes: [], annotations: [] }), series = {};
    const showRaw = set.avg.mode !== 'raw', rawSize = g.kind === 'bxb' ? 3 : 5, rawOp = g.kind === 'bxb' ? .22 : .45;
    let y = layH;
    vars.forEach((k, j) => {
      const yax = 'y' + (j ? j + 1 : ''), dom = [(y - panelPx) / layH, y / layH]; y -= panelPx + gapPx;
      const Xp = [], Yp = []; Xs.t.forEach((t, i) => { if (i && t - Xs.t[i - 1] > gapX) { Xp.push(null); Yp.push(null); } Xp.push(t / 60); Yp.push(Xs.v[k][i]); });
      series[j] = { k, x: Xp, y: Yp };
      if (showRaw && S.D.R0.v[k]) { const R = S.D.R0; tr.push({ x: R.t.map(t => t / 60), y: R.v[k], xaxis: 'x', yaxis: yax, type: 'scattergl', mode: 'markers', marker: { color: css('--rf'), size: rawSize, opacity: rawOp }, hoverinfo: 'skip' }); }
      tr.push({ x: Xp, y: Yp, xaxis: 'x', yaxis: yax, type: 'scattergl', mode: set.avg.mode === 'raw' ? 'markers' : 'lines', connectgaps: false, marker: { color: css('--ma'), size: 4 }, line: { color: css('--ma'), width: 2 }, hoverinfo: 'skip' });
      if (set.outl.show && !set.outl.remove && set.outl.local && g.v[k]) { const fl = S.D.fl.flag, a = []; for (let i = 0; i < g.t.length; i++) if ((fl[i] === 1 || fl[i] === 2) && F(g.v[k][i])) a.push(i); tr.push({ x: a.map(i => g.t[i] / 60), y: a.map(i => g.v[k][i]), xaxis: 'x', yaxis: yax, type: 'scattergl', mode: 'markers', marker: { color: css('--accent'), size: 8, symbol: 'x' }, hoverinfo: 'skip' }); }
      L2[yax.replace('y', 'yaxis')] = ax(vlab(k), { domain: dom, anchor: 'x', fixedrange: true, title: { text: vlab(k), font: { size: 11, color: css('--fg') }, standoff: 6 } });
    });
    const iax = 'y' + (n + 1);
    if (I) {
      const ch = []; for (let i = 0; i < I.t.length; i++) if (i === 0 || I.p[i] !== I.p[i - 1] || i === I.t.length - 1) ch.push(i);
      tr.push({ x: ch.map(i => I.t[i] / 60), y: ch.map(i => I.p[i]), xaxis: 'x', yaxis: iax, type: 'scatter', mode: 'lines', line: { shape: 'hv', color: css('--power'), width: 1.5 }, fill: 'tozeroy', fillcolor: css('--powerfill'), hoverinfo: 'skip' });
      const top = C.quant(I.p.filter(F), .995) * 1.35 || 1;
      L2['yaxis' + (n + 1)] = ax(iLab(), { domain: [0, iPx / layH], anchor: 'x', fixedrange: true, range: [0, top], title: { text: iLab(), font: { size: 11, color: css('--fg') }, standoff: 6 } });
      // Annotations rather than a text trace, so the markers stay out of the overview strip.
      (g.markers || []).filter(m => m.text !== '').forEach(m => { const v = parseFloat(String(m.text).replace(',', '.')), isR = F(v) && v >= 6 && v <= 20; L2.annotations.push({ xref: 'x', yref: iax, x: m.t / 60, y: top * .95, showarrow: false, text: (isR ? 'RPE ' : '') + esc(m.text), font: { size: 10, color: css('--muted') } }); });
      // The value of each stage or steady block, just under its line.
      pr.plateaus.filter(q => q.dur >= 45 && q.p > (I.unit === 'W' ? 20 : 2)).forEach(q => L2.annotations.push({ xref: 'x', yref: iax, x: (q.t0 + q.t1) / 120, y: q.p, yanchor: 'top', showarrow: false, text: q.p.toFixed(iDp()), font: { size: 10, color: css('--fg') } }));
    }
    pr.phases.forEach(q => {
      if (q.kind === 'test' || q.kind === 'allout') L2.shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: q.t0 / 60, x1: q.t1 / 60, y0: 0, y1: 1, fillcolor: css(q.kind === 'test' ? '--test' : '--maot'), line: { width: 0 }, layer: 'below' });
      L2.annotations.push({ xref: 'x', yref: 'paper', x: (q.t0 + q.t1) / 120, y: 1, yanchor: 'bottom', showarrow: false, text: q.label, font: { size: 10, color: css('--muted') } });
    });
    L2.xaxis = ax('Time (min)', { anchor: I ? iax : 'y' + (n ? (n > 1 ? n : '') : ''), range: [0, end], rangeslider: { visible: true, thickness: 34 / H, bgcolor: css('--bg'), bordercolor: css('--line'), borderwidth: 1, range: [0, end] }, title: { text: 'Time (min)', font: { size: 12, color: css('--fg') }, standoff: 2 } });
    const gd = document.getElementById('pv');
    Plotly.newPlot(gd, tr, L2, CFG);
    gd.addEventListener('click', e => { if (e.detail > 1) setX([0, end]); });
    let busy = false, X0 = [0, end];
    function fit(x0, x1) { const up = {}; Object.values(series).forEach((s, j) => { const v = []; s.x.forEach((x, i) => { if (x !== null && x >= x0 && x <= x1 && F(s.y[i])) v.push(s.y[i]); }); const r = robustRange(v); if (r) up['yaxis' + (j ? j + 1 : '') + '.range'] = r; }); return up; }
    function readout(x0, x1) { $('#ro').textContent = `In view, ${x0.toFixed(1)}–${x1.toFixed(1)} min: ` + vars.map((k, j) => { const s = series[j], v = s.y.filter((q, i) => s.x[i] !== null && s.x[i] >= x0 && s.x[i] <= x1 && F(q)); return `${VARS[k].l} ${fx(C.mean(v), VARS[k].dp)} ± ${fx(C.sd(v), VARS[k].dp)}`; }).join(' · '); }
    function setX(r) { X0 = r.slice(); busy = true; Plotly.relayout(gd, Object.assign({ 'xaxis.range': r.slice() }, fit(r[0], r[1]))).then(() => { setTimeout(() => (busy = false), 0); }); readout(r[0], r[1]); }
    Plotly.relayout(gd, fit(0, end)); readout(0, end);
    const showMode = () => { gd.classList.remove('m-pan', 'm-zoom'); gd.classList.add(gd._fullLayout.dragmode === 'zoom' ? 'm-zoom' : 'm-pan'); }; showMode();
    gd.on('plotly_relayout', e => { showMode(); if (busy) return; let a = e['xaxis.range[0]'], b = e['xaxis.range[1]']; if (e['xaxis.range']) [a, b] = e['xaxis.range']; if (e['xaxis.autorange']) { a = 0; b = end; } if (a === undefined) return; X0 = [+a, +b]; busy = true; Plotly.relayout(gd, fit(+a, +b)).then(() => setTimeout(() => (busy = false), 0)); readout(+a, +b); });
    $$('[data-j]').forEach(b => (b.onclick = () => setX(jumps.find(j => j[0] === b.dataset.j)[2])));
    // Zoom tool: a light shade over the period being selected.
    const shade = $('#zshade');
    $('#cwrap').addEventListener('mousedown', ev => {
      if (gd._fullLayout.dragmode !== 'zoom' || ev.button) return;
      const fl = gd._fullLayout, xa = fl.xaxis, box = gd.getBoundingClientRect(), x0 = ev.clientX - box.left, y0 = ev.clientY - box.top, top = fl.margin.t, h = fl.height - fl.margin.t - fl.margin.b;
      if (x0 < xa._offset || x0 > xa._offset + xa._length || y0 < top || y0 > top + h) return;
      const clamp = x => Math.max(xa._offset, Math.min(xa._offset + xa._length, x));
      const mm = e => { const x = clamp(e.clientX - box.left); shade.style.display = 'block'; shade.style.left = Math.min(x, x0) + 'px'; shade.style.width = Math.abs(x - x0) + 'px'; shade.style.top = top + 'px'; shade.style.height = h + 'px'; };
      const mu = () => { shade.style.display = 'none'; window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
    }, true);
    // Cursor: a line across all panels and one reading of every variable.
    const line = $('#cline'), wrap = $('#cwrap'), cur = $('#cur');
    wrap.onmousemove = ev => {
      const xa = gd._fullLayout.xaxis, r = wrap.getBoundingClientRect(), px = ev.clientX - r.left - xa._offset; if (px < 0 || px > xa._length) { line.style.display = 'none'; return; }
      const ya = gd._fullLayout.margin.t, x = xa.p2l(px); line.style.display = 'block'; line.style.left = (ev.clientX - r.left) + 'px'; line.style.top = ya + 'px'; line.style.height = (gd._fullLayout.height - gd._fullLayout.margin.t - gd._fullLayout.margin.b) + 'px';
      const parts = vars.map((k, j) => { const s = series[j]; let best = null, d = Infinity; const a = bisect(s.x.map(q => (q === null ? -1 : q)), x); for (let i = Math.max(0, a - 2); i < Math.min(s.x.length, a + 2); i++) if (s.x[i] !== null) { const q = Math.abs(s.x[i] - x); if (q < d) { d = q; best = s.y[i]; } } return `${VARS[k].l} ${d < 0.6 ? fx(best, VARS[k].dp) : '–'}`; });
      if (I) parts.push(`${I.label} ${iVal(C.loadAt(I, x * 60))}`);
      cur.textContent = `${mmss(x * 60)} · ` + parts.join(' · ');
    };
    wrap.onmouseleave = () => { line.style.display = 'none'; };
  }

  /* ---------------- Threshold charts ---------------- */
  // ctx: { lines: ['vt1','vt2'], get(q) -> VO2, set(q, VO2), toX(VO2, key), fromX(x, key), pts: {t, v}, live(), done(), charts: [] }
  const vtColor = q => css(q === 'vt1' ? '--vt1' : '--vt2');
  const vtName = q => q.toUpperCase();
  const seriesColors = () => [css('--ma'), css('--t2')];
  function vtChart(id, ctx, spec) {
    const gd = document.getElementById(id), pts = ctx.pts, xv = spec.x === 't' ? pts.t.map(t => t / 60) : pts.v[spec.x], tr = [], colors = seriesColors(), ally = [];
    spec.y.forEach((k, i) => {
      const y = pts.v[k]; if (!y) return; ally.push(...y.filter(F));
      tr.push({ x: xv, y, type: xv.length > 1500 ? 'scattergl' : 'scatter', mode: 'markers', marker: { color: colors[i], size: 6, opacity: .75 }, name: VARS[k].l, hovertemplate: `${spec.x === 't' ? '%{x:.1f} min' : '%{x:.2f} L/min'}<br>${VARS[k].l} %{y:.${VARS[k].dp}f}<extra></extra>` });
    });
    const xr0 = xv.filter(F), pad = (Math.max(...xr0) - Math.min(...xr0)) * .03, xr = [Math.min(...xr0) - pad, Math.max(...xr0) + pad];
    const xTitle = { vo2: 'VO<sub>2</sub> (L/min)', vco2: 'VCO<sub>2</sub> (L/min)', t: 'Time (min)' }[spec.x];
    const LL = lay({ margin: { l: 58, r: 12, t: 22, b: 44 }, xaxis: ax(xTitle, { range: xr }), yaxis: ax(spec.yTitle, { range: robustRange(ally) }) });
    Plotly.newPlot(gd, tr, LL, Object.assign({}, CFG, { displayModeBar: false }));
    gd.addEventListener('click', e => { if (e.detail > 1) Plotly.relayout(gd, { 'xaxis.range': xr, 'yaxis.range': LL.yaxis.range }); });
    attachVT(gd, ctx, Object.assign({ xv }, spec));
    if (spec.fit) { // each figure has its own fitted-lines button
      const entry = ctx.charts.at(-1), head = gd.closest('.panel').querySelector('h3'), btn = document.createElement('button');
      btn.className = 'fitbtn'; btn.textContent = 'Fitted lines'; btn.setAttribute('aria-pressed', !!S.set.fits[id]);
      btn.onclick = () => { S.set.fits[id] = !S.set.fits[id]; btn.setAttribute('aria-pressed', S.set.fits[id]); drawOverlay(ctx, entry); };
      head.appendChild(btn);
    }
  }
  // The threshold lines and fitted lines are drawn on a thin layer over the chart, so they follow the cursor at full speed while dragging.
  function attachVT(gd, ctx, spec) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'vtov'); gd.style.position = 'relative'; gd.appendChild(svg);
    const entry = { gd, spec, svg, id: gd.id, clip: 'vc' + Math.random().toString(36).slice(2, 9) }; ctx.charts.push(entry);
    const redraw = () => drawOverlay(ctx, entry);
    gd.on('plotly_afterplot', redraw); gd.on('plotly_relayouting', redraw); redraw();
    const near = ev => { const xa = gd._fullLayout.xaxis, ya = gd._fullLayout.yaxis, r = gd.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top; if (py < ya._offset - 18 || py > ya._offset + ya._length) return null; let hit = null, bd = 9; ctx.lines.forEach(q => { const v = ctx.get(q); if (!F(v)) return; const d = Math.abs(xa.l2p(ctx.toX(v, spec.x)) + xa._offset - px); if (d < bd) { bd = d; hit = q; } }); return hit; };
    gd.addEventListener('mousemove', ev => { const c = near(ev) ? 'ew-resize' : ''; gd.style.cursor = c; const el = gd.querySelector('.nsewdrag'); if (el) el.style.cursor = c; }, true);
    gd.addEventListener('mousedown', ev => {
      const q = near(ev); if (!q) return; ev.stopPropagation(); ev.preventDefault();
      const r = gd.getBoundingClientRect(); let raf = 0;
      const mm = e => { const xa = gd._fullLayout.xaxis; let x = xa.p2l(e.clientX - r.left - xa._offset); x = Math.max(xa.range[0], Math.min(xa.range[1], x)); ctx.set(q, ctx.fromX(x, spec.x)); if (!raf) raf = requestAnimationFrame(() => { raf = 0; moveLines(ctx); ctx.live(); }); };
      const mu = () => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); moveLines(ctx); ctx.done(); };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
    }, true);
  }
  function drawOverlay(ctx, c) {
    const fl = c.gd._fullLayout; if (!fl || !fl.xaxis || !fl.yaxis) return;
    const xa = fl.xaxis, ya = fl.yaxis, l = xa._offset, t = ya._offset, w = xa._length, h = ya._length, px = x => l + xa.l2p(x), py = y => t + ya.l2p(y), sp = c.spec, colors = seriesColors();
    let out = `<defs><clipPath id="${c.clip}"><rect x="${l}" y="${t}" width="${w}" height="${h}"></rect></clipPath></defs>`;
    if (S.set.fits[c.id] && sp.fit) {
      const knots = ctx.lines.map(q => { const v = ctx.get(q); return F(v) ? ctx.toX(v, sp.x) : NaN; });
      sp.y.forEach((k, i) => { const f = L.piecewise(sp.xv, ctx.pts.v[k], knots); if (f) out += `<polyline class="fit" clip-path="url(#${c.clip})" fill="none" stroke="${sp.y.length > 1 ? colors[i] : css('--fg')}" stroke-width="2" points="${f.x.map((x, j) => px(x).toFixed(1) + ',' + py(f.y[j]).toFixed(1)).join(' ')}"></polyline>`; });
    }
    ctx.lines.forEach(q => {
      const v = ctx.get(q), x = F(v) ? ctx.toX(v, sp.x) : NaN; if (!F(x)) return;
      const X = px(x); if (X < l - 1 || X > l + w + 1) return;
      out += `<line data-q="${q}" data-x="${x}" x1="${X.toFixed(1)}" x2="${X.toFixed(1)}" y1="${t}" y2="${t + h}" stroke="${vtColor(q)}" stroke-width="2.5"></line><text x="${X.toFixed(1)}" y="${t - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="${vtColor(q)}">${vtName(q)}</text>`;
    });
    c.svg.innerHTML = out;
  }
  function moveLines(ctx) { ctx.charts.forEach(c => drawOverlay(ctx, c)); }

  /* ---------------- Incremental test ---------------- */
  function vIncremental() {
    const D = S.D.inc, set = S.set.inc, pr = S.proto;
    const I = S.I || { label: 'Intensity', unit: '', mode: '' };
    if (!pr.inc || !D) { $('#views').innerHTML = '<p class="msg">No ascending stages were found. Enter the protocol by hand under Test details.</p>'; return; }
    const ids = []; S.D.X.t.forEach((t, i) => { if (t >= D.t0 && t <= D.t1 && F(S.D.X.v.vo2[i]) && S.D.X.v.vo2[i] > .3) ids.push(i); });
    const pts = { t: ids.map(i => S.D.X.t[i]), v: {} }; Object.keys(S.D.X.v).forEach(k => (pts.v[k] = ids.map(i => S.D.X.v[k][i])));
    const M = D.map, ctx = {
      lines: ['vt1', 'vt2'], pts, charts: [], get: q => incVT(q), set: (q, v) => { S.picks.inc[q] = Math.round(v * 1000) / 1000; if (S.picks.incSrc) delete S.picks.incSrc[q]; }, live: () => incResults(),
      toX: (v, key) => (key === 'vo2' ? v : key === 'vco2' ? M.vco2At(M.tOf(v)) : M.tOf(v) / 60),
      fromX: (x, key) => (key === 'vo2' ? x : key === 'vco2' ? M.vo2At(M.tOfVco2(x)) : M.vo2At(x * 60)), done: () => { incResults(); summaries(); }
    };
    const xk = set.x, stW = [[30, '30 s'], [60, '60 s'], [90, '90 s']], pkW = [[15, '15 s'], [30, '30 s'], [60, '60 s']];
    $('#views').innerHTML = `
      <div class="stats" id="tiles"></div>
      <div id="vtwarn"></div>
      <div class="panel" style="padding:10px"><div class="tools">
        <span>Analysis window (min):</span><input type="number" step="0.25" id="cA" value="${(D.t0 / 60).toFixed(2)}"><span>to</span><input type="number" step="0.25" id="cB" value="${(D.t1 / 60).toFixed(2)}"><button id="cR">Reset</button>
        <span class="sep"></span><span>VO₂peak over:</span>${pkW.map(([v, l]) => `<button data-pk="${v}" aria-pressed="${set.peakWin === v}">${l}</button>`).join('')}
        <span class="sep"></span><span>Stage means and the VO₂–${I.label.toLowerCase()} regression use the last:</span>${stW.map(([v, l]) => `<button data-sw="${v}" aria-pressed="${set.stageWin === v}">${l}</button>`).join('')}
      </div>
      <p class="hint" style="margin-top:6px">${pr.inc.none ? 'With no stages entered, the window covers all the exercise data, including any warm-up. Set its start after the warm-up.' : 'The window starts 90 s into the first stage by default, so the rise in VO₂ at the start does not feed the threshold fits.'}</p></div>
      <div class="tools"><span>Plot thresholds against:</span><button data-x="vo2" aria-pressed="${xk === 'vo2'}">VO<sub>2</sub></button><button data-x="t" aria-pressed="${xk === 't'}">Time</button>
        <span class="hint">Drag a <b class="vt1c">VT1</b> or <b class="vt2c">VT2</b> line sideways on any chart (the cursor changes over it); it moves on all of them.</span></div>
      <div class="grid3">
        ${[['vs', 'V-slope', 'VCO<sub>2</sub> against VO<sub>2</sub>'], ['eq', 'Ventilatory equivalents', 'VE/VO<sub>2</sub> and VE/VCO<sub>2</sub>'], ['po', 'End-tidal O<sub>2</sub>', 'P<sub>ET</sub>O<sub>2</sub>'], ['pc', 'End-tidal CO<sub>2</sub>', 'P<sub>ET</sub>CO<sub>2</sub>'], ['vv', 'Ventilation against VCO<sub>2</sub>', 'VE against VCO<sub>2</sub>'], ['ve', 'Ventilation', 'VE'], ['rr', 'RER', ''], ['hh', 'Heart rate', ''], ['iv', iLab(), 'stage-end values against VO<sub>2</sub>']].map(([id, t, s]) => `<div class="panel"><h3>${t}<span>${s}</span></h3>${id === 'eq' ? `<div style="padding:2px 8px"><span class="lg"><i style="background:${css('--ma')}"></i>VE/VO₂</span><span class="lg"><i style="background:${css('--t2')}"></i>VE/VCO₂</span></div>` : ''}<div class="chart mid" id="vc_${id}"></div></div>`).join('')}
      </div>
      <h2 class="row">Thresholds</h2><div class="panel"><div class="tblwrap"><table id="vtT"></table></div><div class="tools" style="padding:0 8px 8px"><button id="rst">Reset both to suggestions</button><button id="addV2" hidden>Add a VT2 line</button></div></div>
      <h2 class="row">Oxynet suggestions<span>from the open-source pyoxynet models, run on this computer</span></h2>
      <div class="tools"><span>Give Oxynet:</span><button data-ow="analysis" aria-pressed="${S.set.oxyWin === 'analysis'}">Analysis window</button><button data-ow="whole" aria-pressed="${S.set.oxyWin === 'whole'}">All exercise data</button><span class="hint" id="oxS"></span></div>
      <div class="grid3">${[['cnn', 'CNN model'], ['lstm', 'LSTM model']].map(([m, t]) => `<div class="panel"><h3>${t}<span>domain outputs over time</span></h3><div style="padding:2px 8px">${[['--t3', 'Moderate'], ['--t2', 'Heavy'], ['--t1', 'Severe']].map(([c, n]) => `<span class="lg"><i style="background:${css(c)}"></i>${n}</span>`).join('')}</div><div class="chart mid" id="ox_${m}"></div><p class="hint" id="oxm_${m}" style="padding:0 10px 6px"></p></div>`).join('')}</div>
      <ul class="notes"><li>Oxynet reads 40-s windows and places each threshold at the start of the window in which its outputs cross, so each output is drawn at the start of its window and the dashed lines pass through the crossings. VT1 is the first crossing of moderate and heavy, and VT2 is the last crossing of heavy and severe. The outputs are smoothed network outputs, not calibrated probabilities. The LSTM outputs sum to 1, so they usually cross near 0.5; the CNN outputs do not, so they can cross higher. These are suggestions for the researcher, who places the final lines.</li><li>The result can shift noticeably with the data given, because Oxynet scales each signal over that data. Try both options, and move the analysis window if a warm-up is included.</li><li>Oxynet: Zignoli et al. (2022), <i>Eur J Sport Sci</i>, <a href="https://doi.org/10.1080/17461391.2020.1866081">doi:10.1080/17461391.2020.1866081</a>; Keir et al. (2026), <i>Sports Med</i>, <a href="https://doi.org/10.1007/s40279-026-02403-w">doi:10.1007/s40279-026-02403-w</a>. Full credits are in the Summary tab.</li></ul>
      <div class="row2"><div class="panel" style="flex:1 1 380px"><h3>How each method placed them<span>VO₂ in L/min; “Use” moves the line there</span></h3><div class="tblwrap"><table id="mT"></table></div></div>
      <div class="panel" style="flex:1 1 380px"><h3>Was it maximal?</h3><div class="tblwrap"><table id="eT"></table></div></div></div>
      <h2 class="row">Stages<span>mean of the last ${set.stageWin} s of each stage</span></h2><div class="panel"><div class="tblwrap"><table id="sT"></table></div></div>
      <ul class="notes"><li>${I.label} at a threshold comes from a regression of stage-end ${I.label === 'Speed' ? 'VO₂ on speed' : 'VO₂ on power'}, using stages of at least 2 min. “Stage” is the stage running when the line’s VO₂ was reached.</li><li>The solid lines start at the classical suggestion, and Oxynet never moves them unless you click Use. VT1 is the median of three two-line breakpoints (V-slope, VE/VO₂, PETO₂) up to 80% of the VO₂ range. VT2 is the median of three (VE against VCO₂, VE/VCO₂, PETCO₂) from 2 min after VT1 to 90 s before the end. All use the 15-s data in the analysis window, as a starting point for the researcher’s own judgement.</li></ul>`;
    const on = (id, fn) => { const el = $(id); if (el) el.onchange = e => later(() => fn(e)); };
    on('#cA', e => { set.t0 = parseFloat(e.target.value) * 60; recompute(); }); on('#cB', e => { set.t1 = parseFloat(e.target.value) * 60; recompute(); });
    $('#cR').onclick = () => { set.t0 = set.t1 = null; recompute(); };
    $$('[data-pk]').forEach(b => (b.onclick = () => { set.peakWin = +b.dataset.pk; recompute(); }));
    $$('[data-sw]').forEach(b => (b.onclick = () => { set.stageWin = +b.dataset.sw; recompute(); }));
    $$('[data-x]').forEach(b => (b.onclick = () => { set.x = b.dataset.x; vIncremental(); }));
    $('#rst').onclick = () => { S.picks.inc = {}; S.picks.incSrc = {}; moveLines(ctx); incResults(); summaries(); };
    $('#addV2').onclick = () => { S.picks.inc.vt2 = Math.round(((F(incVT('vt1')) ? incVT('vt1') : M.lo) + D.peak.vo2.value) / 2 * 1000) / 1000; moveLines(ctx); incResults(); };
    const specs = [
      ['vs', { x: 'vo2', y: ['vco2'], yTitle: 'VCO<sub>2</sub> (L/min)' }],
      ['eq', { x: xk, y: ['eqo2', 'eqco2'], yTitle: 'Ventilatory equivalent' }],
      ['po', { x: xk, y: ['peto2'], yTitle: 'P<sub>ET</sub>O<sub>2</sub> (mmHg)' }],
      ['pc', { x: xk, y: ['petco2'], yTitle: 'P<sub>ET</sub>CO<sub>2</sub> (mmHg)' }],
      ['vv', { x: 'vco2', y: ['ve'], yTitle: 'VE (L/min)' }],
      ['ve', { x: xk, y: ['ve'], yTitle: 'VE (L/min)' }],
      ['rr', { x: xk, y: ['rer'], yTitle: 'RER' }],
      ['hh', { x: xk, y: ['hr'], yTitle: 'Heart rate (bpm)' }]
    ];
    specs.forEach(([id, sp]) => { if (sp.y.some(k => pts.v[k] && pts.v[k].some(F))) vtChart('vc_' + id, ctx, Object.assign({ fit: true }, sp)); else $('#vc_' + id).innerHTML = '<p class="hint" style="padding:16px">Not in this file.</p>'; });
    intensityChart(ctx);
    $$('[data-ow]').forEach(b => (b.onclick = () => { S.set.oxyWin = b.dataset.ow; $$('[data-ow]').forEach(x => x.setAttribute('aria-pressed', x === b)); runOxynet(incResults); }));
    incResults();
    S._ctx = ctx;
    runOxynet(incResults);
    function incResults() {
      const v1 = incVT('vt1'), v2 = incVT('vt2'), pk = D.peak, mass = S.meta.mass;
      const at = v => { if (!F(v)) return {}; const t = M.tOf(v), hr = L.meanInWindow(S.D.R0, 'hr', t - 15, t + 15), iv = D.fit ? D.fit.m * v + D.fit.b : NaN, st = S.I ? C.loadAt(S.I, t) : NaN; return { t, hr, iv, st, pct: pk.vo2 ? 100 * v / pk.vo2.value : NaN, kg: F(mass) && mass > 0 ? v * 1000 / mass : NaN }; };
      const a1 = at(v1), a2 = at(v2); S._inc = { v1, v2, a1, a2 };
      const tile = (cls, big, lab, sub) => `<div class="stat ${cls}"><b>${big}</b><span>${lab}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
      $('#tiles').innerHTML =
        tile('key', pk.vo2 ? fx(pk.vo2.value, 2) + ' L/min' : '–', 'VO₂peak (' + set.peakWin + '-s mean)', pk.vo2kg ? fx(pk.vo2kg.value, 1) + ' mL/kg/min, at ' + mmss(pk.vo2.t1) : '') +
        tile('vt1b', F(v1) ? fx(v1, 2) + ' L/min' : 'Not set', 'VT1', F(v1) ? `${fx(a1.pct, 0)}% of peak · ${iVal(a1.iv)} · ${fx(a1.hr, 0)} bpm` : '') +
        tile('vt2b', F(v2) ? fx(v2, 2) + ' L/min' : 'Not set', 'VT2', F(v2) ? `${fx(a2.pct, 0)}% of peak · ${iVal(a2.iv)} · ${fx(a2.hr, 0)} bpm` : 'No clear break found; place it by eye') +
        tile('', pk.hr ? fx(pk.hr.value, 0) + ' bpm' : '–', 'Peak heart rate', '') + tile('', pk.rer ? fx(pk.rer.value, 2) : '–', 'Peak RER', '') + tile('', pk.ve ? fx(pk.ve.value, 0) + ' L/min' : '–', 'Peak VE', '') + tile('', iVal(pr.inc.peak), 'Peak ' + (I.label).toLowerCase(), '');
      const un = D.sugg.unsure, msgs = [];
      if (!F(S.picks.inc.vt1) && un.vt1) msgs.push(F(D.sugg.vt1) ? `The VT1 methods disagree${F(D.sugg.spread.vt1) ? ` by ${fx(D.sugg.spread.vt1, 2)} L/min` : ''}. Check it by eye.` : 'No VT1 break was found. Add it by eye.');
      if (!F(S.picks.inc.vt2) && un.vt2) msgs.push(F(D.sugg.vt2) ? `The VT2 suggestion is weak${F(D.sugg.spread.vt2) ? ` (methods differ by ${fx(D.sugg.spread.vt2, 2)} L/min)` : ''}. Check it by eye.` : 'No VT2 break was found before the final surge in ventilation. Use “Add a VT2 line” below if you can place it by eye.');
      $('#vtwarn').innerHTML = msgs.length ? `<div class="warnbox">${msgs.map(esc).join(' ')}</div>` : '';
      const iName = I.label.toLowerCase();
      const row = (q, v, a) => `<tr><td><b class="${q}c">${vtName(q)}</b>${F(S.picks.inc[q]) ? '' : ' <span class="hint">suggested</span>'}</td><td><input type="number" step="0.01" class="vtinput" data-vti="${q}" value="${F(v) ? v.toFixed(2) : ''}"></td><td>${fx(a.kg, 1)}</td><td>${fx(a.pct, 0)}</td><td>${iVal(a.iv)}</td><td>${iVal(a.st)}</td><td>${fx(a.hr, 0)}</td><td>${mmss(a.t)}</td></tr>`;
      $('#vtT').innerHTML = `<tr><th>Threshold</th><th>VO₂ (L/min)</th><th>VO₂ (mL/kg/min)</th><th>% VO₂peak</th><th>${I.label} (regression)</th><th>Stage</th><th>Heart rate (bpm)</th><th>Time</th></tr>` + row('vt1', v1, a1) + row('vt2', v2, a2);
      $$('[data-vti]').forEach(el => (el.onchange = () => later(() => { const x = parseFloat(el.value); if (S.picks.incSrc) delete S.picks.incSrc[el.dataset.vti]; if (F(x)) S.picks.inc[el.dataset.vti] = x; else delete S.picks.inc[el.dataset.vti]; moveLines(ctx); incResults(); summaries(); })));
      $('#addV2').hidden = F(v2);
      const mrow = (q, ms) => ms.map(m => `<tr><td><b class="${q}c">${vtName(q)}</b> ${m.label}</td><td>${m.ok ? fx(m.vo2, 2) : '<span class="hint">no break</span>'}</td><td>${m.ok ? `<button data-use="${q}:${m.vo2}">Use</button>` : ''}</td></tr>`).join('');
      const oxr = q => ['cnn', 'lstm'].map(mm => { const r = S.oxy && S.oxy.res && S.oxy.res[mm]; if (!r) return ''; const o = r[q], ok = o && !r.problem, nm = 'Oxynet ' + mm.toUpperCase(); return `<tr><td><b class="${q}c">${vtName(q)}</b> ${nm}</td><td>${ok ? fx(o.vo2, 2) : '<span class="hint">not placed</span>'}</td><td>${ok ? `<button data-use="${q}:${o.vo2}:${nm}">Use</button>` : ''}</td></tr>`; }).join('');
      const sv = S.gas.meta.saved || {}, svr = q => (F(sv[q]) ? `<tr><td><b class="${q}c">${vtName(q)}</b> Saved in the COSMED file</td><td>${fx(sv[q], 2)}</td><td><button data-use="${q}:${sv[q]}:COSMED file">Use</button></td></tr>` : '');
      $('#mT').innerHTML = '<tr><th>Method</th><th>VO₂</th><th></th></tr>' + mrow('vt1', D.sugg.vt1Methods) + oxr('vt1') + svr('vt1') + mrow('vt2', D.sugg.vt2Methods) + oxr('vt2') + svr('vt2');
      $$('[data-use]').forEach(b => (b.onclick = () => { const [q, v, src] = b.dataset.use.split(':'); S.picks.inc[q] = +(+v).toFixed(3); S.picks.incSrc = S.picks.incSrc || {}; if (src) S.picks.incSrc[q] = src; else delete S.picks.incSrc[q]; moveLines(ctx); incResults(); summaries(); }));
      $('#eT').innerHTML = '<tr><th>Criterion</th><th style="text-align:left">Result</th><th>Met</th></tr>' + D.effort.map(r => `<tr><td>${r.name}</td><td style="text-align:left;white-space:normal;min-width:16em">${esc(r.detail)}</td><td>${r.met === null ? '–' : r.met ? 'Yes' : '<b class="flag">No</b>'}</td></tr>`).join('');
      const isT = I.mode === 'treadmill', ec = isT ? '<th>Economy (mL/kg/km)</th><th>Energy cost (J/kg/m)</th>' : '<th>Gross efficiency (%)</th>';
      $('#sT').innerHTML = `<tr><th>${iLab()}</th><th>Length</th><th>VO₂ (L/min)</th><th>VO₂/kg</th><th>VCO₂</th><th>RER</th><th>VE</th><th>Heart rate</th><th>RPE</th>${ec}</tr>` + D.values.map((q, i) => `<tr><td>${q.p.toFixed(iDp())}${q.warm ? ' <span class="hint">warm-up</span>' : ''}</td><td>${mmss(q.dur)}</td><td>${fx(q.m.vo2, 2)}</td><td>${fx(q.m.vo2rel, 1)}</td><td>${fx(q.m.vco2, 2)}</td><td>${fx(q.m.rer, 2)}</td><td>${fx(q.m.ve, 1)}</td><td>${fx(q.m.hr, 0)}</td><td>${F(D.rpe[i]) ? D.rpe[i] : '–'}</td>${isT ? `<td>${fx(q.economy, 0)}</td><td>${fx(q.costJ, 2)}</td>` : `<td>${fx(q.ge, 1)}</td>`}</tr>`).join('');
    }
  }
  function intensityChart(ctx) {
    const D = S.D.inc, gd = document.getElementById('vc_iv'), use = D.values.filter(q => F(q.m.vo2)), fit = D.fit;
    if (!use.length) { gd.innerHTML = `<p class="hint" style="padding:16px">${S.I ? 'Ramp test: there are no stages to fit, so read the intensity from the time a threshold was reached.' : 'Enter the steps under Test details, or add a Lode file, to get power at each threshold.'}</p>`; return; }
    const inFit = fit ? new Set(fit.stages) : new Set();
    const tr = [{ x: use.filter(q => inFit.has(q)).map(q => q.m.vo2), y: use.filter(q => inFit.has(q)).map(q => q.p), mode: 'markers', type: 'scatter', marker: { size: 9, color: css('--ma') }, hovertemplate: '%{x:.2f} L/min<br>%{y} ' + S.I.unit + '<extra></extra>' },
      { x: use.filter(q => !inFit.has(q)).map(q => q.m.vo2), y: use.filter(q => !inFit.has(q)).map(q => q.p), mode: 'markers', type: 'scatter', marker: { size: 9, color: css('--panel'), line: { color: css('--ma'), width: 1.5 } }, hovertemplate: '%{x:.2f} L/min<br>%{y} ' + S.I.unit + ' (not in the fit)<extra></extra>' }];
    const xs = use.map(q => q.m.vo2), lo = Math.min(...xs), hi = Math.max(...xs);
    if (fit) tr.push({ x: [lo, hi], y: [fit.m * lo + fit.b, fit.m * hi + fit.b], mode: 'lines', type: 'scatter', line: { color: css('--fg'), width: 2 }, hoverinfo: 'skip' });
    const LL = lay({ margin: { l: 58, r: 12, t: 22, b: 44 }, xaxis: ax('VO<sub>2</sub> (L/min)'), yaxis: ax(iLab()), annotations: fit ? [{ xref: 'paper', yref: 'paper', x: .98, y: .03, xanchor: 'right', yanchor: 'bottom', showarrow: false, align: 'right', text: `${iLab()} = ${fit.m.toFixed(2)} × VO<sub>2</sub> ${fit.b >= 0 ? '+' : '−'} ${Math.abs(fit.b).toFixed(2)}<br>R² = ${fit.r2.toFixed(3)}, ${fit.nStages} stages (open points left out)`, font: { size: 11, color: css('--muted') } }] : [] });
    Plotly.newPlot(gd, tr, LL, Object.assign({}, CFG, { displayModeBar: false }));
    attachVT(gd, ctx, { x: 'vo2', y: [] });
  }

  /* ---------------- Oxynet ---------------- */
  function oxyInput() {
    const D = S.D.inc, R = S.D.R0, whole = S.set.oxyWin === 'whole', a = whole ? S.gas.t[0] : D.t0, b = whole ? L.exerciseEnd(S.gas) : D.t1, ids = [];
    R.t.forEach((t, i) => { if (t >= a && t <= b) ids.push(i); });
    const pick = k => ids.map(i => R.v[k][i]), out = { t: ids.map(i => R.t[i]) }; ['vo2', 'vco2', 've', 'peto2', 'petco2'].forEach(k => (out[k] = R.v[k] ? pick(k) : []));
    out.key = [a, b, out.t.length, S.set.outl.remove, S.set.outl.nsd, S.set.outl.local].join('|');
    return out;
  }
  function runOxynet(after) {
    if (!S.D.inc) return;
    const inp = oxyInput(), st = $('#oxS'), cached = S.oxyCache[inp.key];
    if (cached && cached.done) { S.oxy = cached; drawOxynet(); if (st) st.textContent = oxyStatus(); after(); return; }
    const job = S.oxy = { key: inp.key, res: {}, done: false }; S.oxyCache[inp.key] = job;
    job.promise = (async () => {
      for (const m of ['cnn', 'lstm']) {
        if ($('#oxm_' + m) && S.oxy === job) $('#oxm_' + m).textContent = 'Running…';
        try { job.res[m] = await LabOxynet.run(inp, m, f => { if ($('#oxS') && S.oxy === job) $('#oxS').textContent = `Running the ${m.toUpperCase()} model: ${Math.round(100 * f)}%`; }); }
        catch (e) { job.res[m] = { error: 'Could not run this model: ' + e.message }; }
      }
      job.done = true;
      if (S.oxy !== job) return;
      if ($('#oxS')) $('#oxS').textContent = oxyStatus();
      if (S.view === 'incremental' && $('#ox_cnn')) { drawOxynet(); after(); }
    })();
  }
  const oxyStatus = () => (S.set.oxyWin === 'whole' ? 'Using all the exercise data' : 'Using the analysis window');
  function drawOxynet() {
    ['cnn', 'lstm'].forEach(m => {
      const r = S.oxy.res[m], el = document.getElementById('ox_' + m), note = $('#oxm_' + m); if (!r || !el) return;
      if (r.error) { el.innerHTML = `<p class="hint" style="padding:16px">${esc(r.error)}</p>`; if (note) note.textContent = ''; return; }
      const x = r.time.map(t => (t - 40) / 60), tr = [['md', '--t3', 'Moderate'], ['hv', '--t2', 'Heavy'], ['sv', '--t1', 'Severe']].filter(q => r[q[0]]).map(([k, c, n]) => ({ x, y: r[k], mode: 'lines', type: 'scatter', line: { color: css(c), width: 2 }, name: n, hovertemplate: `%{x:.1f} min<br>${n} %{y:.2f}<extra></extra>` }));
      const shapes = [], ann = [];
      if (!r.problem) ['vt1', 'vt2'].forEach(q => { const o = r[q]; if (!o) return; shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: o.time / 60, x1: o.time / 60, y0: 0, y1: 1, line: { color: vtColor(q), width: 2, dash: 'dash' } }); ann.push({ xref: 'x', yref: 'paper', x: o.time / 60, y: 1, yanchor: 'bottom', showarrow: false, text: `<b>${vtName(q)}</b>`, font: { size: 11, color: vtColor(q) } }); });
      Plotly.newPlot(el, tr, lay({ margin: { l: 52, r: 12, t: 22, b: 44 }, xaxis: ax('Start of the 40-s window (min)'), yaxis: ax('Model output'), shapes, annotations: ann }), Object.assign({}, CFG, { displayModeBar: false }));
      if (note) note.textContent = r.problem ? r.problem + ' No suggestion from this model.' : `VT1 ${fx(r.vt1.vo2, 2)} L/min at ${mmss(r.vt1.time)}; VT2 ${fx(r.vt2.vo2, 2)} L/min at ${mmss(r.vt2.time)}.`;
    });
  }

  /* ---------------- Step tests ---------------- */
  function vSteps() {
    const set = S.set.st, pr = S.proto, D = S.D.st, av = availVars().filter(k => k !== 'vo2' && k !== 'rpm' && k !== 'vo2kg');
    if (!pr.tests.length || !D) { $('#views').innerHTML = `<p class="msg">No step tests ${(pr.allTests || []).length ? 'are ticked' : 'were found'}. Check Test details, or enter the stages by hand there.</p>`; return; }
    set.meas = set.meas.filter(k => av.includes(k)); if (!set.meas.length) set.meas = [av[0]];
    const X = S.D.X, A = D.A, dur = pr.pattern ? pr.pattern.stepDur : 240, wins = [dur, 180, 120, 60].filter((v, i, a) => v <= dur && a.indexOf(v) === i);
    const curWin = isWholeStage() ? dur : set.win;
    const cmpVars = ['vo2', 'vo2kg', 'hr', 'rer', 've', 'eqo2', 'eqco2', 'peto2', 'petco2', 'cho', 'fat'].filter(k => k === 'cho' || k === 'fat' || av.concat(['vo2', 'vo2kg']).includes(k));
    const name = i => L.testName(pr, i), ec = S.I.mode === 'treadmill' ? 'Economy' : 'Gross efficiency';
    set.cmp = set.cmp.filter(k => cmpVars.includes(k) || k === 'econ' || k === 'rpe'); if (!set.cmp.length) set.cmp = ['vo2'];
    $('#views').innerHTML = `
      <h2 class="row">VT1 in each test</h2><div class="panel"><div class="tblwrap"><table id="vt1T"></table></div><div class="tools" style="padding:0 8px 8px"><button id="rstT">Reset to suggestions</button></div></div>
      <div class="tools"><span>Plot against VO₂ (up to 4):</span>${chips(av, set.meas, 'data-sm')}</div>
      <div class="tools"><span>Chart points use the last:</span>${wins.map(w => `<button data-sw="${w}" aria-pressed="${curWin === w}">${w === dur ? mmss(w) + ' (whole stage)' : mmss(w)}</button>`).join('')}<span class="hint">Drag the <b class="vt1c">VT1</b> line sideways; it moves on every chart for that test.</span></div>
      ${set.meas.map(k => `<h2 class="row">${VARS[k].h} against VO<sub>2</sub><span>${avgLabel()}</span></h2><div class="grid3">${pr.tests.map((T, i) => `<div class="panel"><h3><span class="dot" style="background:${tcol(i)}"></span>${name(i)}<span>${mmss(T.t0)}–${mmss(T.t1)}${T.complete ? '' : ' · partial'}</span></h3><div class="chart mid" id="st_${k}_${i}"></div></div>`).join('')}</div>`).join('')}
      <h2 class="row">Compare the tests, stage by stage<span>mean of the last ${set.regWin} s of each stage</span></h2>
      <div class="tools"><span>Show (up to 4):</span>${cmpVars.map(k => `<button data-cm="${k}" aria-pressed="${set.cmp.includes(k)}">${VARS[k] ? VARS[k].h : k}</button>`).join('')}<button data-cm="econ" aria-pressed="${set.cmp.includes('econ')}">${ec}</button><button data-cm="rpe" aria-pressed="${set.cmp.includes('rpe')}">RPE</button>
        <span class="sep"></span><span>Stage means and VO₂–${S.I.label.toLowerCase()} regressions use the last:</span>${[[30, '30 s'], [60, '60 s'], [120, '2 min']].map(([v, l]) => `<button data-rw="${v}" aria-pressed="${set.regWin === v}">${l}</button>`).join('')}</div>
      <div style="padding:2px 2px">${pr.tests.map((T, i) => `<span class="lg"><i style="background:${tcol(i)}"></i>${name(i)}</span>`).join('')}</div>
      <div class="grid3">${set.cmp.map(k => `<div class="panel"><h3>${k === 'econ' ? ec : k === 'rpe' ? 'RPE' : VARS[k].h}<span>${k === 'econ' ? (S.I.mode === 'treadmill' ? 'mL/kg/km' : '%') : k === 'rpe' ? 'COSMED markers' : VARS[k].u}</span></h3><div class="chart mid" id="cm_${k}"></div></div>`).join('')}</div>
      <ul class="notes"><li>${S.I.label} at VT1 comes from each test’s regression of stage-end VO₂ on ${S.I.label.toLowerCase()}, over the full stages.</li><li>The VT1 line starts at the mean of the two-line breakpoints from V-slope and VE/VO₂ against VO₂, using the last 2 min of each stage, because VO₂ is still rising early in a stage, especially the first. If neither shows a break, it starts at the 45th percentile of VO₂. This is a starting point for the researcher’s own judgement.</li>${S.I.mode === 'treadmill' ? '<li>Economy is only meaningful in a steady state, so read stages above VT1 with care.</li>' : ''}</ul>`;
    multiToggle('data-sm', set.meas, 4, () => vSteps());
    multiToggle('data-cm', set.cmp, 4, () => vSteps());
    $$('[data-sw]').forEach(b => (b.onclick = () => { set.win = +b.dataset.sw; recompute(); }));
    $$('[data-rw]').forEach(b => (b.onclick = () => { set.regWin = +b.dataset.rw; recompute(); }));
    const ctxs = pr.tests.map((T, ti) => {
      const key = testKey(T), ids = []; X.t.forEach((t, i) => { if (A.test[i] === ti && C.inWin(A, i, stWin()) && F(X.v.vo2[i]) && X.v.vo2[i] > .3) ids.push(i); });
      const pts = { t: ids.map(i => X.t[i]), v: {} }; Object.keys(X.v).forEach(k => (pts.v[k] = ids.map(i => X.v[k][i])));
      return { lines: ['vt1'], pts, charts: [], get: () => testVT1(ti), set: (q, v) => { S.picks.tests[key] = { vt1: Math.round(v * 1000) / 1000 }; }, toX: v => v, fromX: x => x, live: () => vtTable(), done: () => { vtTable(); summaries(); } };
    });
    set.meas.forEach(k => pr.tests.forEach((T, ti) => { if (ctxs[ti].pts.t.length) vtChart(`st_${k}_${ti}`, ctxs[ti], { x: 'vo2', y: [k], yTitle: vlab(k), fit: true }); }));
    $('#rstT').onclick = () => { S.picks.tests = {}; ctxs.forEach(c => moveLines(c)); vtTable(); summaries(); };
    function vtTable() {
      const base = testVT1(0), bI = D.fits[0] ? D.fits[0].m * base + D.fits[0].b : NaN;
      $('#vt1T').innerHTML = `<tr><th>Test</th><th>${iLab()} steps</th><th>VT1 VO₂ (L/min)</th><th>VT1 ${S.I.label.toLowerCase()} (${S.I.unit})</th><th>Regression R²</th><th>Heart rate at VT1</th><th>VO₂ change from test 1</th><th>${S.I.label} change from test 1</th></tr>` + pr.tests.map((T, i) => {
        const v = testVT1(i), f = D.fits[i], iv = f && F(v) ? f.m * v + f.b : NaN, sv = D.SM[i].filter(q => F(q.m.vo2) && F(q.m.hr)), hr = sv.length >= 2 ? (() => { const r = C.linreg(sv.map(q => q.m.vo2), sv.map(q => q.m.hr)); return r.m * v + r.b; })() : NaN, pickd = F((S.picks.tests[testKey(T)] || {}).vt1);
        return `<tr><td><span class="dot" style="background:${tcol(i)}"></span>${name(i)}${pickd ? '' : ' <span class="hint">suggested</span>'}</td><td>${T.steps.map(s => +s.p.toFixed(1)).join(', ')}</td><td><input type="number" step="0.01" class="vtinput" data-tv="${i}" value="${F(v) ? v.toFixed(2) : ''}"></td><td>${fx(iv, iDp())}</td><td>${f ? f.r2.toFixed(3) : '–'}</td><td>${fx(hr, 0)}</td><td>${i ? (v - base >= 0 ? '+' : '') + fx(v - base, 2) : ''}</td><td>${i && F(iv) && F(bI) ? (iv - bI >= 0 ? '+' : '') + fx(iv - bI, iDp()) : ''}</td></tr>`;
      }).join('');
      $$('[data-tv]').forEach(el => (el.onchange = () => later(() => { const i = +el.dataset.tv, x = parseFloat(el.value), key = testKey(pr.tests[i]); if (F(x)) S.picks.tests[key] = { vt1: x }; else delete S.picks.tests[key]; moveLines(ctxs[i]); vtTable(); summaries(); })));
    }
    vtTable();
    // Stage comparison charts and table
    const rpeOf = (i, j) => D.rpe[i] && F(D.rpe[i][j]) ? D.rpe[i][j] : NaN;
    const valOf = (q, k) => (k === 'econ' ? (S.I.mode === 'treadmill' ? q.economy : q.ge) : k === 'vo2kg' ? q.m.vo2rel : q.m[k]);
    const allP = [...new Set(D.SM.flat().map(q => q.p))].sort((a, b) => a - b);
    set.cmp.forEach(k => {
      const dp = k === 'rpe' ? 1 : k === 'econ' ? (S.I.mode === 'treadmill' ? 0 : 1) : VARS[k].dp;
      const tr = D.SM.map((v, i) => ({ x: v.map(q => q.p), y: v.map((q, j) => (k === 'rpe' ? rpeOf(i, j) : valOf(q, k))), mode: 'lines+markers', type: 'scatter', line: { color: tcol(i), width: 2 }, marker: { size: 8, color: tcol(i), symbol: ['circle', 'square', 'diamond', 'triangle-up', 'x', 'cross'][i % 6], line: { color: css('--panel'), width: 2 } }, name: name(i), hovertemplate: `${name(i)}<br>%{x} ${S.I.unit}: %{y:.${dp}f}<extra></extra>` }));
      Plotly.newPlot('cm_' + k, tr, lay({ margin: { l: 58, r: 12, t: 12, b: 44 }, xaxis: ax(iLab(), { tickvals: allP.length <= 8 ? allP : undefined }), yaxis: ax('') }), Object.assign({}, CFG, { displayModeBar: false }));
    });
  }
  const tcol = i => css('--t' + ((i % 6) + 1));
  /* ---------------- Prolonged exercise ---------------- */
  function periodRows() {
    const pr = S.proto, X = S.D.X, isT = S.I.mode === 'treadmill', mass = S.meta.mass, blocks = L.steadyTotals(pr, S.I.unit).blocks;
    const mk = (S.gas.markers || []).map(m => ({ t: m.t, v: parseFloat(String(m.text).replace(',', '.')) })).filter(m => F(m.v) && m.v >= 6 && m.v <= 20);
    return (S.D.per || []).filter(p => p.avgWin && p.n).map(p => {
      const b = blocks.findIndex(q => p.t0 >= q.t0 - 30 && p.t0 < q.t1), q = blocks[b], val = k => L.periodValue(X, p, k), r = { p, block: b + 1, into: q ? (p.avgWin[1] - q.t0) / 60 : NaN, mid: (p.avgWin[0] + p.avgWin[1]) / 120 };
      ['vo2', 'vo2kg', 'vco2', 've', 'hr', 'eqo2', 'eqco2', 'rf', 'vt'].forEach(k => (r[k] = val(k)));
      r.rer = p.rer; r.cho = p.cho; r.fat = p.fat;
      r.econ = isT ? [F(mass) && mass > 0 ? r.vo2[0] * 1000 / mass * 60 / pr.base : NaN, F(mass) && mass > 0 ? r.vo2[1] * 1000 / mass * 60 / pr.base : NaN] : p.ge;
      const e = C.energy(p.cho[0], p.fat[0], C.ee(r.vo2[0], r.vco2[0]), isT ? 0 : pr.base); r.energy = e;
      const hit = mk.filter(m => m.t >= p.t0 - 30 && m.t <= p.t1 + 30); r.rpe = hit.length ? hit.at(-1).v : NaN;
      return r;
    });
  }
  function vProlonged() {
    const pr = S.proto, I = S.I, set = S.set.per, rows = periodRows(), isT = I.mode === 'treadmill', ec = isT ? 'Economy' : 'Gross efficiency', ecU = isT ? 'mL/kg/km' : '%', tot = L.steadyTotals(pr, I.unit);
    if (!rows.length) { $('#views').innerHTML = `<p class="msg">No gas recordings were found during the steady work at ${iVal(pr.base)}.</p>`; return; }
    const pm = (a, d) => (a && F(a[0]) ? a[0].toFixed(d) + ' ± ' + (F(a[1]) ? a[1].toFixed(d) : '–') : '–'), keys = ['vo2', 'vo2kg', 'hr', 've', 'rer', 'eqo2', 'eqco2', 'cho', 'fat'].filter(k => rows.some(r => r[k] && F(r[k][0])));
    const lab = k => (k === 'econ' ? ec : VARS[k].h), unit = k => (k === 'econ' ? ecU : VARS[k].u), dpOf = k => (k === 'econ' ? (isT ? 0 : 1) : VARS[k].dp), name = (r, i) => `Recording ${i + 1}`;
    set.vars = set.vars.filter(k => keys.includes(k) || k === 'econ'); if (!set.vars.length) set.vars = ['vo2'];
    const first = rows[0], last = rows.at(-1), vt0 = S.D.st && pr.tests.length ? (() => { const f = S.D.st.fits[0], v = testVT1(0); return f && F(v) ? f.m * v + f.b : NaN; })() : NaN;
    const diff = (k, d) => (F(last[k][0]) && F(first[k][0]) ? (last[k][0] - first[k][0] >= 0 ? '+' : '') + (last[k][0] - first[k][0]).toFixed(d) : '–');
    const allout = pr.maot && I.source === 'lode' ? C.threeMAOT({ t: I.t, p: I.p, rpm: I.rpm }, pr.maot, false) : null;
    const tile = (big, lab2, sub) => `<div class="stat"><b>${big}</b><span>${lab2}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    $('#views').innerHTML = `
      <div class="stats">${tile(iVal(pr.base), 'Steady ' + I.label.toLowerCase(), F(vt0) ? `${fx(100 * pr.base / vt0, 0)}% of VT1 from the first step test` : '')}${tile(mmss(tot.sec), 'Time at this ' + I.label.toLowerCase(), `${tot.blocks.length} block${tot.blocks.length > 1 ? 's' : ''}`)}${tile(fx(tot.amount, isT ? 1 : 0) + ' ' + tot.amountUnit, isT ? 'Distance' : 'Work')}${tile(diff('hr', 0) + ' bpm', 'Heart rate, first to last recording')}${tile(diff('vo2', 2) + ' L/min', 'VO₂, first to last recording')}${tile(diff('cho', 2) + ' g/min', 'Carbohydrate oxidation, first to last recording')}</div>
      <div class="tools"><span>Show (up to 6):</span>${keys.map(k => `<button data-pv="${k}" aria-pressed="${set.vars.includes(k)}">${VARS[k].h}</button>`).join('')}<button data-pv="econ" aria-pressed="${set.vars.includes('econ')}">${ec}</button>
        <span class="sep"></span><span>Average the last:</span>${[1, 2, 4].map(m => `<button data-pa="${m}" aria-pressed="${set.avgMin === m}">${m} min</button>`).join('')}<span class="hint">of each recording</span></div>
      <div class="grid3">${set.vars.map(k => `<div class="panel"><h3>${lab(k)}<span>${unit(k)}, mean ± SD</span></h3><div class="chart mid" id="pv_${k}"></div></div>`).join('')}</div>
      <h2 class="row">Each recording<span>mean ± SD of the last ${set.avgMin} min</span></h2>
      <div class="panel"><div class="tblwrap"><table id="pT"></table></div></div>
      <h2 class="row">Energy<span>same windows</span></h2>
      <div class="grid3"><div class="panel"><h3>Energy from carbohydrate and fat<span>kJ/min</span></h3><div style="padding:2px 8px"><span class="lg"><i style="background:${css('--t2')}"></i>Carbohydrate</span><span class="lg"><i style="background:${css('--t1')}"></i>Fat</span></div><div class="chart mid" id="peS"></div></div>
      <div class="panel"><div class="tblwrap"><table id="peT"></table></div></div></div>
      ${allout ? `<h2 class="row">All-out test<span>${mmss(pr.maot.t0)}–${mmss(pr.maot.t1)}, start spike left out of W′</span></h2><div class="stats">${tile(fx(allout.CP, 1) + ' W', 'Critical power', 'Mean of the last 30 s')}${tile(fx(allout.Wp / 1000, 2) + ' kJ', 'W′')}${tile(fx(allout.peak, 0) + ' W', 'Peak power')}${tile(fx(allout.mean, 0) + ' W', 'Mean power')}</div>` : ''}
      <ul class="notes"><li>Each recording is a stretch of gas data at the steady ${I.label.toLowerCase()}. The window ends just before the mask came off and looks back 4 min, leaving out partial breaths at mask-off and any 15-s bins below 80% or above 125% of the median VO₂. A recording of more than 10 min is split into 5-min windows.</li>
      <li>Oxidation: carbohydrate = 4.210 VCO₂ − 2.962 VO₂; fat = 1.695 VO₂ − 1.701 VCO₂ (Jeukendrup and Wallis, 2005). Valid while RER stays below 1, and carbohydrate includes any ingested during exercise. Energy from each substrate uses 17.57 kJ/g for carbohydrate and 39.33 kJ/g for fat. Energy expenditure: 16.89 VO₂ + 4.84 VCO₂ kJ/min (Brouwer, 1957).</li>
      <li>${isT ? 'Economy = VO₂ per kilogram per kilometre, at the steady speed.' : 'Gross efficiency = power ÷ metabolic power × 100.'} For any other part of the session, zoom to it on the Protocol tab and read the mean ± SD under the chart.</li></ul>`;
    multiToggle('data-pv', set.vars, 6, () => vProlonged());
    $$('[data-pa]').forEach(b => (b.onclick = () => { set.avgMin = +b.dataset.pa; recompute(); }));
    const bands = pr.phases.filter(q => q.kind === 'test' || q.kind === 'allout'), x = rows.map(r => r.mid);
    set.vars.forEach(k => {
      const y = rows.map(r => r[k][0]), e = rows.map(r => r[k][1]);
      Plotly.newPlot('pv_' + k, [{ x, y, error_y: { type: 'data', array: e, color: css('--muted'), thickness: 1.2, width: 4 }, type: 'scatter', mode: 'lines+markers', line: { color: css('--ma'), width: 2 }, marker: { color: css('--ma'), size: 9 }, customdata: rows.map((r, i) => name(r, i)), hovertemplate: `%{customdata}, %{x:.1f} min<br>%{y:.${dpOf(k)}f} ${unit(k)}<extra></extra>` }],
        lay({ margin: { l: 58, r: 12, t: 22, b: 44 }, xaxis: ax('Time in the session (min)'), yaxis: ax(''), shapes: bands.map(q => ({ type: 'rect', xref: 'x', yref: 'paper', x0: q.t0 / 60, x1: q.t1 / 60, y0: 0, y1: 1, fillcolor: css(q.kind === 'test' ? '--test' : '--maot'), line: { width: 0 }, layer: 'below' })), annotations: bands.map(q => ({ xref: 'x', yref: 'paper', x: (q.t0 + q.t1) / 120, y: 1, yanchor: 'bottom', showarrow: false, text: q.label, font: { size: 10, color: css('--muted') } })) }), Object.assign({}, CFG, { displayModeBar: false }));
    });
    const multi = tot.blocks.length > 1, cols = ['vo2', 'vo2kg', 'hr', 've', 'rer', 'cho', 'fat'].filter(k => keys.includes(k)), short = { cho: 'Carbohydrate', fat: 'Fat' };
    $('#pT').innerHTML = `<tr><th>Recording</th>${multi ? '<th>Block</th>' : ''}<th>Averaged (min of session)</th><th>Minutes into block</th>${cols.map(k => `<th>${short[k] || VARS[k].h}${VARS[k].u ? ` (${VARS[k].u})` : ''}</th>`).join('')}<th>${ec} (${ecU})</th><th>RPE</th></tr>` + rows.map((r, i) => `<tr><td>${i + 1}</td>${multi ? `<td>${r.block || '–'}</td>` : ''}<td>${fx(r.p.avgWin[0] / 60, 1)}–${fx(r.p.avgWin[1] / 60, 1)}</td><td>${fx(r.into, 0)}</td>${cols.map(k => `<td>${pm(r[k], dpOf(k))}</td>`).join('')}<td>${pm(r.econ, isT ? 0 : 1)}</td><td>${F(r.rpe) ? r.rpe : '–'}</td></tr>`).join('');
    Plotly.newPlot('peS', [['cho', 'Carbohydrate', '--t2'], ['fat', 'Fat', '--t1']].map(([k, n, c]) => ({ x, y: rows.map(r => r.energy[k]), type: 'scatter', mode: 'lines+markers', name: n, line: { color: css(c), width: 2 }, marker: { color: css(c), size: 9, symbol: k === 'cho' ? 'circle' : 'square' }, hovertemplate: n + ', %{x:.1f} min<br>%{y:.1f} kJ/min<extra></extra>' })), lay({ margin: { l: 52, r: 12, t: 12, b: 44 }, xaxis: ax('Time in the session (min)'), yaxis: ax('Energy (kJ/min)', { rangemode: 'tozero' }) }), Object.assign({}, CFG, { displayModeBar: false }));
    $('#peT').innerHTML = `<tr><th>Recording</th><th>Carbohydrate (kJ/min)</th><th>Fat (kJ/min)</th><th>% from carbohydrate</th><th>Expenditure (kJ/min)</th></tr>` + rows.map((r, i) => `<tr><td>${i + 1}</td><td>${fx(r.energy.cho, 1)}</td><td>${fx(r.energy.fat, 1)}</td><td>${fx(r.energy.pctCho, 0)}</td><td>${fx(r.energy.total, 1)}</td></tr>`).join('');
  }

  /* ---------------- Summary ---------------- */
  function results() { // one tidy structure that both the page and the exports read
    const D = S.D, pr = S.proto, m = S.meta, I = S.I, unit = I ? I.unit : '', rows = [], thr = [], stages = [];
    const idcols = { study_id: m.studyId || '', participant: m.name, date: m.date, modality: I ? I.mode : '', test_type: pr.type };
    const push = (test, stage, intensity, variable, value, u) => { if (F(value)) rows.push(Object.assign({}, idcols, { test, stage, intensity: F(intensity) ? intensity : '', intensity_unit: F(intensity) ? unit : '', variable, value: +value.toFixed(4), unit: u })); };
    const stageRow = (test, stage, q, rpe) => {
      stages.push(Object.assign({}, idcols, { test, stage, intensity: q.p, intensity_unit: unit, stage_s: Math.round(q.dur), vo2_L_min: rd(q.m.vo2, 3), vo2_mL_kg_min: rd(q.m.vo2rel, 2), vco2_L_min: rd(q.m.vco2, 3), rer: rd(q.m.rer, 3), ve_L_min: rd(q.m.ve, 2), eq_o2: rd(q.m.eqo2, 2), eq_co2: rd(q.m.eqco2, 2), pet_o2_mmHg: rd(q.m.peto2, 1), pet_co2_mmHg: rd(q.m.petco2, 1), hr_bpm: rd(q.m.hr, 1), cho_g_min: rd(q.m.cho, 3), fat_g_min: rd(q.m.fat, 3), gross_efficiency_pct: rd(q.ge, 2), economy_mL_kg_km: rd(q.economy, 1), energy_cost_J_kg_m: rd(q.costJ, 3), rpe: F(rpe) ? rpe : '' }));
      [['vo2', 'L/min', q.m.vo2], ['vo2_kg', 'mL/kg/min', q.m.vo2rel], ['vco2', 'L/min', q.m.vco2], ['rer', '', q.m.rer], ['ve', 'L/min', q.m.ve], ['hr', 'bpm', q.m.hr], ['cho', 'g/min', q.m.cho], ['fat', 'g/min', q.m.fat], ['gross_efficiency', '%', q.ge], ['economy', 'mL/kg/km', q.economy], ['rpe', 'Borg', rpe]].forEach(([k, u, v]) => push(test, stage, q.p, k, v, u));
    };
    if (pr.type === 'incremental' && D.inc) {
      const d = D.inc, pk = d.peak, v = q => incVT(q), M = d.map;
      [['vo2peak', 'L/min', pk.vo2], ['vo2peak_kg', 'mL/kg/min', pk.vo2kg], ['hr_peak', 'bpm', pk.hr], ['rer_peak', '', pk.rer], ['ve_peak', 'L/min', pk.ve]].forEach(([k, u, o]) => { if (o) push('incremental', '', NaN, k, o.value, u); });
      push('incremental', '', pr.inc.peak, 'intensity_peak', pr.inc.peak, unit);
      ['vt1', 'vt2'].forEach(q => {
        const x = v(q); if (!F(x)) return; const t = M.tOf(x), hr = L.meanInWindow(D.R0, 'hr', t - 15, t + 15), iv = d.fit ? d.fit.m * x + d.fit.b : NaN, kg = F(m.mass) ? x * 1000 / m.mass : NaN, pct = pk.vo2 ? 100 * x / pk.vo2.value : NaN;
        thr.push(Object.assign({}, idcols, { test: 'incremental', threshold: q.toUpperCase(), source: F(S.picks.inc[q]) ? ((S.picks.incSrc && S.picks.incSrc[q]) || 'placed by user') : 'classical suggestion', vo2_L_min: rd(x, 3), vo2_mL_kg_min: rd(kg, 2), pct_vo2peak: rd(pct, 1), intensity_regression: rd(iv, 2), intensity_stage: I ? C.loadAt(I, t) : '', intensity_unit: unit, hr_bpm: rd(hr, 1), time_s: Math.round(t) }));
        [['vo2', 'L/min', x], ['vo2_kg', 'mL/kg/min', kg], ['pct_vo2peak', '%', pct], ['intensity', unit, iv], ['hr', 'bpm', hr]].forEach(([k, u, val]) => push('incremental', '', NaN, q + '_' + k, val, u));
      });
      d.values.forEach((q, i) => stageRow('incremental', i + 1, q, d.rpe[i]));
    }
    if (pr.type !== 'incremental' && D.st) {
      pr.tests.forEach((T, i) => {
        const nm = 'test_' + (i + 1), x = testVT1(i), f = D.st.fits[i], iv = f && F(x) ? f.m * x + f.b : NaN;
        thr.push(Object.assign({}, idcols, { test: nm, threshold: 'VT1', source: F((S.picks.tests[testKey(T)] || {}).vt1) ? 'placed by user' : 'classical suggestion', vo2_L_min: rd(x, 3), vo2_mL_kg_min: rd(F(m.mass) ? x * 1000 / m.mass : NaN, 2), pct_vo2peak: '', intensity_regression: rd(iv, 2), intensity_stage: '', intensity_unit: unit, hr_bpm: '', time_s: '' }));
        push(nm, '', NaN, 'vt1_vo2', x, 'L/min'); push(nm, '', NaN, 'vt1_intensity', iv, unit);
        D.st.SM[i].forEach((q, j) => stageRow(nm, j + 1, q, D.st.rpe[i][j]));
      });
    }
    const periods = [];
    if (pr.type !== 'incremental' && F(pr.base) && I && D.per) periodRows().forEach((r, i) => {
      periods.push(Object.assign({}, idcols, { recording: i + 1, block: r.block || '', intensity: pr.base, intensity_unit: unit, avg_start_s: Math.round(r.p.avgWin[0]), avg_end_s: Math.round(r.p.avgWin[1]), min_into_block: rd(r.into, 1), vo2_L_min: rd(r.vo2[0], 3), vo2_mL_kg_min: rd(r.vo2kg[0], 2), vco2_L_min: rd(r.vco2[0], 3), rer: rd(r.rer[0], 3), ve_L_min: rd(r.ve[0], 2), hr_bpm: rd(r.hr[0], 1), cho_g_min: rd(r.cho[0], 3), fat_g_min: rd(r.fat[0], 3), cho_kJ_min: rd(r.energy.cho, 2), fat_kJ_min: rd(r.energy.fat, 2), pct_energy_cho: rd(r.energy.pctCho, 1), expenditure_kJ_min: rd(r.energy.total, 2), gross_efficiency_pct: I.mode === 'cycling' ? rd(r.econ[0], 2) : '', economy_mL_kg_km: I.mode === 'treadmill' ? rd(r.econ[0], 1) : '', rpe: F(r.rpe) ? r.rpe : '' }));
      [['vo2', 'L/min', r.vo2[0]], ['hr', 'bpm', r.hr[0]], ['rer', '', r.rer[0]], ['ve', 'L/min', r.ve[0]], ['cho', 'g/min', r.cho[0]], ['fat', 'g/min', r.fat[0]], [I.mode === 'cycling' ? 'gross_efficiency' : 'economy', I.mode === 'cycling' ? '%' : 'mL/kg/km', r.econ[0]], ['rpe', 'Borg', r.rpe]].forEach(([k, u, v]) => push('prolonged', 'recording_' + (i + 1), pr.base, k, v, u));
    });
    return { rows, thr, stages, periods };
  }
  const rd = (v, d) => (F(v) ? +v.toFixed(d) : '');
  function methodsText() {
    const pr = S.proto, I = S.I, set = S.set, g = S.gas, bxb = g.kind === 'bxb';
    const avgT = avgLabel().replace('breath-by-breath', 'breath-by-breath data');
    const joined = g.files ? ` The ${g.files.length} recordings of the session were aligned by their clock times.` : '';
    const entered = I && I.plan ? ' Power was taken from the protocol entered by the researcher, not from a recording.' : '';
    const tool = ` Data were analysed with the Lab CPET tool (version ${VERSION}, created by ${AUTHOR}).`;
    const oxUsed = S.oxy && S.oxy.done && S.proto.type === 'incremental', fromOx = Object.entries((S.picks.incSrc) || {}).filter(e => /^Oxynet/.test(e[1]));
    const ox = oxUsed ? ` Suggestions from the Oxynet open-source models (pyoxynet; CNN and LSTM) were also available to the researcher${fromOx.length ? `, and ${fromOx.map(e => `the ${e[1].replace('Oxynet ', '')} suggestion was used for ${e[0].toUpperCase()}`).join(' and ')}` : ''} (Zignoli et al., 2022; Keir et al., 2026).` : '';
    const gas = `Gas exchange was recorded with a COSMED metabolic cart (${bxb ? 'breath-by-breath export' : g.avgWidth + '-s average export'}) and displayed as ${avgT}. ${set.outl.remove ? `Breaths more than ${set.outl.nsd} SD from their local mean were removed.` : ''}`.trim();
    const eq = I && I.mode === 'cycling' ? ' Gross efficiency was calculated as external power divided by metabolic power (Brouwer, 1957).' : I ? ' Running economy was calculated as stage-end VO₂ per kilogram per kilometre.' : '';
    if (pr.type === 'incremental') return `${gas} VO₂peak was the highest ${set.inc.peakWin}-s rolling mean. ${I ? `Stage values were the mean of the last ${set.inc.stageWin} s of each stage. ` : ''}VT1 and VT2 were identified visually from V-slope, ventilatory equivalents and end-tidal gases, starting from two-line breakpoint suggestions.${I ? ` ${I.label} at each threshold was estimated from the linear regression of stage-end VO₂ on ${I.label.toLowerCase()}.` : ''}${entered}${ox}${eq}${tool}`;
    return `${gas} Stage values were the mean of the last ${set.st.regWin} s of each stage. VT1 in each step test was identified visually from V-slope and ventilatory equivalents, plotted from ${isWholeStage() ? 'the whole' : 'the last ' + mmss(set.st.win)} of each stage, starting from a two-line breakpoint suggestion on the last 2 min of each stage, and ${I ? I.label.toLowerCase() : 'intensity'} at VT1 was estimated from the linear regression of stage-end VO₂ on ${I ? I.label.toLowerCase() : 'intensity'} for that test.${joined}${F(pr.base) && S.D.per && S.D.per.length ? ` During the steady exercise, values were the mean of the last ${set.per.avgMin} min of each gas recording, and substrate oxidation was calculated from VO₂ and VCO₂ (Jeukendrup and Wallis, 2005).` : ''}${eq}${tool}`;
  }
  const REFS = [
    ['Zignoli A, Fornasiero A, Rota P, et al. Oxynet: a collective intelligence that detects ventilatory thresholds in cardiopulmonary exercise tests. <i>European Journal of Sport Science</i>. 2022;22(3):425-435.', '10.1080/17461391.2020.1866081'],
    ['Keir DA, Zignoli A, Iannetta D, Mattioni Maturana F, Murias JM. AI-driven analysis of cardiopulmonary exercise tests to identify gas exchange and ventilatory thresholds. <i>Sports Medicine</i>. 2026;56(7):1833-1843.', '10.1007/s40279-026-02403-w'],
    ['Zignoli A, et al. Expert-level classification of ventilatory thresholds from cardiopulmonary exercising test data with recurrent neural networks. <i>European Journal of Sport Science</i>. 2019;19(9):1221-1229.', '10.1080/17461391.2019.1587523'],
    ['Zignoli A. Machine learning models for the automatic detection of exercise thresholds in cardiopulmonary exercising tests: from regression to generation to explanation. <i>Sensors</i>. 2023;23(2):826.', '10.3390/s23020826']
  ];
  function creditsHTML() {
    return `<div class="methods"><p style="margin:0 0 8px"><b>Lab CPET tool</b>, version ${VERSION}, was created by <b>${AUTHOR}</b>.</p>
      <p style="margin:0 0 8px"><b>Oxynet.</b> The Oxynet suggestions use the frozen CNN and LSTM models from <a href="https://pypi.org/project/pyoxynet/">pyoxynet</a> 1.0.2 by Andrea Zignoli and the Oxynet team (MIT licence). They run on this computer through this tool’s own JavaScript runner, and no data are sent to Oxynet. This tool is not made or endorsed by the Oxynet team. Please cite:</p>
      <ol class="refs">${REFS.map(([t, d]) => `<li>${t} <a href="https://doi.org/${d}">doi:${d}</a></li>`).join('')}</ol>
      <p style="margin:8px 0 0"><b>Other software.</b> Plotly.js (MIT licence) and SheetJS (Apache 2.0 licence). <b>Equations.</b> Substrate oxidation: Jeukendrup and Wallis (2005). Metabolic power: Brouwer (1957). V-slope: Beaver et al. (1986).</p></div>`;
  }
  $('#credit').innerHTML = `Lab CPET tool ${VERSION}. Created by ${AUTHOR}. Threshold suggestions on incremental tests include the open-source Oxynet models (Zignoli et al., 2022; Keir et al., 2026; pyoxynet, MIT licence).`;
  function vSummary() {
    const R = results(), I = S.I;
    const cols = ['test', 'threshold', 'source', 'vo2_L_min', 'vo2_mL_kg_min', 'pct_vo2peak', 'intensity_regression', 'hr_bpm'], names = ['Test', 'Threshold', 'Placed', 'VO₂ (L/min)', 'VO₂ (mL/kg/min)', '% VO₂peak', I ? I.label + ' (' + I.unit + ')' : 'Intensity', 'Heart rate (bpm)'];
    $('#views').innerHTML = `
      ${S.proto.type === 'incremental' && S.D.inc && S.D.inc.peak.vo2 ? `<div class="stats"><div class="stat key"><b>${fx(S.D.inc.peak.vo2.value, 2)} L/min</b><span>VO₂peak</span><small>${S.D.inc.peak.vo2kg ? fx(S.D.inc.peak.vo2kg.value, 1) + ' mL/kg/min' : ''}</small></div></div>` : ''}
      <h2 class="row">Thresholds</h2><div class="panel"><div class="tblwrap"><table><tr>${names.map(n => `<th>${n}</th>`).join('')}</tr>${R.thr.map(r => `<tr>${cols.map(c => `<td>${esc(r[c] === '' ? '–' : r[c])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}">None yet.</td></tr>`}</table></div></div>
      <h2 class="row">Data checks</h2><div class="panel" style="padding:12px"><ul class="checks" id="chk2"></ul></div>
      <h2 class="row">Methods paragraph</h2><div class="methods" id="meth"></div><div class="tools"><button id="cpM">Copy</button><span class="hint" id="cpS"></span></div>
      <h2 class="row">About and credits</h2>${creditsHTML()}
      <ul class="notes"><li>Exports carry the tool version (${VERSION}) and every setting, so a result can be reproduced. “Save analysis” keeps your data, settings and threshold lines in one file to reopen later.</li></ul>`;
    const ic = { ok: '✓', warn: '!', info: 'i' };
    $('#chk2').innerHTML = S.checks.map(c => `<li class="${c.level}"><span class="ic" aria-hidden="true">${ic[c.level]}</span><span>${esc(c.text)}</span></li>`).join('');
    $('#meth').textContent = methodsText();
    $('#cpM').onclick = async () => { try { await navigator.clipboard.writeText(methodsText()); $('#cpS').textContent = 'Copied.'; } catch (e) { $('#cpS').textContent = 'Select the text and copy it by hand.'; } };
  }

  /* ---------------- Save, open, export ---------------- */
  const stem = () => (((S.meta.studyId || S.meta.name || 'test') + '_' + String(S.meta.date || '').replace(/\//g, '-')).replace(/[^\w.-]+/g, '_'));
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function settingsRows() {
    const set = S.set, out = [['tool', 'Lab CPET tool'], ['tool_version', VERSION], ['created_by', AUTHOR], ['exported', new Date().toISOString()], ['gas_file_type', S.gas.kind === 'bxb' ? 'breath-by-breath' : S.gas.avgWidth + '-s averages'], ['cosmed_files_joined', S.gas.files ? S.gas.files.map(f => f.name + ' at ' + f.start + ' s').join('; ') : ''], ['intensity_source', S.I ? (S.I.plan ? 'steps entered by the researcher' : S.I.source) : 'none'], ['entered_steps', S.set.plan ? JSON.stringify(S.set.plan) : ''], ['lode_offset_s', set.offset], ['body_mass_kg', S.meta.mass], ['averaging', avgLabel()], ['outlier_flagging', set.outl.local ? set.outl.nsd + ' SD' : 'off'], ['flagged_removed', set.outl.remove]];
    if (S.proto.type === 'incremental') { out.push(['analysis_window_min', S.D.inc ? (S.D.inc.t0 / 60).toFixed(2) + '-' + (S.D.inc.t1 / 60).toFixed(2) : ''], ['vo2peak_window_s', set.inc.peakWin], ['stage_window_s', set.inc.stageWin]); }
    else out.push(['stage_window_s', set.st.regWin], ['vt1_chart_window_s', isWholeStage() ? 'whole stage' : set.st.win], ['tests_excluded', set.excluded.join(' ')], ['steady_average_min', set.per.avgMin]);
    return out;
  }
  $('#bExport').onclick = async () => {
    if (S.oxy && !S.oxy.done) await S.oxy.promise;
    const R = results(), wb = XLSX.utils.book_new(), add = (name, rows) => XLSX.utils.book_append_sheet(wb, rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['No data']]), name);
    add('Long format', R.rows); add('Stages', R.stages); add('Thresholds', R.thr);
    const ox = S.oxy && S.oxy.done && S.proto.type === 'incremental' ? ['cnn', 'lstm'].flatMap(m => { const r = S.oxy.res[m]; return ['vt1', 'vt2'].map(q => ({ model: 'Oxynet ' + m.toUpperCase(), threshold: q.toUpperCase(), vo2_L_min: r && r[q] && !r.problem ? rd(r[q].vo2, 3) : '', time_s: r && r[q] && !r.problem ? r[q].time : '', note: r ? (r.problem || r.error || '') : '', data_used: S.set.oxyWin === 'whole' ? 'all exercise data' : 'analysis window' })); }) : [];
    if (ox.length) add('Oxynet suggestions', ox);
    if (R.periods.length) add('Prolonged exercise', R.periods);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Lab CPET tool ' + VERSION + ', created by ' + AUTHOR], [''], ['Please cite when Oxynet suggestions are used:'], ...REFS.map(([t, d]) => [t.replace(/<[^>]+>/g, '') + ' doi:' + d]), ['pyoxynet 1.0.2, Andrea Zignoli and the Oxynet team, MIT licence.']]), 'Credits');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Check', 'Message'], ...S.checks.map(c => [c.level, c.text])]), 'Data checks');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Setting', 'Value'], ...settingsRows()]), 'Settings');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Methods paragraph'], [methodsText()]]), 'Methods');
    XLSX.writeFile(wb, stem() + '_results.xlsx');
  };
  $('#bCsv').onclick = () => { const R = results(), ws = XLSX.utils.json_to_sheet(R.rows); download(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv' }), stem() + '_long.csv'); };
  $('#bSave').onclick = () => {
    const blocks = S.set.blocks ? { list: [...S.set.blocks], unit: S.set.blocks.unit } : null, set = clone(S.set); set.blocks = blocks;
    const o = { app: 'lab-cpet-tool', version: VERSION, gas: S.gas, lode: S.lode, hr: S.hr, meta: S.meta, set, picks: S.picks };
    download(new Blob([JSON.stringify(o)], { type: 'application/json' }), stem() + '_analysis.json');
  };
  function openAnalysis(o) {
    if (o.app !== 'lab-cpet-tool') throw new Error('This is not a Lab CPET tool analysis file.');
    const nan = a => a.map(x => (x === null ? NaN : x));
    Object.keys(o.gas.v).forEach(k => (o.gas.v[k] = nan(o.gas.v[k]))); Object.keys(o.gas.aux).forEach(k => { if (k !== 'phase' && Array.isArray(o.gas.aux[k])) o.gas.aux[k] = nan(o.gas.aux[k]); });
    if (o.lode) { o.lode.rpm = nan(o.lode.rpm); }
    if (o.set.blocks) { const b = o.set.blocks.list; b.unit = o.set.blocks.unit; o.set.blocks = b; }
    S.gas = o.gas; S.lode = o.lode; S.hr = o.hr; S.meta = o.meta; S.set = Object.assign(defaults(), o.set); S.picks = o.picks; S.oxy = null; S.oxyCache = {}; S.view = 'protocol';
    start();
  }
  window.LabApp = { S, recompute, results, methodsText };
})();
