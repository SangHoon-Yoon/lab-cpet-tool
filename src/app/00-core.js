/* Lab CPET tool — browser app. Depends on Plotly, XLSX, GDParse, GDCore, LabCore. */
(function () {
  'use strict';
  const VERSION = '0.23.4', CAVEAT = 'This tool helps with the analysis but should not be relied on alone. Suggested thresholds and fits only assist: always look at the data yourself, place and check every threshold, and confirm results against your usual method.', AUTHOR = 'SangHoon Yoon';
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
    source: null, offset: 0, type: null, blocks: null, plan: null, excluded: [], leaveOut: [], oxyWin: 'analysis', fits: {},
    outl: { local: true, nsd: 4, half: 5, vars: ['vo2', 'vco2', 've'], limits: true, rfMin: 5, rfMax: 100, vtMin: 0.3, remove: false, show: false },
    avg: { mode: 'bin', bin: 15, ma: 7, roll: 15 },
    view: { vars: ['vo2', 'hr', 've'], h: {} },
    inc: { t0: null, t1: null, skip: 0, selVar: 'vo2', stageWin: 60, peakWin: 30, x: 'vo2' },
    st: { meas: ['eqo2', 'vco2'], win: null, regWin: 60, sel: null, sels: {}, selVar: 'vo2', vt2: false, cmp: ['vo2', 'hr', 'rer'] }, per: { avgMin: 1, vars: ['vo2', 'hr', 'cho', 'fat', 'econ'] }, hrOffset: 0
  });
  const S = { pending: [], gas: null, lode: null, hr: null, meta: {}, set: defaults(), picks: { inc: {}, tests: {} }, I: null, proto: null, D: null, view: 'protocol', align: null, oxy: null, oxyCache: {} };
  let cmode = 'light';

