  /* ---------------- Threshold charts ---------------- */
  // ctx: { lines: ['vt1','vt2'], get(q) -> VO2, set(q, VO2), toX(VO2, key), fromX(x, key), pts: {t, v}, live(), done(), charts: [] }
  const vtColor = q => css(q.endsWith('1') ? '--vt1' : '--vt2');
  const vtName = q => q.toUpperCase();
  const seriesColors = () => [css('--ma'), css('--t2')];
  function vtChart(id, ctx, spec) {
    const gd = document.getElementById(id), pts = ctx.pts, xv = spec.x === 't' ? pts.t.map(t => t / 60) : pts.v[spec.x], tr = [], colors = seriesColors(), ally = [];
    spec.y.forEach((k, i) => {
      const y = pts.v[k]; if (!y) return; ally.push(...y.filter(F));
      tr.push({ x: xv, y, type: xv.length > 1500 ? 'scattergl' : 'scatter', mode: 'markers', marker: { color: colors[i], size: 6, opacity: .75 }, name: VARS[k].l, hovertemplate: `${spec.x === 't' ? '%{x:.1f} min' : '%{x:.2f} L/min'}<br>${VARS[k].l} %{y:.${VARS[k].dp}f}<extra></extra>` });
    });
    const xr0 = xv.filter(F), pad = (Math.max(...xr0) - Math.min(...xr0)) * .03, xr = [Math.min(...xr0) - pad, Math.max(...xr0) + pad];
    const xTitle = { vo2: 'VO<sub>2</sub> (L/min)', vco2: 'VCO<sub>2</sub> (L/min)', t: 'Time (min)' }[spec.x];
    const LL = lay({ margin: { l: 58, r: 12, t: 22, b: 44 }, xaxis: ax(xTitle, { range: xr }), yaxis: ax(spec.yTitle, { range: robustRange(ally) }) });
    Plotly.newPlot(gd, tr, LL, FIGCFG);
    gd.addEventListener('click', e => { if (e.detail > 1) Plotly.relayout(gd, { 'xaxis.range': xr, 'yaxis.range': LL.yaxis.range }); });
    attachVT(gd, ctx, Object.assign({ xv }, spec));
    if (spec.fit) { // each figure has its own fitted-lines button
      const entry = ctx.charts.at(-1), head = gd.closest('.panel').querySelector('h3'), btn = document.createElement('button');
      btn.className = 'fitbtn'; btn.textContent = 'Fitted lines'; btn.setAttribute('aria-pressed', !!S.set.fits[id]);
      btn.onclick = () => { S.set.fits[id] = !S.set.fits[id]; btn.setAttribute('aria-pressed', S.set.fits[id]); drawOverlay(ctx, entry); };
      head.appendChild(btn);
    }
  }
  // The threshold lines and fitted lines are drawn on a thin layer over the chart, so they follow the cursor at full speed while dragging.
  function attachVT(gd, ctx, spec) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'vtov'); gd.style.position = 'relative'; gd.appendChild(svg);
    const entry = { gd, spec, svg, id: gd.id, clip: 'vc' + Math.random().toString(36).slice(2, 9) }; ctx.charts.push(entry);
    const redraw = () => drawOverlay(ctx, entry);
    gd.on('plotly_afterplot', redraw); gd.on('plotly_relayouting', redraw); redraw();
    const near = ev => { const xa = gd._fullLayout.xaxis, ya = gd._fullLayout.yaxis, r = gd.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top; if (py < ya._offset - 18 || py > ya._offset + ya._length) return null; let hit = null, bd = 9; ctx.lines.forEach(q => { const v = ctx.get(q); if (!F(v)) return; const d = Math.abs(xa.l2p(ctx.toX(v, spec.x)) + xa._offset - px); if (d < bd) { bd = d; hit = q; } }); return hit; };
    gd.addEventListener('mousemove', ev => { const c = near(ev) ? 'ew-resize' : ''; gd.style.cursor = c; const el = gd.querySelector('.nsewdrag'); if (el) el.style.cursor = c; }, true);
    gd.addEventListener('mousedown', ev => {
      const q = near(ev); if (!q) return; ev.stopPropagation(); ev.preventDefault();
      const r = gd.getBoundingClientRect(); let raf = 0;
      const mm = e => { if (!e.buttons) return mu(); const xa = gd._fullLayout.xaxis; let x = xa.p2l(e.clientX - r.left - xa._offset); x = Math.max(xa.range[0], Math.min(xa.range[1], x)); ctx.set(q, ctx.fromX(x, spec.x), x, spec.x); if (!raf) raf = requestAnimationFrame(() => { raf = 0; moveLines(ctx); ctx.live(); }); };
      const mu = () => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); window.removeEventListener('blur', mu); moveLines(ctx); ctx.done(); };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true); window.addEventListener('blur', mu);
    }, true);
  }
  function drawOverlay(ctx, c) {
    const fl = c.gd._fullLayout; if (!fl || !fl.xaxis || !fl.yaxis) return;
    const xa = fl.xaxis, ya = fl.yaxis, l = xa._offset, t = ya._offset, w = xa._length, h = ya._length, px = x => l + xa.l2p(x), py = y => t + ya.l2p(y), sp = c.spec, colors = seriesColors();
    let out = `<defs><clipPath id="${c.clip}"><rect x="${l}" y="${t}" width="${w}" height="${h}"></rect></clipPath></defs>`;
    if (S.set.fits[c.id] && sp.fit) {
      const knots = ctx.lines.map(q => { const v = ctx.get(q); return F(v) ? ctx.toX(v, sp.x, q) : NaN; });
      sp.y.forEach((k, i) => { const f = L.piecewise(sp.xv, ctx.pts.v[k], knots); if (f) out += `<polyline class="fit" clip-path="url(#${c.clip})" fill="none" stroke="${sp.y.length > 1 ? colors[i] : css('--fg')}" stroke-width="2" points="${f.x.map((x, j) => px(x).toFixed(1) + ',' + py(f.y[j]).toFixed(1)).join(' ')}"></polyline>`; });
    }
    ctx.lines.forEach(q => {
      const v = ctx.get(q), x = F(v) ? ctx.toX(v, sp.x, q) : NaN; if (!F(x)) return;
      const X = px(x); if (X < l - 1 || X > l + w + 1) return;
      out += `<line data-q="${q}" data-x="${x}" x1="${X.toFixed(1)}" x2="${X.toFixed(1)}" y1="${t}" y2="${t + h}" stroke="${vtColor(q)}" stroke-width="2.5"></line><text x="${X.toFixed(1)}" y="${t - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="${vtColor(q)}">${vtName(q)}</text>`;
    });
    c.svg.innerHTML = out;
  }
  function moveLines(ctx) { ctx.charts.forEach(c => drawOverlay(ctx, c)); }

