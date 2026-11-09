/* Lactate thresholds: a JavaScript port of the methods in the lactater R package
   (Mattioni Maturana F, MIT licence), which Exphyslab (exphyslab.com) also uses.
   Rows: [{ p: intensity, la: lactate (mmol/L), hr }], the first row being the resting baseline (p = 0) if one was taken.
   Options: { fit: 'poly3' | 'poly4' | 'bspline', baseline: include the baseline in the fit, restrain: share of the data for Log-log (0.25–1), sport: 'cycling' | 'running' }. */
(function (root) {
  'use strict';
  const F = Number.isFinite;
  const FITS = { poly3: '3rd degree polynomial', poly4: '4th degree polynomial', bspline: 'B-spline', exp: 'Exponential' };

  /* ---------- small linear algebra ---------- */
  // Least squares by Householder QR: returns the coefficients b that minimise |X b - y|.
  function lsq(X, y) {
    const n = X.length, p = X[0].length, A = X.map(r => r.slice()), b = y.slice(); if (n < p) return new Array(p).fill(NaN);
    for (let k = 0; k < p; k++) {
      let s = 0; for (let i = k; i < n; i++) s += A[i][k] * A[i][k]; s = Math.sqrt(s); if (s === 0) continue;
      const a = A[k][k] > 0 ? -s : s, v = new Array(n).fill(0); v[k] = A[k][k] - a; for (let i = k + 1; i < n; i++) v[i] = A[i][k];
      let vv = 0; for (let i = k; i < n; i++) vv += v[i] * v[i]; if (vv === 0) continue;
      for (let j = k; j < p; j++) { let d = 0; for (let i = k; i < n; i++) d += v[i] * A[i][j]; d = 2 * d / vv; for (let i = k; i < n; i++) A[i][j] -= d * v[i]; }
      let d = 0; for (let i = k; i < n; i++) d += v[i] * b[i]; d = 2 * d / vv; for (let i = k; i < n; i++) b[i] -= d * v[i];
    }
    const c = new Array(p).fill(0);
    for (let k = p - 1; k >= 0; k--) { let s = b[k]; for (let j = k + 1; j < p; j++) s -= A[k][j] * c[j]; c[k] = Math.abs(A[k][k]) < 1e-300 ? 0 : s / A[k][k]; }
    return c;
  }
  const sse = (X, y, c) => X.reduce((a, r, i) => { const e = r.reduce((s, v, j) => s + v * c[j], 0) - y[i]; return a + e * e; }, 0);
  // R's quantile(type = 7)
  const quantile7 = (x, q) => { const s = x.slice().sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); };
  // R's seq(from, to, by)
  const seq = (a, b, by) => { const n = Math.floor((b - a) / by + 1e-10), out = []; for (let i = 0; i <= n; i++) out.push(a + i * by); return out; };
  // R's approx() with rule = 1 and ties = "ordered": a binary search that assumes x is sorted, as R's C code does.
  function approx1(x, y, v) {
    const n = x.length; if (!n || !(v >= x[0] && v <= x[n - 1])) return NaN;
    let i = 0, j = n - 1; while (i < j - 1) { const ij = (i + j) >> 1; if (v < x[ij]) j = ij; else i = ij; }
    if (v === x[j]) return y[j]; if (v === x[i]) return y[i];
    return y[i] + (y[j] - y[i]) * ((v - x[i]) / (x[j] - x[i]));
  }
  const interp = (xs, ys, xout) => xout.map(v => approx1(xs, ys, v));

  /* ---------- curve fits ---------- */
  function fitPoly(x, y, deg) {
    const sc = Math.max(...x.map(Math.abs)) || 1, X = x.map(v => Array.from({ length: deg + 1 }, (_, k) => (v / sc) ** k)), c = lsq(X, y);
    const coef = c.map((v, k) => v / sc ** k); // raw coefficients, as poly(raw = TRUE)
    return { kind: deg === 3 ? 'poly3' : 'poly4', coef, predict: v => coef.reduce((s, b, k) => s + b * v ** k, 0) };
  }
  // splines::ns(x, df = 4) with an intercept: a natural cubic spline with boundary knots at the range and three inner knots at the quartiles.
  // Any basis of the same space gives the same fit, so the truncated-power basis (Hastie, Tibshirani & Friedman, eq. 5.4) is used.
  function fitNs(x, y) {
    const K = [Math.min(...x), quantile7(x, .25), quantile7(x, .5), quantile7(x, .75), Math.max(...x)], n = K.length, pos = v => (v > 0 ? v * v * v : 0);
    const sc = K[n - 1] || 1, Ks = K.map(k => k / sc); // intensities scaled to 0–1 for a well-conditioned fit
    const ds = (v, k) => (pos(v - Ks[k]) - pos(v - Ks[n - 1])) / (Ks[n - 1] - Ks[k]), bs = v => { const r = [1, v]; for (let k = 0; k < n - 2; k++) r.push(ds(v, k) - ds(v, n - 2)); return r; };
    const c = lsq(x.map(v => bs(v / sc)), y);
    return { kind: 'bspline', knots: K, predict: v => bs(v / sc).reduce((s, b, j) => s + b * c[j], 0) };
  }
  // lactate = a + b·exp(c·intensity), fitted by least squares. For a fixed c the best a and b are linear, so c is searched and then refined.
  function fitExp(x, y) {
    const rng = (Math.max(...x) - Math.min(...x)) || 1;
    const solve = c => { const X = x.map(v => [1, Math.exp(c * v)]), ab = lsq(X, y); return { c, ab, s: sse(X, y, ab) }; };
    let best = null; for (let k = -400; k <= 1200; k++) { const c = (k / 40) / rng; if (c === 0) continue; const r = solve(c); if (!best || r.s < best.s) best = r; }
    let lo = best.c - 1 / 40 / rng, hi = best.c + 1 / 40 / rng; // golden-section refinement
    const g = (Math.sqrt(5) - 1) / 2; let a = hi - g * (hi - lo), b = lo + g * (hi - lo), fa = solve(a).s, fb = solve(b).s;
    for (let it = 0; it < 200; it++) { if (fa < fb) { hi = b; b = a; fb = fa; a = hi - g * (hi - lo); fa = solve(a).s; } else { lo = a; a = b; fa = fb; b = lo + g * (hi - lo); fb = solve(b).s; } }
    const r = solve((lo + hi) / 2), [A, B] = r.ab, C = r.c;
    return { kind: 'exp', coef: [A, B, C], predict: v => A + B * Math.exp(C * v) };
  }
  function fitModel(kind, x, y) { return kind === 'poly4' ? fitPoly(x, y, 4) : kind === 'bspline' ? fitNs(x, y) : kind === 'exp' ? fitExp(x, y) : fitPoly(x, y, 3); }

  /* ---------- breakpoints (as the segmented package estimates them) ---------- */
  // Continuous broken-line regression with one or two breakpoints; the breakpoints minimising the squared error are found by a grid search and refined.
  function brokenSSE(x, y, psis) { const X = x.map(v => [1, v, ...psis.map(p => Math.max(0, v - p))]), c = lsq(X, y); return sse(X, y, c); }
  function breakpoints(x, y, k) {
    const n = x.length, lo = x[0], hi = x[n - 1], span = hi - lo, G = k === 1 ? 400 : 60;
    const cand = Array.from({ length: G - 1 }, (_, i) => lo + span * (i + 1) / G);
    let best = null;
    if (k === 1) cand.forEach(p => { const s = brokenSSE(x, y, [p]); if (!best || s < best.s) best = { s, p: [p] }; });
    else for (let i = 0; i < cand.length; i++) for (let j = i + 2; j < cand.length; j++) { const s = brokenSSE(x, y, [cand[i], cand[j]]); if (!best || s < best.s) best = { s, p: [cand[i], cand[j]] }; }
    let step = span / G; // coordinate refinement
    for (let it = 0; it < 60 && step > span * 1e-7; it++) {
      let moved = false;
      for (let d = 0; d < k; d++) for (const sgn of [-1, 1]) {
        const p = best.p.slice(); p[d] += sgn * step; if (p[d] <= lo || p[d] >= hi || (k === 2 && p[0] >= p[1])) continue;
        const s = brokenSSE(x, y, p); if (s < best.s - 1e-15) { best = { s, p }; moved = true; }
      }
      if (!moved) step /= 2;
    }
    return best.p;
  }

  /* ---------- the analysis ---------- */
  function analyse(rows0, opt = {}) {
    const o = Object.assign({ fit: 'poly3', baseline: false, restrain: 0.75, sport: 'cycling' }, opt), out = { methods: [], problems: [] };
    const rows = rows0.filter(r => F(r.p) && F(r.la)).map(r => ({ p: r.p, la: r.la, hr: F(r.hr) ? r.hr : NaN }));
    const hasBase = rows.length && rows[0].p === 0;
    if (rows.length - (hasBase ? 1 : 0) < 3) { out.problems.push('Enter lactate for at least three stages.'); return out; }
    for (let i = 1; i < rows.length; i++) if (!(rows[i].p > rows[i - 1].p)) { out.problems.push('The intensities must go up from one row to the next.'); return out; }
    if (rows.some(r => r.la < 0)) { out.problems.push('Lactate cannot be negative.'); return out; }
    // As in lactater, the baseline is drawn one step before the first stage.
    const data = rows.map(r => Object.assign({}, r));
    if (hasBase) data[0].p = data[1].p - (data[2].p - data[1].p);
    const model = o.baseline || !hasBase ? data : data.slice(1), dmaxData = hasBase ? data.slice(1) : data;
    const need = { poly3: 4, poly4: 5, bspline: 5 }[o.fit] || 4;
    if (model.length < need) { out.problems.push(`A ${FITS[o.fit].toLowerCase()} needs lactate from at least ${need} ${o.baseline && hasBase ? 'samples' : 'stages'}.`); return out; }
    const mx = model.map(r => r.p), my = model.map(r => r.la), step = 0.1;
    const grid = seq(Math.min(...mx), Math.max(...mx), step), gridLa = interp(mx, my, grid);
    const dig = o.sport === 'running' ? 2 : 1, rI = v => (F(v) ? Math.round(v * 10 ** dig) / 10 ** dig : NaN), r1 = v => Math.round(v * 10) / 10;
    // heart rate from a straight line through the stages (baseline left out)
    const hrRows = dmaxData.filter(r => F(r.hr)), hrFit = hrRows.length >= 2 ? fitPoly(hrRows.map(r => r.p), hrRows.map(r => r.hr), 1) : null;
    const hrAt = v => (hrFit && F(v) ? Math.round(hrFit.predict(v)) : NaN);
    const main = fitModel(o.fit, mx, my), fitted = mx.map(main.predict);
    out.fit = { kind: o.fit, label: FITS[o.fit], model: main, x: grid, y: grid.map(main.predict), from: model[0].p, data, baseline: hasBase ? rows[0].la : NaN };
    const laAt = (m, v) => (F(v) ? r1(m.predict(v)) : NaN);
    const add = (cat, name, fitting, p, la, extra) => out.methods.push(Object.assign({ cat, name, fitting, p: rI(p), la, hr: hrAt(rI(p)) }, extra || {}));
    // intensity where the fitted curve reaches a lactate value (retrieve_intensity)
    const intensityAt = lv => {
      if (main.kind === 'bspline') { const ys = out.fit.y, xs = grid, roots = []; for (let i = 1; i < xs.length; i++) { const a = ys[i - 1] - lv, b = ys[i] - lv; if (a === 0) roots.push(xs[i - 1]); else if (a * b < 0) roots.push(xs[i - 1] + (xs[i] - xs[i - 1]) * a / (a - b)); } if (ys.at(-1) === lv) roots.push(xs.at(-1)); return roots.length ? Math.max(...roots) : NaN; }
      let v = approx1(fitted, mx, lv);
      if (!F(v)) { let s = -1; for (let i = 1; i < fitted.length; i++) if (fitted[i] - fitted[i - 1] < 0) s = i; if (s >= 0) v = approx1(fitted.slice(s), mx.slice(s), lv); }
      return v;
    };
    const fmin = Math.min(...fitted), fmax = Math.max(...fitted), fitLabel = FITS[o.fit] + ' (user-defined)';
    // Log-log
    const loglog = () => {
      let pts = grid.map((x, i) => [x, gridLa[i]]).filter(q => q[0] > 0 && q[1] > 0).map(q => [Math.log(q[0]), Math.log(q[1])]);
      pts = pts.slice(0, Math.floor(o.restrain * pts.length + 1e-9)); if (pts.length < 4) return NaN;
      return Math.exp(breakpoints(pts.map(q => q[0]), pts.map(q => q[1]), 1)[0]);
    };
    const llP = loglog(), ll = { p: rI(llP), la: laAt(main, llP) };
    if (F(llP)) add('Log-log', 'Log-log', fitLabel, llP, ll.la); else out.problems.push('Log-log could not be estimated.');
    // OBLA and baseline-plus
    [2, 2.5, 3, 3.5, 4].forEach(v => add('OBLA', 'OBLA ' + v.toFixed(1), fitLabel, v > fmax || v < fmin ? NaN : intensityAt(v), v));
    if (hasBase) [0.5, 1, 1.5].forEach(d => { const v = rows[0].la + d; add('Bsln+', 'Bsln + ' + d.toFixed(1), fitLabel, v > fmax || v < fmin ? NaN : intensityAt(v), Math.round(v * 100) / 100); });
    // Dmax family (always fitted without the baseline; needs four stages for the 3rd degree polynomial)
    if (dmaxData.length < 4) { out.problems.push('The Dmax methods need lactate from at least four stages.'); return finish(); }
    const dx = dmaxData.map(r => r.p), dy = dmaxData.map(r => r.la), poly = fitPoly(dx, dy, 3), ex = fitExp(dx, dy), maxI = Math.max(...dx);
    const dmaxRoot = beta => {
      const [, b1, b2, b3] = poly.coef, A = 3 * b3, B = 2 * b2, C = b1 - beta; let roots;
      const disc = B * B - 4 * A * C; roots = Math.abs(A) < 1e-15 ? [-C / B] : disc >= 0 ? [(-B + Math.sqrt(disc)) / (2 * A), (-B - Math.sqrt(disc)) / (2 * A)] : [-B / (2 * A), -B / (2 * A)];
      const ok = roots.filter(r => r > 0 && r <= maxI); if (!ok.length) return { p: NaN, la: NaN };
      let p = Math.max(...ok), la = laAt(poly, p); if (la > 8 && ok.length > 1) { p = Math.min(...ok); la = laAt(poly, p); }
      return { p, la };
    };
    const expDmax = (c, si, sf) => Math.log((Math.exp(c * sf) - Math.exp(c * si)) / (c * sf - c * si)) / c;
    const rangeB = (Math.max(...dy) - Math.min(...dy)) / (Math.max(...dx) - Math.min(...dx)), dm = dmaxRoot(rangeB);
    add('Dmax', 'Dmax', '3rd degree polynomial (default)', dm.p, dm.la);
    let fr = -1; for (let i = 0; i < dy.length - 1; i++) if (dy[i + 1] - dy[i] >= 0.4) { fr = i; break; }
    const md = fr >= 0 ? dmaxRoot((Math.max(...dy) - dy[fr]) / (Math.max(...dx) - dx[fr])) : { p: NaN, la: NaN };
    add('Dmax', 'ModDmax', '3rd degree polynomial (default)', md.p, md.la, { from: fr >= 0 ? [dx[fr], dy[fr]] : null });
    const ed = expDmax(ex.coef[2], dx[0], dx.at(-1)); add('Dmax', 'Exp-Dmax', 'Exponential (default)', ed, laAt(ex, ed));
    const lpm = F(ll.p) && F(ll.la) ? dmaxRoot((dy.at(-1) - ll.la) / (dx.at(-1) - ll.p)) : { p: NaN, la: NaN };
    add('Dmax', 'Log-Poly-ModDmax', '3rd degree polynomial (default)', lpm.p, lpm.la);
    const lem = F(ll.p) ? expDmax(ex.coef[2], ll.p, dx.at(-1)) : NaN; add('Dmax', 'Log-Exp-ModDmax', 'Exponential (default)', lem, laAt(ex, lem));
    return finish();
    function finish() {
    // Lactate turn points
    if (grid.length >= 5) { const [a, b] = breakpoints(grid, gridLa, 2); add('LTP', 'LTP1', fitLabel, a, laAt(main, a)); add('LTP', 'LTP2', fitLabel, b, laAt(main, b)); }
    // LTratio: lowest lactate-to-intensity ratio on the B-spline fit
    if (mx.length >= 5) { const bsm = main.kind === 'bspline' ? main : fitNs(mx, my); let bi = 0, br = Infinity; grid.forEach((x, i) => { const r = bsm.predict(x) / x; if (r < br) { br = r; bi = i; } }); add('LTratio', 'LTratio', 'B-Spline (default)', grid[bi], r1(bsm.predict(grid[bi]))); }
    return out;
    }
  }
  const API = { analyse, FITS, _: { lsq, fitPoly, fitNs, fitExp, breakpoints, approx1, quantile7 } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LabLactate = API;
})(this);
