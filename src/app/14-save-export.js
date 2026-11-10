  /* ---------------- Save, open, export ---------------- */
  const stem = () => (((S.meta.studyId || S.meta.name || 'test') + '_' + String(S.meta.date || '').replace(/\//g, '-')).replace(/[^\w.-]+/g, '_'));
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function settingsRows() {
    const set = S.set, out = [['tool', 'Lab CPET tool'], ['tool_version', VERSION], ['created_by', AUTHOR], ['exported', new Date().toISOString()], ['gas_file_type', S.gas.kind === 'bxb' ? 'breath-by-breath' : S.gas.avgWidth + '-s averages'], ['cosmed_files_joined', S.gas.files ? S.gas.files.map(f => f.name + ' at ' + f.start + ' s').join('; ') : ''], ['intensity_source', S.I ? (S.I.plan ? 'steps entered by the researcher' : S.I.source) : 'none'], ['entered_steps', S.set.plan ? JSON.stringify(S.set.plan) : ''], ['lode_offset_s', set.offset], ['body_mass_kg', S.meta.mass], ['averaging', avgLabel()], ['outlier_flagging', set.outl.local ? set.outl.nsd + ' SD' : 'off'], ['flagged_removed', set.outl.remove]];
    if (S.proto.type === 'incremental') { out.push(['analysis_window_min', S.D.inc ? (S.D.inc.t0 / 60).toFixed(2) + '-' + (S.D.inc.t1 / 60).toFixed(2) : ''], ['first_stage_seconds_left_out', set.inc.skip || 0], ['vo2peak_window_s', set.inc.peakWin], ['stage_window_s', set.inc.stageWin]); }
    else out.push(['stage_window_s', set.st.regWin], ['vt1_chart_window_s', isWholeStage() ? 'whole stage' : set.st.win], ['step_test_selection_s_from_start', S.proto ? S.proto.tests.map((T, i) => { const r = testSel(T); return L.testName(S.proto, i) + ': ' + (r ? r.join('-') : 'all'); }).join('; ') : 'all'], ['step_test_vt2', set.st.vt2], ['tests_excluded', set.excluded.join(' ')], ['periods_left_out_s', (set.leaveOut || []).map(p => p.join('-')).join(' ')], ['steady_average_min', set.per.avgMin]);
    return out;
  }
  $('#bExport').onclick = async () => {
    if (S.oxy && !S.oxy.done) await S.oxy.promise;
    const R = results(), wb = XLSX.utils.book_new(), add = (name, rows) => XLSX.utils.book_append_sheet(wb, rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['No data']]), name);
    add('Long format', R.rows); add('Stages', R.stages); add('Thresholds', R.thr); if (R.lactate.length) add('Lactate', R.lactate);
    const ox = S.oxy && S.oxy.done && S.proto.type === 'incremental' ? ['cnn', 'lstm'].flatMap(m => { const r = S.oxy.res[m]; return ['vt1', 'vt2'].map(q => ({ model: 'Oxynet ' + m.toUpperCase(), threshold: q.toUpperCase(), vo2_L_min: r && r[q] && !r.problem ? rd(r[q].vo2, 3) : '', time_s: r && r[q] && !r.problem ? r[q].time : '', note: r ? (r.problem || r.error || '') : '', data_used: oxyName() })); }) : [];
    if (ox.length) add('Oxynet suggestions', ox);
    if (R.periods.length) add('Prolonged exercise', R.periods);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Lab CPET tool ' + VERSION + ', created by ' + AUTHOR], [''], ['References: cite the Oxynet papers when Oxynet suggestions are used, and lactater when lactate thresholds are used.'], ...REFS.map(([t, d]) => [t.replace(/<[^>]+>/g, '') + (d ? ' doi:' + d : '')]), ['pyoxynet 1.0.2, Andrea Zignoli and the Oxynet team, MIT licence.']]), 'Credits');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Check', 'Message'], ...S.checks.map(c => [c.level, c.text])]), 'Data checks');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Setting', 'Value'], ...settingsRows()]), 'Settings');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Methods paragraph'], [methodsText()]]), 'Methods');
    XLSX.writeFile(wb, stem() + '_results.xlsx');
  };
  $('#bCsv').onclick = () => { const R = results(), ws = XLSX.utils.json_to_sheet(R.rows); download(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv' }), stem() + '_long.csv'); };
  $('#bSave').onclick = () => {
    const blocks = S.set.blocks ? { list: [...S.set.blocks], unit: S.set.blocks.unit } : null, set = clone(S.set); set.blocks = blocks;
    const o = { app: 'lab-cpet-tool', version: VERSION, gas: S.gas, lode: S.lode, hr: S.hr, meta: S.meta, set, picks: S.picks };
    download(new Blob([JSON.stringify(o)], { type: 'application/json' }), stem() + '_analysis.json');
    checkpoint(); H.saved = H.at >= 0 ? H.steps[H.at].k : null; toast('Saved');
  };
  function openAnalysis(o) {
    if (o.app !== 'lab-cpet-tool') throw new Error('This is not a Lab CPET tool analysis file.');
    const nan = a => a.map(x => (x === null ? NaN : x));
    Object.keys(o.gas.v).forEach(k => (o.gas.v[k] = nan(o.gas.v[k]))); Object.keys(o.gas.aux).forEach(k => { if (k !== 'phase' && Array.isArray(o.gas.aux[k])) o.gas.aux[k] = nan(o.gas.aux[k]); });
    if (o.lode) { o.lode.rpm = nan(o.lode.rpm); }
    if (o.set.blocks) { const b = o.set.blocks.list; b.unit = o.set.blocks.unit; o.set.blocks = b; }
    S.gas = o.gas; S.lode = o.lode; S.hr = o.hr; S.meta = o.meta; S.set = Object.assign(defaults(), o.set); S.picks = o.picks; S.oxy = null; S.oxyCache = {}; S.view = 'protocol';
    start();
  }
