/* Runs the frozen Oxynet models (pyoxynet, Zignoli A; MIT licence) in plain JavaScript, on this computer.
   The steps after inference follow pyoxynet.test_pyoxynet: one-second grid, min-max scaling over the test, 40-s windows,
   smoothed outputs, and thresholds placed at the start of the window in which the outputs cross. */
(function (root) {
  'use strict';
  const MODELS = (typeof OXY_MODELS !== 'undefined') ? OXY_MODELS : require('./oxynet_models.js');
  const F = Number.isFinite;
  function decode(b64, type) {
    const bin = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary'), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return type === 'i' ? new Int32Array(u.buffer) : new Float32Array(u.buffer);
  }
  const size = s => s.reduce((a, b) => a * b, 1);
  const act = (y, a) => { if (a === 1) { for (let i = 0; i < y.length; i++) if (y[i] < 0) y[i] = 0; } else if (a === 3) { for (let i = 0; i < y.length; i++) y[i] = Math.min(6, Math.max(0, y[i])); } else if (a) throw new Error('Unsupported activation'); };

  // Prepare once: one reusable array per tensor, and a list of small closures for the operations.
  function compile(name) {
    const G = MODELS[name], T = G.tensors.map(t => ({ s: t.s, d: t.d ? decode(t.d, t.t) : new Float32Array(size(t.s)) }));
    const steps = G.ops.map(op => {
      const I = op.i.map(i => (i >= 0 ? T[i] : null)), O = op.o.map(i => T[i]), a = op.a, o0 = O[0];
      switch (op.k) {
        case 'RESHAPE': case 'EXPAND_DIMS': return () => o0.d.set(I[0].d);
        case 'PAD': { // padding of the height/width axis only, zeros
          const [n, w, c] = I[0].s, pad = I[1].d; return () => { o0.d.fill(0); const off = (pad[0] * o0.s[1] + pad[2]) * c; for (let b = 0; b < n; b++) for (let i = 0; i < w * c; i++) o0.d[off + i] = I[0].d[i]; void n; void pad; };
        }
        case 'CONV_2D': {
          const [, H, W, C] = I[0].s, f = I[1].s, [FN, FH, FW] = f, [, OH, OW] = o0.s, FC = f[3]; if (a.pad !== 1 || a.sw !== 1 || a.sh !== 1) throw new Error('Unsupported convolution');
          return () => {
            const x = I[0].d, k = I[1].d, b = I[2] ? I[2].d : null, y = o0.d;
            for (let oh = 0; oh < OH; oh++) for (let ow = 0; ow < OW; ow++) for (let n = 0; n < FN; n++) {
              let s = b ? b[n] : 0;
              for (let fh = 0; fh < FH; fh++) for (let fw = 0; fw < FW; fw++) for (let c = 0; c < FC; c++) s += x[((oh + fh) * W + ow + fw) * C + c] * k[((n * FH + fh) * FW + fw) * FC + c];
              y[(oh * OW + ow) * FN + n] = s;
            }
            void H; act(y, a.act);
          };
        }
        case 'MAX_POOL_2D': { // SAME padding with stride equal to the filter, as these models use
          const [, H, W, C] = I[0].s, [, OH, OW] = o0.s;
          return () => {
            const x = I[0].d, y = o0.d;
            for (let oh = 0; oh < OH; oh++) for (let ow = 0; ow < OW; ow++) for (let c = 0; c < C; c++) {
              let m = -Infinity;
              for (let h = oh * a.sh; h < Math.min(H, oh * a.sh + a.fh); h++) for (let w = ow * a.sw; w < Math.min(W, ow * a.sw + a.fw); w++) { const v = x[(h * W + w) * C + c]; if (v > m) m = v; }
              y[(oh * OW + ow) * C + c] = m;
            }
          };
        }
        case 'FULLY_CONNECTED': {
          const [U, N] = I[1].s;
          return () => { const x = I[0].d, k = I[1].d, b = I[2] ? I[2].d : null, y = o0.d; for (let u = 0; u < U; u++) { let s = b ? b[u] : 0; const r = u * N; for (let j = 0; j < N; j++) s += x[j] * k[r + j]; y[u] = s; } act(y, a.act); };
        }
        case 'ADD': case 'MUL': case 'SUB': {
          const A = I[0], B = I[1], n = o0.d.length, fn = op.k === 'ADD' ? (p, q) => p + q : op.k === 'MUL' ? (p, q) => p * q : (p, q) => p - q;
          const stepA = A.d.length === 1 ? 0 : 1, sb = B.s;
          if (B.d.length === n || B.d.length === 1 || A.d.length === 1) { const stepB = B.d.length === 1 ? 0 : 1; return () => { const y = o0.d, p = A.d, q = B.d; for (let i = 0; i < n; i++) y[i] = fn(p[stepA * i], q[stepB * i]); act(y, a.act); }; }
          const per = sb[sb.length - 1]; if (B.d.length !== per) throw new Error('Unsupported broadcast');
          return () => { const y = o0.d, p = A.d, q = B.d; for (let i = 0; i < n; i++) y[i] = fn(p[i], q[i % per]); act(y, a.act); };
        }
        case 'LOGISTIC': return () => { const x = I[0].d, y = o0.d; for (let i = 0; i < y.length; i++) y[i] = 1 / (1 + Math.exp(-x[i])); };
        case 'TANH': return () => { const x = I[0].d, y = o0.d; for (let i = 0; i < y.length; i++) y[i] = Math.tanh(x[i]); };
        case 'SOFTMAX': return () => { const x = I[0].d, y = o0.d; let s = 0; for (let i = 0; i < y.length; i++) s += Math.exp(a.beta * x[i]); for (let i = 0; i < y.length; i++) y[i] = Math.exp(a.beta * x[i]) / s; };
        case 'SPLIT': { const X = I[1], n = O.length, each = X.d.length / n; return () => { for (let k = 0; k < n; k++) { const y = O[k].d; for (let i = 0; i < each; i++) y[i] = X.d[k * each + i]; } }; }
        case 'SPLIT_V': { const X = I[0]; return () => { let off = 0; for (let k = 0; k < O.length; k++) { const y = O[k].d; for (let i = 0; i < y.length; i++) y[i] = X.d[off + i]; off += y.length; } }; }
        case 'UNPACK': { const X = I[0], each = X.d.length / O.length; return () => { for (let k = 0; k < O.length; k++) { const y = O[k].d; for (let i = 0; i < each; i++) y[i] = X.d[k * each + i]; } }; }
        case 'PACK': { const each = I[0].d.length; return () => { for (let k = 0; k < I.length; k++) { const x = I[k].d; for (let i = 0; i < each; i++) o0.d[k * each + i] = x[i]; } }; }
        case 'MEAN': { // mean over the time axis of [batch, steps, channels]
          const [, S, C] = I[0].s; return () => { const x = I[0].d, y = o0.d; y.fill(0); for (let t = 0; t < S; t++) for (let c = 0; c < C; c++) y[c] += x[t * C + c]; for (let c = 0; c < C; c++) y[c] /= S; };
        }
        default: throw new Error('Unsupported operation ' + op.k);
      }
    });
    const inp = T[G.in], out = T[G.out];
    return x => { inp.d.set(x); for (let i = 0; i < steps.length; i++) steps[i](); return out.d; };
  }
  const cache = {};
  const model = name => (cache[name] = cache[name] || compile(name));

  /* ---------- Steps around the model ---------- */
  function optimalFilter(t, y, lambda) { // pyoxynet.optimal_filter
    const n = y.length - 1, h = new Float64Array(n + 1); h[0] = .5 * (t[1] - t[0]); for (let i = 1; i < n; i++) h[i] = .5 * (t[i + 1] - t[i - 1]); h[n] = .5 * (t[n] - t[n - 1]);
    const a = new Float64Array(n), b = new Float64Array(n), u = new Float64Array(n);
    for (let i = 0; i < n; i++) { a[i] = -lambda / h[i + 1]; b[i] = t[i + 1] - t[i] + lambda / h[i] + lambda / h[i + 1]; u[i] = y[i + 1] - y[i]; }
    for (let j = 0; j < n - 1; j++) { const mu = a[j] / b[j]; b[j + 1] -= mu * a[j]; u[j + 1] -= mu * u[j]; }
    u[n - 1] /= b[n - 1]; for (let j = n - 2; j >= 0; j--) u[j] = (u[j] - a[j] * u[j + 1]) / b[j];
    const x = new Float64Array(n + 1); x[0] = y[0] + lambda * u[0] / h[0]; for (let i = 0; i < n; i++) x[i + 1] = x[i] + (t[i + 1] - t[i]) * u[i];
    return x;
  }
  // One-second grid: mean inside each second, straight lines between, the nearest value held at the ends.
  function toGrid(time, ys) {
    const seen = new Set(), keep = []; time.forEach((t, i) => { if (F(t) && !seen.has(t)) { seen.add(t); keep.push(i); } });
    const t0 = Math.floor(time[keep[0]]), tN = Math.floor(time[keep.at(-1)]), n = tN - t0 + 1, out = ys.map(y => {
      const s = new Float64Array(n), c = new Uint16Array(n); keep.forEach(i => { if (F(y[i])) { const k = Math.floor(time[i]) - t0; s[k] += y[i]; c[k]++; } });
      const r = new Float64Array(n); let last = -1;
      for (let k = 0; k < n; k++) if (c[k]) { r[k] = s[k] / c[k]; if (last < 0) for (let q = 0; q < k; q++) r[q] = r[k]; else for (let q = last + 1; q < k; q++) r[q] = r[last] + (r[k] - r[last]) * (q - last) / (k - last); last = k; }
      if (last >= 0) for (let q = last + 1; q < n; q++) r[q] = r[last]; else r.fill(NaN);
      return r;
    });
    return { t: Array.from({ length: n }, (_, k) => t0 + k), ys: out };
  }
  const nextTick = () => new Promise(r => setTimeout(r, 0));
  /* input: {t (s), vo2, vco2, ve, peto2, petco2}. Returns the outputs over time and the thresholds, or {error}. */
  async function run(input, name, onProgress) {
    const past = 40, keys = ['vo2', 'vco2', 've', 'peto2', 'petco2'], G = toGrid(input.t, keys.map(k => input[k])), n = G.t.length;
    if (n < 2 * past) return { error: 'The test is too short for Oxynet (it needs at least 80 s).' };
    const low = [], span = [];
    for (let j = 0; j < 5; j++) { let a = Infinity, b = -Infinity; for (const v of G.ys[j]) { if (v < a) a = v; if (v > b) b = v; } if (!F(a) || a === b) return { error: `Oxynet needs all five signals to vary, and ${keys[j].toUpperCase()} does not.` }; low.push(a); span.push(b - a); }
    const f = model(name), X = new Float32Array(n * 5); for (let i = 0; i < n; i++) for (let j = 0; j < 5; j++) X[i * 5 + j] = (G.ys[j][i] - low[j]) / span[j];
    const time = [], P = [[], [], []], vo2 = [], t0Clock = Date.now(); let tick = Date.now();
    for (let i = 1; i < n - past; i++) {
      const o = f(X.subarray(i * 5, (i + past) * 5));
      for (let c = 0; c < 3; c++) P[c].push(o[c]);
      time.push(G.t[i] + past); vo2.push(X[(i + past - 1) * 5] * span[0] + low[0]);
      if (Date.now() - tick > 60) { tick = Date.now(); if (onProgress) onProgress((i + 1) / (n - past)); await nextTick(); }
    }
    const sm = P.map(p => optimalFilter(time, p, 100)), lead = (from, to) => { let b = 0, v = -Infinity; for (let c = 0; c < 3; c++) { let s = 0; for (let i = from; i < to; i++) s += sm[c][i]; if (s > v) { v = s; b = c; } } return b; };
    const L = time.length, mod = lead(0, 5), sev = lead(L - 5, L), hv = [0, 1, 2].find(c => c !== mod && c !== sev);
    const out = { model: name, time, md: Array.from(sm[mod]), hv: hv === undefined ? null : Array.from(sm[hv]), sv: Array.from(sm[sev]), vo2F: Array.from(optimalFilter(time, vo2, 100)), ms: Date.now() - t0Clock };
    if (hv === undefined) { out.problem = 'The same output leads at the start and end of the test, so it does not show three domains.'; return out; }
    let i1 = -1, i2 = -1; for (let i = 0; i < L; i++) { if (i1 < 0 && out.hv[i] >= out.md[i]) i1 = i; if (out.sv[i] <= out.hv[i]) i2 = i; }
    const place = (i, label) => { if (i < 0) { out.problem = `The outputs never cross where ${label} would be.`; return null; } const k = i - past; if (k < 0) { out.problem = `The outputs cross within the first ${past} s of ${label}, before the model has seen a full window.`; return null; } return { time: time[k], vo2: out.vo2F[k], index: k, crossing: time[i] }; };
    out.vt1 = place(i1, 'VT1'); out.vt2 = place(i2, 'VT2');
    if (out.vt1 && out.vt2 && out.vt1.time >= out.vt2.time) out.problem = 'The outputs put VT1 at or after VT2, so the two are not consistent in this test.';
    return out;
  }
  const API = { run, compile, optimalFilter, toGrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LabOxynet = API;
})(this);
