/* Lab CPET tool — intensity channel, protocol detection, thresholds and data checks. Pure functions; no DOM. */
(function (root) {
  'use strict';
  const C = (typeof GDCore !== 'undefined') ? GDCore : require('./gdcore.js');
  const F = Number.isFinite, { mean, median, quant, linreg, hinge, plateaus, loadAt } = C;

  /* ---------- One intensity channel for both modalities ---------- */
  // Cycling: power from the Lode file (or a COSMED power column). Treadmill: speed from the COSMED file.
  // A speed that never changes is not a usable channel: cycling files can carry a leftover treadmill protocol (for example Balke).
  function speedChanges(gas) { const a = gas.aux || {}; return !!a.speed && new Set(a.speed.filter(x => F(x) && x > 0).map(x => Math.round(x * 10))).size >= 2; }
  function availableIntensity(gas, lode) {
    const a = gas.aux || {}, out = [];
    if (lode) out.push('lode');
    if (speedChanges(gas)) out.push('speed');
    if (a.power && a.power.some(x => F(x) && x > 0)) out.push('power');
    return out;
  }
  function buildIntensity(gas, lode, source, offset, blocks, plan) {
    if (plan) return fromPlan(plan, gas);
    if (blocks && blocks.length) return fromBlocks(blocks, gas);
    if (source === 'lode' && lode) return { t: lode.t.map(x => x + (offset || 0)), p: lode.p, rpm: lode.rpm, unit: 'W', label: 'Power', mode: 'cycling', source: 'lode', tolerance: 1, gapTol: 3 };
    if (source === 'speed' || source === 'power') {
      const y = source === 'speed' ? gas.aux.speed : gas.aux.power, w = gas.kind === 'avg' ? gas.avgWidth : 0, t = [], p = [];
      for (let i = 0; i < gas.t.length; i++) if (F(y[i])) {
        const v = Math.round(y[i] * 10) / 10; let at = gas.t[i] - w; // an averaged row covers the w seconds before its time stamp
        if (!w && t.length && v !== p.at(-1)) at = (gas.t[i - 1] + gas.t[i]) / 2; // between breaths, the change happened somewhere in the gap: use its middle
        t.push(at); p.push(v);
      }
      if (t.length) { t.push(gas.t.at(-1)); p.push(p.at(-1)); }
      return source === 'speed' ? { t, p, unit: 'km/h', label: 'Speed', mode: 'treadmill', source: 'cosmed', tolerance: 0.11, gapTol: Math.max(w + 5, 10), width: w }
        : { t, p, unit: 'W', label: 'Power', mode: 'cycling', source: 'cosmed', tolerance: 1, gapTol: Math.max(w + 5, 10), width: w };
    }
    return null;
  }
  // A protocol typed in by hand: blocks of {start (min), n, dur (min), first, inc}, zero between them.
  function fromBlocks(blocks, gas) {
    const unit = blocks.unit || 'km/h', t = [0], p = [0];
    [...blocks].sort((a, b) => a.start - b.start).forEach(b => {
      for (let k = 0; k < b.n; k++) { t.push(b.start * 60 + k * b.dur * 60); p.push(b.first + k * b.inc); }
      t.push(b.start * 60 + b.n * b.dur * 60); p.push(0);
    });
    t.push(Math.max(gas.t.at(-1), t.at(-1)) + 1); p.push(0);
    return { t, p, unit, label: unit === 'W' ? 'Power' : 'Speed', mode: unit === 'W' ? 'cycling' : 'treadmill', source: 'manual', tolerance: unit === 'W' ? 1 : 0.11, gapTol: 3 };
  }

  // The end of exercise: where the COSMED phase turns to recovery for the last time, otherwise the end of the file.
  function exerciseEnd(gas) {
    const ph = (gas.aux && gas.aux.phase) || [], w = gas.kind === 'avg' ? gas.avgWidth : 0;
    for (let i = ph.length - 1; i > 0; i--) if (/EXERCISE/i.test(ph[i - 1]) && /RECOVERY/i.test(ph[i])) return gas.t[i] - w;
    return gas.t.at(-1);
  }

  /* ---------- One session split across several COSMED files ----------
     list: [{gas, name}]. Files are put in clock order using the COSMED header, and their times are shifted onto one clock.
     Two exports of the same recording (same start time) count once, preferring breath-by-breath. Returns {gas, problem, note}. */
  function joinCosmed(list, epochOf) {
    const who = g => (String(g.meta.firstName || '') + ' ' + String(g.meta.lastName || '')).trim().toLowerCase();
    const items = list.map(x => ({ gas: x.gas, name: x.name, at: epochOf(x.gas.meta) }));
    if (items.length === 1) return { gas: items[0].gas };
    if (items.some(x => !F(x.at))) return { problem: 'Some files have no readable test date or time, so they cannot be put in order.' };
    if (new Set(items.map(x => who(x.gas))).size > 1) return { problem: 'These COSMED files are for different people: ' + [...new Set(items.map(x => who(x.gas)))].join(', ') + '.' };
    const day = x => new Date(x.at * 1000).toDateString();
    if (new Set(items.map(day)).size > 1) return { problem: 'These COSMED files are from different days, so they are not one session. Load one day at a time.' };
    const byStart = new Map(); items.forEach(x => { const o = byStart.get(x.at); if (!o || (o.gas.kind !== 'bxb' && x.gas.kind === 'bxb')) byStart.set(x.at, x); });
    const use = [...byStart.values()].sort((a, b) => a.at - b.at), dropped = items.length - use.length;
    if (use.length === 1) return { gas: use[0].gas, note: 'Two exports of the same recording: the breath-by-breath one is used.' };
    if (new Set(use.map(x => x.gas.kind + (x.gas.avgWidth || ''))).size > 1) return { problem: 'Export all the files of a session in the same format: these mix breath-by-breath and averaged data.' };
    const f0 = use[0].gas, keys = f0.has, join = { kind: f0.kind, avgWidth: f0.avgWidth, t: [], v: {}, has: keys.filter(k => use.every(x => x.gas.has.includes(k))), markers: [], meta: Object.assign({}, f0.meta), aux: { speed: [], grade: [], power: [], phase: [], speedUnit: f0.aux.speedUnit }, files: [] };
    join.has.forEach(k => (join.v[k] = []));
    const push = (t, get, a) => { join.t.push(t); join.has.forEach(k => join.v[k].push(get(k))); ['speed', 'grade', 'power', 'phase'].forEach(k => join.aux[k].push(a(k))); };
    use.forEach((x, n) => {
      const g = x.gas, off = x.at - use[0].at;
      // An empty row at each end of a file marks the rest between files: no gas data and no movement.
      if (n) push(off, () => NaN, k => (k === 'phase' ? 'REST' : k === 'grade' ? NaN : 0));
      for (let i = 0; i < g.t.length; i++) push(g.t[i] + off, k => g.v[k][i], k => g.aux[k][i]);
      (g.markers || []).forEach(m => join.markers.push({ t: m.t + off, text: m.text }));
      if (n < use.length - 1) push(g.t.at(-1) + off + 1, () => NaN, k => (k === 'phase' ? 'REST' : k === 'grade' ? NaN : 0));
      join.files.push({ name: x.name, start: off, end: g.t.at(-1) + off, protocol: g.meta.protocol, mass: g.meta.mass });
    });
    for (let i = 1; i < use.length; i++) if (join.files[i].start < join.files[i - 1].end) return { problem: `${use[i].name} starts before ${use[i - 1].name} has ended, so the clock times look wrong.` };
    return { gas: join, note: dropped ? 'Duplicate exports of a recording were left out.' : '' };
  }
  // The usual incremental test written as a plan: warm-up, then stages of one length, then shorter stages from a chosen time to the end.
  function fromPlan(pl, gas) {
    const unit = pl.unit || 'W', t = [0], p = [F(pl.warmP) && pl.warmMin > 0 ? pl.warmP : 0], warm = (pl.warmMin || 0) * 60, end = F(pl.endMin) ? pl.endMin * 60 : exerciseEnd(gas), sw = F(pl.switchMin) ? pl.switchMin * 60 : Infinity;
    let x = warm, v = pl.startP, guard = 0;
    while (x < end - 1e-6 && guard++ < 500) {
      const short = x >= sw - 1e-6, x1 = Math.min(x + (short ? (pl.shortMin || 1) : pl.stageMin) * 60, short ? end : Math.min(sw, end));
      if (x === 0) p[0] = v; else { t.push(x); p.push(v); }
      x = x1; v += x >= sw - 1e-6 && F(pl.shortInc) ? pl.shortInc : pl.inc; // the step into a shorter stage uses the shorter-stage increment
    }
    t.push(end); p.push(0); const last = Math.max(gas.t.at(-1), end) + 1; t.push(last); p.push(0);
    return { t, p, unit, label: unit === 'W' ? 'Power' : 'Speed', mode: unit === 'W' ? 'cycling' : 'treadmill', source: 'manual', plan: true, warmEnd: warm, tolerance: unit === 'W' ? 1 : 0.11, gapTol: 3 };
  }

  /* ---------- Protocol detection ---------- */
  function coreOf(run, tol) { // longest stretch with equal increments and equal stage durations
    let best = null;
    for (let i = 0; i < run.length - 1; i++) {
      const d = run[i + 1].p - run[i].p, ref = run[i].dur, lim = Math.max(10, 0.1 * ref); let j = i + 1;
      if (Math.abs(run[j].dur - ref) > lim) continue;
      while (j + 1 < run.length && Math.abs(run[j + 1].p - run[j].p - d) <= tol && Math.abs(run[j + 1].dur - ref) <= lim) j++;
      const n = j - i + 1; if (!best || n > best.n) best = { i, n, inc: d, stages: run.slice(i, j + 1) };
    }
    return best;
  }

  function detect(I, opts) {
    opts = opts || {};
    const unit = I.unit, minV = unit === 'W' ? 20 : 2, tol = I.tolerance, gapTol = I.gapTol;
    const P = plateaus(I), LP = P.filter(q => q.dur >= 20 && q.p > minV);
    const exTime = P.filter(q => q.p > minV).reduce((a, q) => a + q.dur, 0);
    // Ascending runs of stages.
    const runs = []; let cur = [];
    LP.forEach(q => { const pv = cur[cur.length - 1]; if (pv && q.p > pv.p + tol && q.t0 - pv.t1 <= gapTol) cur.push(q); else { if (cur.length >= 2) runs.push(cur); cur = [q]; } });
    if (cur.length >= 2) runs.push(cur);
    const durOf = r => r[r.length - 1].t1 - r[0].t0;
    const longest = runs.slice().sort((a, b) => durOf(b) - durOf(a))[0];
    const ramp = findRamp(P, unit, minV, tol);

    const two = opts.type === 'prolonged' || opts.type === 'incremental' ? null : findTwoPhase(P, runs, tol, unit, minV);
    let type = 'prolonged';
    if (two) type = 'incremental';
    else if (ramp && ramp.dur >= 0.5 * exTime) type = 'incremental';
    else if (longest) { const c = coreOf(longest, tol); if (durOf(longest) >= 0.6 * exTime && (longest.length >= 7 || (c && c.n >= 6))) type = 'incremental'; }
    if (opts.type && opts.type !== 'two') type = opts.type;

    const out = { unit, label: I.label, type, plateaus: P, runs, tests: [], pattern: null, base: NaN, maot: null, ttf: null, pauses: [], inc: null, ramp: null, phases: [] };

    // Incremental: the longest run (or ramp), with any differing first stage marked as warm-up.
    if (ramp) out.ramp = ramp;
    if (two) {
      out.inc = { ramp: false, stages: two.first, t0: two.first.find(q => !q.warm).t0, t1: two.first.at(-1).t1, peak: two.first.at(-1).p };
      out.max = { stages: two.second.filter(q => !q.warm), t0: two.second.find(q => !q.warm).t0, t1: two.second.at(-1).t1, peak: two.second.at(-1).p, walk: [two.first.at(-1).t1, two.second.find(q => !q.warm).t0] };
    } else if (longest || ramp) {
      if (ramp && (!longest || ramp.dur > durOf(longest))) out.inc = { ramp: true, stages: [], t0: ramp.t0, t1: ramp.t1, peak: ramp.p1 };
      else {
        const st = longest.map(q => ({ p: q.p, t0: q.t0, t1: q.t1, dur: q.dur, full: true, warm: false }));
        if (firstIsWarm(st)) st[0].warm = true;
        if (st.length >= 2 && st.at(-1).dur < 0.5 * st.at(-2).dur) st.at(-1).full = false; // a final stage cut short
        if (F(I.warmEnd) && I.warmEnd > 0) st.forEach(q => { if (q.t1 <= I.warmEnd + 1) q.warm = true; });
        out.inc = { ramp: false, stages: st, t0: st.find(q => !q.warm).t0, t1: st.at(-1).t1, peak: st.at(-1).p };
      }
    }

    // Step tests embedded in a trial.
    const cores = runs.map(r => coreOf(r, tol)).filter(c => c && c.n >= 3);
    const pat = cores.slice().sort((a, b) => b.n - a.n)[0];
    if (pat) out.pattern = { powers: pat.stages.map(q => q.p), inc: pat.inc, stepDur: Math.round(median(pat.stages.map(q => q.dur))) };
    if (out.pattern) {
      const pw = out.pattern.powers, sd = out.pattern.stepDur, seen = [];
      for (let i = 0; i < LP.length; i++) {
        if (Math.abs(LP[i].p - pw[0]) > tol) continue;
        if (i > 0 && Math.abs(LP[i - 1].p - pw[0]) <= tol && LP[i].t0 - LP[i - 1].t1 <= gapTol) continue;
        const steps = [];
        for (let k = 0; k < pw.length && i + k < LP.length; k++) {
          const q = LP[i + k];
          if (Math.abs(q.p - pw[k]) > tol) break;
          if (k > 0 && q.t0 - steps[k - 1].t1 > gapTol) break;
          steps.push({ p: q.p, t0: q.t0, t1: q.t1, dur: q.dur, full: q.dur >= sd - 10 });
        }
        if (steps.length >= 2) seen.push(steps);
      }
      // Runs with other powers (a test re-prescribed partway through) still count if they show the same structure.
      cores.forEach(c => { if (!seen.some(s => s[0].t0 <= c.stages[0].t0 && s.at(-1).t1 >= c.stages[0].t1)) seen.push(c.stages.map(q => ({ p: q.p, t0: q.t0, t1: q.t1, dur: q.dur, full: true }))); });
      seen.sort((a, b) => a[0].t0 - b[0].t0);
      out.tests = seen.map(steps => ({ steps, t0: steps[0].t0, t1: steps.at(-1).t1, complete: steps.length === pw.length && steps.every(s => s.full) }));
    }

    // Steady work: the load with most time outside the tests.
    const inTest = q => out.tests.some(T => q.t0 >= T.t0 - 1 && q.t1 <= T.t1 + 1);
    const tot = new Map(); P.forEach(q => { if (q.p > minV && q.dur >= 60 && !inTest(q)) tot.set(q.p, (tot.get(q.p) || 0) + q.dur); });
    out.base = [...tot.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? NaN;

    // All-out test on the ergometer: the last abrupt rise to well above steady work.
    const ref = F(out.base) ? out.base : median(LP.map(q => q.p));
    if (unit === 'W' && F(ref)) {
      let on = null; for (let i = I.t.length - 1; i > 5; i--) if (I.p[i] >= 1.8 * ref && I.p[i - 1] <= 1.2 * ref) { on = i; break; }
      if (on !== null && !out.max && (!out.inc || I.t[on] > out.inc.t1 || type === 'prolonged')) {
        const t0 = I.t[on]; let e = I.t.length - 1;
        for (let i = on; i < I.t.length; i++) if (I.t[i] > t0 + 60 && I.p[i] < 0.4 * ref) { e = i; break; }
        if (I.t[e] - t0 >= 30 && !plateausAtOnset(LP, t0)) out.maot = { i0: on, i1: e, t0, t1: I.t[e], dur: I.t[e] - t0 };
      }
    }
    if (out.maot) out.tests = out.tests.filter(T => T.t0 < out.maot.t0);
    const work = Math.min(F(out.base) ? out.base : Infinity, out.pattern ? out.pattern.powers[0] : Infinity);
    for (const q of P) { if (out.maot && q.t0 >= out.maot.t0) break; if (q.dur >= 30 && q.p >= 0.8 * work && q.p > minV) out.ttf = q.t1; }
    out.pauses = P.filter(q => q.p <= minV && q.dur >= 30 && q.t0 > 5 && out.ttf && q.t1 <= out.ttf).map(q => ({ t0: q.t0, t1: q.t1, dur: q.dur }));

    // Shaded phases for the viewer.
    if (type === 'incremental' && out.inc) {
      if (!out.inc.ramp && out.inc.stages[0].warm) out.phases.push({ kind: 'warm', t0: out.inc.stages[0].t0, t1: out.inc.stages[0].t1, label: 'Warm-up' });
      out.phases.push({ kind: 'test', t0: out.inc.t0, t1: out.inc.t1, label: out.inc.ramp ? 'Ramp' : out.max ? 'Threshold stages' : 'Incremental test' });
      if (out.max) out.phases.push({ kind: 'test', t0: out.max.t0, t1: out.max.t1, label: 'VO₂max stages' });
    } else {
      out.tests.forEach((T, i) => out.phases.push({ kind: 'test', t0: T.t0, t1: T.t1, label: testName(out, i) + (T.complete ? '' : ' (partial)') }));
      P.filter(q => q.p > minV && q.dur >= 120 && !inTest(q) && !(out.maot && q.t0 >= out.maot.t0)).forEach(q => out.phases.push({ kind: 'steady', t0: q.t0, t1: q.t1, label: fmtI(q.p, unit) }));
    }
    if (out.maot) out.phases.push({ kind: 'allout', t0: out.maot.t0, t1: out.maot.t1, label: 'All-out' });
    out.phases.sort((a, b) => a.t0 - b.t0);
    return out;
  }
  // A first stage well below the next, with a bigger jump than the stages after it, is a warm-up.
  function firstIsWarm(st) { if (st.length < 3) return false; const d0 = st[1].p - st[0].p, d1 = st[2].p - st[1].p; return d0 > 1.4 * d1 && st[0].p < 0.85 * st[1].p; }
  // Longer stages for thresholds, an easy block, then shorter stages to failure. Stage lengths in the first part may differ.
  function findTwoPhase(P, runs, tol, unit, minV) {
    const stage = q => ({ p: q.p, t0: q.t0, t1: q.t1, dur: q.dur, full: true, warm: false });
    const parts = runs.map(r => { const st = r.map(stage); if (firstIsWarm(st)) st[0].warm = true; return st; }).filter(st => st.filter(q => !q.warm).length >= 2);
    if (parts.length !== 2) return null;
    const [a, b] = parts, work = st => st.filter(q => !q.warm), med = st => median(work(st).map(q => q.dur)), gap = work(b)[0].t0 - a.at(-1).t1;
    if (!(med(a) >= 120 && med(b) <= 90 && work(b).length >= 3 && gap >= 30 && gap <= 900)) return null;
    // Between the two parts there must be only the easy block, below where the parts start.
    if (P.some(q => q.t0 >= a.at(-1).t1 - 1 && q.t1 <= work(b)[0].t0 + 1 && q.dur >= 20 && q.p >= work(b)[0].p - tol)) return null;
    // Keep a last stage too short to count as a full plateau (10 s or more).
    const last = b.at(-1), extra = P.find(q => q.p > last.p + tol && q.t0 >= last.t1 - 1 && q.t0 - last.t1 <= 10 && q.dur >= 10 && q.dur < 20);
    if (extra) b.push(stage(extra));
    const m = med(b); if (b.at(-1).dur < 0.75 * m) b.at(-1).full = false;
    return { first: a, second: b };
  }
  const plateausAtOnset = (LP, t0) => LP.some(q => Math.abs(q.t0 - t0) < 2 && q.dur >= 60); // a long plateau is a stage, not an all-out start
  const fmtI = (v, u) => (u === 'W' ? Math.round(v) + ' W' : (+v.toFixed(1)) + ' km/h');
  function testName(pr, i) { const n = pr.pattern ? pr.pattern.powers.length : 0; return (n === 5 ? '5ST ' : 'Step test ') + (i + 1); }

  function findRamp(P, unit, minV, tol) { // a long monotonic rise made of short plateaus
    let best = null, a = -1;
    for (let i = 0; i < P.length; i++) {
      const ok = P[i].p > minV && P[i].dur < 30;
      if (ok && a < 0) a = i;
      const brk = a >= 0 && (!ok || i === P.length - 1 || P[i + 1].p < P[i].p);
      if (brk) {
        const e = ok ? i : i - 1;
        if (e > a) { const dur = P[e].t1 - P[a].t0, rise = P[e].p - P[a].p; if (dur >= 180 && rise >= (unit === 'W' ? 50 : 3) && (!best || dur > best.dur)) best = { t0: P[a].t0, t1: P[e].t1, dur, p0: P[a].p, p1: P[e].p }; }
        a = -1;
      }
    }
    return best;
  }

  /* ---------- Time ↔ VO2 map used to place thresholds ----------
     A 60-s mean, forced never to fall, so each VO2 (or VCO2) has one time. */
  function monoMap(ref, t0, t1) {
    const ids = []; for (let i = 0; i < ref.t.length; i++) if (ref.t[i] >= t0 && ref.t[i] <= t1 && F(ref.v.vo2[i])) ids.push(i);
    const t = ids.map(i => ref.t[i]), raw = k => ids.map(i => ref.v[k][i]);
    const sm = y => y.map((_, j) => { const w = []; for (let q = j; q >= 0 && t[j] - t[q] <= 30; q--) if (F(y[q])) w.push(y[q]); for (let q = j + 1; q < t.length && t[q] - t[j] <= 30; q++) if (F(y[q])) w.push(y[q]); return mean(w); });
    const cm = y => { let m = -Infinity; return y.map(v => (m = F(v) ? Math.max(m, v) : m)); };
    const vo2 = cm(sm(raw('vo2'))), vco2 = cm(sm(raw('vco2')));
    const inv = (arr, v) => { if (!t.length) return NaN; if (v <= arr[0]) return t[0]; for (let i = 1; i < arr.length; i++) if (arr[i] >= v) { const f = arr[i] > arr[i - 1] ? (v - arr[i - 1]) / (arr[i] - arr[i - 1]) : 0; return t[i - 1] + f * (t[i] - t[i - 1]); } return t.at(-1); };
    const at = (arr, x) => { if (!t.length) return NaN; if (x <= t[0]) return arr[0]; for (let i = 1; i < t.length; i++) if (t[i] >= x) { const f = (x - t[i - 1]) / (t[i] - t[i - 1]); return arr[i - 1] + f * (arr[i] - arr[i - 1]); } return arr.at(-1); };
    return { t, vo2, vco2, tOf: v => inv(vo2, v), vo2At: x => at(vo2, x), vco2At: x => at(vco2, x), tOfVco2: v => inv(vco2, v), lo: vo2[0], hi: vo2.at(-1) };
  }

  /* ---------- Classical threshold suggestions for an incremental test ---------- */
  // Each estimate is a two-line (hinge) breakpoint. VT2 is found first, so V-slope can be fitted below it, as Beaver et al. (1986) require.
  function suggestIncremental(ref, t0, t1, opts) {
    const M = monoMap(ref, t0, t1), ids = [];
    for (let i = 0; i < ref.t.length; i++) if (ref.t[i] >= t0 && ref.t[i] <= t1 && F(ref.v.vo2[i]) && ref.v.vo2[i] > 0.3) ids.push(i);
    const col = (k, sub) => (sub || ids).map(i => ref.v[k] ? ref.v[k][i] : NaN);
    const hi = quant(col('vo2'), 0.97), lo = quant(col('vo2'), 0.03), span = hi - lo;
    const add = (arr, key, label, h, test, convert) => { const ok = !!(h && test(h)); arr.push({ key, label, vo2: ok ? (convert ? convert(h.bp) : h.bp) : NaN, ok }); };
    // VT1 first, on data up to 80% of the VO2 range, so the steep end of the test cannot pull the V-slope break upward (Beaver et al., 1986).
    const low = ids.filter(i => ref.v.vo2[i] <= lo + 0.8 * span), vt1m = [];
    add(vt1m, 'vslope', 'V-slope', hinge(col('vo2', low), col('vco2', low), 0.15), h => h.s2 > h.s1);
    add(vt1m, 'eqo2', 'VE/VO₂ rises', hinge(col('vo2', low), col('eqo2', low), 0.15), h => h.s2 > 0 && h.s2 > h.s1);
    add(vt1m, 'peto2', 'PETO₂ rises', hinge(col('vo2', low), col('peto2', low), 0.15), h => h.s2 > 0 && h.s2 > h.s1);
    const v1ok = vt1m.filter(m => m.ok).map(m => m.vo2), vt1 = v1ok.length ? median(v1ok) : NaN;
    // VT2 above VT1 and against time: near VO2peak VO2 stops rising, so a VO2 axis would crowd the late breakpoints together.
    // The last 90 s are left out, because the final surge in ventilation would otherwise take the breakpoint.
    const from = F(vt1) ? M.tOf(vt1) + 120 : quant(ref.t.filter(x => x >= t0 && x <= t1), 0.5);
    const upperIds = ids.filter(i => ref.t[i] >= from && ref.t[i] <= t1 - (opts && opts.noFinalSurge ? 0 : 90)), ut = upperIds.map(i => ref.t[i]), vt2m = [], cap = lo + 0.97 * span;
    add(vt2m, 've_vco2', 'VE against VCO₂', hinge(col('vco2', upperIds), col('ve', upperIds), 0.15), h => h.s2 > h.s1 * 1.1, b => M.vo2At(M.tOfVco2(b)));
    add(vt2m, 'eqco2', 'VE/VCO₂ rises', hinge(ut, col('eqco2', upperIds), 0.15), h => h.s2 > 0 && h.s2 > h.s1, b => M.vo2At(b));
    add(vt2m, 'petco2', 'PETCO₂ falls', hinge(ut, col('petco2', upperIds), 0.15), h => h.s2 < 0 && h.s2 < h.s1, b => M.vo2At(b));
    const v2ok = vt2m.filter(m => m.ok).map(m => m.vo2), vt2 = v2ok.length ? median(v2ok) : NaN;
    // Breakpoints at the very start of the search range may only mean the rise began before the data do.
    const startEdge = (() => { const xs = col('vo2', low).filter(F), a = quant(xs, 0.15), b = quant(xs, 0.85), near = vt1m.filter(m => m.ok && m.vo2 <= a + 0.03 * (b - a)); return near.length >= 2; })();
    const spread = a => (a.length > 1 ? Math.max(...a) - Math.min(...a) : NaN);
    const low2 = !F(vt2) || vt2 >= cap || v2ok.length < 2 || spread(v2ok) > 0.3, low1 = !F(vt1) || v1ok.length < 2 || spread(v1ok) > 0.3;
    return { vt1, vt2, vt1Methods: vt1m, vt2Methods: vt2m, map: M, startEdge, unsure: { vt1: low1, vt2: low2 }, spread: { vt1: spread(v1ok), vt2: spread(v2ok) } };
  }

  /* ---------- Peak values ---------- */
  // Highest time-weighted rolling mean of `win` seconds, requiring the window to be at least 80% covered.
  function rollingPeak(S, key, win, t0, t1) {
    const y = S.v[key]; if (!y) return null; let best = null, lo = 0;
    const width = S.width || 0;
    for (let i = 0; i < S.t.length; i++) {
      if (S.t[i] < t0 || S.t[i] > t1 || !F(y[i])) continue;
      while (S.t[lo] <= S.t[i] - win) lo++;
      let s = 0, w = 0, n = 0; for (let j = lo; j <= i; j++) if (F(y[j]) && S.t[j] >= t0) { s += y[j] * S.wt[j]; w += S.wt[j]; n++; }
      const covered = width ? n * width : w; if (covered < 0.8 * win) continue;
      const m = s / w; if (!best || m > best.value) best = { value: m, t0: S.t[i] - win, t1: S.t[i], n };
    }
    return best;
  }
  function meanInWindow(S, key, t0, t1) {
    const y = S.v[key]; if (!y) return NaN; let s = 0, w = 0;
    for (let i = 0; i < S.t.length; i++) if (S.t[i] > t0 && S.t[i] <= t1 && F(y[i])) { s += y[i] * S.wt[i]; w += S.wt[i]; }
    return w ? s / w : NaN;
  }

  /* ---------- Stage values ---------- */
  // Mean of each variable over the last `win` seconds of a stage (never longer than the stage).
  function stageValues(S, st, win, mass, mode) {
    const a = st.t1 - Math.min(win, st.dur), m = {}, ids = [];
    for (let i = 0; i < S.t.length; i++) if (S.t[i] > a + 1e-6 && S.t[i] <= st.t1 + 1e-6 && S.at[i] >= st.t0) ids.push(i);
    for (const k in S.v) { let s = 0, w = 0; ids.forEach(i => { const y = S.v[k][i]; if (F(y)) { s += y * S.wt[i]; w += S.wt[i]; } }); m[k] = w ? s / w : NaN; }
    const covered = S.width ? ids.length * S.width : ids.reduce((q, i) => q + S.wt[i], 0);
    m.vo2rel = F(mass) && mass > 0 ? m.vo2 * 1000 / mass : NaN;
    m.cho = C.cho(m.vo2, m.vco2); m.fat = C.fat(m.vo2, m.vco2);
    const o = { p: st.p, dur: st.dur, full: st.full !== false, warm: !!st.warm, n: ids.length, cover: covered / Math.min(win, st.dur), m };
    if (mode === 'cycling') o.ge = C.ge(st.p, m.vo2, m.vco2);
    if (mode === 'treadmill' && st.p > 0) { o.economy = m.vo2rel * 60 / st.p; o.costJ = F(mass) && mass > 0 ? C.ee(m.vo2, m.vco2) * 1000 / mass / (st.p * 1000 / 60) : NaN; }
    return o;
  }
  // Intensity from VO2: regression through the stage-end values of stages long enough to settle (at least 2 min, excluding warm-up).
  function intensityFit(values) {
    let use = values.filter(q => !q.warm && q.full && q.dur >= 120 && F(q.m.vo2));
    if (use.length < 3) use = values.filter(q => !q.warm && F(q.m.vo2));
    if (use.length < 3) return null;
    const r = linreg(use.map(q => q.m.vo2), use.map(q => q.p)); r.nStages = use.length; r.range = [Math.min(...use.map(q => q.m.vo2)), Math.max(...use.map(q => q.m.vo2))]; r.stages = use;
    return r;
  }

  /* ---------- RPE from the COSMED marker column ---------- */
  function stageRPE(gas, stages) {
    if (!stages.length) return {};
    const t0 = stages[0].t0, t1 = stages.at(-1).t1 + 60;
    const mk = (gas.markers || []).map(m => ({ t: m.t, v: parseFloat(String(m.text).replace(',', '.')) })).filter(m => F(m.v) && m.v >= 6 && m.v <= 20 && m.t > t0 && m.t < t1).sort((a, b) => a.t - b.t);
    const tps = stages.map((s, i) => ({ key: i, t: s.t1 })), hit = C.matchRPE(tps, mk), out = {};
    Object.entries(hit).forEach(([k, h]) => { out[k] = mk[h.mi].v; });
    return out;
  }

  /* ---------- Maximal-effort criteria ---------- */
  function effortChecks(S, gas, inc, age, values, peak, rpe) {
    const rows = [], stg = values.filter(q => q.full && !q.warm);
    if (stg.length >= 2) {
      const a = stg.at(-2).m.vo2, b = stg.at(-1).m.vo2, d = (b - a) * 1000;
      rows.push({ met: F(d) ? d < 150 : null, name: 'VO₂ plateau', detail: F(d) ? `VO₂ changed by ${d >= 0 ? '+' : ''}${d.toFixed(0)} mL/min over the last stage (criterion: under 150)` : 'not available' });
    }
    rows.push({ met: peak.rer ? peak.rer.value >= 1.10 : null, name: 'RER', detail: peak.rer ? `Peak ${peak.rer.value.toFixed(2)} (criterion: at least 1.10)` : 'not available' });
    if (peak.hr && F(age)) { const pred = 220 - age; rows.push({ met: peak.hr.value >= pred - 10, name: 'Heart rate', detail: `Peak ${peak.hr.value.toFixed(0)} bpm, age-predicted ${pred.toFixed(0)} (criterion: within 10 bpm)` }); }
    else rows.push({ met: null, name: 'Heart rate', detail: 'Needs heart rate and age' });
    const vals = Object.values(rpe);
    const lastIdx = values.length - 1;
    if (F(rpe[lastIdx])) rows.push({ met: rpe[lastIdx] >= 17, name: 'RPE', detail: `Final stage ${rpe[lastIdx]} (criterion: at least 17)` });
    else rows.push({ met: null, name: 'RPE', detail: vals.length ? `Not recorded in the final stage (last value ${vals.at(-1)})` : 'No RPE markers in the file' });
    return rows;
  }

  /* ---------- Data checks in plain language ---------- */
  const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  function excelDate(x) { if (typeof x !== 'number') return null; const d = new Date(Math.round((x - 25569) * 86400000)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }

  function alignment(gas, I) { // finds the time shift of the gas data that best matches VE to intensity
    if (!I || I.source !== 'lode') return null;
    const keep = gas.t.map((_, i) => F(gas.v.ve[i]));
    const b = C.series(gas, keep, 'bin', Math.max(5, gas.avgWidth || 5));
    const r2 = off => { const x = [], y = []; b.t.forEach((t, i) => { if (F(b.v.ve[i]) && b.v.ve[i] > 2) { x.push(loadAt(I, t - off - 20)); y.push(b.v.ve[i]); } }); const r = linreg(x, y); return r && F(r.r2) ? r.r2 : 0; };
    const r0 = r2(0); let best = { off: 0, r: r0 };
    for (let o = -600; o <= 600; o += 10) { const r = r2(o); if (r > best.r) best = { off: o, r }; }
    return { r0, best, shift: Math.abs(best.off) >= 30 && best.r - r0 > 0.05 };
  }

  function dataChecks(ss) {
    const out = [], g = ss.gas, L = ss.lode, I = ss.I, pr = ss.proto, m = g.meta, ok = t => out.push({ level: 'ok', text: t }), warn = t => out.push({ level: 'warn', text: t }), info = t => out.push({ level: 'info', text: t });
    if (L && I && I.source === 'lode') {
      const lm = L.meta || {}, dg = g.t.at(-1), dl = L.t.at(-1), d = excelDate(lm.date), dm = String(m.testDate || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (d && dm && (+dm[1] !== d.d || +dm[2] !== d.m || +dm[3] !== d.y)) warn(`The files have different dates: COSMED ${m.testDate}, Lode ${d.d}/${d.m}/${d.y}. Check they are the same session.`);
      if ((m.firstName || m.lastName) && (lm.firstName || lm.lastName) && !(sameName(m.firstName, lm.firstName) && sameName(m.lastName, lm.lastName))) warn(`The names differ: COSMED “${String(m.firstName).trim()} ${String(m.lastName).trim()}”, Lode “${String(lm.firstName).trim()} ${String(lm.lastName).trim()}”.`);
      if (Math.abs(dg - dl) > 30) warn(`Recording lengths differ by ${Math.abs(dg - dl).toFixed(0)} s (COSMED ${(dg / 60).toFixed(1)} min, Lode ${(dl / 60).toFixed(1)} min). Check the two files line up.`);
      else ok(`COSMED and Lode recordings are the same length (within ${Math.abs(dg - dl).toFixed(0)} s).`);
      if (F(m.mass) && F(lm.mass) && Math.abs(m.mass - lm.mass) >= 1) warn(`Body mass differs between files: COSMED ${m.mass} kg, Lode ${lm.mass} kg. The value under Test details (now ${ss.meta.mass} kg) is used for all per-kilogram results.`);
      const A = ss.align;
      if (A && A.shift) warn(`Ventilation lines up better with power with a Lode time offset of ${A.best.off} s. Check the start times, then enter the offset under Test details if it looks right.`);
      else if (A) ok('Ventilation follows power at the current time alignment.');
    }
    const sp = g.aux && g.aux.speed ? g.aux.speed.filter(x => F(x) && x > 0) : [];
    if (sp.length && !speedChanges(g) && (!I || I.mode !== 'treadmill')) info(`The COSMED file lists a speed of ${g.aux.speedUnit && /mph/i.test(g.aux.speedUnit) ? (sp[0] / 1.60934).toFixed(1) + ' mph' : sp[0].toFixed(1) + ' km/h'} that never changes${m.protocol && m.protocol !== 'None' ? ` (protocol “${m.protocol}”)` : ''}, which looks like a leftover setting, so it was ignored.`);
    if (!I) warn('No power or speed yet: thresholds, VO₂peak and the charts all work, but power and stage results need the steps entered below or a Lode file.');
    if (I && I.plan) { info('Power comes from the steps you entered, not from a recording.'); const pl = ss.set && ss.set.plan; if (pl && F(pl.switchMin) && Math.abs(((pl.switchMin - (pl.warmMin || 0)) / pl.stageMin) % 1) > 0.01 && Math.abs(((pl.switchMin - (pl.warmMin || 0)) / pl.stageMin) % 1) < 0.99) warn(`The ${pl.shortMin || 1}-min stages start partway through a ${pl.stageMin}-min stage, so that stage is shorter. Check the time entered.`); }
    if (I && I.mode === 'treadmill' && g.aux && g.aux.grade) {
      // Only the test stages count: a walk at a different grade does not affect the results.
      const stagesOnly = pr && pr.type === 'incremental' && pr.inc && !pr.inc.ramp && !pr.inc.none ? pr.inc.stages.filter(q => !q.warm).concat(pr.max ? pr.max.stages : []) : pr && pr.tests && pr.tests.length ? pr.tests.flatMap(T => T.steps) : null;
      const gs = g.aux.grade.filter((x, i) => F(x) && !/RECOVERY/i.test(g.aux.phase[i] || '') && g.aux.speed[i] > 2.5 && (!stagesOnly || stagesOnly.some(q => g.t[i] > q.t0 + 5 && g.t[i] <= q.t1 - 5))).sort((a, b) => a - b), lo = gs.length ? gs[Math.floor(gs.length * .02)] : NaN, hi = gs.length ? gs[Math.ceil(gs.length * .98) - 1] : NaN;
      if (gs.length && hi - lo > 0.05) warn(`Treadmill grade changes during the test stages (${lo}–${hi}%). Results are reported against speed only, so check they are comparable.`);
      else if (gs.length) info(`Treadmill grade was ${hi}% during the test stages.`);
    }
    if (g.kind === 'avg') info(`The COSMED file holds ${g.avgWidth}-s averages, so outliers are checked on averages and shorter averaging is not possible. Export breath-by-breath for finer detail.`);
    const fl = ss.D ? ss.D.fl.flag : [], n = fl.length || 1, nf = fl.filter ? fl.filter(x => x === 1 || x === 2).length : 0;
    if (ss.D) { const p = 100 * nf / n; const unit = g.kind === 'bxb' ? 'breaths' : 'samples'; if (p > 5) warn(`${p.toFixed(1)}% of ${unit} were flagged as outliers, which is high. Check for mask leaks.`); else ok(`${p.toFixed(1)}% of ${unit} flagged as outliers.`); }
    const gapLim = g.kind === 'bxb' ? 20 : 1.5 * g.avgWidth, gaps = [], isRow = i => F(g.v.vo2[i]);
    if (g.files) { const rest = g.files.slice(1).map((f, i) => ((f.start - g.files[i].end) / 60).toFixed(1)); info(`${g.files.length} COSMED files were joined by their clock times, with ${rest.join(' and ')} min of rest between them. Check the order: ${g.files.map(f => f.protocol && f.protocol !== 'None' ? f.protocol : f.name).join(', then ')}.`); const ms = new Set(g.files.map(f => f.mass).filter(F)); if (ms.size > 1) warn(`Body mass differs between the files (${[...ms].join(', ')} kg).`); }
    { let last = -1; for (let i = 0; i < g.t.length; i++) { if (!isRow(i)) { if (g.aux && g.aux.phase[i] === 'REST') last = -1; continue; } if (last >= 0 && g.t[i] - g.t[last] > gapLim) gaps.push([g.t[last], g.t[i]]); last = i; } }
    if (gaps.length) info(`${gaps.length} gap${gaps.length > 1 ? 's' : ''} in the gas data, ${(gaps.reduce((a, q) => a + q[1] - q[0], 0) / 60).toFixed(1)} min in total (mask off).`);
    if (pr && pr.max) { const lens = pr.inc.stages.filter(q => !q.warm), lo = Math.min(...lens.map(q => q.dur)), hi = Math.max(...lens.map(q => q.dur)); if (hi - lo > 30) warn(`The threshold stages are not all the same length: ${lens.map(q => (+q.p.toFixed(1)) + ' ' + I.unit + ' for ' + Math.floor(q.dur / 60) + ':' + String(Math.round(q.dur % 60)).padStart(2, '0')).join(', ')}. Check this matches what was run.`); const di = ss.D && ss.D.inc; if (di && di.peak1 && di.peak.vo2 && di.peak1.value > di.peak.vo2.value) warn(`VO₂ was higher in the threshold stages (${di.peak1.value.toFixed(2)} L/min) than in the VO₂max stages (${di.peak.vo2.value.toFixed(2)} L/min). Check that the VO₂max stages were maximal.`); }
    const testBlocks = pr ? (pr.type === 'incremental' ? (pr.inc && !pr.inc.ramp ? pr.inc.stages.filter(q => !q.warm).concat(pr.max ? pr.max.stages : []) : []) : pr.tests.flatMap(T => T.steps)) : [];
    const hit = testBlocks.filter(st => gaps.some(q => q[0] < st.t1 && q[1] > st.t0));
    if (hit.length) warn(`Gas data are missing during ${hit.length} stage${hit.length > 1 ? 's' : ''}: ${hit.map(q => fmtI(q.p, I.unit)).join(', ')}.`);
    else if (testBlocks.length) ok('Gas data cover every test stage.');
    const hr = g.v.hr ? g.v.hr.filter(x => F(x) && x > 0).length : 0;
    if (!hr && !ss.hr) warn('No heart-rate data in this file.');
    else if (g.v.hr && hr < 0.9 * g.t.length && !ss.hr) { const lastHR = g.t.filter((_, i) => g.v.hr[i] > 0).at(-1), stopped = g.t.at(-1) - lastHR > 300; warn(`Heart rate is missing from ${(100 - 100 * hr / g.t.length).toFixed(0)}% of the file${stopped ? `; the last reading is at ${(lastHR / 60).toFixed(0)} min of ${(g.t.at(-1) / 60).toFixed(0)}` : ''}.`); }
    if (F(ss.meta.mass)) { /* mass is used */ } else warn('Body mass is missing, so per-kilogram results and economy are blank.');
    if (pr && pr.type === 'prolonged' && !pr.tests.length) info('No step tests were found. The Protocol tab still works; enter the stages by hand under Test details if they should be there.');
    if (pr && pr.type === 'prolonged' && pr.tests.some(T => !T.complete)) info('At least one step test is partial: only full stages feed the regression.');
    return out;
  }

  /* ---------- Hinge with a chosen breakpoint (for the fitted lines on the threshold charts) ---------- */
  function fixedHinge(xs, ys, k) {
    const pts = xs.map((x, i) => [x, ys[i]]).filter(q => F(q[0]) && F(q[1])); if (pts.length < 5) return null;
    const below = pts.filter(q => q[0] < k).length; if (below < 2 || pts.length - below < 2) return null;
    const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], T = [0, 0, 0];
    pts.forEach(([x, y]) => { const r = [1, x, Math.max(0, x - k)]; for (let a = 0; a < 3; a++) { T[a] += r[a] * y; for (let b = 0; b < 3; b++) S[a][b] += r[a] * r[b]; } });
    const c = C.solve3(S, T); if (!c) return null;
    const x0 = Math.min(...pts.map(q => q[0])), x1 = Math.max(...pts.map(q => q[0])), f = x => c[0] + c[1] * x + c[2] * Math.max(0, x - k);
    return { x: [x0, k, x1], y: [f(x0), f(k), f(x1)], s1: c[1], s2: c[1] + c[2] };
  }

  /* ---------- Connected straight lines with chosen joins (fitted lines on the threshold charts) ---------- */
  function piecewise(xs, ys, knots) {
    const pts = []; for (let i = 0; i < xs.length; i++) if (F(xs[i]) && F(ys[i])) pts.push([xs[i], ys[i]]);
    if (pts.length < 3) return null;
    const use = [...knots].filter(F).sort((a, b) => a - b).filter((k, i, a) => { const lo = i ? a[i - 1] : -Infinity; return pts.filter(q => q[0] < k && q[0] >= lo).length >= 2 && pts.filter(q => q[0] >= k).length >= 2; });
    const n = use.length + 2, A = Array.from({ length: n }, () => new Array(n + 1).fill(0)), basis = x => [1, x, ...use.map(k => Math.max(0, x - k))];
    pts.forEach(([x, y]) => { const r = basis(x); for (let a = 0; a < n; a++) { A[a][n] += r[a] * y; for (let b = 0; b < n; b++) A[a][b] += r[a] * r[b]; } });
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; if (Math.abs(A[p][c]) < 1e-12) return null; [A[c], A[p]] = [A[p], A[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q <= n; q++) A[r][q] -= f * A[c][q]; } }
    const w = A.map((r, i) => r[n] / r[i]), f = x => basis(x).reduce((t, b, i) => t + b * w[i], 0), lo = Math.min(...pts.map(q => q[0])), hi = Math.max(...pts.map(q => q[0])), X = [lo, ...use, hi];
    return { x: X, y: X.map(f) };
  }

  /* ---------- Steady exercise ---------- */
  // Mean and SD of any variable over a period's averaged points.
  function periodValue(S, p, key) {
    const ids = p.avg.filter(i => F(S.v[key] ? S.v[key][i] : NaN)); if (!ids.length) return [NaN, NaN];
    let s = 0, w = 0; ids.forEach(i => { s += S.v[key][i] * S.wt[i]; w += S.wt[i]; }); const m = s / w; let v = 0; ids.forEach(i => { v += S.wt[i] * (S.v[key][i] - m) ** 2; });
    return [m, ids.length > 1 ? Math.sqrt(v / w * ids.length / (ids.length - 1)) : NaN];
  }
  // If the mask stayed on through a long stretch, the study-style "last minutes before mask-off" gives only one point, so split it into windows.
  function splitLongPeriods(per, S, I, base, o) {
    const out = [], step = o.splitSec || 300;
    per.forEach(p => {
      if (p.t1 - p.t0 <= 2 * step || !p.perWin) { out.push(p); return; }
      const ends = []; for (let e = p.perWin[1]; e - step >= p.t0 + 60; e -= step) ends.push(e);
      ends.reverse().forEach(e => {
        const ids = []; for (let i = 0; i < S.t.length; i++) if (S.t[i] > e - o.avgSec + 1e-6 && S.t[i] <= e + 1e-6 && loadAt(I, S.at[i]) === base && F(S.v.vo2[i])) ids.push(i);
        const J = ids.map((_, j) => j), W = ids.map(i => S.wt[i]), st = f => { const y = ids.map(f), m = (() => { let a = 0, b = 0; y.forEach((v, j) => { if (F(v)) { a += v * W[j]; b += W[j]; } }); return b ? a / b : NaN; })(); let q = 0, c = 0, n = 0; y.forEach((v, j) => { if (F(v)) { q += W[j] * (v - m) ** 2; c += W[j]; n++; } }); return [m, n > 1 ? Math.sqrt(q / c * n / (n - 1)) : NaN]; };
        void J;
        out.push(Object.assign({}, p, { perWin: [e - step, e], avgWin: [e - o.avgSec, e], t0: e - step, t1: e, avg: ids, period: ids, n: ids.length, vo2: st(i => S.v.vo2[i]), rer: st(i => S.v.vco2[i] / S.v.vo2[i]), cho: st(i => C.cho(S.v.vo2[i], S.v.vco2[i])), fat: st(i => C.fat(S.v.vo2[i], S.v.vco2[i])), ge: st(i => C.ge(base, S.v.vo2[i], S.v.vco2[i])) }));
      });
    });
    return out;
  }
  // Time and amount of steady work, outside the step tests.
  function steadyTotals(pr, unit) {
    const inTest = q => pr.tests.some(T => q.t0 >= T.t0 - 1 && q.t1 <= T.t1 + 1), blocks = pr.plateaus.filter(q => q.p === pr.base && q.dur >= 60 && !inTest(q)), sec = blocks.reduce((a, q) => a + q.dur, 0);
    return { blocks, sec, amount: unit === 'W' ? pr.base * sec / 1000 : pr.base * sec / 3600, amountUnit: unit === 'W' ? 'kJ' : 'km' };
  }

  const API = { piecewise, periodValue, splitLongPeriods, steadyTotals, joinCosmed, exerciseEnd, speedChanges, availableIntensity, buildIntensity, detect, testName, fmtI, monoMap, suggestIncremental, rollingPeak, meanInWindow, stageValues, intensityFit, stageRPE, effortChecks, dataChecks, alignment, fixedHinge };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LabCore = API;
})(this);
