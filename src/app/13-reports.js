  /* ---------------- Word reports ----------------
     Client report: the clinic template, in everyday language, for incremental tests. Research report: results, stages, thresholds, figures and methods. */
  const DX = window.LabDocx;
  const repInfo = () => { const r = S.meta.rep = Object.assign({ title: (() => { try { return localStorage.getItem('labcpet.reptitle') || 'Exercise test report'; } catch (e) { return 'Exercise test report'; } })(), src: null, dob: '', height: '', protocol: '' }, S.meta.rep || {}); if (r.tester === undefined) { try { r.tester = localStorage.getItem('labcpet.tester') || ''; } catch (e) { r.tester = ''; } } if (!r.height && S.gas.meta && F(S.gas.meta.height)) r.height = String(S.gas.meta.height); return r; };
  // A picture of a Plotly chart, drawn off screen in print colours.
  async function figPNG(traces, layout, w, h) {
    const div = document.createElement('div'); div.style.cssText = `position:fixed;left:-10000px;top:0;width:${w}px;height:${h}px`; document.body.appendChild(div);
    const base = { paper_bgcolor: '#fff', plot_bgcolor: '#fff', font: { family: 'Open Sans, Arial, sans-serif', size: 14, color: '#000' }, margin: { l: 64, r: 16, t: 28, b: 56 }, showlegend: false };
    const axis = (t, extra) => Object.assign({ title: { text: t, font: { size: 15 } }, showline: true, linecolor: '#000', ticks: 'outside', gridcolor: '#e6e6e6', zeroline: false, mirror: false }, extra || {});
    await Plotly.newPlot(div, traces, Object.assign(base, layout(axis), { width: w, height: h }), { staticPlot: true });
    const url = await Plotly.toImage(div, { format: 'png', width: w, height: h, scale: 2 }); Plotly.purge(div); div.remove();
    const bin = atob(url.split(',')[1]), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
  }
  async function lactateFigure(se, res, w = 600, h = 400) {
    const I = S.I, isRun = I.unit !== 'W', d = res.fit.data, shapes = [], ann = [];
    ['lt1', 'lt2'].forEach(q => { const p = ltVal(se, res, q); if (!F(p)) return; shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: p, x1: p, y0: 0, y1: 1, line: { color: '#E8323C', width: 2, dash: 'dash' } }); ann.push({ xref: 'x', yref: 'paper', x: p, y: 1.02, yanchor: 'bottom', showarrow: false, text: q.toUpperCase(), font: { color: '#E8323C', size: 14 } }); });
    if (res.hasBase) ann.push({ x: d[0].p, y: d[0].la, text: 'Baseline', showarrow: true, arrowhead: 2, ax: 0, ay: -40, font: { size: 13 } });
    const pts = ['lt1', 'lt2'].map(q => ltVal(se, res, q)).filter(F);
    return figPNG([{ x: res.fit.x, y: res.fit.y, mode: 'lines', line: { color: '#E8336D', width: 2.5 } }, { x: d.map(r => r.p), y: d.map(r => r.la), mode: 'markers', marker: { size: 11, color: '#fff', line: { color: '#000', width: 1.5 } } }, { x: pts, y: pts.map(p => res.fit.model.predict(p)), mode: 'markers', marker: { size: 10, color: '#555' } }],
      ax => ({ xaxis: ax(isRun ? 'Running speed (km/h)' : 'Power (W)'), yaxis: ax('Lactate (mmol/L)', { rangemode: 'tozero' }), shapes, annotations: ann, margin: { l: 64, r: 16, t: 36, b: 56 } }), w, h);
  }
  // Ventilatory equivalents against time with the VT lines, for reports without lactate and for the research report.
  async function gasFigure(w = 600, h = 380) {
    const D = S.D.inc, X = S.D.X, M = D.map, lo = D.t0, hi = S.proto.max ? S.proto.max.t1 : D.t1, ids = X.t.map((t, i) => i).filter(i => X.t[i] >= lo - 60 && X.t[i] <= hi + 30), shapes = [], ann = [];
    ['vt1', 'vt2'].forEach(q => { const v = incVT(q); if (!F(v)) return; const t = vtTime(M, v, q) / 60; shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: t, x1: t, y0: 0, y1: 1, line: { color: '#E8323C', width: 2, dash: 'dash' } }); ann.push({ xref: 'x', yref: 'paper', x: t, y: 1.02, yanchor: 'bottom', showarrow: false, text: q.toUpperCase(), font: { color: '#E8323C', size: 14 } }); });
    const tr = [['eqo2', '#1F3864', 'VE/VO₂'], ['eqco2', '#E8336D', 'VE/VCO₂']].filter(([k]) => X.v[k]).map(([k, c, n]) => ({ x: ids.map(i => X.t[i] / 60), y: ids.map(i => X.v[k][i]), mode: 'markers', marker: { size: 6, color: c }, name: n }));
    return figPNG(tr, ax => ({ showlegend: true, legend: { x: 0.01, y: 0.99, bgcolor: 'rgba(255,255,255,.8)' }, xaxis: ax('Time (min)'), yaxis: ax('Ventilatory equivalent'), shapes, annotations: ann, margin: { l: 64, r: 16, t: 36, b: 56 } }), w, h);
  }
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
  const interpAt = (xs, ys, x) => { const P = xs.map((v, i) => [v, ys[i]]).filter(q => F(q[0]) && F(q[1])).sort((a, b) => a[0] - b[0]); if (P.length < 2 || !F(x)) return NaN; if (x <= P[0][0]) return P[0][1]; if (x >= P.at(-1)[0]) return P.at(-1)[1]; for (let i = 1; i < P.length; i++) if (x <= P[i][0]) return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return NaN; };
  function protocolText() {
    const pr = S.proto, I = S.I; if (!I || !pr.inc || pr.inc.none) return '';
    const st = pr.inc.stages, u = I.unit, dur = st.map(q => Math.round(q.dur / 60)), inc = st.length > 1 ? +C.median(st.slice(1).map((q, i) => q.p - st[i].p)).toFixed(2) : NaN, long = Math.round(C.median(st.filter(q => q.full).map(q => q.dur)) / 60) || Math.round(st[0].dur / 60);
    const shortI = st.findIndex((q, i) => i > 0 && q.full && q.dur < 0.8 * st[0].dur);
    let a = shortI > 0 ? `${long} min stages, then ${Math.round(st[shortI].dur / 60)} min stages from ${st[shortI].p} ${u}` : `${long} min stages`;
    if (pr.max) a = `${long} min stages, then a VO₂max test of ${Math.round(pr.max.stages[0].dur / 60)} min stages`;
    const g = S.gas.aux && S.gas.aux.grade ? C.quant(S.gas.aux.grade.filter(F), 0.5) : NaN; void dur;
    return a + '\n' + (F(inc) ? `${inc} ${u} increments` : '') + (I.mode === 'treadmill' && F(g) ? `, ${+g.toFixed(1)}% gradient` : '');
  }
  function clientData() {
    const pr = S.proto, I = S.I, D = S.D.inc, rep = repInfo(), se = lacSeries()[0], res = se ? lacAnalyse(se) : null, isRun = I.unit !== 'W';
    const hasLac = !!(res && res.fit), src = rep.src === 'gas' || !hasLac ? 'gas' : 'lactate';
    const rows = se ? lacRows(se) : { base: {}, rows: [] };
    const thr = ['1', '2'].map(n => { const p = src === 'lactate' ? ltVal(se, res, 'lt' + n) : (() => { const v = incVT('vt' + n); return F(v) && D.fit ? D.fit.m * v + D.fit.b : NaN; })(); return p; });
    const stRows = rows.rows.filter(r => r.extra === undefined), hrP = stRows.filter(r => F(r.hr)).map(r => r.stageP), hrV = stRows.filter(r => F(r.hr)).map(r => r.hr);
    const lin = hrP.length >= 2 ? C.linreg(hrP, hrV) : null, hrAt = p => (lin && F(p) ? lin.m * p + lin.b : NaN), rpeAt = p => interpAt(stRows.map(r => r.stageP), stRows.map(r => r.rpe), p);
    const st = pr.max ? pr.max.stages : pr.inc.stages, last = st.at(-1), full = st.filter(q => q.full).length, partial = last && !last.full;
    const maxRows = pr.max ? pr.max.stages.map((q, i) => ({ stageP: q.p, part: !q.full, hr: D.maxValues[i] ? Math.round(D.maxValues[i].m.hr) : NaN, rpe: D.maxRpe[i], la: NaN })) : [];
    return { pr, I, D, rep, se, res, isRun, src, hasLac, rows, stRows, maxRows, thr, hrAt, rpeAt, full, partial, last, st, maxHr: D.peak.hr ? D.peak.hr.value : NaN };
  }
  async function clientReport() {
    const c = clientData(), { I, D, rep, isRun, thr } = c, u = I.unit, dp = isRun ? 1 : 0, doc = DX.doc(), B = doc.body, red = 'EE0000';
    const v = (x, d) => (F(x) ? (+x).toFixed(d) : '–'), lab = (t) => ({ text: t, color: '7F7F7F', sz: 9, jc: 'left' });
    B.push(DX.title(rep.title || 'Exercise test report'));
    const cell = (label, value, o = {}) => ({ lines: [label, ...String(value ?? '').split('\n')], color: '7F7F7F', subColor: '000000', sz: 9, sz2: 10, jc: 'left', span: o.span });
    const m = S.meta, gender = m.sex === 'F' ? 'Female' : m.sex === 'M' ? 'Male' : '';
    B.push(DX.table([{ cells: [cell('Full name', m.name), cell('D.O.B', rep.dob), cell('Gender', gender), cell('Age', F(m.age) ? Math.floor(m.age) : ''), cell('Weight (kg)', F(m.mass) ? (+m.mass).toFixed(1) : ''), cell('Height (cm)', rep.height)] },
      { cells: [cell('Tester', rep.tester), cell('Test date', m.date), cell('Protocol', rep.protocol || protocolText(), { span: 4 })] }], [2650, 1464, 1464, 1464, 1464, 1412], { box: true }));
    void lab;
    B.push(DX.para('', { after: 0 }), DX.heading('Raw data'));
    const phase = c.pr.max ? ' of the VO₂max test' : '';
    const lastTxt = c.partial ? `You completed ${c.full} full stages${phase} and stopped at ${mmss(c.last.dur)} into the ${ordinal(c.st.length)} stage (${v(c.last.p, dp)} ${u}).` : `You completed all ${c.full} stages${phase}, finishing at ${v(c.last.p, dp)} ${u}.`;
    B.push(DX.para(`${lastTxt}${F(c.maxHr) ? ` Your maximum heart rate was ${Math.round(c.maxHr)} bpm.` : ''}`, { jc: 'both' }));
    const H = { fill: '1F3864', header: true, topLine: true, bottomLine: true }, alt = i => (i % 2 === 0 ? 'DAE9F7' : undefined);
    const raw = [{ ...H, cells: [isRun ? 'Speed (km/h)' : 'Power (W)', 'Lactate (mmol/L)', 'HR (bpm)', 'RPE (6–20)'].map(t => ({ text: t })) }];
    raw.push({ fill: alt(0), topLine: true, cells: [{ text: 'Baseline' }, { text: v(c.rows.base.la, 1) }, { text: v(c.rows.base.hr, 0) }, { text: '' }] });
    const rawRow = (r, i) => raw.push({ fill: alt(i), cells: [{ text: v(r.stageP, dp) + (r.part ? ' (part)' : '') }, { text: F(r.la) ? v(r.la, 1) : '' }, { text: v(r.hr, 0) }, { text: F(r.rpe) ? String(r.rpe) : '' }] });
    c.stRows.forEach((r, i) => rawRow(r, i + 1));
    if (c.maxRows.length) { raw.push({ topLine: true, cells: [{ text: 'VO₂max test', span: 4, i: true }] }); c.maxRows.forEach((r, i) => rawRow(r, i + 1)); }
    B.push(DX.table(raw, [1992, 1992, 1992, 1993], { lastLine: true }));
    B.push(DX.para('', { after: 0 }), DX.heading('Thresholds'));
    const what = c.src === 'lactate' ? ['lactate data', 'lactate thresholds', 'LT'] : ['breathing (gas) data', 'ventilatory thresholds', 'VT'];
    const both = F(thr[0]) && F(thr[1]), one = F(thr[0]) ? 0 : F(thr[1]) ? 1 : -1, what1 = what[1].replace(/s$/, ''), sp = isRun ? 'running speed' : 'power output';
    B.push(DX.para(both ? `Using the ${what[0]}, your ${sp}s corresponding to the first and second ${what[1]} were calculated as ${v(thr[0], dp)} ${u} and ${v(thr[1], dp)} ${u}, respectively.` : one >= 0 ? `Using the ${what[0]}, your ${sp} at the ${one ? 'second' : 'first'} ${what1} was calculated as ${v(thr[one], dp)} ${u}. The ${one ? 'first' : 'second'} ${what1} could not be determined from this test.` : `The ${what[1]} could not be determined from this test.`, { jc: 'both' }));
    const h1 = c.hrAt(thr[0]), h2 = c.hrAt(thr[1]), r1 = c.rpeAt(thr[0]), r2 = c.rpeAt(thr[1]), rr = x => (F(x) ? String(Math.round(x)) : '–'), hh = x => (F(x) ? String(Math.round(x)) : '–');
    const zh = [{ ...H, cells: ['Intensity', isRun ? 'Speed (km/h)' : 'Power (W)', ...(isRun ? ['Speed (min/km)'] : []), 'HR (bpm)', 'RPE (6–20)'].map(t => ({ text: t })) }];
    const z = (name, fill, a, pc, hr, rpe, top) => ({ fill, topLine: top, cells: [{ text: name }, { text: a }, ...(isRun ? [{ text: pc }] : []), { text: hr }, { text: rpe }] });
    if (both) {
      zh.push(z('Light', 'E2EFDA', `< ${v(thr[0], dp)}`, `> ${pace(thr[0])}`, `< ${hh(h1)}`, `< ${rr(r1)}`, true));
      zh.push(z('Moderate', 'FFF2CC', `${v(thr[0], dp)} – ${v(thr[1], dp)}`, `${pace(thr[1])} – ${pace(thr[0])}`, `${hh(h1)} – ${hh(h2)}`, `${rr(r1)} – ${rr(r2)}`));
      zh.push(z('Hard', 'FCE4D6', `> ${v(thr[1], dp)}`, `< ${pace(thr[1])}`, `> ${hh(h2)}`, `> ${rr(r2)}`));
    } else if (one === 0) {
      zh.push(z('Light', 'E2EFDA', `< ${v(thr[0], dp)}`, `> ${pace(thr[0])}`, `< ${hh(h1)}`, `< ${rr(r1)}`, true));
      zh.push(z('Moderate and hard', 'FFF2CC', `> ${v(thr[0], dp)}`, `< ${pace(thr[0])}`, `> ${hh(h1)}`, `> ${rr(r1)}`));
    } else if (one === 1) {
      zh.push(z('Light and moderate', 'E2EFDA', `< ${v(thr[1], dp)}`, `> ${pace(thr[1])}`, `< ${hh(h2)}`, `< ${rr(r2)}`, true));
      zh.push(z('Hard', 'FCE4D6', `> ${v(thr[1], dp)}`, `< ${pace(thr[1])}`, `> ${hh(h2)}`, `> ${rr(r2)}`));
    }
    if (zh.length > 1) B.push(DX.table(zh, isRun ? [1900, 1500, 1500, 1500, 1500] : [2100, 1950, 1950, 1950], { lastLine: true }));
    B.push(DX.para(DX.rich('HR, heart rate; RPE, rating of perceived exertion.', { i: true, sz: 11 }), { after: 6 }));
    B.push(DX.para(c.src === 'lactate' ? `Here is a figure showing how your lactate changed as you ${isRun ? 'ran faster' : 'rode harder'} across the stages. Your first (LT1) and second (LT2) lactate thresholds are shown.` : 'Here is a figure showing how your breathing changed relative to the oxygen you used and the carbon dioxide you breathed out. Your first (VT1) and second (VT2) ventilatory thresholds are shown.', { jc: 'both', keep: true }));
    const png = c.src === 'lactate' ? await lactateFigure(c.se, c.res) : await gasFigure();
    B.push(DX.picture(doc, png, 600, c.src === 'lactate' ? 400 : 380, 14, { frame: true }));
    B.push(DX.para(DX.rich(c.src === 'lactate' ? 'LT1, lactate threshold 1; LT2, lactate threshold 2' : 'VT1, ventilatory threshold 1; VT2, ventilatory threshold 2; VE, ventilation; VO₂, oxygen uptake; VCO₂, carbon dioxide output', { i: true, sz: 11 })));
    const pk = D.peak.vo2kg, mx = S.proto.max ? 'VO₂max' : 'VO₂peak';
    B.push(DX.para('', { after: 0 }), DX.heading(mx));
    B.push(DX.para(pk ? `Your ${S.proto.max ? 'maximum' : 'peak'} rate of oxygen uptake (${mx}) was ${pk.value.toFixed(1)} ml/kg/min.` : 'Oxygen uptake was not available.', { jc: 'both' }));
    return DX.pack(doc, { title: (rep.title || 'Report') + ' – ' + m.name, creator: rep.tester || 'Lab CPET tool', a4: true });
  }
  async function researchReport() {
    const R = results(), pr = S.proto, I = S.I, m = S.meta, D = S.D, doc = DX.doc(), B = doc.body, u = I ? I.unit : '', v = (x, d) => (x === '' || !F(+x) ? '–' : (+x).toFixed(d));
    const H = { fill: '1F3864', header: true, topLine: true, bottomLine: true }, alt = i => (i % 2 === 0 ? 'DAE9F7' : undefined);
    B.push(DX.title('Exercise test report'));
    B.push(DX.para(DX.rich(`Lab CPET tool ${VERSION} · ${new Date().toISOString().slice(0, 10)}`, { color: '7F7F7F', sz: 9 }), { jc: 'center' }));
    const cell = (label, value, span) => ({ lines: [label, String(value ?? '')], color: '7F7F7F', subColor: '000000', sz: 9, sz2: 10, jc: 'left', span });
    B.push(DX.table([{ cells: [cell('Participant', m.name), cell('Study ID', m.studyId), cell('Date', m.date), cell('Age', F(m.age) ? Math.floor(m.age) : ''), cell('Sex', m.sex), cell('Mass (kg)', F(m.mass) ? (+m.mass).toFixed(1) : '')] },
      { cells: [cell('Test', pr.type === 'incremental' ? (pr.max ? 'Incremental, then VO₂max phase' : 'Incremental') : 'Step tests' + (F(pr.base) ? ' and prolonged exercise' : ''), 2), cell('Modality', I ? I.mode : ''), cell('Protocol', (repInfo().protocol || protocolText()).replace('\n', ', '), 3)] }], [2000, 1600, 1600, 1100, 1100, 1650], { box: true }));
    if (pr.type === 'incremental' && D.inc) {
      const pk = D.inc.peak; B.push(DX.para('', { after: 0 }), DX.heading('Peak values'));
      const rows = [{ ...H, cells: ['Variable', 'Value'].map(t => ({ text: t })) }];
      [[pr.max ? 'VO₂max (L/min)' : 'VO₂peak (L/min)', pk.vo2, 2], [pr.max ? 'VO₂max (mL/kg/min)' : 'VO₂peak (mL/kg/min)', pk.vo2kg, 1], ['Heart rate (bpm)', pk.hr, 0], ['RER', pk.rer, 2], ['VE (L/min)', pk.ve, 1]].forEach(([n, o, d], i) => rows.push({ fill: alt(i), cells: [{ text: n, jc: 'left' }, { text: o ? v(o.value, d) : '–' }] }));
      const peakI = pr.max ? pr.max.peak : pr.inc.peak; rows.push({ fill: alt(5), cells: [{ text: `Peak ${I ? I.label.toLowerCase() : 'intensity'} (${u})`, jc: 'left' }, { text: v(peakI, u === 'W' ? 0 : 1) }] });
      B.push(DX.table(rows, [4200, 2200], { lastLine: true }));
    }
    B.push(DX.para('', { after: 0 }), DX.heading('Thresholds'));
    const tr = [{ ...H, cells: ['Test', 'Threshold', 'Source', 'VO₂ (L/min)', 'VO₂ (mL/kg/min)', `${I ? I.label : 'Intensity'} (${u})`, 'HR (bpm)', 'Lactate (mmol/L)'].map(t => ({ text: t, sz: 9 })) }];
    R.thr.forEach((r, i) => tr.push({ fill: alt(i), cells: [r.test.replace(/_/g, ' '), r.threshold, r.source + (r.status === 'checked' ? '' : ' (not checked)'), v(r.vo2_L_min, 2), v(r.vo2_mL_kg_min, 1), v(r.intensity_regression !== '' ? r.intensity_regression : r.intensity_stage, u === 'W' ? 0 : 1), v(r.hr_bpm, 0), v(r.lactate_mmol_L, 1)].map(t => ({ text: t, sz: 9 })) }));
    B.push(DX.table(tr, [1250, 1100, 1750, 900, 1050, 1100, 850, 1000], { lastLine: true }));
    B.push(DX.para(DX.rich('Intensity of VT is from the VO₂–intensity regression; intensity of LT is where the lactate threshold was placed.', { i: true, sz: 9 })));
    // stages, with lactate where entered
    const lacBy = {}; lacSeries().forEach((se, k) => { const nm = se.key === 'inc' ? (pr.max ? 'threshold_stages' : 'incremental') : 'test_' + (k + 1); lacBy[nm] = lacRows(se).rows; });
    const tests = [...new Set(R.stages.map(r => r.test))];
    tests.forEach(t => {
      B.push(DX.para('', { after: 0 }), DX.heading('Stages' + (tests.length > 1 ? ' – ' + t.replace(/_/g, ' ') : '')));
      const rows = [{ ...H, cells: [`${I ? I.label : 'Intensity'} (${u})`, 'VO₂ (L/min)', 'VO₂ (mL/kg/min)', 'HR (bpm)', 'RER', 'VE (L/min)', 'Lactate (mmol/L)', 'RPE'].map(x => ({ text: x, sz: 9 })) }];
      R.stages.filter(r => r.test === t).forEach((r, i) => { const lr = (lacBy[t] || [])[i] || {}; rows.push({ fill: alt(i), cells: [v(r.intensity, u === 'W' ? 0 : 1), v(r.vo2_L_min, 2), v(r.vo2_mL_kg_min, 1), v(r.hr_bpm, 0), v(r.rer, 2), v(r.ve_L_min, 1), F(lr.la) ? (+lr.la).toFixed(1) : '–', F(lr.rpe) ? String(lr.rpe) : (r.rpe !== '' && r.rpe !== undefined ? String(r.rpe) : '–')].map(x => ({ text: x, sz: 9 })) }); });
      B.push(DX.table(rows, [1250, 1150, 1250, 1050, 950, 1150, 1250, 900], { lastLine: true }));
    });
    // figures
    const figs = [];
    if (pr.type === 'incremental' && D.inc) figs.push(['Ventilatory equivalents against time, with VT1 and VT2.', await gasFigure(600, 360), 600, 360]);
    for (const se of lacSeries()) { const res = lacAnalyse(se); if (res.fit) figs.push([`Lactate against ${I.unit === 'W' ? 'power' : 'speed'}${lacSeries().length > 1 ? ' (' + se.name + ')' : ''}, with LT1 and LT2 (${LM.FITS[lacSet().fit].toLowerCase()}).`, await lactateFigure(se, res, 600, 360), 600, 360]); }
    if (figs.length) { B.push(DX.para('', { after: 0 }), DX.heading('Figures')); figs.forEach(([cap, png, w, h]) => { B.push(DX.picture(doc, png, w, h, 15)); B.push(DX.para(DX.rich(cap, { i: true, sz: 10 }), { jc: 'center' })); }); }
    const warn = (S.checks || []).filter(x => x.level === 'warn'); if (warn.length) { B.push(DX.para('', { after: 0 }), DX.heading('Data checks')); warn.forEach(x => B.push(DX.para('! ' + x.text, { jc: 'both' }))); }
    B.push(DX.para('', { after: 0 }), DX.heading('Methods')); B.push(DX.para(methodsText(), { jc: 'both' })); B.push(DX.para(DX.rich(CAVEAT, { i: true, sz: 9 })));
    return DX.pack(doc, { title: 'Exercise test report – ' + m.name, creator: 'Lab CPET tool', a4: true });
  }
  function reportsHTML() {
    const rep = repInfo(), inc = S.proto.type === 'incremental' && S.D.inc && S.I, se = inc ? lacSeries()[0] : null, hasLac = se && lacAnalyse(se).fit;
    const f = (id, lab, val, w) => `<label class="f"><span>${lab}</span><input id="${id}" value="${esc(val || '')}" ${w ? `style="width:${w}"` : ''}></label>`;
    return `<div class="form">${f('rTitle', 'Report heading', rep.title)}${f('rTester', 'Tester', rep.tester)}${f('rDob', 'Date of birth', rep.dob)}${f('rHt', 'Height (cm)', rep.height)}
        <label class="f"><span>Thresholds in the client report</span><select id="rSrc"><option value="lactate" ${hasLac && rep.src !== 'gas' ? 'selected' : ''} ${hasLac ? '' : 'disabled'}>Lactate (LT1, LT2)</option><option value="gas" ${!hasLac || rep.src === 'gas' ? 'selected' : ''}>Gas (VT1, VT2)</option></select></label>
        <label class="f" style="grid-column:span 2"><span>Protocol (as written in the report)</span><textarea id="rProt" rows="2">${esc(rep.protocol || (inc ? protocolText() : ''))}</textarea></label></div>
      <div class="tools"><button class="primary" id="rClient" ${inc ? '' : 'disabled title="The client report is for incremental tests"'}>Client report (Word)</button><button id="rResearch">Research report (Word)</button><span class="hint" id="rMsg">${inc ? '' : 'The client report is for incremental tests.'}</span></div>`;
  }
  function bindReports() {
    const rep = repInfo(), on = (id, k, store) => { const el = $(id); if (el) el.onchange = () => { rep[k] = el.value; if (store) try { localStorage.setItem(store, el.value); } catch (e) { /* private window */ } }; };
    on('#rTitle', 'title', 'labcpet.reptitle'); on('#rTester', 'tester', 'labcpet.tester'); on('#rDob', 'dob'); on('#rHt', 'height'); on('#rProt', 'protocol'); on('#rSrc', 'src');
    const go = async (fn, name) => { const msg = $('#rMsg'), un = results().thr.filter(r => r.status !== 'checked'); msg.textContent = 'Making the report…'; try { if (S.oxy && !S.oxy.done) await S.oxy.promise; const blob = await fn(); download(blob, stem() + name); msg.textContent = 'Report saved. Open it in Word to check and edit the wording.' + (un.length ? ` Note: ${un.map(r => r.threshold).join(', ')} ${un.length > 1 ? 'are' : 'is'} still the tool’s suggestion, not checked.` : ''); } catch (e) { console.error(e); msg.textContent = 'Could not make the report: ' + e.message; } };
    if ($('#rClient')) $('#rClient').onclick = () => go(clientReport, '_client_report.docx');
    $('#rResearch').onclick = () => go(researchReport, '_research_report.docx');
  }

