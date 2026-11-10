  /* ---------------- Oxynet ---------------- */
  const oxyChoice = () => (S.proto.max ? S.set.oxyWinTwo || 'max' : S.set.oxyWin);
  const oxyName = () => ({ whole: 'all the exercise data', max: 'the VO₂max stages', analysis: S.proto.max ? 'the threshold window' : 'the analysis window' }[oxyChoice()]);
  function oxyInput() {
    const D = S.D.inc, R = S.D.R0ox, pr = S.proto, ch = oxyChoice(), a = ch === 'whole' ? S.gas.t[0] : ch === 'max' ? pr.max.t0 : D.t0, b = ch === 'whole' ? (pr.max ? pr.max.t1 : L.exerciseEnd(S.gas)) : ch === 'max' ? pr.max.t1 : D.t1, ids = [];
    R.t.forEach((t, i) => { if (t >= a && t <= b) ids.push(i); });
    const pick = k => ids.map(i => R.v[k][i]), out = { t: ids.map(i => R.t[i]) }; ['vo2', 'vco2', 've', 'peto2', 'petco2'].forEach(k => (out[k] = R.v[k] ? pick(k) : []));
    out.key = [a, b, out.t.length, S.set.outl.nsd, S.set.outl.local, 'ox2'].join('|');
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
  const oxyStatus = () => 'Using ' + oxyName();
  const OXINFO = {
    cnn: 'The CNN (convolutional neural network) looks for patterns within each 40-s window of the test, a bit like sliding a set of templates along the signals. It reads five signals, VO₂, VCO₂, VE, PETO₂ and PETCO₂, each rescaled from 0 to 1 over the data it is given, and outputs a score for each intensity domain: moderate, heavy and severe. The scores are smoothed over time. VT1 is placed where heavy first rises above moderate, and VT2 where severe last rises above heavy. CNN scores do not add up to 1, so they can cross well above 0.5. “Use these lines” moves VT1 and VT2 to this model’s values.',
    lstm: 'The LSTM (long short-term memory) network reads each 40-s window one second at a time, keeping a memory of what came before, so it follows how the signals change through the window. It uses the same five signals as the CNN, VO₂, VCO₂, VE, PETO₂ and PETCO₂, rescaled from 0 to 1 over the data it is given, and outputs a score for moderate, heavy and severe. The scores are smoothed over time. VT1 is placed where heavy first rises above moderate, and VT2 where severe last rises above heavy. LSTM scores add up to 1, so they usually cross near 0.5. “Use these lines” moves VT1 and VT2 to this model’s values.'
  };
  function drawOxynet() {
    ['cnn', 'lstm'].forEach(m => {
      const r = S.oxy.res[m], el = document.getElementById('ox_' + m), note = $('#oxm_' + m); if (!r || !el) return;
      if (r.error) { el.innerHTML = `<p class="hint" style="padding:16px">${esc(r.error)}</p>`; if (note) note.textContent = ''; return; }
      const x = r.time.map(t => (t - 40) / 60), tr = [['md', '--t3', 'Moderate'], ['hv', '--t2', 'Heavy'], ['sv', '--t1', 'Severe']].filter(q => r[q[0]]).map(([k, c, n]) => ({ x, y: r[k], mode: 'lines', type: 'scatter', line: { color: css(c), width: 2 }, name: n, hovertemplate: `%{x:.1f} min<br>${n} %{y:.2f}<extra></extra>` }));
      const shapes = [], ann = [];
      if (!r.problem) ['vt1', 'vt2'].forEach(q => { const o = r[q]; if (!o) return; shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: o.time / 60, x1: o.time / 60, y0: 0, y1: 1, line: { color: vtColor(q), width: 2, dash: 'dash' } }); ann.push({ xref: 'x', yref: 'paper', x: o.time / 60, y: 1, yanchor: 'bottom', showarrow: false, text: `<b>${vtName(q)}</b>`, font: { size: 11, color: vtColor(q) } }); });
      Plotly.newPlot(el, tr, lay({ margin: { l: 52, r: 12, t: 22, b: 44 }, xaxis: ax('Start of the 40-s window (min)'), yaxis: ax('Model output'), shapes, annotations: ann }), FIGCFG);
      if (note) note.textContent = r.problem ? r.problem + ' No suggestion from this model.' : `VT1 ${fx(r.vt1.vo2, 2)} L/min at ${mmss(r.vt1.time)}; VT2 ${fx(r.vt2.vo2, 2)} L/min at ${mmss(r.vt2.time)}.`;
      const ub = $('#oxUse_' + m); if (ub) { const can = S.useOx && S.useOx.can(m); ub.disabled = !can; ub.title = can ? 'Move the VT1 and VT2 lines to this model’s thresholds' : r.problem ? 'This model gave no threshold here' : 'Its thresholds are above the threshold stages, so they cannot be used here'; ub.onclick = () => { const msg = S.useOx(m); if (note && msg) note.textContent = msg; }; }
    });
  }

