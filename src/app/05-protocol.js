  /* ---------------- Plot helpers ---------------- */
  const CFG = { responsive: true, displaylogo: false, displayModeBar: true, scrollZoom: true, showTips: false, doubleClick: false, modeBarButtons: [['pan2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'resetScale2d']] };
  const FIGCFG = Object.assign({}, CFG, { modeBarButtons: [['resetScale2d']] }); // every figure has a home button that zooms all the way out
  function ax(title, extra) { return Object.assign({ showline: true, linecolor: css('--axis'), linewidth: 1.2, ticks: 'outside', tickcolor: css('--axis'), ticklen: 4, gridcolor: css('--grid'), zeroline: false, automargin: false, tickfont: { color: css('--muted'), size: 11 }, title: { text: title || '', font: { color: css('--fg'), size: 12 } } }, extra || {}); }
  function lay(extra) { return Object.assign({ paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { family: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', color: css('--fg') }, dragmode: 'pan', hovermode: 'closest', margin: { l: 62, r: 16, t: 26, b: 48 }, showlegend: false }, extra || {}); }
  function robustRange(vals) { const v = vals.filter(F); if (!v.length) return undefined; const a = C.quant(v, .01), b = C.quant(v, .99), p = Math.max((b - a) * .1, Math.abs(b) * .01, 1e-3); return [a - p, b + p]; }
  const chips = (keys, sel, attr) => keys.map(k => `<button ${attr}="${k}" aria-pressed="${sel.includes(k)}">${VARS[k].h}</button>`).join('');
  function multiToggle(attr, arr, max, cb) { $$(`[${attr}]`).forEach(b => (b.onclick = () => { const k = b.getAttribute(attr), i = arr.indexOf(k); if (i >= 0) { if (arr.length > 1) arr.splice(i, 1); } else { arr.push(k); if (arr.length > max) arr.shift(); } cb(); })); }

  /* ---------------- Protocol: the whole test, stacked panels on one time axis ---------------- */
  function vProtocol() {
    const set = S.set, av = availVars(), I = S.I, pr = S.proto, Xs = S.D.X, g = S.gas;
    set.view.vars = set.view.vars.filter(k => av.includes(k)); if (!set.view.vars.length) set.view.vars = [av[0]];
    const end = Math.max(g.t.at(-1), I ? I.t.at(-1) : 0) / 60;
    const jumps = [['all', 'Whole test', [0, end]]];
    if (pr.max) { jumps.push(['inc', 'Threshold stages', [pr.inc.t0 / 60 - .5, pr.inc.t1 / 60 + .5]]); jumps.push(['mx', 'VO₂max stages', [pr.max.t0 / 60 - .5, pr.max.t1 / 60 + .5]]); }
    else if (pr.type === 'incremental' && pr.inc) jumps.push(['inc', 'Incremental', [pr.inc.t0 / 60 - .5, pr.inc.t1 / 60 + .5]]);
    pr.tests.forEach((T, i) => { if (pr.type !== 'incremental') jumps.push(['t' + i, L.testName(pr, i), [T.t0 / 60 - 1, T.t1 / 60 + 1]]); });
    if (pr.maot) jumps.push(['m', 'All-out', [pr.maot.t0 / 60 - 3, pr.maot.t1 / 60 + 2]]);
    // Each panel has its own height (set.view.h, by variable; '_int' for the intensity panel), changed by dragging its top or bottom edge.
    set.view.h = set.view.h || {}; const ph = k => set.view.h[k] || 132;
    const vars = set.view.vars, n = vars.length, iPx = I ? (set.view.h._int || 112) : 0, gapPx = 22, sliderPx = 46, topPx = 44, H = topPx + vars.reduce((a, k) => a + ph(k) + gapPx, 0) + iPx + sliderPx + 30;
    const pTops = []; { let yy = topPx; vars.forEach(k => { pTops.push([k, yy]); yy += ph(k) + gapPx; }); if (I) pTops.push(['_int', yy]); }
    const szBtns = pTops.map(([k, top]) => { const h = k === '_int' ? iPx : ph(k), nm = k === '_int' ? iLab() : vlab(k); return `<div class="pgrip" data-pg="${k}:top" style="top:${top - 5}px" title="Drag to change the height of the ${esc(nm)} panel"></div><div class="pgrip" data-pg="${k}:bot" style="top:${top + h - 5}px" title="Drag to change the height of the ${esc(nm)} panel"></div>`; }).join('') + '<div class="pgline" id="pgline"></div>';
    $('#views').innerHTML = `
      <div class="tools"><span>Show (up to 6):</span>${chips(av, vars, 'data-sv')}</div>
      <div class="tools"><span>Averaging:</span><select id="vAvg">${[['raw', S.gas.kind === 'bxb' ? 'Breath by breath' : 'As in file'], ['bin:15', '15-s bins'], ['bin:30', '30-s bins'], ['bin:60', '60-s bins'], ['roll:30', '30-s rolling'], ['custom', 'Custom (under Data processing)']].map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
        <span class="sep"></span><span>Go to:</span>${jumps.map(j => `<button data-j="${j[0]}">${j[1]}</button>`).join('')}<span id="pvInfo"></span></div>
      <div class="tools"><button id="stEdit" aria-pressed="${S._stUnlock ? 'true' : 'false'}" title="Drag the edges of the stages on the chart, or type them in the stage table">Edit stages</button><button id="exBtn" aria-pressed="${S._exMode ? 'true' : 'false'}" title="Then drag across the chart over the data to leave out">Leave out a period</button><span class="hint" id="exHint">${S._exMode ? 'Drag across the chart over the noisy or wrong data. Click the button again when done.' : (set.leaveOut || []).length ? 'Left out:' : 'Noisy or wrong data? Leave that period out of every calculation.'}</span>${(set.leaveOut || []).map(([a, b], i) => `<span class="lochip">${mmss(a)}–${mmss(b)}<button data-lo="${i}" title="Put this period back" aria-label="Put ${mmss(a)} to ${mmss(b)} back">×</button></span>`).join('')}</div>
      ${S._stUnlock ? `<p class="sthint">${I ? `Stages unlocked: drag the edge of a stage in the ${esc(I.label.toLowerCase())} panel to move it. Exact values, rests and new stages go in the stage table under Test details.` : 'Stages unlocked: type the stages in the stage table under Test details.'} <button class="linkbtn" id="stOpen">Open the stage table</button> · <button class="linkbtn" id="stDone">Lock the stages</button></p>` : ''}
      <div class="panel"><div class="readout big" id="cur">Move over the chart to read every variable at one moment.</div>
        <div class="chartwrap" id="cwrap"><div class="chart" id="pv" style="height:${H}px"></div><div class="cursor" id="cline"></div><div class="zshade" id="zshade"></div>${szBtns}</div>
        <div class="readout" id="ro"></div></div>
      <ul class="notes" data-info="pvInfo"><li>Each panel’s height can be changed by dragging its top or bottom edge.</li><li>To correct the stages, click <b>Edit stages</b> and drag the edge of a stage in the ${I ? esc(I.label.toLowerCase()) : 'intensity'} panel, or type the values in the stage table under Test details. Rests between stages are shaded grey.</li><li>To leave out noisy or wrong data, click <b>Leave out a period</b> and drag across the chart over it. The period is dropped from every calculation and chart on every tab, like a removed breath, and is listed in Data checks and the export. Click × on a period to put it back.</li><li>Scroll to zoom, or use the tools at the top right of the chart: with the move tool, drag along time; with the zoom tool, drag across the period you want. You can also drag the handles of the strip under the chart. Each panel rescales to the data in view. The home button or a double-click zooms all the way out. The line under the chart gives the mean ± SD of what is in view.</li>
      ${I ? `<li>Shaded: test stages (blue)${pr.maot ? ', all-out test (red)' : ''}. The ${I.label.toLowerCase()} panel gives each stage’s ${I.label.toLowerCase()}, with RPE and any other COSMED markers above it.</li>` : ''}</ul>`;
    multiToggle('data-sv', vars, 6, () => vProtocol());
    const curAvg = set.avg.mode === 'raw' ? 'raw' : set.avg.mode + ':' + avgParOf(set);
    const sel = $('#vAvg'); sel.value = [...sel.options].some(o => o.value === curAvg) ? curAvg : 'custom';
    sel.onchange = () => { const v = sel.value; if (v === 'custom') { $('#qBox').open = true; return; } const [m, p] = v.split(':'); set.avg.mode = m; if (m === 'bin') set.avg.bin = Math.max(+p, g.kind === 'avg' ? g.avgWidth : 1); if (m === 'roll') set.avg.roll = +p; buildProc(); recompute(); };

    const totalPlot = H - topPx - sliderPx - 30, toDom = px => px / H; // paper fractions; the slider and x axis sit below y = 0 via margin
    const gapX = Math.max(g.kind === 'bxb' ? 20 : 1.5 * (g.avgWidth || 15), 1.5 * (Xs.width || 0), set.avg.mode === 'bin' ? 1.5 * set.avg.bin : 0);
    const tr = [], layH = totalPlot, L2 = lay({ margin: { l: 66, r: 18, t: topPx, b: sliderPx + 30 }, hovermode: false, shapes: [], annotations: [] }), series = {};
    const showRaw = set.avg.mode !== 'raw', rawSize = g.kind === 'bxb' ? 3 : 5, rawOp = g.kind === 'bxb' ? .22 : .45;
    let y = layH;
    vars.forEach((k, j) => {
      const panelPx = ph(k), yax = 'y' + (j ? j + 1 : ''), dom = [(y - panelPx) / layH, y / layH]; y -= panelPx + gapPx;
      const Xp = [], Yp = []; Xs.t.forEach((t, i) => { if (i && t - Xs.t[i - 1] > gapX) { Xp.push(null); Yp.push(null); } Xp.push(t / 60); Yp.push(Xs.v[k][i]); });
      series[j] = { k, x: Xp, y: Yp };
      if (showRaw && S.D.R0.v[k]) { const R = S.D.R0; tr.push({ x: R.t.map(t => t / 60), y: R.v[k], xaxis: 'x', yaxis: yax, type: 'scattergl', mode: 'markers', marker: { color: css('--rf'), size: rawSize, opacity: rawOp }, hoverinfo: 'skip' }); }
      tr.push({ x: Xp, y: Yp, xaxis: 'x', yaxis: yax, type: 'scattergl', mode: set.avg.mode === 'raw' ? 'markers' : 'lines', connectgaps: false, marker: { color: css('--ma'), size: 4 }, line: { color: css('--ma'), width: 2 }, hoverinfo: 'skip' });
      if (set.outl.show && !set.outl.remove && set.outl.local && g.v[k]) { const fl = S.D.fl.flag, a = []; for (let i = 0; i < g.t.length; i++) if ((fl[i] === 1 || fl[i] === 2) && F(g.v[k][i])) a.push(i); tr.push({ x: a.map(i => g.t[i] / 60), y: a.map(i => g.v[k][i]), xaxis: 'x', yaxis: yax, type: 'scattergl', mode: 'markers', marker: { color: css('--accent'), size: 8, symbol: 'x' }, hoverinfo: 'skip' }); }
      L2[yax.replace('y', 'yaxis')] = ax(vlab(k), { domain: dom, anchor: 'x', fixedrange: true, title: { text: vlab(k), font: { size: 11, color: css('--fg') }, standoff: 6 } });
      panelBox(yax, j);
    });
    const iax = 'y' + (n + 1);
    // Each panel gets its own framed, lightly tinted box so neighbouring variables are easy to tell apart.
    function panelBox(ya, j) { L2.shapes.push({ type: 'rect', xref: 'paper', yref: ya + ' domain', x0: 0, x1: 1, y0: 0, y1: 1, fillcolor: j % 2 ? 'rgba(0,0,0,0)' : css('--panelalt'), line: { color: css('--line'), width: 1 }, layer: 'below' }); }
    if (I) panelBox(iax, n);
    if (I) {
      const ch = []; for (let i = 0; i < I.t.length; i++) if (i === 0 || I.p[i] !== I.p[i - 1] || i === I.t.length - 1) ch.push(i);
      tr.push({ x: ch.map(i => I.t[i] / 60), y: ch.map(i => I.p[i]), xaxis: 'x', yaxis: iax, type: 'scatter', mode: 'lines', line: { shape: 'hv', color: css('--power'), width: 1.5 }, fill: 'tozeroy', fillcolor: css('--powerfill'), hoverinfo: 'skip' });
      const top = C.quant(I.p.filter(F), .995) * 1.35 || 1;
      L2['yaxis' + (n + 1)] = ax(iLab(), { domain: [0, iPx / layH], anchor: 'x', fixedrange: true, range: [0, top], title: { text: iLab(), font: { size: 11, color: css('--fg') }, standoff: 6 } });
      // Annotations rather than a text trace, so the markers stay out of the overview strip.
      (g.markers || []).filter(m => m.text !== '').forEach(m => { const v = parseFloat(String(m.text).replace(',', '.')), isR = F(v) && v >= 6 && v <= 20; L2.annotations.push({ xref: 'x', yref: iax, x: m.t / 60, y: top * .95, showarrow: false, text: (isR ? 'RPE ' : '') + esc(m.text), font: { size: 10, color: css('--muted') } }); });
      // The value of each stage or steady block, just under its line.
      pr.plateaus.filter(q => q.dur >= 45 && q.p > (I.unit === 'W' ? 20 : 2)).forEach(q => L2.annotations.push({ xref: 'x', yref: iax, x: (q.t0 + q.t1) / 120, y: q.p, yanchor: 'top', showarrow: false, text: q.p.toFixed(iDp()), font: { size: 10, color: css('--fg') } }));
    }
    (set.leaveOut || []).forEach(([a, b]) => { L2.shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: a / 60, x1: b / 60, y0: 0, y1: 1, fillcolor: css('--leftout'), line: { color: css('--warn'), width: 1, dash: 'dot' }, layer: 'above' }); L2.annotations.push({ xref: 'x', yref: 'paper', x: (a + b) / 120, y: 1, yanchor: 'bottom', showarrow: false, text: 'left out', font: { size: 10, color: css('--warn') } }); });
    // Rests between stages (left out of the threshold analysis unless kept), lightly shaded.
    if (pr.type === 'incremental' && pr.inc && pr.inc.rests) pr.inc.rests.forEach(([a, b]) => L2.shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: a / 60, x1: b / 60, y0: 0, y1: 1, fillcolor: css('--restfill'), line: { width: 0 }, layer: 'above' }));
    // Stage edges to drag while the stages are unlocked.
    const edges = [];
    if (S._stUnlock && I) {
      const rows = stageList();
      rows.forEach((q, i) => { const e = q.t0 + q.dur, nx = rows[i + 1], prev = rows[i - 1];
        if (!prev || Math.abs(prev.t0 + prev.dur - q.t0) > 1) edges.push({ x: q.t0, a: null, b: i });
        edges.push({ x: e, a: i, b: nx && Math.abs(nx.t0 - e) <= 1 ? i + 1 : null }); });
      edges.forEach(e => { e.k = L2.shapes.length; L2.shapes.push({ type: 'line', xref: 'x', yref: iax + ' domain', x0: e.x / 60, x1: e.x / 60, y0: 0, y1: 1, line: { color: css('--accent'), width: 2 }, layer: 'above' }); });
    }
    pr.phases.forEach(q => {
      if (q.kind === 'test' || q.kind === 'allout') L2.shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: q.t0 / 60, x1: q.t1 / 60, y0: 0, y1: 1, fillcolor: css(q.kind === 'test' ? '--test' : '--maot'), line: { width: 0 }, layer: 'below' });
      L2.annotations.push({ xref: 'x', yref: 'paper', x: (q.t0 + q.t1) / 120, y: 1, yanchor: 'bottom', showarrow: false, text: q.label, font: { size: 10, color: css('--muted') } });
    });
    L2.xaxis = ax('Time (min)', { anchor: I ? iax : 'y' + (n ? (n > 1 ? n : '') : ''), range: [0, end], rangeslider: { visible: true, thickness: 34 / H, bgcolor: css('--bg'), bordercolor: css('--line'), borderwidth: 1, range: [0, end] }, title: { text: 'Time (min)', font: { size: 12, color: css('--fg') }, standoff: 2 } });
    const gd = document.getElementById('pv');
    Plotly.newPlot(gd, tr, L2, CFG);
    gd.addEventListener('click', e => { if (e.detail > 1) setX([0, end]); });
    let busy = false, X0 = [0, end];
    function fit(x0, x1) { const up = {}; Object.values(series).forEach((s, j) => { const v = []; s.x.forEach((x, i) => { if (x !== null && x >= x0 && x <= x1 && F(s.y[i])) v.push(s.y[i]); }); const r = robustRange(v); if (r) up['yaxis' + (j ? j + 1 : '') + '.range'] = r; }); return up; }
    function readout(x0, x1) { $('#ro').textContent = `In view, ${x0.toFixed(1)}–${x1.toFixed(1)} min: ` + vars.map((k, j) => { const s = series[j], v = s.y.filter((q, i) => s.x[i] !== null && s.x[i] >= x0 && s.x[i] <= x1 && F(q)); return `${VARS[k].l} ${fx(C.mean(v), VARS[k].dp)} ± ${fx(C.sd(v), VARS[k].dp)}`; }).join(' · '); }
    function setX(r) { X0 = r.slice(); busy = true; Plotly.relayout(gd, Object.assign({ 'xaxis.range': r.slice() }, fit(r[0], r[1]))).then(() => { setTimeout(() => (busy = false), 0); }); readout(r[0], r[1]); }
    Plotly.relayout(gd, fit(0, end)); readout(0, end);
    const showMode = () => { gd.classList.remove('m-pan', 'm-zoom'); gd.classList.add(gd._fullLayout.dragmode === 'zoom' ? 'm-zoom' : 'm-pan'); }; showMode();
    gd.on('plotly_relayout', e => { showMode(); if (busy) return; let a = e['xaxis.range[0]'], b = e['xaxis.range[1]']; if (e['xaxis.range']) [a, b] = e['xaxis.range']; if (e['xaxis.autorange']) { a = 0; b = end; } if (a === undefined) return; X0 = [+a, +b]; busy = true; Plotly.relayout(gd, fit(+a, +b)).then(() => setTimeout(() => (busy = false), 0)); readout(+a, +b); });
    $$('[data-j]').forEach(b => (b.onclick = () => setX(jumps.find(j => j[0] === b.dataset.j)[2])));
    // Panel heights: drag a panel's top or bottom edge; a line shows the new edge until the button is let go.
    const pgl = $('#pgline');
    // Live resizing: the chart's height and each panel's share are recomputed and applied while the edge is dragged.
    function resizePanels() {
      const iP = I ? (set.view.h._int || 112) : 0, H2 = topPx + vars.reduce((a, k) => a + ph(k) + gapPx, 0) + iP + sliderPx + 30, lay2 = H2 - topPx - sliderPx - 30, up = { height: H2, 'xaxis.rangeslider.thickness': 34 / H2 };
      let yy = lay2, tp = topPx; const tops = [];
      vars.forEach((k, j) => { up[(j ? 'yaxis' + (j + 1) : 'yaxis') + '.domain'] = [(yy - ph(k)) / lay2, yy / lay2]; yy -= ph(k) + gapPx; tops.push([k, tp, ph(k)]); tp += ph(k) + gapPx; });
      if (I) { up['yaxis' + (n + 1) + '.domain'] = [0, iP / lay2]; tops.push(['_int', tp, iP]); }
      gd.style.height = H2 + 'px'; Plotly.relayout(gd, up).then(placeGrips);
    }
    // Grips sit on each panel's real edges, read from the drawn chart (the range slider takes some height, so the planned sizes are not exact).
    function placeGrips() {
      const fl = gd._fullLayout; if (!fl) return;
      [...vars.map((k, j) => [k, j ? 'yaxis' + (j + 1) : 'yaxis']), ...(I ? [['_int', 'yaxis' + (n + 1)]] : [])].forEach(([k, a]) => {
        const y = fl[a]; if (!y) return; const t = $(`[data-pg="${k}:top"]`), b = $(`[data-pg="${k}:bot"]`);
        if (t) t.style.top = y._offset - 5 + 'px'; if (b) b.style.top = y._offset + y._length - 5 + 'px';
      });
    }
    placeGrips();
    $$('[data-pg]').forEach(gr => (gr.onmousedown = ev => {
      if (ev.button) return; ev.preventDefault(); ev.stopPropagation();
      const [k, edge] = gr.dataset.pg.split(':'), h0 = k === '_int' ? iPx : ph(k), y0 = ev.clientY, top0 = parseFloat(gr.style.top) + 5; let h = h0;
      let raf = 0; void top0; void pgl;
      const mm = e => { if (!e.buttons) return mu(); const d = e.clientY - y0; h = Math.round(Math.max(70, Math.min(700, edge === 'bot' ? h0 + d : h0 - d))); set.view.h[k] = h; if (!raf) raf = requestAnimationFrame(() => { raf = 0; resizePanels(); }); };
      const mu = () => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); window.removeEventListener('blur', mu); if (raf) { cancelAnimationFrame(raf); raf = 0; } resizePanels(); };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true); window.addEventListener('blur', mu);
    }));
    // Editing stages: the button unlocks the stage table; while it is unlocked, a stage's edge can be dragged in the intensity panel.
    const keepX = () => { S._pvX = gd._fullLayout.xaxis.range.slice(); };
    $('#stEdit').onclick = () => { S._stUnlock = !S._stUnlock; S._exMode = false; S._stMsg = ''; keepX(); if (S._stUnlock) openFolds.add('dstg'); buildDetails(); vProtocol(); };
    if ($('#stDone')) $('#stDone').onclick = () => { S._stUnlock = false; keepX(); buildDetails(); vProtocol(); };
    if ($('#stOpen')) $('#stOpen').onclick = () => { $('#dBox').open = true; const d = $('details[data-fold=dstg]'); if (d) { d.open = true; d.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
    if (edges.length) {
      const ia = () => gd._fullLayout['yaxis' + (n + 1)], near = (px, py) => { const xa = gd._fullLayout.xaxis, ya = ia(); if (!ya || py < ya._offset - 4 || py > ya._offset + ya._length + 4) return null; let best = null, d = 7; edges.forEach(e => { const q = Math.abs(xa.l2p(e.x / 60) + xa._offset - px); if (q < d) { d = q; best = e; } }); return best; };
      const wrap = $('#cwrap');
      wrap.addEventListener('mousemove', ev => { if (ev.buttons) return; const r = gd.getBoundingClientRect(); wrap.style.cursor = near(ev.clientX - r.left, ev.clientY - r.top) ? 'ew-resize' : ''; });
      wrap.addEventListener('mousedown', ev => {
        if (ev.button || S._exMode) return; const r = gd.getBoundingClientRect(), e = near(ev.clientX - r.left, ev.clientY - r.top); if (!e) return;
        ev.preventDefault(); ev.stopPropagation();
        const rows = stageList(), xa = gd._fullLayout.xaxis, lo = e.a !== null ? rows[e.a].t0 + 5 : e.b !== null && e.b > 0 ? rows[e.b - 1].t0 + rows[e.b - 1].dur : 0, hi = e.b !== null ? rows[e.b].t0 + rows[e.b].dur - 5 : rows[e.a + 1] ? rows[e.a + 1].t0 : Infinity;
        let x = e.x, raf = 0;
        const mm = m => { if (!m.buttons) return mu(); x = Math.round(Math.max(lo, Math.min(hi, xa.p2l(m.clientX - r.left - xa._offset) * 60))); if (!raf) raf = requestAnimationFrame(() => { raf = 0; Plotly.relayout(gd, { [`shapes[${e.k}].x0`]: x / 60, [`shapes[${e.k}].x1`]: x / 60 }); $('#cur').textContent = `Stage edge at ${mmss(x)}`; }); };
        const mu = () => {
          window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); window.removeEventListener('blur', mu); if (raf) cancelAnimationFrame(raf);
          if (Math.abs(x - e.x) < 0.5) return;
          if (e.a !== null) rows[e.a].dur = +(x - rows[e.a].t0).toFixed(1);
          if (e.b !== null) { const end = rows[e.b].t0 + rows[e.b].dur; rows[e.b].t0 = x; rows[e.b].dur = +(end - x).toFixed(1); }
          keepX(); setStages(rows, `Stage edge moved to ${mmss(x)}.`);
        };
        window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true); window.addEventListener('blur', mu);
      }, true);
    }
    // Leaving out a period: while the button is on, a drag across the chart marks the period instead of zooming or moving.
    $('#exBtn').onclick = () => { S._exMode = !S._exMode; if (S._exMode) S._stUnlock = false; S._pvX = gd._fullLayout.xaxis.range.slice(); vProtocol(); };
    $$('[data-lo]').forEach(b => (b.onclick = () => { set.leaveOut.splice(+b.dataset.lo, 1); S._pvX = gd._fullLayout.xaxis.range.slice(); recompute(); }));
    if (S._exMode) gd.classList.add('m-ex');
    $('#cwrap').addEventListener('mousedown', ev => {
      if (!S._exMode || ev.button || ev.target.closest('.pgrip,.modebar')) return;
      const fl = gd._fullLayout, xa = fl.xaxis, box = gd.getBoundingClientRect(), x0 = ev.clientX - box.left, y0 = ev.clientY - box.top, top = fl.margin.t, h = fl.height - fl.margin.t - fl.margin.b - 40;
      if (x0 < xa._offset || x0 > xa._offset + xa._length || y0 < top || y0 > top + h) return; ev.preventDefault(); ev.stopPropagation();
      const clamp = x => Math.max(xa._offset, Math.min(xa._offset + xa._length, x)), sh = $('#zshade'); let x1 = x0;
      sh.classList.add('ex');
      const mm = e => { if (!e.buttons) return mu(); x1 = clamp(e.clientX - box.left); sh.style.display = 'block'; sh.style.left = Math.min(x1, x0) + 'px'; sh.style.width = Math.abs(x1 - x0) + 'px'; sh.style.top = top + 'px'; sh.style.height = h + 'px'; };
      const mu = () => {
        sh.style.display = 'none'; sh.classList.remove('ex'); window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); window.removeEventListener('blur', mu);
        if (Math.abs(x1 - x0) < 3) return; const a = Math.round(xa.p2l(Math.min(x0, x1) - xa._offset) * 60), b = Math.round(xa.p2l(Math.max(x0, x1) - xa._offset) * 60);
        set.leaveOut = (set.leaveOut || []).concat([[Math.max(0, a), b]]).sort((p, q) => p[0] - q[0]); S._pvX = gd._fullLayout.xaxis.range.slice(); recompute();
      };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true); window.addEventListener('blur', mu);
    }, true);
    if (S._pvX) { const r = S._pvX; S._pvX = null; setX(r); }
    // Zoom tool: a light shade over the period being selected.
    const shade = $('#zshade');
    $('#cwrap').addEventListener('mousedown', ev => {
      if (gd._fullLayout.dragmode !== 'zoom' || ev.button) return;
      const fl = gd._fullLayout, xa = fl.xaxis, box = gd.getBoundingClientRect(), x0 = ev.clientX - box.left, y0 = ev.clientY - box.top, top = fl.margin.t, h = fl.height - fl.margin.t - fl.margin.b;
      if (x0 < xa._offset || x0 > xa._offset + xa._length || y0 < top || y0 > top + h) return;
      const clamp = x => Math.max(xa._offset, Math.min(xa._offset + xa._length, x));
      const mm = e => { if (!e.buttons) return mu(); const x = clamp(e.clientX - box.left); shade.style.display = 'block'; shade.style.left = Math.min(x, x0) + 'px'; shade.style.width = Math.abs(x - x0) + 'px'; shade.style.top = top + 'px'; shade.style.height = h + 'px'; };
      const mu = () => { shade.style.display = 'none'; window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); window.removeEventListener('blur', mu); };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true); window.addEventListener('blur', mu);
    }, true);
    // Cursor: a line across all panels and one reading of every variable.
    const line = $('#cline'), wrap = $('#cwrap'), cur = $('#cur');
    wrap.onmousemove = ev => {
      const xa = gd._fullLayout.xaxis, r = wrap.getBoundingClientRect(), px = ev.clientX - r.left - xa._offset; if (px < 0 || px > xa._length) { line.style.display = 'none'; return; }
      const ya = gd._fullLayout.margin.t, x = xa.p2l(px); line.style.display = 'block'; line.style.left = (ev.clientX - r.left) + 'px'; line.style.top = ya + 'px'; line.style.height = (gd._fullLayout.height - gd._fullLayout.margin.t - gd._fullLayout.margin.b) + 'px';
      const parts = vars.map((k, j) => { const s = series[j]; let best = null, d = Infinity; const a = bisect(s.x.map(q => (q === null ? -1 : q)), x); for (let i = Math.max(0, a - 2); i < Math.min(s.x.length, a + 2); i++) if (s.x[i] !== null) { const q = Math.abs(s.x[i] - x); if (q < d) { d = q; best = s.y[i]; } } return `${VARS[k].l} ${d < 0.6 ? fx(best, VARS[k].dp) : '–'}`; });
      if (I) parts.push(`${I.label} ${iVal(C.loadAt(I, x * 60))}`);
      cur.textContent = `${mmss(x * 60)} · ` + parts.join(' · ');
    };
    wrap.onmouseleave = () => { line.style.display = 'none'; };
  }

  // Time of an incremental VT line: the time it was dragged to on a time chart, if that still gives its VO₂;
  // otherwise the first time the smoothed, never-falling VO₂ reaches it.
  const vtTime = (M, v, q) => { const h = (S.picks.incT || {})[q]; return F(h) && Math.abs(M.vo2At(h) - v) < 0.0011 ? h : M.tOf(v); };
