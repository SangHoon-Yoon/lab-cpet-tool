  /* ---------------- Files ---------------- */
  const fileIn = $('#fileIn');
  $('#bPick').onclick = () => { fileIn.accept = '.xlsx,.xls,.csv,.tcx,.gpx,.json'; fileIn.click(); };
  $('#bLoad').onclick = () => { S.pending = []; drawChoice(); $('#app').hidden = true; $('#start').hidden = false; fillStartPresets(); };
  $('#bOpen').onclick = () => { fileIn.accept = '.json'; fileIn.click(); };
  fileIn.onchange = () => { addFiles([...fileIn.files]); fileIn.value = ''; };
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', ev => addFiles([...ev.dataTransfer.files]));

  /* The choices on the start page: which test, running or cycling, and (incremental tests) which data.
     All are optional: with nothing chosen the tool works the test out from the file, as before. The last choices are remembered in this browser. */
  const CH = (() => { try { return JSON.parse(localStorage.getItem('labcpet.choice') || '{}'); } catch (e) { return {}; } })();
  function drawChoice() {
    $$('[data-ch]').forEach(b => { const [k, v] = b.dataset.ch.split(':'); b.setAttribute('aria-pressed', CH[k] === v); });
    const inc = !CH.test || CH.test === 'inc' || CH.test === 'two'; $('#chData').hidden = !inc; $('#chN').textContent = inc ? '4' : '3';
    const lac = inc && CH.data === 'lac', run = CH.sport === 'run', cyc = CH.sport === 'cycle';
    const tread = '<b>Running:</b> the COSMED export is enough when it holds the treadmill speed. Without speed, you enter the stages on the next screen.', bike = '<b>Cycling:</b> the COSMED export, plus the Lode export if you saved it. Without power, you enter the stages on the next screen.';
    $('#dropSub').innerHTML = lac ? 'No gas file is needed: click <b>Continue</b> and type the stages and lactate values. If you have the COSMED export, add it and the heart rate and RPE of each stage are filled in for you.'
      : `Drop the files here. ${run ? tread : cyc ? bike : tread + ' ' + bike}${CH.test === 'dur' ? ' If the session was recorded as several COSMED files, add them all and they are joined by their clock times.' : ''} You can add a heart-rate file (Polar or Garmin CSV, TCX or GPX) if the COSMED did not record heart rate.`;
    $('#chMsg').textContent = CH.test ? '' : 'You can also skip these and add the files: the tool then works the test out from the file.';
    listFiles();
  }
  $('#choose').addEventListener('click', ev => { const b = ev.target.closest('[data-ch]'); if (!b) return; const [k, v] = b.dataset.ch.split(':'); if (CH[k] === v) delete CH[k]; else CH[k] = v; try { localStorage.setItem('labcpet.choice', JSON.stringify(CH)); } catch (e) { /* private window */ } drawChoice(); });
  const lacNoFile = () => CH.data === 'lac' && (!CH.test || CH.test === 'inc' || CH.test === 'two');
  // Lactate only, with no gas file: an empty recording, so the stages can be typed and the Lactate tab and client report work as usual.
  function blankGas() { const n = 720, t = Array.from({ length: n }, (x, i) => (i + 1) * 15), nan = () => Array(n).fill(NaN), v = {}; ['vo2', 'vco2', 've', 'hr', 'rer', 'eqo2', 'eqco2', 'peto2', 'petco2', 'rf', 'vt'].forEach(k => (v[k] = nan())); return { kind: 'avg', avgWidth: 15, t, v, has: Object.keys(v), markers: [], aux: { speed: nan(), grade: nan(), power: nan(), phase: Array(n).fill(''), speedUnit: '' }, meta: {}, blank: true }; }

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
          else if (id === 'lode' && S.addLode) { S.addLode = false; S.pending = []; S.lode = P.parseLode(wb); S.set.source = 'lode'; S.set.plan = null; S.set.blocks = null; S.set.stages = null; S.set.inc.t0 = S.set.inc.t1 = null; if (S.view !== 'summary') S.view = 'protocol'; rebuild(); S.align = L.alignment(S.gas, S.I); buildDetails(); buildTabs(); recompute(); return; }
          else if (id === 'lode') { item.obj = P.parseLode(wb); item.kind = 'lode'; item.desc = (item.obj.t.at(-1) / 60).toFixed(1) + ' min of power'; }
          else throw new Error('Not recognised as a COSMED or Lode export.');
        }
        item.status = 'ok';
      } catch (e) { item.status = 'bad'; item.err = e.message; }
      listFiles();
    }
  }
  // Example test: a simulated incremental cycling test, with blood lactate filled in for each stage.
  const exampleWB = () => P.readWorkbook(XLSX.write(window.LabExample.workbook(XLSX), { type: 'array', bookType: 'xlsx' }));
  $('#bExample').onclick = () => {
    S.pending = [{ name: window.LabExample.fileName, kind: 'cosmed', status: 'ok', obj: P.parseCosmed(exampleWB()), err: '' }];
    $('#sPreset').value = ''; begin({ test: 'inc', sport: 'cycle', data: 'both' });
    const st = S.proto.inc && !S.proto.inc.none ? S.proto.inc.stages : [];
    S.set.lac = Object.assign({}, S.set.lac || {}, { series: { inc: { base: { la: window.LabExample.lactate(0) }, rows: Object.fromEntries(st.map((q, i) => { const pr = st[i - 1], part = i === st.length - 1 && pr && q.dur < 0.9 * pr.dur; return [i, { la: window.LabExample.lactate(part ? pr.p + (q.p - pr.p) * q.dur / pr.dur : q.p) }]; })) } } });
    H.steps = []; H.at = -1; H.saved = null; checkpoint(); // the Lactate tab reads these values when it is opened
    toast('Example test loaded: simulated data, with lactate on the Lactate tab');
  };
  $('#bExampleFile').onclick = () => XLSX.writeFile(window.LabExample.workbook(XLSX), window.LabExample.fileName);
  // Remove a wrongly added file before continuing.
  $('#flist').addEventListener('click', ev => { const b = ev.target.closest('[data-rm]'); if (!b) return; ev.preventDefault(); ev.stopPropagation(); S.pending.splice(+b.dataset.rm, 1); listFiles(); });
  function listFiles() {
    const K = { cosmed: 'COSMED', lode: 'Lode', hr: 'Heart rate', '?': '…' };
    $('#flist').innerHTML = S.pending.map((it, i) => `<li><span class="pill ${it.status === 'ok' ? 'ok' : it.status === 'bad' ? 'bad' : 'warn'}">${K[it.kind] || it.kind}</span><b>${esc(it.name)}</b><span class="hint">${esc(it.status === 'bad' ? it.err : it.desc || '')}</span><button type="button" class="rm" data-rm="${i}" title="Remove this file" aria-label="Remove ${esc(it.name)}">×</button></li>`).join('');
    const ok = S.pending.filter(i => i.status === 'ok'), cos = ok.filter(i => i.kind === 'cosmed');
    let msg = '', blocked = false;
    const noFile = lacNoFile() && !cos.length && !S.pending.some(i => i.status !== 'ok');
    if (noFile) msg = S.pending.length ? 'Continue to type the stages and lactate values.' : '';
    else if (S.pending.length && !cos.length) msg = 'Add the COSMED export.';
    else if (cos.length > 1) { const j = L.joinCosmed(cos.map(i => ({ gas: i.obj, name: i.name })), P.cosmedStartEpoch); msg = j.problem || (j.gas.files ? `${j.gas.files.length} COSMED files will be joined into one session by their clock times: ${j.gas.files.map(f => mmss(f.start)).join(', ')}.` : j.note); blocked = !!j.problem; }
    else if (cos.length && !ok.some(i => i.kind === 'lode') && !L.speedChanges(cos[0].obj)) msg = 'This file has no usable speed or power. Add the Lode export if you have it, or continue and enter the power steps on the next screen.';
    $('#fmsg').textContent = msg;
    $('#bGo').disabled = (!cos.length && !noFile) || blocked; $('#bGo').textContent = noFile ? 'Continue without a gas file' : 'Continue';
  }
  $('#bGo').onclick = () => begin(CH);
  function begin(ch) {
    const ok = S.pending.filter(i => i.status === 'ok'), cos = ok.filter(i => i.kind === 'cosmed');
    S.gas = cos.length ? L.joinCosmed(cos.map(i => ({ gas: i.obj, name: i.name })), P.cosmedStartEpoch).gas : blankGas();
    const lo = ok.find(i => i.kind === 'lode'); S.lode = lo ? lo.obj : null;
    const h = ok.find(i => i.kind === 'hr'); S.hr = h ? h.obj : null;
    S.set = defaults(); S.picks = { inc: {}, tests: {} }; S.oxy = null; S.oxyCache = {}; S.meta = {}; S.view = 'protocol';
    // the start-page choices
    const inc = !ch.test || ch.test === 'inc' || ch.test === 'two';
    if (ch.test) S.set.type = { inc: 'incremental', two: 'two', dur: 'prolonged' }[ch.test];
    if (ch.sport) S.set.sport = ch.sport;
    S.set.data = inc && ch.data ? ch.data : 'both';
    if (S.gas.blank) { S.set.data = 'lac'; S.set.type = 'incremental'; S.view = 'lactate'; }
    if (ch.sport) { const av = L.availableIntensity(S.gas, S.lode), want = ch.sport === 'run' ? ['speed'] : ['lode', 'power']; S.set.source = av.find(a => want.includes(a)) || null; }
    const pre = presetList().find(x => x.name === $('#sPreset').value); if (pre) { applyPresetTo(pre); try { localStorage.setItem('labcpet.lastPreset', pre.name); } catch (e) { /* private window */ } }
    start();
    if (S.gas.blank) { $('#dBox').open = true; $('#sBox').open = true; }
    if (pre) toast(`Preset “${pre.name}” applied`);
    else if (ch.sport && S.I && !S.I.plan && (S.I.mode === 'cycling') !== (ch.sport === 'cycle')) toast(`You chose ${ch.sport === 'cycle' ? 'cycling' : 'running'}, but the file holds ${S.I.mode === 'cycling' ? 'cycling power' : 'treadmill speed'}. Check Test details.`);
  }

  drawChoice();
  function start() {
    S._exMode = false;
    const g = S.gas, m = g.meta, lm = (S.lode && S.lode.meta) || {};
    S.meta = Object.assign({
      name: [m.firstName || lm.firstName, m.lastName || lm.lastName].map(x => String(x || '').trim()).filter(Boolean).join(' ') || (g.blank ? '' : 'Participant'),
      date: m.testDate || '', sex: /^f/i.test(m.sex || lm.sex || '') ? 'F' : /^m/i.test(m.sex || lm.sex || '') ? 'M' : '',
      mass: F(m.mass) ? m.mass : lm.mass, age: m.age, studyId: m.id ? String(m.id) : ''
    }, S.meta);
    const av = L.availableIntensity(g, S.lode);
    if (!S.set.source || !av.includes(S.set.source)) S.set.source = av[0] || null;
    if (g.kind === 'avg' && S.set.avg.bin < g.avgWidth) S.set.avg.bin = g.avgWidth;
    if (S.hr && !S.set.hrOffset) { const ce = P.cosmedStartEpoch(m); if (S.hr.start && ce) S.set.hrOffset = Math.round(S.hr.start - ce); }
    rebuild();
    S.align = L.alignment(S.gas, S.I);
    $('#start').hidden = true; $('#app').hidden = false; $('#dBox').open = false; $('#sBox').open = false; S._stUnlock = false; S._stX = null; S._stMsg = ''; S._stSel = null; S._stRest = null; S._stTemp = null; S._stFS = false; document.body.classList.remove('stfs-on'); S._stVO2 = null;
    ['#bSave', '#bExport', '#bCsv'].forEach(b => ($(b).disabled = false));
    buildDetails(); buildProc(); buildTabs(); recompute();
    H.steps = []; H.at = -1; H.saved = null; checkpoint(); S.gStep = 0; renderGuide();
  }
  // Intensity channel and protocol, from the current settings.
  function rebuild() {
    const set = S.set;
    S.I = L.buildIntensity(S.gas, S.lode, set.source, set.offset, set.blocks, set.plan, set.stages);
    S.proto = S.I ? L.detect(S.I, { type: set.plan ? 'incremental' : set.type }) : { type: set.type || 'incremental', unit: '', label: 'Intensity', tests: [], phases: [], inc: { none: true, ramp: false, stages: [], t0: S.gas.t[0], t1: L.exerciseEnd(S.gas), peak: NaN }, plateaus: [], pauses: [], base: NaN, maot: null, ttf: null, pattern: null };
    S.proto.allTests = S.proto.tests;
    S.proto.tests = S.proto.tests.filter(T => !set.excluded.includes(Math.round(T.t0)));
  }

