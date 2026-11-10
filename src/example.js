/* Lab CPET tool — example data. A made-up incremental cycling test (no real person): breath-by-breath gas in the
   COSMED export layout, with the power in the same file, and blood lactate for each stage.
   The physiology is a simple model, chosen so that VT1 is near 190 W, VT2 near 280 W and VO₂peak near 4.2 L/min.
   Works in the browser (global XLSX) and in Node (pass require('xlsx')). */
(function (root) {
  'use strict';
  const REST = 180, STAGE = 180, P0 = 100, INC = 30, NST = 9, LAST = 90, REC = 120; // seconds and watts; the last stage is cut short
  const VT1P = 190, VT2P = 280;

  // Repeatable pseudo-random numbers, so the example is the same every time.
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  const end = REST + (NST - 1) * STAGE + LAST, total = end + REC;
  function powerAt(t) {
    if (t < REST || t >= end) return 0;
    return P0 + INC * Math.min(NST - 1, Math.floor((t - REST) / STAGE));
  }
  // Steady-state targets for a given power (L/min, bpm, breaths/min).
  function target(P, t) {
    const vo2 = P > 0 ? Math.min(4.25, 0.8 + 0.0105 * P + (P > VT2P ? 0.002 * (P - VT2P) * Math.min(1, (t % STAGE) / STAGE) : 0)) : 0.35;
    const rer = P > 0 ? 0.84 + 0.0003 * Math.max(0, P - 100) + 0.0016 * Math.max(0, P - VT1P) : 0.82;
    const eqco2 = P > 0 ? 27 + 0.09 * Math.max(0, P - VT2P) : 31;
    return { vo2, vco2: vo2 * rer, eqco2, hr: P > 0 ? Math.min(188, 70 + 0.38 * P) : 62, rf: P > 0 ? 16 + 0.07 * P + 0.12 * Math.max(0, P - VT2P) : 13 };
  }

  function rows() {
    const r = rng(20261111), out = [];
    let t = 2, s = { vo2: 0.35, vco2: 0.29, hr: 62, eqco2: 31, rf: 13 }, n = 0;
    while (t < total) {
      const P = powerAt(t), g = target(P, t), dt = 60 / s.rf;
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const back = P === 0 && t > end; // recovery is slower
      s.vo2 += (g.vo2 - s.vo2) * k(back ? 50 : 30); s.vco2 += (g.vco2 - s.vco2) * k(back ? 70 : 45);
      s.hr += (g.hr - s.hr) * k(40); s.eqco2 += (g.eqco2 - s.eqco2) * k(60); s.rf += (g.rf - s.rf) * k(40);
      const depth = 1 + 0.07 * gauss(r); // one breath deeper or shallower moves VO₂, VCO₂ and VE together
      let vo2 = s.vo2 * depth * (1 + 0.03 * gauss(r)), vco2 = s.vco2 * depth * (1 + 0.025 * gauss(r));
      let ve = vco2 * s.eqco2 * (1 + 0.02 * gauss(r));
      n++; if (n === 140 || n === 610) { vo2 *= 2.1; vco2 *= 2.0; ve *= 2.2; } // two sighs, for the outlier check
      const rf = s.rf * (1 + 0.06 * gauss(r)), eqo2 = ve / vo2, eqco2 = ve / vco2;
      const peto2 = 78 + 1.3 * eqo2 + 0.8 * gauss(r), petco2 = 61 - 0.78 * eqco2 + 0.6 * gauss(r);
      out.push({ t, P, rf, vt: ve / rf, ve, vo2, vco2, rer: vco2 / vo2, eqo2, eqco2, peto2, petco2, hr: Math.round(s.hr + gauss(r)) });
      t += 60 / rf;
    }
    return out;
  }

  // The workbook, laid out like a COSMED breath-by-breath export: details in columns A–H, data from column J.
  function workbook(X) {
    X = X || (typeof XLSX !== 'undefined' ? XLSX : null);
    const meta = [['ID1', 'EXAMPLE'], ['Last Name', 'Participant'], ['First Name', 'Example'], ['Gender', 'Male'], ['Age', 30], ['Height (cm)', 178], ['Weight (kg)', 72],
      ['Test date', '1/1/2026'], ['Test Time', '9:00:00 AM'], ['Ergometer', 'Cycle ergometer'], ['Protocol', 'Example: 3-min stages, 100 W + 30 W'], ['Note', 'Simulated data, not a real person']];
    const head = ['t', 'Rf', 'VT', 'VE', 'VO2', 'VCO2', 'RQ', 'VE/VO2', 'VE/VCO2', 'PetO2', 'PetCO2', 'HR', 'Power', 'Marker'];
    const units = ['hh:mm:ss', '1/min', 'L(btps)', 'L/min', 'mL/min', 'mL/min', '---', '---', '---', 'mmHg', 'mmHg', 'bpm', 'W', '---'];
    const R = rows(), aoa = [];
    const n = Math.max(R.length + 3, meta.length);
    for (let i = 0; i < n; i++) {
      const line = new Array(9 + head.length).fill(null);
      if (meta[i]) { line[0] = meta[i][0]; line[1] = meta[i][1]; }
      if (i === 0) head.forEach((h, j) => (line[9 + j] = h));
      else if (i === 1) units.forEach((u, j) => (line[9 + j] = u));
      else if (i >= 3 && R[i - 3]) {
        const b = R[i - 3], f = (x, d) => +x.toFixed(d);
        [b.t / 86400, f(b.rf, 1), f(b.vt, 3), f(b.ve, 1), Math.round(b.vo2 * 1000), Math.round(b.vco2 * 1000), f(b.rer, 2), f(b.eqo2, 1), f(b.eqco2, 1), f(b.peto2, 1), f(b.petco2, 1), b.hr, b.P,
          Math.abs(b.t - REST) < 2 && i > 3 && R[i - 4].t < REST ? 'Start of test' : null].forEach((v, j) => (line[9 + j] = v));
      }
      aoa.push(line);
    }
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), 'Data');
    return wb;
  }

  // Blood lactate (mmol/L) at the end of a stage of power P; rest is 0.9.
  const lactate = P => +(P > 0 ? 0.9 + 0.08 * Math.exp((P - 100) / 50) : 0.9).toFixed(1);
  const fileName = 'Example_incremental_cycling_simulated.xlsx';

  const API = { workbook, rows, lactate, fileName, truth: { vt1: VT1P, vt2: VT2P, rest: REST, stage: STAGE, p0: P0, inc: INC, end } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LabExample = API;
})(this);
