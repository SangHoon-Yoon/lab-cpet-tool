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
    // Periods the researcher left out (set.leaveOut, seconds) are dropped from every calculation and chart, like removed breaths.
    const lo = set.leaveOut || [], out = t => lo.some(([a, b]) => t >= a && t <= b);
    const keep = Array.from(fl.flag, (f, i) => (f === 0 || (!set.outl.remove && f !== 3)) && !out(g.t[i]));
    const av = set.avg, par = avgParOf(set), w0 = g.kind === 'avg' ? g.avgWidth : 15;
    const X = C.series(g, keep, av.mode, par), ref = av.mode === 'bin' && par === w0 ? X : C.series(g, keep, 'bin', w0), R0 = C.series(g, keep, 'raw', 0);
    [...new Set([X, ref, R0])].forEach(decorate);
    // Oxynet rescales each signal from 0 to 1 over the data it is given, so one extreme breath (VO₂ of 10 L/min, PETCO₂ of 5 mmHg) squeezes
    // everything else into a sliver of the scale. Its input therefore always leaves out flagged breaths, whatever the display settings say.
    const flOx = set.outl.local ? fl : C.flagOutliers(g, Object.assign({}, defaults().outl, { limits: true })), R0ox = C.series(g, Array.from(flOx.flag, (f, i) => f === 0 && !out(g.t[i])), 'raw', 0);
    decorate(R0ox);
    const D = { fl, keep, X, ref, R0, R0ox, mode };
    // Incremental test
    if (pr.type === 'incremental' && pr.inc) {
      const inc = pr.inc, t0 = F(set.inc.t0) ? set.inc.t0 : inc.t0 + (inc.none ? 0 : set.inc.skip || 0), t1 = F(set.inc.t1) ? set.inc.t1 : inc.t1;
      const sugg = L.suggestIncremental(ref, t0, t1, { noFinalSurge: !!pr.max });
      const stages = inc.stages, values = stages.map(st => L.stageValues(R0, st, set.inc.stageWin, mass, mode));
      const fit = L.intensityFit(values), rpe = L.stageRPE(g, stages);
      const peak = {}; ['vo2', 'vo2kg', 'vco2', 've', 'hr', 'rer'].forEach(k => (peak[k] = L.rollingPeak(R0, k, set.inc.peakWin, pr.max ? pr.max.t0 : t0, (pr.max ? pr.max.t1 : t1) + 1e-6)));
      const maxValues = pr.max ? pr.max.stages.map(st => L.stageValues(R0, st, set.inc.stageWin, mass, mode)) : [], maxRpe = pr.max ? L.stageRPE(g, pr.max.stages) : {}, peak1 = pr.max ? L.rollingPeak(R0, 'vo2', set.inc.peakWin, t0, t1 + 1e-6) : null;
      const atPeak = peak.vo2 ? { hr: L.meanInWindow(R0, 'hr', peak.vo2.t0, peak.vo2.t1), rer: L.meanInWindow(R0, 'rer', peak.vo2.t0, peak.vo2.t1) } : {};
      D.inc = { t0, t1, sugg, stages, values, maxValues, maxRpe, peak1, fit, rpe, peak, atPeak, map: sugg.map, effort: L.effortChecks(R0, g, inc, S.meta.age, pr.max ? maxValues : values, peak, pr.max ? maxRpe : rpe) };
    }
    // Step tests
    if (pr.tests.length && I) {
      const A = C.assignSteps(X, I, pr), Aref = C.assignSteps(ref, I, pr);
      // Stage means use the last regWin seconds of each stage that also fall inside the selected time.
      const SM = pr.tests.map(T => T.steps.map(st => {
        const [a, b] = selAbs(T), lo = Math.max(st.t1 - set.st.regWin, a, st.t0), hi = Math.min(st.t1, b);
        if (hi - lo < 10) { const o = L.stageValues(R0, st, 0, mass, mode); o.outside = true; return o; }
        const o = L.stageValues(R0, { p: st.p, t0: st.t0, t1: hi, dur: hi - st.t0, full: st.full }, hi - lo, mass, mode); o.dur = st.dur; o.used = [lo, hi]; return o;
      }));
      const fits = SM.map(v => { const u = v.filter(q => q.full && F(q.m.vo2)); return u.length >= 3 ? C.linreg(u.map(q => q.m.vo2), u.map(q => q.p)) : null; });
      D.st = { A, SM, fits, sugg: C.suggestVT1(ref, Aref, pr, Math.min(120, stepLength()), i => inSelT(pr.tests[Aref.test[i]], ref.t[i])), rpe: pr.tests.map(T => L.stageRPE(g, T.steps)) };
      if (F(pr.base)) D.per = L.splitLongPeriods(C.periods(X, I, pr, { gapSec: 20, dropSec: w0, periodSec: 240, avgSec: set.per.avgMin * 60 }, ref), X, I, pr.base, { avgSec: set.per.avgMin * 60 });
    } else if (F(pr.base) && I) D.per = L.splitLongPeriods(C.periods(X, I, pr, { gapSec: 20, dropSec: w0, periodSec: 240, avgSec: set.per.avgMin * 60 }, ref), X, I, pr.base, { avgSec: set.per.avgMin * 60 });
    return D;
  }
  // Time used from the end of each stage on the step-test charts. The default is the whole stage.
  // Each step test has its own selected time range, in seconds from that test's start (S.set.st.sels, keyed by testKey).
  // An older saved analysis may hold one range for all tests in S.set.st.sel; it is used for tests without their own range.
  const testSel = T => { const o = S.set.st.sels || {}, k = Math.round(T.t0); return k in o ? o[k] : S.set.st.sel; };
  const selAbs = T => { const r = testSel(T); return r ? [T.t0 + r[0], T.t0 + r[1]] : [-Infinity, Infinity]; };
  const anySel = () => !!S.proto && S.proto.tests.some(T => testSel(T));
  const inSelT = (T, t) => { if (!T) return true; const [a, b] = selAbs(T); return t > a && t <= b; };
  const stepLength = () => (S.proto.pattern ? S.proto.pattern.stepDur : 240);
  const isWholeStage = () => !F(S.set.st.win) || S.set.st.win >= stepLength();
  const stWin = () => (isWholeStage() ? stepLength() + 15 : S.set.st.win); // a little extra, so a stage a fraction longer than planned stays whole
  function recompute() { S.D = computeD(); S.checks = L.dataChecks(S); const lo = S.set.leaveOut || []; if (lo.length) S.checks.push({ level: 'info', text: `Left out by you: ${lo.map(([a, b]) => mmss(a) + '–' + mmss(b)).join(', ')} (${Math.round(lo.reduce((s, [a, b]) => s + b - a, 0))} s in all).` }); summaries(); render(); }
  function avgParOf(set) { const a = set.avg; return a.mode === 'bin' ? a.bin : a.mode === 'ma' ? a.ma : a.mode === 'roll' ? a.roll : 0; }
  function avgLabel() { const a = S.set.avg, bxb = S.gas.kind === 'bxb'; return { raw: bxb ? 'breath-by-breath' : S.gas.avgWidth + '-s averages from the file', bin: a.bin + '-s bins', ma: a.ma + '-' + (bxb ? 'breath' : 'sample') + ' moving average', roll: a.roll + '-s rolling average' }[a.mode]; }
  const iLab = () => (S.I ? S.I.label + ' (' + S.I.unit + ')' : 'Intensity');
  const iDp = () => (S.I && S.I.unit === 'W' ? 0 : 1);
  const iVal = v => (S.I && F(v) ? v.toFixed(iDp()) + ' ' + S.I.unit : '–');
  const availVars = () => Object.keys(VARS).filter(k => { const X = S.D.X; return X.v[k] && X.v[k].some(x => F(x) && x !== 0); });

  // Thresholds: a pick when the user has moved the line, otherwise the suggestion.
  const incVT = q => { const p = S.picks.inc[q]; return F(p) ? p : S.D.inc ? S.D.inc.sugg[q] : NaN; };
  const testKey = T => Math.round(T.t0);
  const testVT = (q, i) => { const T = S.proto.tests[i], p = (S.picks.tests[testKey(T)] || {})[q]; return F(p) ? p : S.D.st && S.D.st.sugg[i] ? S.D.st.sugg[i][q] : NaN; };
  const testVT1 = i => testVT('vt1', i);
  // Threshold status: a line is "suggested, not checked" until someone moves it, types it, picks a method for it, or confirms it.
  const statusBadge = (checked, conf) => checked ? '<span class="tstat ok" title="Placed or confirmed by you">✓ checked</span>' : `<span class="tstat sug" title="Still the tool's suggestion">suggested, not checked</span>${conf ? `<button class="tconf" data-conf="${conf}">Confirm</button>` : ''}`;
  const SUGGESTED = /classical suggestion$|\(default\)$/;
  const statusOf = source => (SUGGESTED.test(source || '') ? 'suggested, not checked' : 'checked');
  // Confirm a suggested line: keep its value, now as the researcher's choice. conf = 'inc:vt1' | 'test:<i>:vt1' | 'lt:<series key>:lt1'
  function confirmThreshold(conf) {
    const [kind, a, b] = conf.split(':');
    if (kind === 'inc') { const v = incVT(a); if (!F(v)) return; S.picks.inc[a] = +v.toFixed(3); S.picks.incSrc = S.picks.incSrc || {}; S.picks.incSrc[a] = 'suggestion, confirmed'; }
    else if (kind === 'test') { const i = +a, v = testVT(b, i); if (!F(v)) return; setTestVT(S.proto.tests[i], b, +v.toFixed(3)); S.picks.testSrc = S.picks.testSrc || {}; (S.picks.testSrc[testKey(S.proto.tests[i])] = S.picks.testSrc[testKey(S.proto.tests[i])] || {})[b] = 'suggestion, confirmed'; }
    else if (kind === 'lt') { const se = lacSeries().find(x => x.key === a); if (!se) return; const res = lacAnalyse(se), v = ltVal(se, res, b); if (!F(v)) return; setLT(se.key, b, v, lacSet()[b] + ', confirmed'); }
    summaries(); render();
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-conf]'); if (b) { e.preventDefault(); confirmThreshold(b.dataset.conf); } });
  const setTestVT = (T, q, v) => { const k = testKey(T), o = Object.assign({}, S.picks.tests[k]); if (F(v)) o[q] = v; else delete o[q]; if (Object.keys(o).length) S.picks.tests[k] = o; else delete S.picks.tests[k]; };

