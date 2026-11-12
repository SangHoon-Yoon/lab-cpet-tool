  /* ---------------- Step tests ---------------- */
  function vSteps() {
    const set = S.set.st, pr = S.proto, D = S.D.st, av = availVars().filter(k => k !== 'vo2' && k !== 'rpm' && k !== 'vo2kg');
    if (!pr.tests.length || !D) { $('#views').innerHTML = `<p class="msg">No step tests ${(pr.allTests || []).length ? 'are ticked' : 'were found'}. Check Test details, or enter the stages by hand there.</p>`; return; }
    set.meas = set.meas.filter(k => av.includes(k)); if (!set.meas.length) set.meas = [av[0]];
    const X = S.D.X, A = D.A, dur = pr.pattern ? pr.pattern.stepDur : 240, wins = [dur, 180, 120, 60].filter((v, i, a) => v <= dur && a.indexOf(v) === i);
    const curWin = isWholeStage() ? dur : set.win;
    const cmpVars = ['vo2', 'vo2kg', 'hr', 'rer', 've', 'eqo2', 'eqco2', 'peto2', 'petco2', 'cho', 'fat'].filter(k => k === 'cho' || k === 'fat' || av.concat(['vo2', 'vo2kg']).includes(k));
    const name = i => L.testName(pr, i), ec = S.I.mode === 'treadmill' ? 'Economy' : 'Gross efficiency';
    set.cmp = set.cmp.filter(k => cmpVars.includes(k) || k === 'econ' || k === 'rpe'); if (!set.cmp.length) set.cmp = ['vo2'];
    const lines = set.vt2 ? ['vt1', 'vt2'] : ['vt1'], sel = anySel();
    if (set.sel) { set.sels = set.sels || {}; pr.tests.forEach(T => { const k = testKey(T); if (!(k in set.sels)) set.sels[k] = set.sel.slice(); }); set.sel = null; }
    const selVars = ['vo2', 'hr', 've', 'eqo2', 'eqco2', 'rer', 'petco2'].filter(k => k === 'vo2' || av.includes(k)); if (!selVars.includes(set.selVar)) set.selVar = 'vo2';
    $('#views').innerHTML = `
      <h2 class="row" id="selH">Choose the data<span>a separate time range for each test</span></h2>
      <div class="tools"><span>Show:</span><select id="selVar">${selVars.map(k => `<option value="${k}" ${k === set.selVar ? 'selected' : ''}>${VARS[k].l}</option>`).join('')}</select><span class="hint" data-info="selH">Drag across a test’s chart to highlight the time to use from that test, or type the times. Drag either side of a highlight to make it longer or shorter, or click elsewhere on the chart to clear it and start again. Only data in each test’s highlighted time are used for its threshold charts, suggested lines, stage means and VO₂–${S.I.label.toLowerCase()} regression. “Chart points use the last” still applies within it.</span></div>
      <div class="grid3">${pr.tests.map((T, i) => { const r = testSel(T); return `<div class="panel"><h3><span class="dot" style="background:${tcol(i)}"></span>${name(i)}<span>${r ? `using ${fx(r[0] / 60, 2)}–${fx(r[1] / 60, 2)} min` : 'using all'}</span></h3>
        <div class="tools" style="padding:0 10px"><span>Use from</span><input type="number" step="0.25" min="0" id="selA${i}" value="${r ? (r[0] / 60).toFixed(2) : ''}" placeholder="start" style="width:5.5em"><span>to</span><input type="number" step="0.25" min="0" id="selB${i}" value="${r ? (r[1] / 60).toFixed(2) : ''}" placeholder="end" style="width:5.5em"><span>min</span><button id="selAll${i}" ${r ? '' : 'disabled'}>Use all</button></div>
        <div class="chartwrap" id="selWrap${i}"><div class="chart" id="selC${i}" style="height:230px"></div><div class="zshade" id="selShade${i}"></div></div></div>`; }).join('')}</div>
      <h2 class="row" id="vt1H">${set.vt2 ? 'VT1 and VT2' : 'VT1'} in each test</h2><div class="panel"><div class="tblwrap"><table id="vt1T"></table></div><div class="tools" style="padding:0 8px 8px"><button id="rstT">Reset to suggestions</button><button id="tgV2">${set.vt2 ? 'Remove VT2 lines' : 'Add VT2 lines'}</button></div></div>
      <div class="tools"><span>Plot against VO₂ (up to 4):</span>${chips(av, set.meas, 'data-sm')}</div>
      <div class="tools"><span>Chart points use the last:</span>${wins.map(w => `<button data-sw="${w}" aria-pressed="${curWin === w}">${w === dur ? mmss(w) + ' (whole stage)' : mmss(w)}</button>`).join('')}<span id="swInfo"></span><span class="hint" data-info="swInfo">Drag ${set.vt2 ? 'a <b class="vt1c">VT1</b> or <b class="vt2c">VT2</b>' : 'the <b class="vt1c">VT1</b>'} line sideways; it moves on every chart for that test.</span></div>
      ${set.meas.map(k => `<h2 class="row">${VARS[k].h} against VO<sub>2</sub><span>${avgLabel()}</span></h2><div class="grid3">${pr.tests.map((T, i) => `<div class="panel"><h3><span class="dot" style="background:${tcol(i)}"></span>${name(i)}<span>${mmss(T.t0)}–${mmss(T.t1)}${T.complete ? '' : ' · partial'}</span></h3><div class="chart mid" id="st_${k}_${i}"></div></div>`).join('')}</div>`).join('')}
      <h2 class="row">Compare the tests, stage by stage<span>mean of the last ${set.regWin} s of each stage${sel ? ', within the highlighted time' : ''}${set.regWin > 30 ? '; heart rate, the last 30 s' : ''}</span></h2>
      <div class="tools"><span>Show (up to 4):</span>${cmpVars.map(k => `<button data-cm="${k}" aria-pressed="${set.cmp.includes(k)}">${VARS[k] ? VARS[k].h : k}</button>`).join('')}<button data-cm="econ" aria-pressed="${set.cmp.includes('econ')}">${ec}</button><button data-cm="rpe" aria-pressed="${set.cmp.includes('rpe')}">RPE</button>
        <span class="sep"></span><span>Stage means and VO₂–${S.I.label.toLowerCase()} regressions use the last:</span>${[[30, '30 s'], [60, '60 s'], [120, '2 min']].map(([v, l]) => `<button data-rw="${v}" aria-pressed="${set.regWin === v}">${l}</button>`).join('')}</div>
      <div style="padding:2px 2px">${pr.tests.map((T, i) => `<span class="lg"><i style="background:${tcol(i)}"></i>${name(i)}</span>`).join('')}</div>
      <div class="grid3">${set.cmp.map(k => `<div class="panel"><h3>${k === 'econ' ? ec : k === 'rpe' ? 'RPE' : VARS[k].h}<span>${k === 'econ' ? (S.I.mode === 'treadmill' ? 'mL/kg/km' : '%') : k === 'rpe' ? 'COSMED markers' : VARS[k].u}</span></h3><div class="chart mid" id="cm_${k}"></div></div>`).join('')}</div>
      <ul class="notes" data-info="vt1H"><li>${S.I.label} at a threshold comes from each test’s regression of stage-end VO₂ on ${S.I.label.toLowerCase()}, over the full stages${anySel() ? ' with data in each test’s highlighted time' : ''}.</li><li>The VT1 line starts at the mean of the two-line breakpoints from V-slope and VE/VO₂ against VO₂, using the last 2 min of each stage inside the highlighted time, because VO₂ is still rising early in a stage, especially the first. If neither shows a break, it starts at the 45th percentile of VO₂.${set.vt2 ? ' The VT2 line starts at the breakpoint where VE/VCO₂ begins to rise above VT1; if there is none, at the 90th percentile of VO₂. A 5-step test centred on VT1 often stops before VT2, so a VT2 line there may have nothing to mark.' : ''} These are starting points for the researcher’s own judgement.</li>${S.I.mode === 'treadmill' ? '<li>Economy is only meaningful in a steady state, so read stages above VT1 with care.</li>' : ''}</ul>`;
    multiToggle('data-sm', set.meas, 4, () => vSteps());
    multiToggle('data-cm', set.cmp, 4, () => vSteps());
    $$('[data-sw]').forEach(b => (b.onclick = () => { set.win = +b.dataset.sw; recompute(); }));
    $$('[data-rw]').forEach(b => (b.onclick = () => { set.regWin = +b.dataset.rw; recompute(); }));
    $('#selVar').onchange = e => { set.selVar = e.target.value; pr.tests.forEach((T, i) => selectionChart(i)); };
    pr.tests.forEach((T, i) => selectionChart(i));
    $('#tgV2').onclick = () => { set.vt2 = !set.vt2; render(); summaries(); };
    const ctxs = pr.tests.map((T, ti) => {
      const ids = []; X.t.forEach((t, i) => { if (A.test[i] === ti && C.inWin(A, i, stWin()) && inSelT(T, t) && F(X.v.vo2[i]) && X.v.vo2[i] > .3) ids.push(i); });
      const pts = { t: ids.map(i => X.t[i]), v: {} }; Object.keys(X.v).forEach(k => (pts.v[k] = ids.map(i => X.v[k][i])));
      return { lines, pts, charts: [], get: q => testVT(q, ti), set: (q, v) => setTestVT(T, q, Math.round(v * 1000) / 1000), toX: v => v, fromX: x => x, live: () => vtTable(), done: () => { vtTable(); summaries(); } };
    });
    set.meas.forEach(k => pr.tests.forEach((T, ti) => { if (ctxs[ti].pts.t.length) vtChart(`st_${k}_${ti}`, ctxs[ti], { x: 'vo2', y: [k], yTitle: vlab(k), fit: true }); else $(`#st_${k}_${ti}`).innerHTML = '<p class="hint" style="padding:16px">No data from this test in the highlighted time.</p>'; }));
    $('#rstT').onclick = () => { S.picks.tests = {}; ctxs.forEach(c => moveLines(c)); vtTable(); summaries(); };
    function vtTable() {
      const base = testVT1(0), bI = D.fits[0] ? D.fits[0].m * base + D.fits[0].b : NaN, at = (f, v) => (f && F(v) ? f.m * v + f.b : NaN);
      const tag = (T, q) => { const i = pr.tests.indexOf(T), v = testVT(q, i); return F(v) ? ' ' + statusBadge(F((S.picks.tests[testKey(T)] || {})[q]), `test:${i}:${q}`) : ''; };
      $('#vt1T').innerHTML = `<tr><th>Test</th><th>${iLab()} steps</th><th>VT1 VO₂ (L/min)</th><th>VT1 ${S.I.label.toLowerCase()} (${S.I.unit})</th>${set.vt2 ? `<th>VT2 VO₂ (L/min)</th><th>VT2 ${S.I.label.toLowerCase()} (${S.I.unit})</th>` : ''}<th>Regression R²</th><th>Heart rate at VT1</th><th>VT1 VO₂ change from test 1</th><th>VT1 ${S.I.label.toLowerCase()} change from test 1</th></tr>` + pr.tests.map((T, i) => {
        const v = testVT1(i), f = D.fits[i], iv = at(f, v), sv = D.SM[i].filter(q => F(q.m.vo2) && F(q.m.hr)), hr = sv.length >= 2 ? (() => { const r = C.linreg(sv.map(q => q.m.vo2), sv.map(q => q.m.hr)); return r.m * v + r.b; })() : NaN, v2 = testVT('vt2', i);
        return `<tr><td><span class="dot" style="background:${tcol(i)}"></span>${name(i)}</td><td>${T.steps.map(s => +s.p.toFixed(1)).join(', ')}</td><td><input type="number" step="0.01" class="vtinput" data-tv="vt1:${i}" value="${F(v) ? v.toFixed(2) : ''}">${tag(T, 'vt1')}</td><td>${fx(iv, iDp())}</td>${set.vt2 ? `<td><input type="number" step="0.01" class="vtinput" data-tv="vt2:${i}" value="${F(v2) ? v2.toFixed(2) : ''}">${tag(T, 'vt2')}</td><td>${fx(at(f, v2), iDp())}</td>` : ''}<td>${f ? f.r2.toFixed(3) : '–'}</td><td>${fx(hr, 0)}</td><td>${i ? (v - base >= 0 ? '+' : '') + fx(v - base, 2) : ''}</td><td>${i && F(iv) && F(bI) ? (iv - bI >= 0 ? '+' : '') + fx(iv - bI, iDp()) : ''}</td></tr>`;
      }).join('');
      $$('[data-tv]').forEach(el => (el.onchange = () => later(() => { const [q, n] = el.dataset.tv.split(':'), i = +n; setTestVT(pr.tests[i], q, parseFloat(el.value)); moveLines(ctxs[i]); vtTable(); summaries(); })));
    }
    vtTable();
    // Stage comparison charts and table
    const rpeOf = (i, j) => D.rpe[i] && F(D.rpe[i][j]) ? D.rpe[i][j] : NaN;
    const valOf = (q, k) => (k === 'econ' ? (S.I.mode === 'treadmill' ? q.economy : q.ge) : k === 'vo2kg' ? q.m.vo2rel : q.m[k]);
    const allP = [...new Set(D.SM.flat().map(q => q.p))].sort((a, b) => a - b);
    set.cmp.forEach(k => {
      const dp = k === 'rpe' ? 1 : k === 'econ' ? (S.I.mode === 'treadmill' ? 0 : 1) : VARS[k].dp;
      const tr = D.SM.map((v, i) => ({ x: v.map(q => q.p), y: v.map((q, j) => (k === 'rpe' ? rpeOf(i, j) : valOf(q, k))), mode: 'lines+markers', type: 'scatter', line: { color: tcol(i), width: 2 }, marker: { size: 8, color: tcol(i), symbol: ['circle', 'square', 'diamond', 'triangle-up', 'x', 'cross'][i % 6], line: { color: css('--panel'), width: 2 } }, name: name(i), hovertemplate: `${name(i)}<br>%{x} ${S.I.unit}: %{y:.${dp}f}<extra></extra>` }));
      Plotly.newPlot('cm_' + k, tr, lay({ margin: { l: 58, r: 12, t: 12, b: 44 }, xaxis: ax(iLab(), { tickvals: allP.length <= 8 ? allP : undefined }), yaxis: ax('') }), FIGCFG);
    });
  }
  const tcol = i => css('--t' + ((i % 6) + 1));
  // Every test drawn against time from its own start, with the highlighted range shaded.
  function selectionChart(ti) {
    const pr = S.proto, X = S.D.X, A = S.D.st.A, set = S.set.st, k = set.selVar, gd = document.getElementById('selC' + ti), T = pr.tests[ti], key = testKey(T), r = testSel(T);
    const xs = [], ys = []; X.t.forEach((t, i) => { if (A.test[i] === ti && F(X.v[k][i])) { xs.push((t - T.t0) / 60); ys.push(X.v[k][i]); } });
    const tr = [{ x: xs, y: ys, type: 'scatter', mode: 'lines+markers', line: { color: tcol(ti), width: 1.5 }, marker: { color: tcol(ti), size: 4 }, hovertemplate: `%{x:.2f} min<br>${VARS[k].l} %{y:.${VARS[k].dp}f}<extra></extra>` }];
    const end = (T.t1 - T.t0) / 60, shapes = [], ann = [];
    T.steps.forEach((st, j) => { if (j) shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: (st.t0 - T.t0) / 60, x1: (st.t0 - T.t0) / 60, y0: 0, y1: 1, line: { color: css('--grid'), width: 1, dash: 'dot' } }); ann.push({ xref: 'x', yref: 'paper', x: ((st.t0 + st.t1) / 2 - T.t0) / 60, y: 1, yanchor: 'bottom', showarrow: false, text: 'Stage ' + (j + 1), font: { size: 10, color: css('--muted') } }); });
    gd._baseShapes = shapes.slice();
    if (r) shapes.push(...selShapes(r[0] / 60, r[1] / 60));
    Plotly.newPlot(gd, tr, lay({ dragmode: false, showlegend: false, margin: { l: 58, r: 12, t: 24, b: 44 }, xaxis: ax('Time from the start of this test (min)', { range: [0, end], fixedrange: true }), yaxis: ax(vlab(k), { range: robustRange(ys), fixedrange: true }), shapes, annotations: ann }), Object.assign({}, CFG, { displayModeBar: false }));
    const put = v => { set.sels = set.sels || {}; if (v) set.sels[key] = v; else delete set.sels[key]; if (set.sel) set.sels[key] = v; recompute(); };
    const apply = (a, b) => { a = Math.max(0, Math.min(a, b)); b = Math.max(a, b); if (b - a < 0.25) return selectionChart(ti); put(a <= 0.01 && b >= end - 0.01 ? null : [Math.round(a * 60), Math.round(b * 60)]); };
    const readBox = () => { const a = parseFloat($('#selA' + ti).value), b = parseFloat($('#selB' + ti).value); apply(F(a) ? a : 0, F(b) ? b : end); };
    $('#selA' + ti).onchange = () => later(readBox); $('#selB' + ti).onchange = () => later(readBox);
    $('#selAll' + ti).onclick = () => put(null);
    rangeSelect(gd, $('#selWrap' + ti), $('#selShade' + ti), () => (r ? [r[0] / 60, r[1] / 60] : null), v => (v ? apply(v[0], v[1]) : put(null)));
  }
  // The highlighted time: a shaded band with a line on each side only.
  const selShapes = (a, b) => [{ type: 'rect', xref: 'x', yref: 'paper', x0: a, x1: b, y0: 0, y1: 1, fillcolor: css('--test'), line: { width: 0 }, layer: 'below' },
    ...[a, b].map(x => ({ type: 'line', xref: 'x', yref: 'paper', x0: x, x1: x, y0: 0, y1: 1, line: { color: css('--vt1'), width: 1.5 } }))];
  // Drag across a chart to highlight a time; drag either side of the highlight to move it; a click without dragging clears it.
  // The drag also ends if the button is let go outside the chart or the window.
  function rangeSelect(gd, wrap, shade, get, onSet) {
    const geo = () => { const fl = gd._fullLayout, xa = fl.xaxis, box = gd.getBoundingClientRect(); return { xa, box, top: fl.margin.t, h: fl.height - fl.margin.t - fl.margin.b }; };
    const edge = (ev, g) => { const r = get(); if (!r) return null; const px = ev.clientX - g.box.left, py = ev.clientY - g.box.top; if (py < g.top || py > g.top + g.h) return null; const pa = g.xa._offset + g.xa.l2p(r[0]), pb = g.xa._offset + g.xa.l2p(r[1]), da = Math.abs(px - pa), db = Math.abs(px - pb); if (Math.min(da, db) > 6) return null; return da <= db ? 'a' : 'b'; };
    const setCursor = c => { wrap.style.cursor = c; const el = gd.querySelector('.nsewdrag'); if (el) el.style.cursor = c; };
    wrap.onmousemove = ev => { if (ev.buttons) return; const g = geo(), px = ev.clientX - g.box.left, py = ev.clientY - g.box.top; setCursor(edge(ev, g) ? 'ew-resize' : px >= g.xa._offset && px <= g.xa._offset + g.xa._length && py >= g.top && py <= g.top + g.h ? 'crosshair' : ''); };
    wrap.onmousedown = ev => {
      const g = geo(), xa = g.xa, x0 = ev.clientX - g.box.left, y0 = ev.clientY - g.box.top;
      if (ev.button || x0 < xa._offset || x0 > xa._offset + xa._length || y0 < g.top || y0 > g.top + g.h) return; ev.preventDefault();
      const clamp = x => Math.max(xa._offset, Math.min(xa._offset + xa._length, x)), r = get(), side = edge(ev, g);
      const fixed = side ? xa._offset + xa.l2p(side === 'a' ? r[1] : r[0]) : x0; let x1 = side ? xa._offset + xa.l2p(side === 'a' ? r[0] : r[1]) : x0, moved = false;
      const draw = () => { shade.style.display = 'block'; shade.style.left = Math.min(x1, fixed) + 'px'; shade.style.width = Math.abs(x1 - fixed) + 'px'; shade.style.top = g.top + 'px'; shade.style.height = g.h + 'px'; };
      if (side) { Plotly.relayout(gd, { shapes: gd._baseShapes }); draw(); }
      const mm = e => { if (!e.buttons) return mu(); const x = clamp(e.clientX - g.box.left); if (Math.abs(x - x0) > 3) moved = true; x1 = x; if (moved) draw(); };
      const mu = () => {
        shade.style.display = 'none'; window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); window.removeEventListener('blur', mu);
        if (moved && Math.abs(x1 - fixed) > 4) onSet([xa.p2l(Math.min(x1, fixed) - xa._offset), xa.p2l(Math.max(x1, fixed) - xa._offset)]);
        else if (side) onSet(r); else if (r) onSet(null);
      };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true); window.addEventListener('blur', mu);
    };
  }
