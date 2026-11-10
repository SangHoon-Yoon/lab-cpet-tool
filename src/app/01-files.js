  /* ---------------- Files ---------------- */
  const fileIn = $('#fileIn');
  $('#bPick').onclick = () => { fileIn.accept = '.xlsx,.xls,.csv,.tcx,.gpx,.json'; fileIn.click(); };
  $('#bLoad').onclick = () => { S.pending = []; listFiles(); $('#app').hidden = true; $('#start').hidden = false; fillStartPresets(); };
  $('#bOpen').onclick = () => { fileIn.accept = '.json'; fileIn.click(); };
  fileIn.onchange = () => { addFiles([...fileIn.files]); fileIn.value = ''; };
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', ev => addFiles([...ev.dataTransfer.files]));

  async function addFiles(files) {
    for (const f of files) {
      const item = { name: f.name, kind: '?', status: 'reading', obj: null, err: '' };
      S.pending.push(item); listFiles();
      try {
        if (S.addLode && !/\.xlsx?$/i.test(f.name)) throw new Error('Choose the Lode .xlsx export.');
        if (/\.json$/i.test(f.name)) { openAnalysis(JSON.parse(await f.text())); S.pending = []; return; }
        if (/\.(csv|tcx|gpx)$/i.test(f.name)) { item.obj = P.parseHR(await f.text(), f.name); item.kind = 'hr'; item.desc = item.obj.t.length + ' heart-rate samples'; }
        else {
          const wb = P.readWorkbook(await f.arrayBuffer()), id = P.identify(wb);
          if (id === 'cosmed') { item.obj = P.parseCosmed(wb); item.kind = 'cosmed'; const hasSp = L.speedChanges(item.obj); item.desc = (item.obj.kind === 'bxb' ? item.obj.t.length + ' breaths' : item.obj.t.length + ' × ' + item.obj.avgWidth + '-s averages') + (hasSp ? ', with treadmill speed' : ''); }
          else if (id === 'lode' && S.addLode) { S.addLode = false; S.pending = []; S.lode = P.parseLode(wb); S.set.source = 'lode'; S.set.plan = null; S.set.blocks = null; S.set.inc.t0 = S.set.inc.t1 = null; if (S.view !== 'summary') S.view = 'protocol'; rebuild(); S.align = L.alignment(S.gas, S.I); buildDetails(); buildTabs(); recompute(); return; }
          else if (id === 'lode') { item.obj = P.parseLode(wb); item.kind = 'lode'; item.desc = (item.obj.t.at(-1) / 60).toFixed(1) + ' min of power'; }
          else throw new Error('Not recognised as a COSMED or Lode export.');
        }
        item.status = 'ok';
      } catch (e) { item.status = 'bad'; item.err = e.message; }
      listFiles();
    }
  }
  // Remove a wrongly added file before continuing.
  $('#flist').addEventListener('click', ev => { const b = ev.target.closest('[data-rm]'); if (!b) return; ev.preventDefault(); ev.stopPropagation(); S.pending.splice(+b.dataset.rm, 1); listFiles(); });
  function listFiles() {
    const K = { cosmed: 'COSMED', lode: 'Lode', hr: 'Heart rate', '?': '…' };
    $('#flist').innerHTML = S.pending.map((it, i) => `<li><span class="pill ${it.status === 'ok' ? 'ok' : it.status === 'bad' ? 'bad' : 'warn'}">${K[it.kind] || it.kind}</span><b>${esc(it.name)}</b><span class="hint">${esc(it.status === 'bad' ? it.err : it.desc || '')}</span><button type="button" class="rm" data-rm="${i}" title="Remove this file" aria-label="Remove ${esc(it.name)}">×</button></li>`).join('');
    const ok = S.pending.filter(i => i.status === 'ok'), cos = ok.filter(i => i.kind === 'cosmed');
    let msg = '', blocked = false;
    if (S.pending.length && !cos.length) msg = 'Add the COSMED export.';
    else if (cos.length > 1) { const j = L.joinCosmed(cos.map(i => ({ gas: i.obj, name: i.name })), P.cosmedStartEpoch); msg = j.problem || (j.gas.files ? `${j.gas.files.length} COSMED files will be joined into one session by their clock times: ${j.gas.files.map(f => mmss(f.start)).join(', ')}.` : j.note); blocked = !!j.problem; }
    else if (cos.length && !ok.some(i => i.kind === 'lode') && !L.speedChanges(cos[0].obj)) msg = 'This file has no usable speed or power. Add the Lode export if you have it, or continue and enter the power steps on the next screen.';
    $('#fmsg').textContent = msg;
    $('#bGo').disabled = !cos.length || blocked;
  }
  $('#bGo').onclick = () => {
    const ok = S.pending.filter(i => i.status === 'ok'), cos = ok.filter(i => i.kind === 'cosmed');
    S.gas = L.joinCosmed(cos.map(i => ({ gas: i.obj, name: i.name })), P.cosmedStartEpoch).gas;
    const lo = ok.find(i => i.kind === 'lode'); S.lode = lo ? lo.obj : null;
    const h = ok.find(i => i.kind === 'hr'); S.hr = h ? h.obj : null;
    S.set = defaults(); S.picks = { inc: {}, tests: {} }; S.oxy = null; S.oxyCache = {}; S.meta = {}; S.view = 'protocol';
    const pre = presetList().find(x => x.name === $('#sPreset').value); if (pre) { applyPresetTo(pre); try { localStorage.setItem('labcpet.lastPreset', pre.name); } catch (e) { /* private window */ } }
    start();
    if (pre) toast(`Preset “${pre.name}” applied`);
  };

  function start() {
    S._exMode = false;
    const g = S.gas, m = g.meta, lm = (S.lode && S.lode.meta) || {};
    S.meta = Object.assign({
      name: [m.firstName || lm.firstName, m.lastName || lm.lastName].map(x => String(x || '').trim()).filter(Boolean).join(' ') || 'Participant',
      date: m.testDate || '', sex: /^f/i.test(m.sex || lm.sex || '') ? 'F' : /^m/i.test(m.sex || lm.sex || '') ? 'M' : '',
      mass: F(m.mass) ? m.mass : lm.mass, age: m.age, studyId: m.id ? String(m.id) : ''
    }, S.meta);
    const av = L.availableIntensity(g, S.lode);
    if (!S.set.source || !av.includes(S.set.source)) S.set.source = av[0] || null;
    if (g.kind === 'avg' && S.set.avg.bin < g.avgWidth) S.set.avg.bin = g.avgWidth;
    if (S.hr && !S.set.hrOffset) { const ce = P.cosmedStartEpoch(m); if (S.hr.start && ce) S.set.hrOffset = Math.round(S.hr.start - ce); }
    rebuild();
    S.align = L.alignment(S.gas, S.I);
    $('#start').hidden = true; $('#app').hidden = false; $('#dBox').open = false;
    ['#bSave', '#bExport', '#bCsv'].forEach(b => ($(b).disabled = false));
    buildDetails(); buildProc(); buildTabs(); recompute();
    H.steps = []; H.at = -1; H.saved = null; checkpoint(); S.gStep = 0; renderGuide();
  }
  // Intensity channel and protocol, from the current settings.
  function rebuild() {
    const set = S.set;
    S.I = L.buildIntensity(S.gas, S.lode, set.source, set.offset, set.blocks, set.plan);
    S.proto = S.I ? L.detect(S.I, { type: set.plan ? 'incremental' : set.type }) : { type: set.type || 'incremental', unit: '', label: 'Intensity', tests: [], phases: [], inc: { none: true, ramp: false, stages: [], t0: S.gas.t[0], t1: L.exerciseEnd(S.gas), peak: NaN }, plateaus: [], pauses: [], base: NaN, maot: null, ttf: null, pattern: null };
    S.proto.allTests = S.proto.tests;
    S.proto.tests = S.proto.tests.filter(T => !set.excluded.includes(Math.round(T.t0)));
  }

