/* Shared analysis core, carried over from the GlyDurability app. Pure functions; no DOM. */
(function (root) {
  'use strict';
  const F = Number.isFinite;
  const mean = a => { let s = 0, n = 0; for (const x of a) if (F(x)) { s += x; n++; } return n ? s / n : NaN; };
  const sd = a => { const m = mean(a); let s = 0, n = 0; for (const x of a) if (F(x)) { s += (x - m) ** 2; n++; } return n > 1 ? Math.sqrt(s / (n - 1)) : NaN; };
  const median = a => { const b = a.filter(F).sort((x, y) => x - y); if (!b.length) return NaN; const k = b.length >> 1; return b.length % 2 ? b[k] : (b[k - 1] + b[k]) / 2; };
  const quant = (a, q) => { const b = a.filter(F).sort((x, y) => x - y); if (!b.length) return NaN; return b[Math.min(b.length - 1, Math.max(0, Math.round(q * (b.length - 1))))]; };

  // Substrate oxidation, Jeukendrup & Wallis (2005), L/min in, g/min out.
  const cho = (vo2, vco2) => 4.210 * vco2 - 2.962 * vo2;
  const fat = (vo2, vco2) => 1.695 * vo2 - 1.701 * vco2;
  // Gross efficiency (%): external power / metabolic power. Metabolic power from Brouwer (1957): kJ/min = 16.89 VO2 + 4.84 VCO2 (L/min).
  const metW = (vo2, vco2) => (16.89 * vo2 + 4.84 * vco2) * 1000 / 60;
  const ge = (p, vo2, vco2) => (F(p) && F(vo2) && F(vco2) && vo2 > 0.2 ? 100 * p / metW(vo2, vco2) : NaN);

  function linreg(x, y) {
    const n = x.length; if (n < 2) return null;
    const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
    const m = sxy / sxx, b = my - m * mx; return { m, b, r2: sxy * sxy / (sxx * syy), n };
  }

  // Two-segment (hinge) fit: y = a + b x + c max(0, x - bp). Returns best breakpoint.
  function hinge(x, y, lo = 0.15) {
    const idx = x.map((v, i) => i).filter(i => F(x[i]) && F(y[i])).sort((i, j) => x[i] - x[j]);
    if (idx.length < 8) return null;
    const xs = idx.map(i => x[i]), ys = idx.map(i => y[i]);
    const a = quant(xs, lo), b = quant(xs, 1 - lo); let best = null;
    for (let s = 0; s <= 200; s++) {
      const bp = a + (b - a) * s / 200;
      // least squares with 3 params via normal equations
      let S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], T = [0, 0, 0];
      for (let i = 0; i < xs.length; i++) { const r = [1, xs[i], Math.max(0, xs[i] - bp)]; for (let p = 0; p < 3; p++) { T[p] += r[p] * ys[i]; for (let q = 0; q < 3; q++) S[p][q] += r[p] * r[q]; } }
      const c = solve3(S, T); if (!c) continue;
      let sse = 0; for (let i = 0; i < xs.length; i++) { const e = c[0] + c[1] * xs[i] + c[2] * Math.max(0, xs[i] - bp) - ys[i]; sse += e * e; }
      if (!best || sse < best.sse) best = { bp, sse, s1: c[1], s2: c[1] + c[2] };
    }
    return best;
  }
  function solve3(A, b) {
    const M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < 3; c++) {
      let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null; [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
    }
    return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  }

  /* ---------- Gas processing ---------- */
  // Segments split where consecutive samples are more than `gap` s apart (mask off).
  function segments(t, gap) { const s = []; let a = 0; for (let i = 1; i <= t.length; i++) if (i === t.length || t[i] - t[i - 1] > gap) { s.push([a, i]); a = i; } return s; }

  // Outlier flags: 0 = ok, 1 = local-SD outlier, 2 = physiological limit, 3 = missing.
  function flagOutliers(g, o) {
    const n = g.t.length, flag = new Uint8Array(n), reason = new Array(n).fill('');
    const gap = g.kind === 'bxb' ? 20 : 1.5 * (g.avgWidth || 15);
    for (let i = 0; i < n; i++) {
      if (!F(g.v.vo2[i]) || g.v.vo2[i] <= 0) { flag[i] = 3; reason[i] = 'missing or zero VO2'; continue; }
      if (o.limits && g.kind === 'bxb') {
        const rf = g.v.rf ? g.v.rf[i] : NaN, vt = g.v.vt ? g.v.vt[i] : NaN;
        if (F(rf) && (rf < o.rfMin || rf > o.rfMax)) { flag[i] = 2; reason[i] = 'breathing frequency ' + rf.toFixed(1); continue; }
        if (F(vt) && vt < o.vtMin) { flag[i] = 2; reason[i] = 'tidal volume ' + vt.toFixed(2) + ' L'; continue; }
      }
    }
    if (o.local) {
      for (const [a, b] of segments(g.t, gap)) {
        for (let i = a; i < b; i++) {
          if (flag[i]) continue;
          for (const k of o.vars) {
            const y = g.v[k]; if (!y) continue;
            const w = []; for (let j = Math.max(a, i - o.half); j <= Math.min(b - 1, i + o.half); j++) if (j !== i && !flag[j] && F(y[j])) w.push(y[j]);
            if (w.length < 4) continue;
            const m = mean(w), s = sd(w);
            if (F(s) && s > 0 && Math.abs(y[i] - m) > o.nsd * s) { flag[i] = 1; reason[i] = k.toUpperCase() + ' ' + ((y[i] - m) / s).toFixed(1) + ' SD from local mean'; break; }
          }
        }
      }
    }
    return { flag, reason };
  }

  // Display smoothing of one variable. keep[i] true = use. Returns {x (s), y}.
  function smooth(t, y, keep, mode, param, gap) {
    const x = [], out = [];
    const idx = []; for (let i = 0; i < t.length; i++) if (keep[i] && F(y[i])) idx.push(i);
    if (mode === 'raw') { for (const i of idx) { x.push(t[i]); out.push(y[i]); } return { x, y: out }; }
    const tt = idx.map(i => t[i]), yy = idx.map(i => y[i]);
    const segs = segments(tt, gap);
    for (const [a, b] of segs) {
      if (mode === 'ma') {
        const n = Math.max(1, Math.round(param)), h = Math.floor(n / 2);
        for (let i = a; i < b; i++) { const lo = Math.max(a, i - h), hi = Math.min(b - 1, i + (n - 1 - h)); if (hi - lo + 1 < n) continue; let s = 0; for (let j = lo; j <= hi; j++) s += yy[j]; x.push(tt[i]); out.push(s / (hi - lo + 1)); }
      } else if (mode === 'bin') {
        const w = param; let k0 = null, s = 0, c = 0;
        for (let i = a; i < b; i++) { const k = Math.ceil(tt[i] / w); if (k !== k0 && c) { x.push(k0 * w); out.push(s / c); s = 0; c = 0; } k0 = k; s += yy[i]; c++; }
        if (c) { x.push(k0 * w); out.push(s / c); }
      } else if (mode === 'roll') {
        const h = param / 2; let lo = a, hi = a, s = 0;
        for (let i = a; i < b; i++) {
          while (hi < b && tt[hi] <= tt[i] + h) { s += yy[hi]; hi++; }
          while (tt[lo] < tt[i] - h) { s -= yy[lo]; lo++; }
          x.push(tt[i]); out.push(s / (hi - lo));
        }
      }
      if (b < tt.length) { x.push(null); out.push(null); }
    }
    return { x, y: out };
  }

  // Time bins for analysis (bin label = end time, like Cosmed 15-s averages).
  function binGas(g, keep, w) {
    if (g.kind === 'avg') {
      const t = [], v = {}; g.has.forEach(k => (v[k] = []));
      for (let i = 0; i < g.t.length; i++) if (keep[i]) { t.push(g.t[i]); g.has.forEach(k => v[k].push(g.v[k][i])); }
      return { t, v, w: g.avgWidth || 15 };
    }
    const acc = new Map();
    for (let i = 0; i < g.t.length; i++) {
      if (!keep[i]) continue; const k = Math.ceil(g.t[i] / w - 1e-9);
      let a = acc.get(k); if (!a) { a = { n: 0 }; g.has.forEach(q => { a[q] = 0; a['n_' + q] = 0; }); acc.set(k, a); }
      // weight each breath by its duration (60/Rf), which reproduces Cosmed's time averages
      const dw = g.v.rf && F(g.v.rf[i]) && g.v.rf[i] > 0 ? 60 / g.v.rf[i] : (i ? Math.min(10, g.t[i] - g.t[i - 1]) : 3);
      a.n++; g.has.forEach(q => { const y = g.v[q][i]; if (F(y)) { a[q] += y * dw; a['n_' + q] += dw; } });
    }
    const keys = [...acc.keys()].sort((a, b) => a - b), t = [], v = {}; g.has.forEach(k => (v[k] = []));
    for (const k of keys) { const a = acc.get(k); t.push(k * w); g.has.forEach(q => v[q].push(a['n_' + q] ? a[q] / a['n_' + q] : NaN)); }
    // VE/VO2 etc. recomputed from the binned volumes are closer to Cosmed's averages than the mean of breath ratios
    ratios(v);
    return { t, v, w };
  }

  // Ratios recomputed from averaged volumes; undefined where VO2/VCO2 is near zero (mask on/off fragments).
  function ratios(v) {
    const ok = x => F(x) && x >= 0.2;
    if (v.ve && v.vo2) v.eqo2 = v.ve.map((x, i) => (ok(v.vo2[i]) ? x / v.vo2[i] : NaN));
    if (v.ve && v.vco2) v.eqco2 = v.ve.map((x, i) => (ok(v.vco2[i]) ? x / v.vco2[i] : NaN));
    if (v.vo2 && v.vco2) v.rer = v.vco2.map((x, i) => (ok(v.vo2[i]) ? x / v.vo2[i] : NaN));
  }

  /* ---------- Lode protocol detection ---------- */
  function loadAt(L, t) { // sample-and-hold
    let lo = 0, hi = L.t.length - 1; if (t < L.t[0]) return L.p[0];
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L.t[m] <= t) lo = m; else hi = m - 1; }
    return L.p[lo];
  }
  function plateaus(L) {
    const out = []; let a = 0;
    for (let i = 1; i <= L.t.length; i++) if (i === L.t.length || L.p[i] !== L.p[a]) {
      const t1 = i < L.t.length ? L.t[i] : L.t[L.t.length - 1];
      out.push({ t0: L.t[a], t1, p: L.p[a], dur: t1 - L.t[a] }); a = i;
    }
    return out;
  }

  function detectProtocol(L) {
    const P = plateaus(L);
    // Baseline (90% VT1): load with most total time among plateaus >= 60 s.
    const tot = new Map(); P.forEach(q => { if (q.p > 20 && q.dur >= 60) tot.set(q.p, (tot.get(q.p) || 0) + q.dur); });
    const base = [...tot.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? NaN;
    // Long plateaus for step detection.
    const LP = P.filter(q => q.dur >= 20 && q.p > 20);
    // Find the first complete 5-step pattern.
    let pattern = null;
    for (let i = 0; i + 4 < LP.length && !pattern; i++) {
      const s = LP.slice(i, i + 5); const d = s[1].p - s[0].p;
      if (d < 5 || d > 60) continue;
      const ok = s.every((q, k) => Math.abs(q.p - (s[0].p + k * d)) <= 1 && q.dur >= 200 && q.dur <= 280 && (k === 0 || Math.abs(q.t0 - s[k - 1].t1) < 3));
      if (ok) pattern = { powers: s.map(q => q.p), inc: d, stepDur: Math.round(median(s.map(q => q.dur))) };
    }
    // 3MAOT: last abrupt rise from <= 1.2*base to >= 1.8*base.
    let onset = null;
    for (let i = L.t.length - 1; i > 5; i--) {
      if (L.p[i] >= 1.8 * base && L.p[i - 1] <= 1.2 * base) { onset = i; break; }
    }
    let maot = null;
    if (onset !== null) {
      const t0 = L.t[onset]; let e = L.t.length - 1;
      for (let i = onset; i < L.t.length; i++) if (L.t[i] > t0 + 60 && L.p[i] < 0.4 * base) { e = i; break; }
      maot = { i0: onset, i1: e, t0, t1: L.t[e], dur: L.t[e] - t0 };
    }
    // 5-step tests: every entry into powers[0] from another load, then consecutive matching steps.
    const tests = [];
    if (pattern) {
      for (let i = 0; i < LP.length; i++) {
        if (Math.abs(LP[i].p - pattern.powers[0]) > 1) continue;
        if (i > 0 && Math.abs(LP[i - 1].p - pattern.powers[0]) <= 1) continue;
        if (maot && LP[i].t0 >= maot.t0) break;
        const steps = [];
        for (let k = 0; k < 5 && i + k < LP.length; k++) {
          const q = LP[i + k];
          if (Math.abs(q.p - pattern.powers[k]) > 1) break;
          if (k > 0 && Math.abs(q.t0 - steps[k - 1].t1) > 3) break;
          steps.push({ p: q.p, t0: q.t0, t1: q.t1, dur: q.dur, full: q.dur >= pattern.stepDur - 10 });
        }
        if (steps.length) tests.push({ steps, t0: steps[0].t0, t1: steps[steps.length - 1].t1, complete: steps.length === 5 && steps.every(s => s.full) });
      }
    }
    // Task failure: end of the last plateau (>= 30 s, >= 0.8 x lowest working load) before the 3MAOT.
    const work = Math.min(base, pattern ? pattern.powers[0] : base);
    let ttf = null;
    for (const q of P) { if (maot && q.t0 >= maot.t0) break; if (q.dur >= 30 && q.p >= 0.8 * work) ttf = q.t1; }
    const pauses = P.filter(q => q.p === 0 && q.dur >= 30 && q.t0 > 0 && ttf && q.t1 <= ttf).map(q => ({ t0: q.t0, t1: q.t1, dur: q.dur }));
    return { base, pattern, tests, maot, ttf, pauses, plateaus: P };
  }

  /* ---------- Analysis series (one averaging choice drives every view) ----------
     mode: 'raw' (each breath / sample), 'bin' (time bins of `param` s, labelled at the bin end),
           'ma' (centred moving average of `param` breaths), 'roll' (centred rolling average of `param` s).
     Every point carries a weight (breath duration for breath-based series, 1 for bins) and an
     "at" time used to decide which load it belongs to (bin midpoint for bins, the breath time otherwise). */
  function series(g, keep, mode, param) {
    const dur = i => (g.v.rf && F(g.v.rf[i]) && g.v.rf[i] > 0 ? 60 / g.v.rf[i] : (i ? Math.min(10, g.t[i] - g.t[i - 1]) : 3));
    const avgInput = g.kind === 'avg', gap = avgInput ? 1.5 * (g.avgWidth || 15) : 20;
    if (mode === 'bin' && !(avgInput && param <= (g.avgWidth || 15))) {
      const B = avgInput ? rebin(g, keep, param) : binGas(g, keep, param);
      return { t: B.t, v: B.v, wt: B.t.map(() => 1), at: B.t.map(t => t - param / 2), mode, param, width: param };
    }
    const idx = []; for (let i = 0; i < g.t.length; i++) if (keep[i]) idx.push(i);
    const t = idx.map(i => g.t[i]), wt = idx.map(i => (avgInput ? 1 : dur(i))), v = {};
    const w0 = avgInput ? (g.avgWidth || 15) : 0;
    if (mode === 'raw' || mode === 'bin') { g.has.forEach(k => (v[k] = idx.map(i => g.v[k][i]))); }
    else {
      const segs = segments(t, gap);
      g.has.forEach(k => {
        const y = idx.map(i => g.v[k][i]), out = new Array(y.length).fill(NaN);
        for (const [a, b] of segs) for (let j = a; j < b; j++) {
          let lo, hi;
          if (mode === 'ma') { const h = Math.floor(param / 2); lo = Math.max(a, j - h); hi = Math.min(b - 1, j + (param - 1 - h)); }
          else { lo = j; hi = j; while (lo > a && t[lo - 1] >= t[j] - param / 2) lo--; while (hi < b - 1 && t[hi + 1] <= t[j] + param / 2) hi++; }
          let s = 0, c = 0; for (let q = lo; q <= hi; q++) if (F(y[q])) { s += y[q] * wt[q]; c += wt[q]; }
          out[j] = c ? s / c : NaN;
        }
        v[k] = out;
      });
      ratios(v);
    }
    return { t, v, wt, at: t.map(x => x - w0 / 2), mode, param, width: w0 };
  }
  function rebin(g, keep, w) { // larger bins from an averaged file
    const acc = new Map();
    for (let i = 0; i < g.t.length; i++) { if (!keep[i]) continue; const k = Math.ceil(g.t[i] / w - 1e-9); let a = acc.get(k); if (!a) { a = {}; g.has.forEach(q => { a[q] = 0; a['n' + q] = 0; }); acc.set(k, a); } g.has.forEach(q => { const y = g.v[q][i]; if (F(y)) { a[q] += y; a['n' + q]++; } }); }
    const keys = [...acc.keys()].sort((a, b) => a - b), t = [], v = {}; g.has.forEach(k => (v[k] = []));
    for (const k of keys) { const a = acc.get(k); t.push(k * w); g.has.forEach(q => v[q].push(a['n' + q] ? a[q] / a['n' + q] : NaN)); }
    ratios(v);
    return { t, v };
  }
  const wmean = (ids, y, wt) => { let s = 0, c = 0; for (const i of ids) if (F(y[i])) { s += y[i] * wt[i]; c += wt[i]; } return c ? s / c : NaN; };
  const wsd = (ids, y, wt) => { const m = wmean(ids, y, wt); let s = 0, c = 0, n = 0; for (const i of ids) if (F(y[i])) { s += wt[i] * (y[i] - m) ** 2; c += wt[i]; n++; } return n > 1 ? Math.sqrt(s / c * n / (n - 1)) : NaN; };

  /* ---------- Step tests ---------- */
  // For each point: which test/step it belongs to (load at its "at" time) and how far its time is from the step end (s).
  function assignSteps(S, L, proto) {
    const n = S.t.length, test = new Int16Array(n).fill(-1), step = new Int8Array(n).fill(-1), toEnd = new Float64Array(n).fill(Infinity);
    proto.tests.forEach((T, ti) => T.steps.forEach((st, si) => {
      for (let i = 0; i < n; i++) { const a = S.at[i]; if (a >= st.t0 && a < st.t1 && S.t[i] <= st.t1 + 1e-6 && Math.abs(loadAt(L, a) - st.p) <= 1) { test[i] = ti; step[i] = si; toEnd[i] = st.t1 - S.t[i]; } }
    }));
    return { test, step, toEnd };
  }
  const inWin = (A, i, winSec) => A.toEnd[i] >= 0 && A.toEnd[i] < winSec - 1e-6;

  function stepMeans(S, A, proto, winSec) {
    return proto.tests.map((T, ti) => T.steps.map((st, si) => {
      const ids = []; for (let i = 0; i < S.t.length; i++) if (A.test[i] === ti && A.step[i] === si && inWin(A, i, winSec)) ids.push(i);
      const m = {}; for (const k in S.v) m[k] = wmean(ids, S.v[k], S.wt);
      const c = ids.map(i => cho(S.v.vo2[i], S.v.vco2[i])), f = ids.map(i => fat(S.v.vo2[i], S.v.vco2[i]));
      const W = ids.map(i => S.wt[i]), cm = wmean(ids.map((_, j) => j), c, W), fm = wmean(ids.map((_, j) => j), f, W);
      const win = ids.length ? [Math.min(...ids.map(i => S.t[i])) - (S.width || 0) - st.t0, Math.max(...ids.map(i => S.t[i])) - st.t0] : null;
      const g = ids.map(i => ge(st.p, S.v.vo2[i], S.v.vco2[i]));
      return { p: st.p, full: st.full, n: ids.length, m, cho: [cm, wsd(ids.map((_, j) => j), c, W)], fat: [fm, wsd(ids.map((_, j) => j), f, W)], ge: [wmean(ids.map((_, j) => j), g, W), wsd(ids.map((_, j) => j), g, W)], win };
    }));
  }

  function regressions(SM) {
    return SM.map(steps => { const s = steps.filter(q => q.full && q.n && F(q.m.vo2)); return s.length >= 3 ? linreg(s.map(q => q.m.vo2), s.map(q => q.p)) : null; });
  }

  // VT1 suggestion per test: hinge fits on V-slope and VE/VO2 vs VO2, using the last 2 min of each step.
  function suggestVT1(S, A, proto, winSec) {
    return proto.tests.map((T, ti) => {
      const ids = []; for (let i = 0; i < S.t.length; i++) if (A.test[i] === ti && inWin(A, i, winSec) && S.v.vo2[i] > 0) ids.push(i);
      const x = ids.map(i => S.v.vo2[i]);
      const vs = hinge(x, ids.map(i => S.v.vco2[i])), eq = hinge(x, ids.map(i => S.v.eqo2 ? S.v.eqo2[i] : NaN));
      const c = []; if (vs && vs.s2 > vs.s1) c.push(vs.bp); if (eq && eq.s2 > eq.s1) c.push(eq.bp);
      const vt1 = c.length ? mean(c) : quant(x, 0.45);
      // VT2: breakpoint where VE/VCO2 starts rising (searched above VT1); else the 90th percentile of VO2.
      const hi = ids.filter(i => S.v.vo2[i] > vt1), e2 = hinge(hi.map(i => S.v.vo2[i]), hi.map(i => S.v.eqco2 ? S.v.eqco2[i] : NaN), 0.1);
      const ok2 = !!(e2 && e2.s2 > 0 && e2.s2 > e2.s1 && e2.bp >= vt1 + 0.2);
      const vt2 = ok2 ? e2.bp : Math.max(quant(x, 0.9), vt1 + 0.2);
      return { vslope: vs ? vs.bp : null, eqo2: eq ? eq.bp : null, vt1, vt1Fit: c.length > 0, vt2, vt2Fit: ok2 };
    });
  }

  /* ---------- Gas collection periods at 90% VT1 ----------
     Each recording run at the base load: the mask-off point is the first gap (> gapSec) or partial-breath point
     (VO2 < 80% or > 125% of the run median) in the last 150 s, else the end of the data. The period is the
     `periodSec` before that point minus `dropSec`; the average uses the last `avgSec` of the period. */
  // Windows are found on a 15-s binned reference (robust to breath-to-breath noise); values come from S.
  function periods(S, L, proto, o, ref) {
    if (ref && ref !== S) {
      const W = periods(ref, L, proto, o);
      return W.map(p => {
        if (!p.perWin) return p;
        const [a, e] = p.perWin, ids = []; for (let i = 0; i < S.t.length; i++) if (S.t[i] > a + 1e-6 && S.t[i] <= e + 1e-6 && loadAt(L, S.at[i]) === proto.base && F(S.v.vo2[i]) && (S.mode !== 'bin' || (S.v.vo2[i] >= 0.8 * p.med && S.v.vo2[i] <= 1.25 * p.med))) ids.push(i);
        const avg = ids.filter(i => S.t[i] > e - o.avgSec + 1e-6), Wt = avg.map(i => S.wt[i]), J = avg.map((_, j) => j), val = f => avg.map(f);
        const vo2 = val(i => S.v.vo2[i]), rer = val(i => S.v.vco2[i] / S.v.vo2[i]), cs = val(i => cho(S.v.vo2[i], S.v.vco2[i])), fs = val(i => fat(S.v.vo2[i], S.v.vco2[i]));
        const gs = val(i => ge(proto.base, S.v.vo2[i], S.v.vco2[i]));
        return Object.assign({}, p, { period: ids, avg, n: avg.length, vo2: [wmean(J, vo2, Wt), wsd(J, vo2, Wt)], rer: [wmean(J, rer, Wt), wsd(J, rer, Wt)], cho: [wmean(J, cs, Wt), wsd(J, cs, Wt)], fat: [wmean(J, fs, Wt), wsd(J, fs, Wt)], ge: [wmean(J, gs, Wt), wsd(J, gs, Wt)] });
      });
    }
    const base = proto.base, ids = [];
    for (let i = 0; i < S.t.length; i++) if (loadAt(L, S.at[i]) === base && F(S.v.vo2[i])) ids.push(i);
    const runs = []; let cur = [];
    ids.forEach((i, k) => { if (k && S.t[i] - S.t[ids[k - 1]] > 45) { runs.push(cur); cur = []; } cur.push(i); }); if (cur.length) runs.push(cur);
    const minDur = 150;
    return runs.filter(r => S.t[r[r.length - 1]] - S.t[r[0]] >= minDur).map(r => {
      const med = median(r.map(i => S.v.vo2[i]));
      const bad = new Set(r.filter(i => S.v.vo2[i] < 0.8 * med || S.v.vo2[i] > 1.25 * med));
      const tend = S.t[r[r.length - 1]]; let evT = tend + 1e-6, ev = r.length;
      for (let k = 0; k < r.length; k++) { const i = r[k]; if (S.t[i] < tend - 150) continue; if (bad.has(i) || (k && S.t[i] - S.t[r[k - 1]] > o.gapSec)) { ev = k; break; } }
      const good = r.slice(0, ev).filter(i => !bad.has(i));
      const endT = good.length ? S.t[good[good.length - 1]] - o.dropSec : tend;
      const per = good.filter(i => S.t[i] <= endT + 1e-6 && S.t[i] > endT - o.periodSec + 1e-6);
      const avg = per.filter(i => S.t[i] > endT - o.avgSec + 1e-6);
      const W = avg.map(i => S.wt[i]), J = avg.map((_, j) => j);
      const val = f => avg.map(i => f(i));
      const vo2 = val(i => S.v.vo2[i]), rer = val(i => S.v.vco2[i] / S.v.vo2[i]), cs = val(i => cho(S.v.vo2[i], S.v.vco2[i])), fs = val(i => fat(S.v.vo2[i], S.v.vco2[i]));
      const t0 = S.t[r[0]] - (S.width || 0), t1 = tend;
      let label = '';
      const next = proto.tests.find(T => T.t0 >= t1 - 5), prev = [...proto.tests].reverse().find(T => T.t1 <= t0 + 5);
      if (next && next.t0 - t1 < 240) label = 'Before step test ' + (proto.tests.indexOf(next) + 1);
      else if (prev) label = 'After step test ' + (proto.tests.indexOf(prev) + 1);
      return {
        label, t0, t1, ids: r, bad: [...bad], period: per, avg, med,
        perWin: per.length ? [endT - o.periodSec, endT] : null, avgWin: avg.length ? [endT - o.avgSec, endT] : null,
        n: avg.length, vo2: [wmean(J, vo2, W), wsd(J, vo2, W)], rer: [wmean(J, rer, W), wsd(J, rer, W)], cho: [wmean(J, cs, W), wsd(J, cs, W)], fat: [wmean(J, fs, W), wsd(J, fs, W)], ge: (() => { const gs = avg.map(i => ge(base, S.v.vo2[i], S.v.vco2[i])); return [wmean(J, gs, W), wsd(J, gs, W)]; })()
      };
    });
  }

  /* ---------- Exercise time and sampling timepoints ---------- */
  // Exercise time = session time minus 0-W pauses before it (and back).
  function exTime(proto, t) { let p = 0; for (const q of proto.pauses) p += Math.max(0, Math.min(t, q.t1) - q.t0); return t - p; }
  function sesTime(proto, e) { let t = e; for (const q of proto.pauses) if (q.t0 < t) t += Math.min(q.dur, Math.max(0, t - q.t0)); return t; }
  // Standard blood glucose / RPE timepoints: pre-exercise; after each 5ST; +20 and +40 min of 90% VT1 after it (the +40 is
  // just before the next 5ST); task failure. Points within 2 min of task failure are merged into it.
  function timepoints(proto) {
    const out = [{ key: 'pre', label: 'Pre-exercise', t: 0 }], end = proto.ttf || Infinity;
    proto.tests.forEach((T, k) => {
      if (T.t1 < end - 120) out.push({ key: 'post' + (k + 1), label: 'After 5ST ' + (k + 1), t: T.t1 });
      const e1 = exTime(proto, T.t1);
      [20, 40].forEach(m => { const t = sesTime(proto, e1 + m * 60), nxt = proto.tests[k + 1];
        const tt = m === 40 && nxt ? nxt.t0 : t;
        if (tt < end - 120) out.push({ key: 'p' + (k + 1) + '_' + m, label: m + ' min after 5ST ' + (k + 1) + (m === 40 && nxt ? ' (before 5ST ' + (k + 2) + ')' : ''), t: tt }); });
    });
    if (proto.ttf) out.push({ key: 'ttf', label: 'Task failure', t: proto.ttf });
    return out;
  }

  // Glucose drink (g/kg body mass) given at a glucose timepoint: 0.15 before each 5ST (pre-exercise and 40 min after a 5ST
  // when another follows), 0.075 after each 5ST, 20 min after each 5ST, and at task failure.
  function glucoseDose(tp) {
    if (tp.key === 'pre') return 0.15;
    if (/^post\d+$/.test(tp.key) || /_20$/.test(tp.key) || tp.key === 'ttf') return 0.075;
    if (/_40$/.test(tp.key)) return /before 5ST/.test(tp.label) ? 0.15 : null;
    return null;
  }
  // RPE timepoints: the end of every 5ST stage reached, and +20 / +40 min of 90% VT1 after each 5ST (none at task failure).
  function rpeTimepoints(proto) {
    const out = [], end = proto.ttf || Infinity;
    proto.tests.forEach((T, k) => {
      T.steps.forEach((st, j) => { if (st.t1 <= end + 30) out.push({ key: 's' + (k + 1) + '_' + (j + 1), kind: 'step', test: k, stage: j + 1, p: st.p, label: '5ST ' + (k + 1) + ' · stage ' + (j + 1) + ' (' + st.p + ' W)', t: st.t1 }); });
      const e1 = exTime(proto, T.t1), nxt = proto.tests[k + 1];
      [20, 40].forEach(m => { const tt = m === 40 && nxt ? nxt.t0 : sesTime(proto, e1 + m * 60);
        if (tt < end) out.push({ key: 'p' + (k + 1) + '_' + m, kind: 'cyc', test: k, min: m, label: m + ' min after 5ST ' + (k + 1) + (m === 40 && nxt ? ' (before 5ST ' + (k + 2) + ')' : ''), t: tt }); });
    });
    return out.sort((a, b) => a.t - b.t);
  }
  // Numeric RPE markers (6–20) from the Cosmed marker column, before the 3MAOT.
  function rpeMarkers(gas, proto) {
    const lim = proto.maot ? proto.maot.t0 : Infinity;
    return (gas.markers || []).map(m => ({ t: m.t, v: parseFloat(String(m.text).replace(',', '.')) }))
      .filter(m => Number.isFinite(m.v) && m.v >= 6 && m.v <= 20 && m.t < lim).sort((a, b) => a.t - b.t);
  }
  // Order-preserving match of markers to timepoints. A marker logged late costs its delay; logged early costs 3× (RPE is
  // asked at the timepoint, so early entries are less likely). Every marker is assigned unless there are more markers
  // than timepoints. Returns { key: { mi, dt } }; flag when more than 3 min late or 2 min early.
  function matchRPE(tps, mk) {
    const n = tps.length, m = mk.length, SKIP_T = 240, SKIP_M = 3000, INF = 1e18;
    const c = (i, j) => { const d = mk[j].t - tps[i].t; return d >= 0 ? d : -3 * d; };
    const Dp = [...Array(n + 1)].map(() => new Array(m + 1).fill(INF)), B = [...Array(n + 1)].map(() => new Array(m + 1).fill(0));
    Dp[0][0] = 0;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
      if (i && Dp[i - 1][j] + SKIP_T < Dp[i][j]) { Dp[i][j] = Dp[i - 1][j] + SKIP_T; B[i][j] = 1; }
      if (j && Dp[i][j - 1] + SKIP_M < Dp[i][j]) { Dp[i][j] = Dp[i][j - 1] + SKIP_M; B[i][j] = 2; }
      if (i && j && Dp[i - 1][j - 1] + c(i - 1, j - 1) < Dp[i][j]) { Dp[i][j] = Dp[i - 1][j - 1] + c(i - 1, j - 1); B[i][j] = 3; }
    }
    const out = {}; let i = n, j = m;
    while (i || j) { const b = B[i][j]; if (b === 3) { const d = mk[j - 1].t - tps[i - 1].t; out[tps[i - 1].key] = { mi: j - 1, dt: d, flag: d > 180 || d < -120 }; i--; j--; } else if (b === 1) i--; else j--; }
    return out;
  }

  // Display-only time bins for the 3MAOT: time-weighted mean of the samples in each bin (masked samples left out).
  function binTime(t, ys, width, use) {
    if (!width) return { t: t.slice(), ys: ys.map(y => y.slice()) };
    const out = { t: [], ys: ys.map(() => []) }, end = t[t.length - 1];
    for (let a = 0; a < end; a += width) {
      const b = Math.min(a + width, end); let w = 0; const acc = ys.map(() => 0);
      for (let i = 0; i < t.length; i++) { if (t[i] < a || t[i] >= b || (use && !use[i])) continue; const dt = (i + 1 < t.length ? t[i + 1] : end) - t[i]; ys.forEach((y, k) => { if (Number.isFinite(y[i])) acc[k] += y[i] * dt; }); w += dt; }
      if (w > 0) { out.t.push((a + b) / 2); ys.forEach((_, k) => out.ys[k].push(acc[k] / w)); }
    }
    return out;
  }

  /* ---------- 3MAOT: CP and W' ---------- */
  function threeMAOT(L, m, includeSpike) {
    if (!m) return null;
    const t = [], p = [], rpm = [];
    for (let i = m.i0; i < m.i1; i++) { t.push(L.t[i] - m.t0); p.push(L.p[i]); rpm.push(L.rpm[i]); }
    const T = m.t1 - m.t0, dt = t.map((x, i) => (i < t.length - 1 ? t[i + 1] : T) - x);
    let cpw = 0, cpd = 0; t.forEach((x, i) => { if (x >= T - 30) { cpw += p[i] * dt[i]; cpd += dt[i]; } });
    const CP = cpw / cpd;
    // Start spike: from onset until cadence first recovers to >= 97% of the test's working cadence after the brake engages.
    const target = median(rpm.filter((r, i) => t[i] > 30 && t[i] < T - 30));
    let spikeEnd = 0;
    if (F(target)) { let dipped = false; for (let i = 0; i < t.length && t[i] < 5; i++) { if (rpm[i] < 0.97 * target) dipped = true; if (dipped && rpm[i] >= 0.97 * target) { spikeEnd = t[i]; break; } } }
    else { const cap = 1.5 * Math.max(...p.filter((x, i) => t[i] > 3)); for (let i = 0; i < t.length && t[i] < 3; i++) if (p[i] > cap) spikeEnd = t[i] + dt[i]; }
    const spike = t.map(x => x < spikeEnd);
    let W = 0, E = 0, peak = 0;
    t.forEach((x, i) => { E += p[i] * dt[i]; if (!includeSpike && spike[i]) return; W += Math.max(0, p[i] - CP) * dt[i]; peak = Math.max(peak, p[i]); });
    return { t, p, rpm, dt, dur: T, CP, Wp: W, peak, mean: E / T, spikeEnd, spike, target };
  }

  /* ---------- Session summary ---------- */
  function workDone(L, t0, t1) { let E = 0; for (let i = 0; i < L.t.length - 1; i++) { if (L.t[i] < t0 || L.t[i] >= t1) continue; E += L.p[i] * (L.t[i + 1] - L.t[i]); } return E; }

  const ee = (vo2, vco2) => 16.89 * vo2 + 4.84 * vco2; // kJ/min (Brouwer)
  // Energy partition (kJ/min): substrate energy = g/min × 17.57 (glycogen) or 39.33 (fat) kJ/g (Jeukendrup & Wallis 2005);
  // total expenditure (Brouwer); work = power × 0.06; the rest is energy not turned into work (mainly heat).
  function energy(choG, fatG, eeKJ, pW) {
    const c = Math.max(0, choG) * 17.57, f = Math.max(0, fatG) * 39.33;
    return { cho: c, fat: f, pctCho: c + f > 0 ? 100 * c / (c + f) : NaN, total: eeKJ, work: pW * 0.06, heat: eeKJ - pW * 0.06 };
  }
  const API = { solve3, binTime, ee, energy, mean, sd, median, quant, cho, fat, ge, metW, exTime, sesTime, timepoints, glucoseDose, rpeTimepoints, rpeMarkers, matchRPE, linreg, hinge, segments, flagOutliers, smooth, binGas, series, inWin, loadAt, plateaus, detectProtocol, assignSteps, stepMeans, regressions, suggestVT1, periods, threeMAOT, workDone };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.GDCore = API;
})(this);
