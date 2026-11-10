  /* ---------------- Prolonged exercise ---------------- */
  function periodRows() {
    const pr = S.proto, X = S.D.X, isT = S.I.mode === 'treadmill', mass = S.meta.mass, blocks = L.steadyTotals(pr, S.I.unit).blocks;
    const mk = (S.gas.markers || []).map(m => ({ t: m.t, v: parseFloat(String(m.text).replace(',', '.')) })).filter(m => F(m.v) && m.v >= 6 && m.v <= 20);
    return (S.D.per || []).filter(p => p.avgWin && p.n).map(p => {
      const b = blocks.findIndex(q => p.t0 >= q.t0 - 30 && p.t0 < q.t1), q = blocks[b], val = k => L.periodValue(X, p, k), r = { p, block: b + 1, into: q ? (p.avgWin[1] - q.t0) / 60 : NaN, mid: (p.avgWin[0] + p.avgWin[1]) / 120 };
      ['vo2', 'vo2kg', 'vco2', 've', 'hr', 'eqo2', 'eqco2', 'rf', 'vt'].forEach(k => (r[k] = val(k)));
      r.rer = p.rer; r.cho = p.cho; r.fat = p.fat;
      r.econ = isT ? [F(mass) && mass > 0 ? r.vo2[0] * 1000 / mass * 60 / pr.base : NaN, F(mass) && mass > 0 ? r.vo2[1] * 1000 / mass * 60 / pr.base : NaN] : p.ge;
      const e = C.energy(p.cho[0], p.fat[0], C.ee(r.vo2[0], r.vco2[0]), isT ? 0 : pr.base); r.energy = e;
      const hit = mk.filter(m => m.t >= p.t0 - 30 && m.t <= p.t1 + 30); r.rpe = hit.length ? hit.at(-1).v : NaN;
      return r;
    });
  }
  function vProlonged() {
    const pr = S.proto, I = S.I, set = S.set.per, rows = periodRows(), isT = I.mode === 'treadmill', ec = isT ? 'Economy' : 'Gross efficiency', ecU = isT ? 'mL/kg/km' : '%', tot = L.steadyTotals(pr, I.unit);
    if (!rows.length) { $('#views').innerHTML = `<p class="msg">No gas recordings were found during the steady work at ${iVal(pr.base)}.</p>`; return; }
    const pm = (a, d) => (a && F(a[0]) ? a[0].toFixed(d) + ' ± ' + (F(a[1]) ? a[1].toFixed(d) : '–') : '–'), keys = ['vo2', 'vo2kg', 'hr', 've', 'rer', 'eqo2', 'eqco2', 'cho', 'fat'].filter(k => rows.some(r => r[k] && F(r[k][0])));
    const lab = k => (k === 'econ' ? ec : VARS[k].h), unit = k => (k === 'econ' ? ecU : VARS[k].u), dpOf = k => (k === 'econ' ? (isT ? 0 : 1) : VARS[k].dp), name = (r, i) => `Recording ${i + 1}`;
    set.vars = set.vars.filter(k => keys.includes(k) || k === 'econ'); if (!set.vars.length) set.vars = ['vo2'];
    const first = rows[0], last = rows.at(-1), vt0 = S.D.st && pr.tests.length ? (() => { const f = S.D.st.fits[0], v = testVT1(0); return f && F(v) ? f.m * v + f.b : NaN; })() : NaN;
    const diff = (k, d) => (F(last[k][0]) && F(first[k][0]) ? (last[k][0] - first[k][0] >= 0 ? '+' : '') + (last[k][0] - first[k][0]).toFixed(d) : '–');
    const allout = pr.maot && I.source === 'lode' ? C.threeMAOT({ t: I.t, p: I.p, rpm: I.rpm }, pr.maot, false) : null;
    const tile = (big, lab2, sub) => `<div class="stat"><b>${big}</b><span>${lab2}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    $('#views').innerHTML = `
      <div class="stats">${tile(iVal(pr.base), 'Steady ' + I.label.toLowerCase(), F(vt0) ? `${fx(100 * pr.base / vt0, 0)}% of VT1 from the first step test` : '')}${tile(mmss(tot.sec), 'Time at this ' + I.label.toLowerCase(), `${tot.blocks.length} block${tot.blocks.length > 1 ? 's' : ''}`)}${tile(fx(tot.amount, isT ? 1 : 0) + ' ' + tot.amountUnit, isT ? 'Distance' : 'Work')}${tile(diff('hr', 0) + ' bpm', 'Heart rate, first to last recording')}${tile(diff('vo2', 2) + ' L/min', 'VO₂, first to last recording')}${tile(diff('cho', 2) + ' g/min', 'Carbohydrate oxidation, first to last recording')}</div>
      <div class="tools"><span>Show (up to 6):</span>${keys.map(k => `<button data-pv="${k}" aria-pressed="${set.vars.includes(k)}">${VARS[k].h}</button>`).join('')}<button data-pv="econ" aria-pressed="${set.vars.includes('econ')}">${ec}</button>
        <span class="sep"></span><span>Average the last:</span>${[1, 2, 4].map(m => `<button data-pa="${m}" aria-pressed="${set.avgMin === m}">${m} min</button>`).join('')}<span class="hint">of each recording</span></div>
      <div class="grid3">${set.vars.map(k => `<div class="panel"><h3>${lab(k)}<span>${unit(k)}, mean ± SD</span></h3><div class="chart mid" id="pv_${k}"></div></div>`).join('')}</div>
      <h2 class="row" id="recH">Each recording<span>mean ± SD of the last ${set.avgMin} min</span></h2>
      <div class="panel"><div class="tblwrap"><table id="pT"></table></div></div>
      <h2 class="row">Energy<span>same windows</span></h2>
      <div class="grid3"><div class="panel"><h3>Energy from carbohydrate and fat<span>kJ/min</span></h3><div style="padding:2px 8px"><span class="lg"><i style="background:${css('--t2')}"></i>Carbohydrate</span><span class="lg"><i style="background:${css('--t1')}"></i>Fat</span></div><div class="chart mid" id="peS"></div></div>
      <div class="panel"><div class="tblwrap"><table id="peT"></table></div></div></div>
      ${allout ? `<h2 class="row">All-out test<span>${mmss(pr.maot.t0)}–${mmss(pr.maot.t1)}, start spike left out of W′</span></h2><div class="stats">${tile(fx(allout.CP, 1) + ' W', 'Critical power', 'Mean of the last 30 s')}${tile(fx(allout.Wp / 1000, 2) + ' kJ', 'W′')}${tile(fx(allout.peak, 0) + ' W', 'Peak power')}${tile(fx(allout.mean, 0) + ' W', 'Mean power')}</div>` : ''}
      <ul class="notes" data-info="recH"><li>Each recording is a stretch of gas data at the steady ${I.label.toLowerCase()}. The window ends just before the mask came off and looks back 4 min, leaving out partial breaths at mask-off and any 15-s bins below 80% or above 125% of the median VO₂. A recording of more than 10 min is split into 5-min windows.</li>
      <li>Oxidation: carbohydrate = 4.210 VCO₂ − 2.962 VO₂; fat = 1.695 VO₂ − 1.701 VCO₂ (Jeukendrup and Wallis, 2005). Valid while RER stays below 1, and carbohydrate includes any ingested during exercise. Energy from each substrate uses 17.57 kJ/g for carbohydrate and 39.33 kJ/g for fat. Energy expenditure: 16.89 VO₂ + 4.84 VCO₂ kJ/min (Brouwer, 1957).</li>
      <li>${isT ? 'Economy = VO₂ per kilogram per kilometre, at the steady speed.' : 'Gross efficiency = power ÷ metabolic power × 100.'} For any other part of the session, zoom to it on the Protocol tab and read the mean ± SD under the chart.</li></ul>`;
    multiToggle('data-pv', set.vars, 6, () => vProlonged());
    $$('[data-pa]').forEach(b => (b.onclick = () => { set.avgMin = +b.dataset.pa; recompute(); }));
    const bands = pr.phases.filter(q => q.kind === 'test' || q.kind === 'allout'), x = rows.map(r => r.mid);
    set.vars.forEach(k => {
      const y = rows.map(r => r[k][0]), e = rows.map(r => r[k][1]);
      Plotly.newPlot('pv_' + k, [{ x, y, error_y: { type: 'data', array: e, color: css('--muted'), thickness: 1.2, width: 4 }, type: 'scatter', mode: 'lines+markers', line: { color: css('--ma'), width: 2 }, marker: { color: css('--ma'), size: 9 }, customdata: rows.map((r, i) => name(r, i)), hovertemplate: `%{customdata}, %{x:.1f} min<br>%{y:.${dpOf(k)}f} ${unit(k)}<extra></extra>` }],
        lay({ margin: { l: 58, r: 12, t: 22, b: 44 }, xaxis: ax('Time in the session (min)'), yaxis: ax(''), shapes: bands.map(q => ({ type: 'rect', xref: 'x', yref: 'paper', x0: q.t0 / 60, x1: q.t1 / 60, y0: 0, y1: 1, fillcolor: css(q.kind === 'test' ? '--test' : '--maot'), line: { width: 0 }, layer: 'below' })), annotations: bands.map(q => ({ xref: 'x', yref: 'paper', x: (q.t0 + q.t1) / 120, y: 1, yanchor: 'bottom', showarrow: false, text: q.label, font: { size: 10, color: css('--muted') } })) }), FIGCFG);
    });
    const multi = tot.blocks.length > 1, cols = ['vo2', 'vo2kg', 'hr', 've', 'rer', 'cho', 'fat'].filter(k => keys.includes(k)), short = { cho: 'Carbohydrate', fat: 'Fat' };
    $('#pT').innerHTML = `<tr><th>Recording</th>${multi ? '<th>Block</th>' : ''}<th>Averaged (min of session)</th><th>Minutes into block</th>${cols.map(k => `<th>${short[k] || VARS[k].h}${VARS[k].u ? ` (${VARS[k].u})` : ''}</th>`).join('')}<th>${ec} (${ecU})</th><th>RPE</th></tr>` + rows.map((r, i) => `<tr><td>${i + 1}</td>${multi ? `<td>${r.block || '–'}</td>` : ''}<td>${fx(r.p.avgWin[0] / 60, 1)}–${fx(r.p.avgWin[1] / 60, 1)}</td><td>${fx(r.into, 0)}</td>${cols.map(k => `<td>${pm(r[k], dpOf(k))}</td>`).join('')}<td>${pm(r.econ, isT ? 0 : 1)}</td><td>${F(r.rpe) ? r.rpe : '–'}</td></tr>`).join('');
    Plotly.newPlot('peS', [['cho', 'Carbohydrate', '--t2'], ['fat', 'Fat', '--t1']].map(([k, n, c]) => ({ x, y: rows.map(r => r.energy[k]), type: 'scatter', mode: 'lines+markers', name: n, line: { color: css(c), width: 2 }, marker: { color: css(c), size: 9, symbol: k === 'cho' ? 'circle' : 'square' }, hovertemplate: n + ', %{x:.1f} min<br>%{y:.1f} kJ/min<extra></extra>' })), lay({ margin: { l: 52, r: 12, t: 12, b: 44 }, xaxis: ax('Time in the session (min)'), yaxis: ax('Energy (kJ/min)', { rangemode: 'tozero' }) }), FIGCFG);
    $('#peT').innerHTML = `<tr><th>Recording</th><th>Carbohydrate (kJ/min)</th><th>Fat (kJ/min)</th><th>% from carbohydrate</th><th>Expenditure (kJ/min)</th></tr>` + rows.map((r, i) => `<tr><td>${i + 1}</td><td>${fx(r.energy.cho, 1)}</td><td>${fx(r.energy.fat, 1)}</td><td>${fx(r.energy.pctCho, 0)}</td><td>${fx(r.energy.total, 1)}</td></tr>`).join('');
  }

