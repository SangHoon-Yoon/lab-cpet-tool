  /* ---------------- Incremental test ---------------- */
  // Time chart of the whole recording with the analysis window highlighted; drag to change the window.
  function incSelChart() {
    const D = S.D.inc, set = S.set.inc, pr = S.proto, X = S.D.X, k = set.selVar, gd = document.getElementById('iSelC'); if (!gd) return;
    const xs = [], ys = []; X.t.forEach((t, i) => { if (F(X.v[k][i])) { xs.push(t / 60); ys.push(X.v[k][i]); } });
    const end = Math.max(X.t.at(-1), S.gas.t.at(-1)) / 60, shapes = [], ann = [];
    const dot = x => ({ type: 'line', xref: 'x', yref: 'paper', x0: x, x1: x, y0: 0, y1: 1, line: { color: css('--grid'), width: 1, dash: 'dot' } });
    pr.inc.stages.forEach(st => shapes.push(dot(st.t0 / 60))); shapes.push(dot(pr.inc.t1 / 60));
    if (pr.max) { pr.max.stages.forEach(st => shapes.push(dot(st.t0 / 60))); shapes.push(dot(pr.max.t1 / 60)); ann.push({ xref: 'x', yref: 'paper', x: (pr.max.t0 + pr.max.t1) / 120, y: 1, yanchor: 'bottom', showarrow: false, text: 'VO₂max stages', font: { size: 10, color: css('--muted') } }); ann.push({ xref: 'x', yref: 'paper', x: (pr.inc.t0 + pr.inc.t1) / 120, y: 1, yanchor: 'bottom', showarrow: false, text: 'Threshold stages', font: { size: 10, color: css('--muted') } }); }
    gd._baseShapes = shapes.slice(); shapes.push(...selShapes(D.t0 / 60, D.t1 / 60));
    Plotly.newPlot(gd, [{ x: xs, y: ys, type: 'scatter', mode: 'lines+markers', line: { color: css('--vt1'), width: 1.5 }, marker: { color: css('--vt1'), size: 3 }, hovertemplate: `%{x:.2f} min<br>${VARS[k].l} %{y:.${VARS[k].dp}f}<extra></extra>` }],
      lay({ dragmode: false, showlegend: false, margin: { l: 58, r: 12, t: 24, b: 44 }, xaxis: ax('Time from the start of the recording (min)', { range: [0, end], fixedrange: true }), yaxis: ax(vlab(k), { range: robustRange(ys), fixedrange: true }), shapes, annotations: ann }), Object.assign({}, CFG, { displayModeBar: false }));
    rangeSelect(gd, $('#iSelWrap'), $('#iSelShade'), () => [D.t0 / 60, D.t1 / 60], v => {
      if (!v) { set.t0 = set.t1 = null; return recompute(); }
      if (Math.abs(v[0] * 60 - D.t0) < 1 && Math.abs(v[1] * 60 - D.t1) < 1) return incSelChart();
      const a = Math.max(0, v[0]), b = Math.min(end, v[1]); if (b - a < 1) return incSelChart();
      set.t0 = Math.round(a * 60); set.t1 = Math.round(b * 60); recompute();
    });
  }
  function vIncremental() {
    const D = S.D.inc, set = S.set.inc, pr = S.proto;
    const I = S.I || { label: 'Intensity', unit: '', mode: '' };
    if (!pr.inc || !D) { $('#views').innerHTML = '<p class="msg">No ascending stages were found. Enter the protocol by hand under Test details.</p>'; return; }
    const ids = []; S.D.X.t.forEach((t, i) => { if (t >= D.t0 && t <= D.t1 && F(S.D.X.v.vo2[i]) && S.D.X.v.vo2[i] > .3) ids.push(i); });
    const pts = { t: ids.map(i => S.D.X.t[i]), v: {} }; Object.keys(S.D.X.v).forEach(k => (pts.v[k] = ids.map(i => S.D.X.v[k][i])));
    // VT lines are stored as VO₂. On time (and VCO₂) charts VO₂ maps to time through a curve that never falls, so it has flat stretches
    // where many times share one VO₂; the time the line was dragged to is kept too (S.picks.incT), so the line stays where it was put.
    const tAt = (v, q) => vtTime(M, v, q);
    const M = D.map, ctx = {
      lines: ['vt1', 'vt2'], pts, charts: [], get: q => incVT(q), live: () => incResults(),
      set: (q, v, x, key) => { S.picks.inc[q] = Math.round(v * 1000) / 1000; if (S.picks.incSrc) delete S.picks.incSrc[q]; const T = S.picks.incT = S.picks.incT || {}; if (key === 't') T[q] = x * 60; else if (key === 'vco2') T[q] = M.tOfVco2(x); else delete T[q]; },
      toX: (v, key, q) => (key === 'vo2' ? v : key === 'vco2' ? M.vco2At(tAt(v, q)) : tAt(v, q) / 60),
      fromX: (x, key) => (key === 'vo2' ? x : key === 'vco2' ? M.vo2At(M.tOfVco2(x)) : M.vo2At(x * 60)), done: () => { incResults(); summaries(); }
    };
    const xk = set.x, stW = [[30, '30 s'], [60, '60 s'], [90, '90 s']], pkW = [[15, '15 s'], [30, '30 s'], [60, '60 s']];
    $('#views').innerHTML = `
      <div class="stats" id="tiles"></div>
      <div id="vtwarn"></div>
      <div class="panel" style="padding:10px"><div class="tools">
        <span>${pr.max ? 'Threshold window' : 'Analysis window'} (min):</span><input type="number" step="0.25" id="cA" value="${(D.t0 / 60).toFixed(2)}"><span>to</span><input type="number" step="0.25" id="cB" value="${(D.t1 / 60).toFixed(2)}"><button id="cR">Reset</button>${pr.inc.none ? '' : `<label class="chk">Leave out the first <input type="number" min="0" step="5" id="cS" value="${set.skip || 0}" style="width:4.5em"> s of the first stage</label>`}
        <span id="winInfo"></span><span class="sep"></span><span>${pr.max ? 'VO₂max' : 'VO₂peak'} over:</span>${pkW.map(([v, l]) => `<button data-pk="${v}" aria-pressed="${set.peakWin === v}">${l}</button>`).join('')}
        <span class="sep"></span><span>Stage means and the VO₂–${I.label.toLowerCase()} regression use the last:</span>${stW.map(([v, l]) => `<button data-sw="${v}" aria-pressed="${set.stageWin === v}">${l}</button>`).join('')}
      </div>
      <div class="tools" style="margin-top:8px"><span>Show:</span><select id="iSelVar">${(() => { const av = availVars(), vs = ['vo2', 'hr', 've', 'eqo2', 'eqco2', 'rer', 'petco2'].filter(k => k === 'vo2' || av.includes(k)); if (!vs.includes(set.selVar)) set.selVar = 'vo2'; return vs.map(k => `<option value="${k}" ${k === set.selVar ? 'selected' : ''}>${VARS[k].l}</option>`).join(''); })()}</select><span class="hint">Highlighted: the ${pr.max ? 'threshold' : 'analysis'} window, ${mmss(D.t0)}–${mmss(D.t1)}</span></div>
      <div class="chartwrap" id="iSelWrap"><div class="chart" id="iSelC" style="height:240px"></div><div class="zshade" id="iSelShade"></div></div>
      <p class="hint" data-info="winInfo">Drag across the chart to highlight the data to analyse, or type the times. Drag either side of the highlight to make it longer or shorter, or click elsewhere on the chart to go back to the default window. ${pr.inc.none ? 'With no stages entered, the window covers all the exercise data, including any warm-up. Set its start after the warm-up.' : pr.max ? 'Thresholds and the regression use the threshold stages, and by default the window covers all of them. VO₂max and the peak values come from the VO₂max stages.' : 'By default the window covers all the incremental stages.'}${pr.inc.none ? '' : ' If the gas data look off when the first stage starts, leave out those seconds: this affects the threshold charts, the suggestions and any Oxynet run on this window, but not the stage means, regression or peak values.'}</p></div>
      <div class="tools"><span>Plot thresholds against:</span><button data-x="vo2" aria-pressed="${xk === 'vo2'}">VO<sub>2</sub></button><button data-x="t" aria-pressed="${xk === 't'}">Time</button><button id="addV2" hidden>Add a VT2 line</button><button id="lookFor" title="Reference charts of the typical patterns at VT1 and VT2">What to look for</button><span id="plotInfo"></span>
        <span class="hint" data-info="plotInfo">Drag a <b class="vt1c">VT1</b> or <b class="vt2c">VT2</b> line sideways on any chart (the cursor changes over it); it moves on all of them.</span></div>
      <div class="grid3">
        ${[['vs', 'V-slope', 'VCO<sub>2</sub> against VO<sub>2</sub>'], ['eo', 'VE/VO<sub>2</sub>', 'ventilatory equivalent for O<sub>2</sub>'], ['ec', 'VE/VCO<sub>2</sub>', 'ventilatory equivalent for CO<sub>2</sub>'], ['po', 'End-tidal O<sub>2</sub>', 'P<sub>ET</sub>O<sub>2</sub>'], ['pc', 'End-tidal CO<sub>2</sub>', 'P<sub>ET</sub>CO<sub>2</sub>'], ['vv', 'Ventilation against VCO<sub>2</sub>', 'VE against VCO<sub>2</sub>'], ['ve', 'Ventilation', 'VE'], ['rr', 'RER', ''], ['hh', 'Heart rate', ''], ['iv', iLab(), 'stage-end values against VO<sub>2</sub>']].map(([id, t, s]) => `<div class="panel"><h3>${t}<span>${s}</span></h3><div class="chart mid" id="vc_${id}"></div></div>`).join('')}
      </div>
      <h2 class="row" id="thrH">Thresholds</h2><div class="panel"><div class="tblwrap"><table id="vtT"></table></div><div class="tools" style="padding:0 8px 8px"><button id="rst">Reset both to suggestions</button></div></div>
      <h2 class="row" id="oxH">Oxynet suggestions<span>from the open-source pyoxynet models, run on this computer</span></h2>
      <div class="tools"><span>Give Oxynet:</span>${pr.max ? `<button data-ow="max" aria-pressed="${oxyChoice() === 'max'}">VO₂max stages</button>` : ''}<button data-ow="analysis" aria-pressed="${oxyChoice() === 'analysis'}">${pr.max ? 'Threshold window' : 'Analysis window'}</button><button data-ow="whole" aria-pressed="${oxyChoice() === 'whole'}">All exercise data</button><span class="hint" id="oxS"></span></div>
      <div class="grid3">${[['cnn', 'CNN model'], ['lstm', 'LSTM model']].map(([m, t]) => `<div class="panel"><h3 id="oxh_${m}">${t}<span>domain outputs over time</span><button class="fitbtn" id="oxUse_${m}" disabled title="Move the VT1 and VT2 lines to this model’s thresholds">Use these lines</button></h3><div hidden data-info="oxh_${m}">${OXINFO[m]}</div><div style="padding:2px 8px">${[['--t3', 'Moderate'], ['--t2', 'Heavy'], ['--t1', 'Severe']].map(([c, n]) => `<span class="lg"><i style="background:${css(c)}"></i>${n}</span>`).join('')}</div><div class="chart mid" id="ox_${m}"></div><p class="hint" id="oxm_${m}" style="padding:0 10px 6px"></p></div>`).join('')}</div>
      <ul class="notes" data-info="oxH"><li>Oxynet always gets the breath-by-breath data with flagged outlier breaths left out, even when they are kept elsewhere. It rescales each signal from 0 to 1, so a single extreme breath would squeeze all the other data into a sliver of the scale.</li><li>Oxynet reads 40-s windows and places each threshold at the start of the window in which its outputs cross, so each output is drawn at the start of its window and the dashed lines pass through the crossings. VT1 is the first crossing of moderate and heavy, and VT2 is the last crossing of heavy and severe. The outputs are smoothed network outputs, not calibrated probabilities. The LSTM outputs sum to 1, so they usually cross near 0.5; the CNN outputs do not, so they can cross higher. These are suggestions for the researcher, who places the final lines.</li><li>The result can shift noticeably with the data given, because Oxynet scales each signal over that data. Try each option${pr.max ? '' : ', and move the analysis window if a warm-up is included'}.</li><li>Oxynet: Zignoli et al. (2022), <i>Eur J Sport Sci</i>, <a href="https://doi.org/10.1080/17461391.2020.1866081">doi:10.1080/17461391.2020.1866081</a>; Keir et al. (2026), <i>Sports Med</i>, <a href="https://doi.org/10.1007/s40279-026-02403-w">doi:10.1007/s40279-026-02403-w</a>. Full credits are in the Summary tab.</li></ul>
      <div class="row2"><div class="panel" style="flex:1 1 380px"><h3>How each method placed them<span>VO₂ in L/min; “Use” moves the line there</span></h3><div class="tblwrap"><table id="mT"></table></div></div>
      <div class="panel" style="flex:1 1 380px"><h3>Was it maximal?</h3><div class="tblwrap"><table id="eT"></table></div></div></div>
      <h2 class="row">Stages<span>mean of the last ${set.stageWin} s of each stage</span></h2><div class="panel"><div class="tblwrap"><table id="sT"></table></div></div>
      <ul class="notes" data-info="thrH">${pr.max ? '<li>Oxynet starts with the VO₂max stages here, because they are closest to the tests it was designed for: rising to exhaustion in one go. That also means its thresholds come from different stages than the lines above, with VO₂ lagging more in 1-min stages, so treat them as a loose guide.</li>' : ''}<li>${I.label} at a threshold comes from a regression of stage-end ${I.label === 'Speed' ? 'VO₂ on speed' : 'VO₂ on power'}, using stages of at least 2 min. “Stage” is the stage running when the line’s VO₂ was reached.</li><li>The solid lines start at the classical suggestion, and Oxynet never moves them unless you click Use. VT1 is the median of three two-line breakpoints (V-slope, VE/VO₂, PETO₂) up to 80% of the VO₂ range. VT2 is the median of three (VE against VCO₂, VE/VCO₂, PETCO₂) from 2 min after VT1 to ${pr.max ? 'the end of the threshold stages' : '90 s before the end'}. All use the 15-s data in the analysis window, as a starting point for the researcher’s own judgement.</li></ul>`;
    const on = (id, fn) => { const el = $(id); if (el) el.onchange = e => later(() => fn(e)); };
    on('#cS', e => { const first = pr.inc.stages.find(q => !q.warm), lim = first ? Math.max(0, first.dur - 30) : 0, v = parseFloat(e.target.value); set.skip = F(v) ? Math.max(0, Math.min(lim, v)) : 0; set.t0 = null; recompute(); });
    on('#cA', e => { set.t0 = parseFloat(e.target.value) * 60; recompute(); }); on('#cB', e => { set.t1 = parseFloat(e.target.value) * 60; recompute(); });
    $('#cR').onclick = () => { set.t0 = set.t1 = null; set.skip = 0; recompute(); };
    $('#iSelVar').onchange = e => { set.selVar = e.target.value; incSelChart(); };
    incSelChart();
    $$('[data-pk]').forEach(b => (b.onclick = () => { set.peakWin = +b.dataset.pk; recompute(); }));
    $$('[data-sw]').forEach(b => (b.onclick = () => { set.stageWin = +b.dataset.sw; recompute(); }));
    $$('[data-x]').forEach(b => (b.onclick = () => { set.x = b.dataset.x; vIncremental(); }));
    // Move both lines to one Oxynet model's thresholds. A threshold beyond the threshold stages (two-phase tests) is left where it is.
    S.useOx = m => {
      const r = S.oxy && S.oxy.res && S.oxy.res[m]; if (!r || r.problem) return '';
      const nm = 'Oxynet ' + m.toUpperCase(), moved = [], kept = [];
      ['vt1', 'vt2'].forEach(q => { const o = r[q]; if (!o || !F(o.vo2)) return; if (pr.max && o.vo2 > M.hi + 0.01) { kept.push(vtName(q)); return; } S.picks.inc[q] = +o.vo2.toFixed(3); S.picks.incSrc = S.picks.incSrc || {}; S.picks.incSrc[q] = nm; moved.push(`${vtName(q)} ${fx(o.vo2, 2)} L/min`); });
      moveLines(ctx); incResults(); summaries();
      return (moved.length ? `Lines moved to the ${m.toUpperCase()} thresholds: ${moved.join(', ')}.` : '') + (kept.length ? ` ${kept.join(' and ')} not moved: above the threshold stages.` : '');
    };
    S.useOx.can = m => { const r = S.oxy && S.oxy.res && S.oxy.res[m]; return !!(r && !r.problem && !r.error && ['vt1', 'vt2'].some(q => r[q] && F(r[q].vo2) && !(pr.max && r[q].vo2 > M.hi + 0.01))); };
    $('#rst').onclick = () => { S.picks.inc = {}; S.picks.incSrc = {}; moveLines(ctx); incResults(); summaries(); };
    $('#addV2').onclick = () => { S.picks.inc.vt2 = Math.round(((F(incVT('vt1')) ? incVT('vt1') : M.lo) + (pr.max ? M.hi : D.peak.vo2.value)) / 2 * 1000) / 1000; moveLines(ctx); incResults(); };
    const specs = [
      ['vs', { x: 'vo2', y: ['vco2'], yTitle: 'VCO<sub>2</sub> (L/min)' }],
      ['eo', { x: xk, y: ['eqo2'], yTitle: 'VE/VO<sub>2</sub>' }],
      ['ec', { x: xk, y: ['eqco2'], yTitle: 'VE/VCO<sub>2</sub>' }],
      ['po', { x: xk, y: ['peto2'], yTitle: 'P<sub>ET</sub>O<sub>2</sub> (mmHg)' }],
      ['pc', { x: xk, y: ['petco2'], yTitle: 'P<sub>ET</sub>CO<sub>2</sub> (mmHg)' }],
      ['vv', { x: 'vco2', y: ['ve'], yTitle: 'VE (L/min)' }],
      ['ve', { x: xk, y: ['ve'], yTitle: 'VE (L/min)' }],
      ['rr', { x: xk, y: ['rer'], yTitle: 'RER' }],
      ['hh', { x: xk, y: ['hr'], yTitle: 'Heart rate (bpm)' }]
    ];
    specs.forEach(([id, sp]) => { if (sp.y.some(k => pts.v[k] && pts.v[k].some(F))) vtChart('vc_' + id, ctx, Object.assign({ fit: true }, sp)); else $('#vc_' + id).innerHTML = '<p class="hint" style="padding:16px">Not in this file.</p>'; });
    intensityChart(ctx);
    $$('[data-ow]').forEach(b => (b.onclick = () => { if (pr.max) S.set.oxyWinTwo = b.dataset.ow; else S.set.oxyWin = b.dataset.ow; $$('[data-ow]').forEach(x => x.setAttribute('aria-pressed', x === b)); runOxynet(incResults); }));
    incResults();
    S._ctx = ctx;
    runOxynet(incResults);
    function incResults() {
      const v1 = incVT('vt1'), v2 = incVT('vt2'), pk = D.peak, mass = S.meta.mass;
      const at = (v, q) => { if (!F(v)) return {}; const beyond = pr.max && v > M.hi + 0.01, t = beyond ? NaN : vtTime(M, v, q), hr = beyond ? NaN : L.meanInWindow(S.D.R0, 'hr', t - 15, t + 15), iv = D.fit ? D.fit.m * v + D.fit.b : NaN, st = S.I && !beyond ? C.loadAt(S.I, t) : NaN; return { t, hr, iv, st, pct: pk.vo2 ? 100 * v / pk.vo2.value : NaN, kg: F(mass) && mass > 0 ? v * 1000 / mass : NaN }; };
      const a1 = at(v1, 'vt1'), a2 = at(v2, 'vt2'); S._inc = { v1, v2, a1, a2 };
      const tile = (cls, big, lab, sub) => `<div class="stat ${cls}"><b>${big}</b><span>${lab}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
      $('#tiles').innerHTML =
        tile('key', pk.vo2 ? fx(pk.vo2.value, 2) + ' L/min' : '–', (pr.max ? 'VO₂max (' : 'VO₂peak (') + set.peakWin + '-s mean)', pk.vo2kg ? fx(pk.vo2kg.value, 1) + ' mL/kg/min, at ' + mmss(pk.vo2.t1) : '') +
        tile('vt1b', F(v1) ? fx(v1, 2) + ' L/min' : 'Not set', 'VT1' + (F(v1) ? ' ' + statusBadge(F(S.picks.inc.vt1), 'inc:vt1') : ''), F(v1) ? `${fx(a1.pct, 0)}% of peak · ${iVal(a1.iv)} · ${fx(a1.hr, 0)} bpm` : '') +
        tile('vt2b', F(v2) ? fx(v2, 2) + ' L/min' : 'Not set', 'VT2' + (F(v2) ? ' ' + statusBadge(F(S.picks.inc.vt2), 'inc:vt2') : ''), F(v2) ? `${fx(a2.pct, 0)}% of peak · ${iVal(a2.iv)} · ${fx(a2.hr, 0)} bpm` : 'No clear break found; place it by eye') +
        tile('', pk.hr ? fx(pk.hr.value, 0) + ' bpm' : '–', 'Peak heart rate', '') + tile('', pk.rer ? fx(pk.rer.value, 2) : '–', 'Peak RER', '') + tile('', pk.ve ? fx(pk.ve.value, 0) + ' L/min' : '–', 'Peak VE', '') + tile('', iVal(pr.max ? pr.max.peak : pr.inc.peak), 'Peak ' + (I.label).toLowerCase(), pr.max && pr.max.stages.at(-1).full === false ? 'Reached for ' + Math.round(pr.max.stages.at(-1).dur) + ' s; last full stage ' + iVal(pr.max.stages.at(-2).p) : '');
      const un = D.sugg.unsure, msgs = [];
      if (!F(S.picks.inc.vt1) && D.sugg.startEdge) msgs.push('The VT1 breakpoints sit at the very start of the data they were searched in, so VT1 may be at or below the first stage used. Check it by eye.');
      else if (!F(S.picks.inc.vt1) && un.vt1) msgs.push(F(D.sugg.vt1) ? `The VT1 methods disagree${F(D.sugg.spread.vt1) ? ` by ${fx(D.sugg.spread.vt1, 2)} L/min` : ''}. Check it by eye.` : 'No VT1 break was found. Add it by eye.');
      if (!F(S.picks.inc.vt2) && un.vt2) msgs.push(F(D.sugg.vt2) ? `The VT2 suggestion is weak${F(D.sugg.spread.vt2) ? ` (methods differ by ${fx(D.sugg.spread.vt2, 2)} L/min)` : ''}. Check it by eye.` : (pr.max ? 'No VT2 break was found in the threshold stages. These stages can stop before VT2, so it may not have been reached. Use “Add a VT2 line” if you can place it by eye.' : 'No VT2 break was found before the final surge in ventilation. Use “Add a VT2 line” if you can place it by eye.'));
      $('#vtwarn').innerHTML = msgs.length ? `<div class="warnbox">${msgs.map(esc).join(' ')}</div>` : '';
      const iName = I.label.toLowerCase();
      const row = (q, v, a) => `<tr><td><b class="${q}c">${vtName(q)}</b>${F(S.picks.inc[q]) ? '' : ' <span class="hint">suggested</span>'}</td><td><input type="number" step="0.01" class="vtinput" data-vti="${q}" value="${F(v) ? v.toFixed(2) : ''}"></td><td>${fx(a.kg, 1)}</td><td>${fx(a.pct, 0)}</td><td>${iVal(a.iv)}</td><td>${iVal(a.st)}</td><td>${fx(a.hr, 0)}</td><td>${mmss(a.t)}</td></tr>`;
      $('#vtT').innerHTML = `<tr><th>Threshold</th><th>VO₂ (L/min)</th><th>VO₂ (mL/kg/min)</th><th>% ${pr.max ? 'VO₂max' : 'VO₂peak'}</th><th>${I.label} (regression)</th><th>Stage</th><th>Heart rate (bpm)</th><th>Time</th></tr>` + row('vt1', v1, a1) + row('vt2', v2, a2);
      $$('[data-vti]').forEach(el => (el.onchange = () => later(() => { const x = parseFloat(el.value); if (S.picks.incSrc) delete S.picks.incSrc[el.dataset.vti]; if (F(x)) S.picks.inc[el.dataset.vti] = x; else delete S.picks.inc[el.dataset.vti]; moveLines(ctx); incResults(); summaries(); })));
      $('#addV2').hidden = F(v2);
      const mrow = (q, ms) => ms.map(m => `<tr><td><b class="${q}c">${vtName(q)}</b> ${m.label}</td><td>${m.ok ? fx(m.vo2, 2) : '<span class="hint">no break</span>'}</td><td>${m.ok ? `<button data-use="${q}:${m.vo2}">Use</button>` : ''}</td></tr>`).join('');
      const oxr = q => ['cnn', 'lstm'].map(mm => { const r = S.oxy && S.oxy.res && S.oxy.res[mm]; if (!r) return ''; const o = r[q], ok = o && !r.problem, nm = 'Oxynet ' + mm.toUpperCase(), above = ok && pr.max && o.vo2 > M.hi + 0.01; return `<tr><td><b class="${q}c">${vtName(q)}</b> ${nm}</td><td>${ok ? fx(o.vo2, 2) : '<span class="hint">not placed</span>'}</td><td>${above ? '<span class="hint">above the threshold stages</span>' : ok ? `<button data-use="${q}:${o.vo2}:${nm}">Use</button>` : ''}</td></tr>`; }).join('');
      const sv = S.gas.meta.saved || {}, svr = q => (F(sv[q]) ? `<tr><td><b class="${q}c">${vtName(q)}</b> Saved in the COSMED file</td><td>${fx(sv[q], 2)}</td><td><button data-use="${q}:${sv[q]}:COSMED file">Use</button></td></tr>` : '');
      $('#mT').innerHTML = '<tr><th>Method</th><th>VO₂</th><th></th></tr>' + mrow('vt1', D.sugg.vt1Methods) + oxr('vt1') + svr('vt1') + mrow('vt2', D.sugg.vt2Methods) + oxr('vt2') + svr('vt2');
      $$('[data-use]').forEach(b => (b.onclick = () => { const [q, v, src] = b.dataset.use.split(':'); S.picks.inc[q] = +(+v).toFixed(3); S.picks.incSrc = S.picks.incSrc || {}; if (src) S.picks.incSrc[q] = src; else delete S.picks.incSrc[q]; moveLines(ctx); incResults(); summaries(); }));
      $('#eT').innerHTML = '<tr><th>Criterion</th><th style="text-align:left">Result</th><th>Met</th></tr>' + D.effort.map(r => `<tr><td>${r.name}</td><td style="text-align:left;white-space:normal;min-width:16em">${esc(r.detail)}</td><td>${r.met === null ? '–' : r.met ? 'Yes' : '<b class="flag">No</b>'}</td></tr>`).join('');
      const isT = I.mode === 'treadmill', ec = isT ? '<th>Economy (mL/kg/km)</th><th>Energy cost (J/kg/m)</th>' : '<th>Gross efficiency (%)</th>';
      $('#sT').innerHTML = `<tr><th>${iLab()}</th><th>Length</th><th>VO₂ (L/min)</th><th>VO₂/kg</th><th>VCO₂</th><th>RER</th><th>VE</th><th>Heart rate</th><th>RPE</th>${ec}</tr>` + (() => {
        const row = (q, rp) => `<tr><td>${q.p.toFixed(iDp())}${q.warm ? ' <span class="hint">warm-up</span>' : !q.full ? ' <span class="hint">not completed</span>' : ''}</td><td>${mmss(q.dur)}</td><td>${fx(q.m.vo2, 2)}</td><td>${fx(q.m.vo2rel, 1)}</td><td>${fx(q.m.vco2, 2)}</td><td>${fx(q.m.rer, 2)}</td><td>${fx(q.m.ve, 1)}</td><td>${fx(q.m.hr, 0)}</td><td>${F(rp) ? rp : '–'}</td>${isT ? `<td>${fx(q.economy, 0)}</td><td>${fx(q.costJ, 2)}</td>` : `<td>${fx(q.ge, 1)}</td>`}</tr>`, ncol = isT ? 11 : 10;
        return (pr.max ? `<tr class="sect"><td colspan="${ncol}">Threshold stages</td></tr>` : '') + D.values.map((q, i) => row(q, D.rpe[i])).join('') + (pr.max ? `<tr class="sect"><td colspan="${ncol}">VO₂max stages</td></tr>` + D.maxValues.map((q, i) => row(q, D.maxRpe[i])).join('') : '');
      })();
    }
  }
  function intensityChart(ctx) {
    const D = S.D.inc, gd = document.getElementById('vc_iv'), use = D.values.filter(q => F(q.m.vo2) && !q.warm), fit = D.fit;
    if (!use.length) { gd.innerHTML = `<p class="hint" style="padding:16px">${S.I ? 'Ramp test: there are no stages to fit, so read the intensity from the time a threshold was reached.' : 'Enter the steps under Test details, or add a Lode file, to get power at each threshold.'}</p>`; return; }
    const inFit = fit ? new Set(fit.stages) : new Set();
    const tr = [{ x: use.filter(q => inFit.has(q)).map(q => q.m.vo2), y: use.filter(q => inFit.has(q)).map(q => q.p), mode: 'markers', type: 'scatter', marker: { size: 9, color: css('--ma') }, hovertemplate: '%{x:.2f} L/min<br>%{y} ' + S.I.unit + '<extra></extra>' },
      { x: use.filter(q => !inFit.has(q)).map(q => q.m.vo2), y: use.filter(q => !inFit.has(q)).map(q => q.p), mode: 'markers', type: 'scatter', marker: { size: 9, color: css('--panel'), line: { color: css('--ma'), width: 1.5 } }, hovertemplate: '%{x:.2f} L/min<br>%{y} ' + S.I.unit + ' (not in the fit)<extra></extra>' }];
    const xs = use.map(q => q.m.vo2), lo = Math.min(...xs), hi = Math.max(...xs);
    if (fit) tr.push({ x: [lo, hi], y: [fit.m * lo + fit.b, fit.m * hi + fit.b], mode: 'lines', type: 'scatter', line: { color: css('--fg'), width: 2 }, hoverinfo: 'skip' });
    const LL = lay({ margin: { l: 58, r: 12, t: 22, b: 44 }, xaxis: ax('VO<sub>2</sub> (L/min)'), yaxis: ax(iLab()), annotations: fit ? [{ xref: 'paper', yref: 'paper', x: .98, y: .03, xanchor: 'right', yanchor: 'bottom', showarrow: false, align: 'right', text: `${iLab()} = ${fit.m.toFixed(2)} × VO<sub>2</sub> ${fit.b >= 0 ? '+' : '−'} ${Math.abs(fit.b).toFixed(2)}<br>R² = ${fit.r2.toFixed(3)}, ${fit.nStages} stages ${use.length > fit.nStages ? '(open points left out)' : ''}`, font: { size: 11, color: css('--muted') } }] : [] });
    Plotly.newPlot(gd, tr, LL, FIGCFG);
    attachVT(gd, ctx, { x: 'vo2', y: [] });
  }

