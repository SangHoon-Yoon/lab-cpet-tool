  /* ---------------- Lactate ----------------
     Blood lactate typed per stage; thresholds from the lactater methods (src/lactate.js). LT lines are kept separately from VT lines,
     but either pair can be copied to the other through the VO₂–intensity regression. */
  const LM = window.LabLactate;
  const LT_METHODS = ['Log-log', 'OBLA 2.0', 'OBLA 2.5', 'OBLA 3.0', 'OBLA 3.5', 'OBLA 4.0', 'Bsln + 0.5', 'Bsln + 1.0', 'Bsln + 1.5', 'Dmax', 'ModDmax', 'Exp-Dmax', 'Log-Poly-ModDmax', 'Log-Exp-ModDmax', 'LTP1', 'LTP2', 'LTratio'];
  // The lactate settings. Missing ones are filled in on the SAME object, so anything holding it keeps seeing later changes.
  const lacSet = () => { const o = S.set.lac = S.set.lac || {}, d = { fit: 'poly3', baseline: false, restrain: 0.75, lt1: 'Log-log', lt2: 'ModDmax' }; Object.keys(d).forEach(k => { if (o[k] === undefined) o[k] = d[k]; }); o.series = o.series || {}; return o; };
  // Heart rate of a stage for the lactate table and the client report: the mean of its last 30 s.
  const HR_WIN = 30, stageHR = q => (S.D && S.D.R0 && F(q.t0) && F(q.t1) ? L.stageValues(S.D.R0, q, HR_WIN, S.meta.mass, S.D.mode).m.hr : NaN);
  // One series per lactate curve: the incremental test, or each step test. fit maps VO₂ (L/min) to intensity.
  function lacSeries() {
    const pr = S.proto, D = S.D, out = [];
    if (pr.type === 'incremental') {
      const st = pr.inc && !pr.inc.none ? pr.inc.stages : [];
      out.push({ key: 'inc', name: pr.max ? 'Threshold stages' : 'Incremental test', stages: st.map((q, i) => ({ p: q.p, dur: q.dur, full: q.full, t0: q.t0, t1: q.t1, hr: stageHR(q), rpe: D.inc ? D.inc.rpe[i] : NaN })), fit: D.inc ? D.inc.fit : null,
        vt: q => incVT(q), setVT: (q, v, src) => { S.picks.inc[q] = +v.toFixed(3); S.picks.incSrc = S.picks.incSrc || {}; S.picks.incSrc[q] = src; }, vtLines: ['vt1', 'vt2'] });
    } else if (D.st) pr.tests.forEach((T, i) => out.push({ key: 't' + testKey(T), name: L.testName(pr, i), stages: T.steps.map((q, j) => ({ p: q.p, dur: q.dur, full: q.full, t0: q.t0, t1: q.t1, hr: stageHR(q), rpe: D.st.rpe[i][j] })), fit: D.st.fits[i],
      vt: q => testVT(q, i), setVT: (q, v) => { if (q === 'vt2') S.set.st.vt2 = true; setTestVT(T, q, +v.toFixed(3)); }, vtLines: S.set.st.vt2 ? ['vt1', 'vt2'] : ['vt1'] }));
    return out;
  }
  // The rows of a series: the resting baseline, each stage (an unfinished last stage gets a pro-rated intensity, as in Exphyslab) and any added rows.
  function lacRows(se) {
    const ls = lacSet(), sv = ls.series[se.key] || {}, ent = sv.rows || {}, rows = [];
    // Lactate is taken at the end of the longer stages, so shorter (for example 1-min) stages at the end get no row unless a value was already entered.
    const longs = se.stages.filter(q => q.dur >= 120).map(q => q.dur), usual = longs.length ? C.median(longs) : NaN, isShort = q => F(usual) && q.dur < 0.6 * usual;
    se.stages.forEach((q, i) => {
      const prev = se.stages[i - 1], last = i === se.stages.length - 1, part = last && prev && q.dur < 0.9 * prev.dur, e0 = ent[i] || {};
      if (isShort(q) && !(last && prev && !isShort(prev)) && !F(e0.la)) return;
      const auto = part ? +(prev.p + (q.p - prev.p) * q.dur / prev.dur).toFixed(2) : q.p, e = ent[i] || {};
      rows.push({ i, label: 'Stage ' + (i + 1) + (part ? ' (part)' : ''), stageP: q.p, part, autoP: auto, p: F(e.p) ? e.p : auto, autoHr: F(q.hr) ? Math.round(q.hr) : NaN, hr: F(e.hr) ? e.hr : F(q.hr) ? Math.round(q.hr) : NaN, autoRpe: q.rpe, rpe: F(e.rpe) ? e.rpe : q.rpe, la: e.la });
    });
    (sv.extra || []).forEach((e, j) => rows.push({ i: 'x' + j, label: 'Added', p: e.p, stageP: e.p, hr: e.hr, rpe: e.rpe, la: e.la, extra: j }));
    return { base: sv.base || {}, rows };
  }
  function lacAnalyse(se) {
    const ls = lacSet(), { base, rows } = lacRows(se), use = rows.filter(r => F(r.p) && F(r.la)).sort((a, b) => a.p - b.p);
    const input = (F(base.la) ? [{ p: 0, la: base.la, hr: base.hr }] : []).concat(use.map(r => ({ p: r.p, la: r.la, hr: r.hr })));
    const res = use.length ? LM.analyse(input, { fit: ls.fit, baseline: ls.baseline, restrain: ls.restrain, sport: S.I && S.I.unit !== 'W' ? 'running' : 'cycling' }) : { methods: [], problems: [] };
    res.n = use.length; res.hasBase = F(base.la); return res;
  }
  // Methods marked on the chart: the two starting methods (Log-log and ModDmax unless changed) until boxes are ticked beside the chart.
  const lacShown = () => { const ls = lacSet(); return Array.isArray(ls.showM) ? ls.showM : [...new Set([ls.lt1, ls.lt2])]; };
  const lacMarks = [];
  const ltPick = (key, q) => ((S.picks.lt || {})[key] || {})[q];
  function ltVal(se, res, q) {
    const p = ltPick(se.key, q); if (F(p)) return p;
    const m = res.methods.find(x => x.name === lacSet()[q]); return m && F(m.p) ? m.p : NaN;
  }
  function ltSource(se, res, q) { const p = ltPick(se.key, q); if (F(p)) return ((S.picks.ltSrc || {})[se.key] || {})[q] || 'placed by user'; return F(ltVal(se, res, q)) ? lacSet()[q] + ' (default)' : ''; }
  function setLT(key, q, v, src) { S.picks.lt = S.picks.lt || {}; S.picks.ltSrc = S.picks.ltSrc || {}; const o = S.picks.lt[key] = S.picks.lt[key] || {}, s = S.picks.ltSrc[key] = S.picks.ltSrc[key] || {}; if (F(v)) { o[q] = v; if (src) s[q] = src; else delete s[q]; } else { delete o[q]; delete s[q]; } }
  // lactate and heart rate at any intensity: from the fitted curve, and from a straight line through the stage heart rates
  const ltAt = (res, p) => { if (!res.fit || !F(p)) return {}; const la = res.fit.model.predict(p), hr = res.fit.data.slice(res.hasBase ? 1 : 0).filter(r => F(r.hr)); let h = NaN; if (hr.length >= 2) { const r = C.linreg(hr.map(q => q.p), hr.map(q => q.hr)); h = r.m * p + r.b; } return { la, hr: h }; };
  const lacUsed = () => lacSeries().some(se => lacAnalyse(se).n > 0);

  function vLactate() {
    const ls = lacSet(), I = S.I, u = I ? I.unit : '', dp = u === 'W' ? 0 : 1, series = lacSeries();
    const sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    $('#views').innerHTML = `
      <div class="tools"><span>Curve fit:</span>${sel('lFit', [['poly3', '3rd degree polynomial'], ['poly4', '4th degree polynomial'], ['bspline', 'B-spline']], ls.fit)}
        <span>Baseline in the fit:</span>${sel('lBase', [[0, 'No'], [1, 'Yes']], ls.baseline ? 1 : 0)}
        <span>Log-log uses the first</span><input type="number" id="lRes" min="0.25" max="1" step="0.05" value="${ls.restrain}" style="width:4.5em"><span>of the data</span><span id="lacInfo"></span></div>
      <ul class="notes" data-info="lacInfo"><li>Type the blood lactate (mmol/L) taken at the end of each stage, and the resting value as the baseline. Leave a stage empty if no sample was taken. Press Enter or the down arrow to move down a row, the up arrow to move up, and Tab to move across. Shorter stages at the end of a test (for example 1-min stages) get no row, because lactate is taken at the end of the longer stages; use Add a row if you did take one. To paste from Excel, copy the lactate column (or the lactate, heart-rate and RPE columns together), click the first box to fill, and paste: the values fill down the table. Intensity and heart rate are filled in from the test, and you can change them. An unfinished last stage gets a pro-rated intensity, as in Exphyslab.</li>
        <li>The thresholds use the methods of the open-source lactater R package by Felipe Mattioni Maturana, which Exphyslab also uses: Log-log, OBLA (fixed 2.0–4.0 mmol/L), baseline plus 0.5–1.5 mmol/L, the Dmax family, lactate turn points (LTP1 and LTP2) and LTratio. Dmax methods always use a 3rd degree polynomial or exponential fit without the baseline, as in lactater.</li>
        <li>LT1 starts at the ${ls.lt1} method and LT2 at the ${ls.lt2} method, and the chart marks those two at first. Tick other methods beside the chart to mark their values too.</li>
        <li>To change a threshold, drag its line, or open <b>Every method</b> under the chart and click <b>LT1</b> or <b>LT2</b> next to the method you want. LT lines are kept apart from the VT lines; use the copy buttons to move one pair onto the other through the VO₂–${u === 'km/h' ? 'speed' : 'power'} regression.</li>
        <li>Check the values against your usual method (for example Exphyslab) before relying on them.</li></ul>
      ${series.length ? series.map((se, si) => `<h2 class="row">${esc(se.name)}<span>lactate curve</span></h2>
        <div class="panel"><div class="tools" style="padding:8px 10px 0"><button data-ladd="${si}">Add a row</button><span class="hint" id="lmsg${si}"></span></div><div class="tblwrap"><table class="lacT" data-si="${si}"><thead><tr><th>Stage</th><th>${I ? I.label : 'Intensity'} (${u})</th><th>Lactate (mmol/L)</th><th>Heart rate</th><th>RPE</th><th></th></tr></thead><tbody></tbody></table></div></div>
          <div class="panel" style="margin-top:12px"><h3>Lactate against ${I ? I.label.toLowerCase() : 'intensity'}</h3>
            <div class="lacrow"><div><div class="chart mid" id="lc${si}" style="height:${ls.chartH || 380}px"></div><div class="sizebar" data-lsize="${si}" title="Drag up or down to change the chart's height" role="separator" aria-label="Drag to change the chart's height"><span></span></div></div>
              <div class="lacside"><div class="stats" id="lt${si}"></div><h4>Methods marked on the chart<span id="lmsI${si}"></span></h4><div id="lms${si}"></div></div></div>
            <div class="tools" id="lcp${si}" style="padding:6px 10px 10px"></div></div>
        <details class="box fold" data-fold="lm${si}" ${openFolds.has('lm' + si) ? 'open' : ''}><summary>Every method<span>intensity, lactate and heart rate</span></summary><div class="foldbody"><div class="tblwrap"><table id="lmT${si}"></table></div></div></details>`).join('') : '<p class="msg">No stages were found. Check Test details.</p>'}`;
    const re = () => { vLactate(); summaries(); };
    $('#lFit').onchange = e => { ls.fit = e.target.value; re(); }; $('#lBase').onchange = e => { ls.baseline = e.target.value === '1'; re(); };
    $('#lRes').onchange = e => { const v = parseFloat(e.target.value); ls.restrain = F(v) ? Math.min(1, Math.max(0.25, v)) : 0.75; re(); };
    lacMarks.length = 0;
    series.forEach((se, si) => lacPanel(se, si, dp));
  }
  function lacPanel(se, si, dp) {
    const ls = lacSet(), I = S.I, u = I ? I.unit : '', sv = ls.series[se.key] = ls.series[se.key] || {}, { base, rows } = lacRows(se), res = lacAnalyse(se);
    const num = (v, d) => (F(v) ? (+v).toFixed(d) : ''), inp = (k, v, ph, w) => `<input type="number" step="any" data-lk="${k}" value="${trim0(num(v, k.startsWith('la') ? 2 : k.startsWith('hr') || k.startsWith('rpe') ? 0 : 2))}" placeholder="${ph}" style="width:${w || 5.5}em">`;
    const gd0 = document.getElementById('lc' + si), tb = $(`.lacT[data-si="${si}"] tbody`), focusK = document.activeElement && tb.contains(document.activeElement) ? document.activeElement.dataset.lk : null;
    tb.innerHTML = `<tr><td>Rest (baseline)</td><td>–</td><td>${inp('la:b', base.la, '')}</td><td>${inp('hr:b', base.hr, '', 4.5)}</td><td></td><td></td></tr>` +
      rows.map(r => `<tr><td>${r.label}</td><td>${inp('p:' + r.i, r.p, r.autoP ?? '')}</td><td>${inp('la:' + r.i, r.la, '')}</td><td>${inp('hr:' + r.i, r.hr, r.autoHr ?? '', 4.5)}</td><td>${inp('rpe:' + r.i, r.rpe, r.autoRpe ?? '', 3.5)}</td><td>${r.extra !== undefined ? `<button class="rm" data-lrm="${r.extra}" title="Remove this row" aria-label="Remove this row">×</button>` : ''}</td></tr>`).join('');
    $$(`.lacT[data-si="${si}"] input`).forEach(el => (el.onchange = () => {
      const [k, id] = el.dataset.lk.split(':'), v = parseFloat(el.value);
      if (id === 'b') { sv.base = Object.assign({}, sv.base, { [k]: F(v) ? v : undefined }); }
      else if (id[0] === 'x') { const j = +id.slice(1); sv.extra[j] = Object.assign({}, sv.extra[j], { [k]: F(v) ? v : undefined }); }
      else { sv.rows = sv.rows || {}; const o = sv.rows[id] = Object.assign({}, sv.rows[id]); if (F(v)) o[k] = v; else delete o[k]; }
      setTimeout(() => { lacPanel(se, si, dp); summaries(); }, 0); // after the box has lost focus; the box being typed in keeps focus
    }));
    // Enter or the down arrow moves to the same column in the next row (Shift+Enter or the up arrow moves up); Tab moves across as usual.
    tb.onkeydown = ev => {
      if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(ev.key)) return; const el = ev.target.closest('[data-lk]'); if (!el) return; ev.preventDefault();
      const col = el.dataset.lk.split(':')[0], trs = [...tb.rows], up = ev.key === 'ArrowUp' || (ev.key === 'Enter' && ev.shiftKey); let j = trs.indexOf(el.closest('tr'));
      if (ev.key !== 'Enter' && !trs.slice(up ? 0 : j + 1, up ? j : trs.length).some(r => r.querySelector(`[data-lk^="${col}:"]`))) return; // already at the top or bottom
      for (j += up ? -1 : 1; j >= 0 && j < trs.length; j += up ? -1 : 1) { const nx = trs[j].querySelector(`[data-lk^="${col}:"]`); if (nx) { nx.focus(); nx.select(); return; } }
      el.blur();
    };
    if (focusK) { const el = tb.querySelector(`[data-lk="${focusK}"]`); if (el) { el.focus(); el.select(); } }
    // Paste a column (or several columns) copied from Excel: values fill down from the box pasted into, and to the right.
    const rowIds = ['b', ...rows.map(r => String(r.i))], colIds = ['p', 'la', 'hr', 'rpe'];
    tb.onpaste = ev => {
      const el = ev.target.closest('[data-lk]'), txt = (ev.clipboardData || window.clipboardData).getData('text'); if (!el || !/[\t\n]/.test(txt.trim())) return;
      ev.preventDefault();
      const [k0, id0] = el.dataset.lk.split(':'), grid = txt.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(l => l.split('\t').map(x => parseFloat(x.replace(',', '.').trim())));
      let n = 0; const r0 = rowIds.indexOf(id0), c0 = colIds.indexOf(k0);
      grid.forEach((line, dr) => line.forEach((v, dc) => {
        const rid = rowIds[r0 + dr], k = colIds[c0 + dc]; if (rid === undefined || k === undefined) return;
        if (rid === 'b') { if (k === 'la' || k === 'hr') { sv.base = Object.assign({}, sv.base, { [k]: F(v) ? v : undefined }); n++; } return; }
        if (rid[0] === 'x') { const j = +rid.slice(1); sv.extra[j] = Object.assign({}, sv.extra[j], { [k]: F(v) ? v : undefined }); n++; return; }
        sv.rows = sv.rows || {}; const o = sv.rows[rid] = Object.assign({}, sv.rows[rid]); if (F(v)) o[k] = v; else delete o[k]; n++;
      }));
      lacPanel(se, si, dp); summaries(); const m = $('#lmsg' + si); if (m) m.textContent = `Pasted ${n} value${n === 1 ? '' : 's'}. Check them against your sheet.`;
    };
    $(`[data-ladd="${si}"]`).onclick = () => { sv.extra = (sv.extra || []).concat([{}]); lacPanel(se, si, dp); const nx = tb.querySelector(`[data-lk="p:x${sv.extra.length - 1}"]`); if (nx) nx.focus(); };
    // Drag the bar under the chart to change its height; the chart follows the pointer.
    const bar = $(`[data-lsize="${si}"]`);
    bar.onpointerdown = ev => {
      ev.preventDefault(); bar.setPointerCapture(ev.pointerId); const y0 = ev.clientY, h0 = gd0.getBoundingClientRect().height; let h = h0, raf = 0;
      const apply = () => { raf = 0; gd0.style.height = h + 'px'; if (gd0.data) Plotly.relayout(gd0, { height: h }); };
      bar.onpointermove = e => { h = Math.round(Math.max(220, Math.min(1000, h0 + e.clientY - y0))); if (!raf) raf = requestAnimationFrame(apply); };
      bar.onpointerup = bar.onpointercancel = () => { bar.onpointermove = bar.onpointerup = bar.onpointercancel = null; if (raf) cancelAnimationFrame(raf); apply(); lacSet().chartH = h; };
    };
    $$(`.lacT[data-si="${si}"] [data-lrm]`).forEach(b => (b.onclick = () => { sv.extra.splice(+b.dataset.lrm, 1); lacPanel(se, si, dp); summaries(); }));
    $('#lmsg' + si).textContent = res.n ? res.problems.join(' ') + (res.hasBase ? '' : ' No baseline entered, so the baseline-plus methods are left out.') : 'Type the lactate values to see the curve and thresholds.';
    // chart
    const gd = document.getElementById('lc' + si); Plotly.purge(gd); gd.innerHTML = '';
    const pts = res.fit ? res.fit.data : [], tr = [], mcol = ['--t1', '--t2', '--t3', '--vt1', '--vt2', '--power'];
    const marks = () => { const sh = lacShown(), ms = res.methods.filter(m => F(m.p) && F(m.la) && sh.includes(m.name)); return { x: ms.map(m => m.p), y: ms.map(m => m.la), text: ms.map(m => m.name), mode: ms.length <= 6 ? 'markers+text' : 'markers', color: ms.map(m => css(mcol[LT_METHODS.indexOf(m.name) % 6])) }; };
    if (res.fit) {
      tr.push({ x: res.fit.x, y: res.fit.y, mode: 'lines', type: 'scatter', line: { color: css('--ma'), width: 2 }, name: 'Fitted curve', hoverinfo: 'skip' });
      tr.push({ x: pts.map(r => r.p), y: pts.map(r => r.la), mode: 'markers', type: 'scatter', marker: { color: css('--bg'), size: 9, line: { color: css('--fg'), width: 1.5 } }, name: 'Samples', text: pts.map((r, i) => (res.hasBase && i === 0 ? 'Baseline (rest)' : (+r.p.toFixed(dp + 1)) + ' ' + u)), hovertemplate: `%{text}<br>%{y:.2f} mmol/L<extra></extra>` });
      const mk = marks(); tr.push({ x: mk.x, y: mk.y, text: mk.text, mode: mk.mode, type: 'scatter', marker: { size: 9, color: mk.color, line: { color: css('--bg'), width: 1 } }, name: 'Methods', textposition: 'top left', textfont: { size: 10, color: css('--muted') }, hovertemplate: `%{text}<br>%{x:.${dp}f} ${u}, %{y:.1f} mmol/L<extra></extra>` });
    }
    const xs = pts.map(r => r.p), xr = xs.length ? [Math.min(...xs) - (Math.max(...xs) - Math.min(...xs)) * .05, Math.max(...xs) * 1.03] : [0, 1], ys = pts.map(r => r.la);
    const shapes = [], ann = [];
    if (se.fit) se.vtLines.forEach(q => { const v = se.vt(q), x = F(v) ? se.fit.m * v + se.fit.b : NaN; if (!F(x)) return; shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: x, x1: x, y0: 0, y1: 1, line: { color: vtColor(q), width: 1.5, dash: 'dot' } }); ann.push({ xref: 'x', yref: 'paper', x, y: 0.02, xanchor: 'left', showarrow: false, text: q.toUpperCase() + ' (gas)', font: { size: 10, color: vtColor(q) } }); });
    Plotly.newPlot(gd, tr, lay({ showlegend: false, margin: { l: 52, r: 12, t: 22, b: 44 }, xaxis: ax(`${I ? I.label : 'Intensity'} (${u})`, Object.assign({ range: xr }, lacTicks(res))), yaxis: ax('Lactate (mmol/L)', { range: [0, Math.max(2, ...ys) * 1.1] }), shapes, annotations: ann }), FIGCFG);
    const ctx = { lines: res.fit ? ['lt1', 'lt2'] : [], charts: [], pts: { v: {} }, get: q => ltVal(se, res, q), set: (q, v) => setLT(se.key, q, Math.round(v * 100) / 100), toX: v => v, fromX: x => x, live: () => tiles(), done: () => { tiles(); summaries(); } };
    attachVT(gd, ctx, { x: 'p', y: [] });
    const tiles = () => {
      const t = q => { const p = ltVal(se, res, q), a = ltAt(res, p), src = ltSource(se, res, q); return `<div class="stat ${q === 'lt1' ? 'vt1b' : 'vt2b'}"><b>${F(p) ? fx(p, dp + 1) + ' ' + u : '–'}</b><span>${q.toUpperCase()}${src ? ' · ' + esc(src) : ''}${F(p) ? ' ' + statusBadge(F(ltPick(se.key, q)), `lt:${se.key}:${q}`) : ''}</span><small>${F(p) ? `${fx(a.la, 1)} mmol/L${F(a.hr) ? ', ' + Math.round(a.hr) + ' bpm' : ''}${u === 'km/h' ? ', ' + pace(p) + ' min/km' : ''}` : 'enter lactate values'}</small></div>`; };
      $('#lt' + si).innerHTML = t('lt1') + t('lt2');
    };
    tiles();
    // copy between lactate and gas thresholds
    $('#lcp' + si).innerHTML = se.fit ? `<button id="lcpTo${si}" ${res.fit ? '' : 'disabled'}>Copy LT1 and LT2 to the gas charts</button><button id="lcpFrom${si}">Copy ${se.vtLines.map(q => q.toUpperCase()).join(' and ')} here</button><span class="hint" id="lcpM${si}">Copies through this test’s VO₂–${u === 'km/h' ? 'speed' : 'power'} regression.</span>` : (S.gas.blank ? '' : '<span class="hint">Copying between lactate and gas thresholds needs a VO₂–intensity regression from at least three stages.</span>');
    if (se.fit) {
      $('#lcpTo' + si).onclick = () => { const done = []; ['lt1', 'lt2'].forEach(q => { const p = ltVal(se, res, q); if (!F(p)) return; se.setVT(q.replace('lt', 'vt'), (p - se.fit.b) / se.fit.m, 'Lactate ' + q.toUpperCase()); done.push(q.toUpperCase()); }); $('#lcpM' + si).textContent = done.length ? `${done.join(' and ')} copied to the gas charts as ${done.map(x => x.replace('L', 'V')).join(' and ')}.` : 'Nothing to copy yet.'; summaries(); vLactate(); };
      $('#lcpFrom' + si).onclick = () => { const done = []; se.vtLines.forEach(q => { const v = se.vt(q); if (!F(v)) return; setLT(se.key, q.replace('vt', 'lt'), Math.round((se.fit.m * v + se.fit.b) * 100) / 100, 'Gas ' + q.toUpperCase()); done.push(q.toUpperCase()); }); summaries(); vLactate(); const m = $('#lcpM' + si); if (m) m.textContent = done.length ? `${done.join(' and ')} copied here.` : 'Nothing to copy yet.'; };
    }
    // the list beside the chart: tick a method to mark its value on the chart
    const sh = lacShown(), found = res.methods.filter(m => F(m.p) && F(m.la));
    $('#lms' + si).innerHTML = found.length ? `<div class="lacms">${found.map(m => `<label class="chk"><input type="checkbox" data-lshow="${esc(m.name)}" ${sh.includes(m.name) ? 'checked' : ''}><span>${m.name}</span><span class="hint">${fx(m.p, dp + 1)} ${u}</span></label>`).join('')}</div><div class="tools"><button data-lall="1">Show all</button><button data-lall="0">Reset to default</button></div>` : '<p class="hint">Enter lactate values first.</p>';
    $$(`#lms${si} [data-lshow]`).forEach(el => (el.onchange = () => { const now = new Set(lacShown()); if (el.checked) now.add(el.dataset.lshow); else now.delete(el.dataset.lshow); lacSet().showM = LT_METHODS.filter(m => now.has(m)); lacMarks.forEach(f => f()); }));
    $$(`#lms${si} [data-lall]`).forEach(b => (b.onclick = () => { if (b.dataset.lall === '1') lacSet().showM = [...LT_METHODS]; else delete lacSet().showM; lacMarks.forEach(f => f()); }));
    // Ticking a box only restyles the marks (no redraw of the tab), and keeps the boxes of every test in step.
    lacMarks[si] = () => { const now = lacShown(); $$(`#lms${si} [data-lshow]`).forEach(el => (el.checked = now.includes(el.dataset.lshow))); if (!res.fit || !gd.data) return; const mk = marks(); Plotly.restyle(gd, { x: [mk.x], y: [mk.y], text: [mk.text], mode: mk.mode, 'marker.color': [mk.color] }, [2]); };
    // every method
    $('#lmT' + si).innerHTML = res.methods.length ? `<thead><tr><th>Method</th><th>Fit</th><th>${u}</th><th>Lactate</th><th>Heart rate</th><th>Use as</th></tr></thead><tbody>${res.methods.map(m => `<tr><td>${m.name}</td><td class="hint">${m.fitting}</td><td>${F(m.p) ? fx(m.p, dp + 1) : '<span class="hint">not found</span>'}</td><td>${F(m.la) ? fx(m.la, m.cat === 'Bsln+' ? 2 : 1) : ''}</td><td>${F(m.hr) ? m.hr : ''}</td><td>${F(m.p) ? `<button data-luse="lt1:${m.p}:${m.name}">LT1</button> <button data-luse="lt2:${m.p}:${m.name}">LT2</button>` : ''}</td></tr>`).join('')}</tbody>` : '<tbody><tr><td class="hint">No methods yet.</td></tr></tbody>';
    $$(`#lmT${si} [data-luse]`).forEach(b => (b.onclick = () => { const [q, v, ...nm] = b.dataset.luse.split(':'); setLT(se.key, q, +v, nm.join(':')); moveLines(ctx); tiles(); summaries(); }));
  }
  // With a resting sample, the x-axis is labelled at each sample and the resting one reads "Baseline" (it is drawn one step before the first stage, where no stage was run).
  function lacTicks(res) { if (!res.fit || !res.hasBase) return {}; const d = res.fit.data, k = Math.ceil((d.length - 1) / 12), keep = d.filter((r, i) => i === 0 || (i - 1) % k === 0); return { tickmode: 'array', tickvals: keep.map(r => r.p), ticktext: keep.map((r, i) => (i === 0 ? 'Baseline' : String(+r.p.toFixed(1)))) }; }
  const trim0 = t => (t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t); // 12.50 → 12.5, but 150 stays 150
  const pace = kmh => { if (!(kmh > 0)) return '–'; const s = Math.round(3600 / kmh); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

