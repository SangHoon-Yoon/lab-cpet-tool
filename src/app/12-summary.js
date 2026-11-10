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
      const peakI = pr.max ? pr.max.peak : pr.inc.peak; push('incremental', '', peakI, 'intensity_peak', peakI, unit);
      ['vt1', 'vt2'].forEach(q => {
        const x = v(q); if (!F(x)) return; const t = vtTime(M, x, q), hr = L.meanInWindow(D.R0, 'hr', t - 15, t + 15), iv = d.fit ? d.fit.m * x + d.fit.b : NaN, kg = F(m.mass) ? x * 1000 / m.mass : NaN, pct = pk.vo2 ? 100 * x / pk.vo2.value : NaN;
        thr.push(Object.assign({}, idcols, { test: 'incremental', threshold: q.toUpperCase(), source: F(S.picks.inc[q]) ? ((S.picks.incSrc && S.picks.incSrc[q]) || 'placed by user') : 'classical suggestion', vo2_L_min: rd(x, 3), vo2_mL_kg_min: rd(kg, 2), pct_vo2peak: rd(pct, 1), intensity_regression: rd(iv, 2), intensity_stage: I ? C.loadAt(I, t) : '', intensity_unit: unit, hr_bpm: rd(hr, 1), time_s: Math.round(t) }));
        [['vo2', 'L/min', x], ['vo2_kg', 'mL/kg/min', kg], ['pct_vo2peak', '%', pct], ['intensity', unit, iv], ['hr', 'bpm', hr]].forEach(([k, u, val]) => push('incremental', '', NaN, q + '_' + k, val, u));
      });
      d.values.forEach((q, i) => stageRow(pr.max ? 'threshold_stages' : 'incremental', i + 1, q, d.rpe[i]));
      d.maxValues.forEach((q, i) => stageRow('vo2max_stages', i + 1, q, d.maxRpe[i]));
    }
    if (pr.type !== 'incremental' && D.st) {
      pr.tests.forEach((T, i) => {
        const nm = 'test_' + (i + 1), x = testVT1(i), f = D.st.fits[i], iv = f && F(x) ? f.m * x + f.b : NaN;
        thr.push(Object.assign({}, idcols, { test: nm, threshold: 'VT1', source: F((S.picks.tests[testKey(T)] || {}).vt1) ? 'placed by user' : 'classical suggestion', vo2_L_min: rd(x, 3), vo2_mL_kg_min: rd(F(m.mass) ? x * 1000 / m.mass : NaN, 2), pct_vo2peak: '', intensity_regression: rd(iv, 2), intensity_stage: '', intensity_unit: unit, hr_bpm: '', time_s: '' }));
        push(nm, '', NaN, 'vt1_vo2', x, 'L/min'); push(nm, '', NaN, 'vt1_intensity', iv, unit);
        if (S.set.st.vt2) { const x2 = testVT('vt2', i), iv2 = f && F(x2) ? f.m * x2 + f.b : NaN; thr.push(Object.assign({}, idcols, { test: nm, threshold: 'VT2', source: F((S.picks.tests[testKey(T)] || {}).vt2) ? 'placed by user' : 'classical suggestion', vo2_L_min: rd(x2, 3), vo2_mL_kg_min: rd(F(m.mass) ? x2 * 1000 / m.mass : NaN, 2), pct_vo2peak: '', intensity_regression: rd(iv2, 2), intensity_stage: '', intensity_unit: unit, hr_bpm: '', time_s: '' })); push(nm, '', NaN, 'vt2_vo2', x2, 'L/min'); push(nm, '', NaN, 'vt2_intensity', iv2, unit); }
        D.st.SM[i].forEach((q, j) => stageRow(nm, j + 1, q, D.st.rpe[i][j]));
      });
    }
    // lactate thresholds and every lactate method
    const lactate = [];
    if (pr.type === 'incremental' || D.st) lacSeries().forEach(se => {
      const res = lacAnalyse(se); if (!res.n) return; const nm = se.key === 'inc' ? (pr.max ? 'threshold_stages' : 'incremental') : 'test_' + (lacSeries().indexOf(se) + 1);
      ['lt1', 'lt2'].forEach(q => {
        const p = ltVal(se, res, q); if (!F(p)) return; const a = ltAt(res, p), vo2 = se.fit ? (p - se.fit.b) / se.fit.m : NaN;
        thr.push(Object.assign({}, idcols, { test: nm, threshold: q.toUpperCase(), source: ltSource(se, res, q), vo2_L_min: rd(vo2, 3), vo2_mL_kg_min: rd(F(m.mass) ? vo2 * 1000 / m.mass : NaN, 2), intensity_regression: '', intensity_stage: rd(p, 2), intensity_unit: unit, hr_bpm: rd(a.hr, 1), lactate_mmol_L: rd(a.la, 2) }));
        [['intensity', unit, p], ['lactate', 'mmol/L', a.la], ['hr', 'bpm', a.hr]].forEach(([k, u, val]) => push(nm, '', NaN, q + '_' + k, val, u));
      });
      res.methods.forEach(x => lactate.push(Object.assign({}, idcols, { test: nm, category: x.cat, method: x.name, fitting: x.fitting, intensity: rd(x.p, 2), intensity_unit: unit, lactate_mmol_L: rd(x.la, 2), hr_bpm: F(x.hr) ? x.hr : '' })));
      res.fit.data.forEach((r, i) => lactate.push(Object.assign({}, idcols, { test: nm, category: 'sample', method: i === 0 && res.hasBase ? 'baseline' : 'stage', fitting: '', intensity: i === 0 && res.hasBase ? 0 : rd(r.p, 2), intensity_unit: unit, lactate_mmol_L: rd(r.la, 2), hr_bpm: F(r.hr) ? r.hr : '' })));
    });
    const periods = [];
    if (pr.type !== 'incremental' && F(pr.base) && I && D.per) periodRows().forEach((r, i) => {
      periods.push(Object.assign({}, idcols, { recording: i + 1, block: r.block || '', intensity: pr.base, intensity_unit: unit, avg_start_s: Math.round(r.p.avgWin[0]), avg_end_s: Math.round(r.p.avgWin[1]), min_into_block: rd(r.into, 1), vo2_L_min: rd(r.vo2[0], 3), vo2_mL_kg_min: rd(r.vo2kg[0], 2), vco2_L_min: rd(r.vco2[0], 3), rer: rd(r.rer[0], 3), ve_L_min: rd(r.ve[0], 2), hr_bpm: rd(r.hr[0], 1), cho_g_min: rd(r.cho[0], 3), fat_g_min: rd(r.fat[0], 3), cho_kJ_min: rd(r.energy.cho, 2), fat_kJ_min: rd(r.energy.fat, 2), pct_energy_cho: rd(r.energy.pctCho, 1), expenditure_kJ_min: rd(r.energy.total, 2), gross_efficiency_pct: I.mode === 'cycling' ? rd(r.econ[0], 2) : '', economy_mL_kg_km: I.mode === 'treadmill' ? rd(r.econ[0], 1) : '', rpe: F(r.rpe) ? r.rpe : '' }));
      [['vo2', 'L/min', r.vo2[0]], ['hr', 'bpm', r.hr[0]], ['rer', '', r.rer[0]], ['ve', 'L/min', r.ve[0]], ['cho', 'g/min', r.cho[0]], ['fat', 'g/min', r.fat[0]], [I.mode === 'cycling' ? 'gross_efficiency' : 'economy', I.mode === 'cycling' ? '%' : 'mL/kg/km', r.econ[0]], ['rpe', 'Borg', r.rpe]].forEach(([k, u, v]) => push('prolonged', 'recording_' + (i + 1), pr.base, k, v, u));
    });
    return { rows, thr, stages, periods, lactate };
  }
  const rd = (v, d) => (F(v) ? +v.toFixed(d) : '');
  function lactateText() {
    if (!lacUsed()) return ''; const ls = lacSet(), fit = LM.FITS[ls.fit].toLowerCase(), used = [];
    lacSeries().forEach(se => { const res = lacAnalyse(se); if (!res.n) return; ['lt1', 'lt2'].forEach(q => { const s = ltSource(se, res, q); if (s) used.push(`${q.toUpperCase()} ${s.replace(' (default)', '')}`); }); });
    return ` Blood lactate thresholds were determined with the methods of the lactater R package (Mattioni Maturana; the methods used by Exphyslab), ported to JavaScript in the tool. Lactate was fitted against ${S.I && S.I.unit !== 'W' ? 'speed' : 'power'} with a ${fit}${ls.baseline ? ' including' : ' excluding'} the resting baseline${ls.lt1 === 'Log-log' || ls.lt2 === 'Log-log' ? `, and the Log-log method used the first ${Math.round(ls.restrain * 100)}% of the data` : ''}. Thresholds used: ${[...new Set(used)].join('; ')}.`;
  }
  function methodsText() { const lo = S.set.leaveOut || []; return methodsCore() + (lo.length ? ` Data from ${lo.length} period${lo.length > 1 ? 's' : ''} (${lo.map(([a, b]) => mmss(a) + '–' + mmss(b)).join(', ')}) judged noisy or erroneous were left out of the analysis.` : '') + lactateText(); }
  function methodsCore() {
    const pr = S.proto, I = S.I, set = S.set, g = S.gas, bxb = g.kind === 'bxb';
    const avgT = avgLabel().replace('breath-by-breath', 'breath-by-breath data');
    const joined = g.files ? ` The ${g.files.length} recordings of the session were aligned by their clock times.` : '';
    const skipped = pr.type === 'incremental' && set.inc.skip > 0 && !F(set.inc.t0) ? ` The first ${set.inc.skip} s of the first stage were left out of the threshold estimation.` : '';
    const entered = I && I.plan ? ' Power was taken from the protocol entered by the researcher, not from a recording.' : '';
    const tool = ` Data were analysed with the Lab CPET tool (version ${VERSION}, created by ${AUTHOR}).`;
    const oxUsed = S.oxy && S.oxy.done && S.proto.type === 'incremental', fromOx = Object.entries((S.picks.incSrc) || {}).filter(e => /^Oxynet/.test(e[1]));
    const ox = oxUsed ? ` Suggestions from the Oxynet open-source models (pyoxynet; CNN and LSTM) were also available to the researcher, run on ${oxyName()} with flagged outlier breaths left out${fromOx.length ? `, and ${fromOx.map(e => `the ${e[1].replace('Oxynet ', '')} suggestion was used for ${e[0].toUpperCase()}`).join(' and ')}` : ''} (Zignoli et al., 2022; Keir et al., 2026).` : '';
    const gas = `Gas exchange was recorded with a COSMED metabolic cart (${bxb ? 'breath-by-breath export' : g.avgWidth + '-s average export'}) and displayed as ${avgT}. ${set.outl.remove ? `Breaths more than ${set.outl.nsd} SD from their local mean were removed.` : ''}`.trim();
    const eq = I && I.mode === 'cycling' ? ' Gross efficiency was calculated as external power divided by metabolic power (Brouwer, 1957).' : I ? ' Running economy was calculated as stage-end VO₂ per kilogram per kilometre.' : '';
    if (pr.type === 'incremental') return `${gas} ${pr.max ? `Thresholds came from the longer stages. After a recovery block, VO₂max was the highest ${set.inc.peakWin}-s rolling mean during the shorter stages to failure.` : `VO₂peak was the highest ${set.inc.peakWin}-s rolling mean.`} ${I ? `Stage values were the mean of the last ${set.inc.stageWin} s of each stage. ` : ''}VT1 and VT2 were identified visually from V-slope, ventilatory equivalents and end-tidal gases, starting from two-line breakpoint suggestions.${I ? ` ${I.label} at each threshold was estimated from the linear regression of stage-end VO₂ on ${I.label.toLowerCase()}.` : ''}${skipped}${entered}${ox}${eq}${tool}`;
    const selList = S.proto ? S.proto.tests.map((T, i) => { const r = testSel(T); return r ? `${L.testName(S.proto, i)} ${(r[0] / 60).toFixed(2)}–${(r[1] / 60).toFixed(2)} min` : null; }).filter(Boolean) : [];
    const selM = selList.length ? ` Only data within a chosen time from the start of each step test were used (${selList.join('; ')}; other tests used all data).` : '';
    return `${gas} Stage values were the mean of the last ${set.st.regWin} s of each stage.${selM} ${set.st.vt2 ? 'VT1 and VT2' : 'VT1'} in each step test ${set.st.vt2 ? 'were' : 'was'} identified visually from V-slope and ventilatory equivalents, plotted from ${isWholeStage() ? 'the whole' : 'the last ' + mmss(set.st.win)} of each stage, starting from a two-line breakpoint suggestion on the last 2 min of each stage, and ${I ? I.label.toLowerCase() : 'intensity'} at ${set.st.vt2 ? 'each threshold' : 'VT1'} was estimated from the linear regression of stage-end VO₂ on ${I ? I.label.toLowerCase() : 'intensity'} for that test.${joined}${F(pr.base) && S.D.per && S.D.per.length ? ` During the steady exercise, values were the mean of the last ${set.per.avgMin} min of each gas recording, and substrate oxidation was calculated from VO₂ and VCO₂ (Jeukendrup and Wallis, 2005).` : ''}${eq}${tool}`;
  }
  const REFS = [
    ['Zignoli A, Fornasiero A, Rota P, et al. Oxynet: a collective intelligence that detects ventilatory thresholds in cardiopulmonary exercise tests. <i>European Journal of Sport Science</i>. 2022;22(3):425-435.', '10.1080/17461391.2020.1866081'],
    ['Keir DA, Zignoli A, Iannetta D, Mattioni Maturana F, Murias JM. AI-driven analysis of cardiopulmonary exercise tests to identify gas exchange and ventilatory thresholds. <i>Sports Medicine</i>. 2026;56(7):1833-1843.', '10.1007/s40279-026-02403-w'],
    ['Zignoli A, et al. Expert-level classification of ventilatory thresholds from cardiopulmonary exercising test data with recurrent neural networks. <i>European Journal of Sport Science</i>. 2019;19(9):1221-1229.', '10.1080/17461391.2019.1587523'],
    ['Mattioni Maturana F. lactater: tools for analyzing lactate thresholds. R package version 0.3.0. https://github.com/fmmattioni/lactater (MIT licence).', ''],
    ['Zignoli A. Machine learning models for the automatic detection of exercise thresholds in cardiopulmonary exercising tests: from regression to generation to explanation. <i>Sensors</i>. 2023;23(2):826.', '10.3390/s23020826']
  ];
  function creditsHTML() {
    return `<div class="methods"><p style="margin:0 0 8px"><b>Lab CPET tool</b>, version ${VERSION}, was created by <b>${AUTHOR}</b>.</p>
      <p style="margin:0 0 8px"><b>Oxynet.</b> The Oxynet suggestions use the frozen CNN and LSTM models from <a href="https://pypi.org/project/pyoxynet/">pyoxynet</a> 1.0.2 by Andrea Zignoli and the Oxynet team (MIT licence). They run on this computer through this tool’s own JavaScript runner, and no data are sent to Oxynet. This tool is not made or endorsed by the Oxynet team. Please cite:</p>
      <ol class="refs">${REFS.map(([t, d]) => `<li>${t}${d ? ` <a href="https://doi.org/${d}">doi:${d}</a>` : ''}</li>`).join('')}</ol>
      <p style="margin:8px 0 0"><b>Other software.</b> Plotly.js (MIT licence) and SheetJS (Apache 2.0 licence). <b>Equations.</b> Substrate oxidation: Jeukendrup and Wallis (2005). Metabolic power: Brouwer (1957). V-slope: Beaver et al. (1986).</p></div>`;
  }
  $('#credit').innerHTML = `Lab CPET tool ${VERSION}. Created by ${AUTHOR}. Threshold suggestions on incremental tests include the open-source Oxynet models (Zignoli et al., 2022; Keir et al., 2026; pyoxynet, MIT licence).`;
  function vSummary() {
    const R = results(), I = S.I;
    const cols = ['test', 'threshold', 'source', 'vo2_L_min', 'vo2_mL_kg_min', 'pct_vo2peak', 'intensity_regression', 'hr_bpm'], names = ['Test', 'Threshold', 'Placed', 'VO₂ (L/min)', 'VO₂ (mL/kg/min)', '% VO₂peak', I ? I.label + ' (' + I.unit + ')' : 'Intensity', 'Heart rate (bpm)'];
    $('#views').innerHTML = `
      ${S.proto.type === 'incremental' && S.D.inc && S.D.inc.peak.vo2 ? `<div class="stats"><div class="stat key"><b>${fx(S.D.inc.peak.vo2.value, 2)} L/min</b><span>${S.proto.max ? 'VO₂max' : 'VO₂peak'}</span><small>${S.D.inc.peak.vo2kg ? fx(S.D.inc.peak.vo2kg.value, 1) + ' mL/kg/min' : ''}</small></div></div>` : ''}
      <h2 class="row">Thresholds</h2><div class="panel"><div class="tblwrap"><table><tr>${names.map(n => `<th>${n}</th>`).join('')}</tr>${R.thr.map(r => `<tr>${cols.map(c => `<td>${esc(r[c] === '' ? '–' : r[c])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}">None yet.</td></tr>`}</table></div></div>
      ${fold('rep', 'Reports', 'Word files for a client or for research', reportsHTML())}
      ${fold('chk', 'Data checks', (() => { const w = (S.checks || []).filter(c => c.level === 'warn').length; return w ? `${w} to look at` : 'nothing to look at'; })(), '<ul class="checks" id="chk2"></ul>')}
      ${fold('meth', 'Methods paragraph', 'to copy into a paper', '<div class="methods" id="meth"></div><div class="tools"><button id="cpM">Copy</button><span class="hint" id="cpS"></span></div>')}
      ${fold('cred', 'About and credits', 'version ' + VERSION + ', citations', creditsHTML())}
      <ul class="notes"><li>Exports carry the tool version (${VERSION}) and every setting, so a result can be reproduced. “Save analysis” keeps your data, settings and threshold lines in one file to reopen later.</li></ul>`;
    const ic = { ok: '✓', warn: '!', info: 'i' };
    $('#chk2').innerHTML = S.checks.map(c => `<li class="${c.level}"><span class="ic" aria-hidden="true">${ic[c.level]}</span><span>${esc(c.text)}</span></li>`).join('');
    $('#meth').textContent = methodsText(); bindReports();
    $('#cpM').onclick = async () => { try { await navigator.clipboard.writeText(methodsText()); $('#cpS').textContent = 'Copied.'; } catch (e) { $('#cpS').textContent = 'Select the text and copy it by hand.'; } };
  }

