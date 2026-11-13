  /* ---------------- Test details ---------------- */
  function buildDetails() {
    const set = S.set, pr = S.proto, I = S.I, av = L.availableIntensity(S.gas, S.lode), m = S.meta;
    const srcName = { lode: 'Cycling: Lode power', speed: 'Treadmill: COSMED speed', power: 'Cycling: COSMED power' };
    const stageTxt = pr.type === 'incremental' ? (pr.inc && !pr.inc.none ? (pr.inc.ramp ? `Ramp from ${iVal(S.proto.ramp.p0)} to ${iVal(S.proto.ramp.p1)}, ${mmss(pr.inc.t1 - pr.inc.t0)} long` : groupStages(pr.inc.stages) + (pr.max ? `. VO₂max stages: ${groupStages(pr.max.stages)}` : '')) : 'No stages found') : '';
    $('#dForm').innerHTML = `
      <div class="form">
        <label class="f"><span>Name</span><input type="text" id="mName" value="${esc(m.name)}"></label>
        <label class="f"><span>Study ID (optional)</span><input type="text" id="mId" value="${esc(m.studyId || '')}"></label>
        <label class="f"><span>Test date</span><input type="text" id="mDate" value="${esc(m.date)}"></label>
        <label class="f"><span>Sex</span><select id="mSex"><option value="F">Female</option><option value="M">Male</option><option value="">Not set</option></select></label>
        <label class="f"><span>Body mass (kg)</span><input type="number" step="0.1" id="mMass" value="${F(m.mass) ? m.mass : ''}"></label>
        <label class="f"><span>Age (years)</span><input type="number" step="0.1" id="mAge" value="${F(m.age) ? +m.age.toFixed(1) : ''}"></label>
      </div>
      <div class="form">
        <label class="f"><span>Exercise and intensity data</span><select id="mSrc" ${av.length > 1 ? '' : 'disabled'}>${av.length ? av.map(a => `<option value="${a}">${srcName[a]}</option>`).join('') : '<option>None found</option>'}</select></label>
        <label class="f"><span>Test type</span><select id="mType" ${S.gas.blank ? 'disabled' : ''}><option value="incremental">Incremental test</option><option value="two">Submaximal test, then a VO₂max test</option><option value="prolonged">Durability test (step tests before and after prolonged exercise)</option></select></label>
        ${I && I.source === 'lode' ? `<label class="f"><span>Lode time offset (s)</span><input type="number" step="1" id="mOff" value="${set.offset}"></label>` : ''}
        ${S.hr ? `<label class="f"><span>Heart-rate offset (s)</span><input type="number" step="1" id="mHR" value="${set.hrOffset}"></label>` : ''}
      </div>
      <div class="step"><h4>What was detected</h4>${protoSummary(stageTxt)}</div>
      <details class="sub" data-fold="dchk" ${openFolds.has('dchk') ? 'open' : ''}><summary>Data checks <span class="hint" id="chkSum"></span></summary><ul class="checks" id="chk"></ul></details>
      <details class="sub" data-fold="dpre" ${openFolds.has('dpre') ? 'open' : ''}><summary>Lab presets <span class="hint">${presetList().length ? presetList().length + ' saved' : 'none saved yet'}</span><span id="preInfo"></span></summary><div>
        <p class="hint" data-info="preInfo">A preset keeps the settings of a protocol so the next test starts with them: test type, entered steps (used only when a file has no power or speed), averaging and outliers, the analysis windows, the step-test options, the lactate settings and the report heading and protocol text. Thresholds, lactate values and participant details are never saved in a preset. Presets are kept in this browser; use Export and Import to share them with the lab.</p>
        <div class="tools"><select id="pSel">${presetList().map(x => `<option>${esc(x.name)}</option>`).join('') || '<option value="">No presets yet</option>'}</select><button id="pApply" ${presetList().length ? '' : 'disabled'}>Apply</button><button id="pDel" ${presetList().length ? '' : 'disabled'}>Delete</button>
          <span class="sep"></span><input id="pName" placeholder="Name, e.g. Clinic run" style="width:14em"><button id="pSave">Save these settings as a preset</button>
          <span class="sep"></span><button id="pExp" ${presetList().length ? '' : 'disabled'}>Export presets</button><button id="pImp">Import presets</button><span class="hint" id="pMsg"></span></div></div></details>`;
    bindPresets();
    // A clear prompt when the file has no power or speed: the steps must be entered (or the Lode file added) for stage and power results.
    const ns = $('#needSteps'); ns.innerHTML = !S.I && pr.type === 'incremental' && !set.blocks ? (S.gas.blank ? `<div class="needsteps"><p><b>Lactate only, with no gas file.</b> Enter the test's stages first; the Lactate tab then has a row for each stage.</p><button class="primary" id="nsGo">Enter the stages</button></div>` : `<div class="needsteps"><p><b>No power or speed in this file.</b> Enter the incremental test steps to get stages and power results, or add the Lode file.</p><button class="primary" id="nsGo">Enter the incremental test steps</button><button id="nsLode">Add the Lode file</button></div>`) : '';
    $('#qBox').hidden = !!S.gas.blank;
    if ($('#nsLode')) $('#nsLode').onclick = () => { S.addLode = true; fileIn.accept = '.xlsx,.xls'; fileIn.click(); };
    if ($('#nsGo')) $('#nsGo').onclick = () => { $('#sBox').open = true; const pd = $('#planD'); if (pd) { pd.open = true; pd.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { const f = pd.querySelector('input'); if (f) f.focus(); }, 400); } };
    $('#mSex').value = m.sex || ''; if (av.length) $('#mSrc').value = set.source; $('#mType').value = pr.max ? 'two' : pr.type;
    const on = (id, fn) => { const el = $(id); if (el) el.onchange = e => later(() => fn(e)); };
    on('#mName', e => { m.name = e.target.value; summaries(); });
    on('#mId', e => { m.studyId = e.target.value; summaries(); });
    on('#mDate', e => { m.date = e.target.value; summaries(); });
    on('#mSex', e => { m.sex = e.target.value; });
    on('#mMass', e => { m.mass = parseFloat(e.target.value); recompute(); });
    on('#mAge', e => { m.age = parseFloat(e.target.value); recompute(); });
    const full = () => { rebuild(); S.align = L.alignment(S.gas, S.I); buildDetails(); buildTabs(); recompute(); };
    on('#mSrc', e => { set.source = e.target.value; set.blocks = null; set.stages = null; full(); });
    on('#mRest', e => { set.inc.dropRests = e.target.checked; recompute(); buildDetails(); });
    on('#mType', e => { set.type = e.target.value; S.view = 'protocol'; full(); });
    on('#mOff', e => { set.offset = parseFloat(e.target.value) || 0; full(); });
    on('#mHR', e => { set.hrOffset = parseFloat(e.target.value) || 0; recompute(); });
    buildStages();
    drawChecks();
  }
  function groupStages(st) { // "warm-up 5:00 at 50 W; 7 × 3:00 from 9 to 15 km/h; 5 × 1:00 from 16 to 20 km/h"
    const out = [], rest = st.filter(q => !q.warm); st.filter(q => q.warm).forEach(q => out.push(`warm-up ${mmss(q.dur)} at ${+q.p.toFixed(1)} ${S.I.unit}`));
    let a = 0;
    for (let i = 1; i <= rest.length; i++) if (i === rest.length || Math.abs(rest[i].dur - rest[a].dur) > 20) { out.push(i - a === 1 ? `${mmss(rest[a].dur)} at ${+rest[a].p.toFixed(1)} ${S.I.unit}` : `${i - a} × ${mmss(Math.round(rest[a].dur / 5) * 5)} from ${+rest[a].p.toFixed(1)} to ${+rest[i - 1].p.toFixed(1)} ${S.I.unit}`); a = i; }
    return out.join('; ');
  }
  // The usual incremental test: warm-up, longer stages, then shorter stages to failure.
  function planDefaults() { let last = {}; try { last = JSON.parse(localStorage.getItem('labcpet:plan') || '{}'); } catch (e) { } const u = S.set.sport ? (S.set.sport === 'run' ? 'km/h' : 'W') : last.unit || 'W'; return { unit: u, warmMin: last.warmMin, warmP: last.warmP, startP: last.startP, inc: last.inc, stageMin: last.stageMin || 3, restS: last.restS, switchP: NaN, shortMin: last.shortMin || 1, endMin: S.gas.blank ? NaN : +(L.exerciseEnd(S.gas) / 60).toFixed(2) }; }
  function planForm() {
    const set = S.set, q = set.plan || planDefaults(), need = !S.I, show = need && !set.plan, val = v => (F(v) ? v : ''), uu = q.unit === 'W' ? 'W' : 'km/h', fld = (id, lab, v, extra) => `<label class="f"><span>${lab}</span><input type="number" step="any" id="${id}" value="${val(v)}" ${extra || ''}></label>`;
    return `<h4 class="stfill">Other ways to fill the stages</h4><details class="adv ${need && !set.plan ? 'needd' : ''}" id="planD" ${show ? 'open' : ''}><summary>${set.plan ? `Change the entered steps <span class="hint">(applied: ${+set.plan.startP} ${set.plan.unit === 'W' ? 'W' : 'km/h'}, +${+set.plan.inc} every ${+set.plan.stageMin} min)</span>` : S.lode || S.I && !S.I.plan ? 'Enter an incremental pattern instead (start, increment, stage length)' : 'Enter the incremental test steps'}</summary><div class="plan ${need ? 'need' : ''}" style="margin-top:8px">
      <h4>Incremental test steps</h4>
      ${S.gas.blank ? '<p class="hint">Enter the stages as they were run. Times are from the start of the first stage (or of the warm-up, if you enter one). <b>Test ended at</b> is the time the last stage stopped, so an unfinished last stage is counted correctly.</p>' : need ? '<p class="hint">This COSMED file has no power recording. Enter the steps here, or <button id="bAddLode">add the Lode file</button>. Times are from the start of the COSMED recording.</p>' : ''}
      <div class="form">
        <label class="f"><span>Unit</span><select id="plU">${unitOpts()}</select></label>
        ${fld('plWm', 'Warm-up length (min, optional)', q.warmMin)}${fld('plWp', `Warm-up intensity (${uu}, optional)`, q.warmP)}
        ${fld('plS', `Starting intensity (${uu})`, q.startP)}${fld('plI', `Increment (${uu})`, q.inc)}${fld('plD', 'Stage length (min)', q.stageMin)}${fld('plR', 'Rest between stages (s, optional)', q.restS)}
        <label class="f"><span>Shorter stages at the end</span><select id="plHasSh"><option value="0">No</option><option value="1" ${F(q.switchP) || F(q.switchMin) ? 'selected' : ''}>Yes</option></select></label>
        ${fld('plSw', `Shorter stages started at (${uu})`, q.switchP)}${fld('plSd', 'Shorter stage length (min)', q.shortMin)}
        ${fld('plE', 'Test ended at (min)', q.endMin)}
      </div>
      <div class="tools"><button class="primary" id="plGo">Apply steps</button><button id="plOff" ${set.plan ? '' : 'disabled'}>Remove entered steps</button><span class="msg" id="plMsg"></span></div>
    </div></details>`;
  }
  function bindPlan() {
    const set = S.set, g = id => parseFloat($(id).value), u = $('#plU'), q = set.plan || planDefaults(); u.value = q.unit === 'W' ? 'W' : 'km/h';
    const lode = $('#bAddLode'); if (lode) lode.onclick = ev => { ev.preventDefault(); S.addLode = true; fileIn.accept = '.xlsx,.xls'; fileIn.click(); };
    // The shorter-stage boxes only show when the test has shorter stages at the end.
    const hasSh = $('#plHasSh'), showSh = () => ['#plSw', '#plSd'].forEach(id => ($(id).closest('label').hidden = hasSh.value !== '1')); hasSh.onchange = showSh; showSh();
    $('#plGo').onclick = () => {
      const sh = hasSh.value === '1', pl = { unit: u.value, warmMin: g('#plWm') || 0, warmP: g('#plWp'), startP: g('#plS'), inc: g('#plI'), stageMin: g('#plD'), restS: g('#plR') > 0 ? g('#plR') : 0, switchP: sh ? g('#plSw') : NaN, shortMin: g('#plSd') || 1, endMin: g('#plE') };
      if (sh && !F(pl.switchP)) { $('#plMsg').textContent = `Enter the ${pl.unit === 'W' ? 'power' : 'speed'} the shorter stages started at, or choose No under Shorter stages at the end.`; return; }
      if (!F(pl.startP) || !F(pl.inc) || !(pl.stageMin > 0) || !(pl.endMin > pl.warmMin)) { $('#plMsg').textContent = 'Enter the starting intensity, increment, stage length and test end.'; return; }
      if (F(pl.switchP)) { const k = (pl.switchP - pl.startP) / pl.inc, near = [Math.floor(k), Math.ceil(k)].map(j => +(pl.startP + Math.max(1, j) * pl.inc).toFixed(2)).filter((x, i, a) => a.indexOf(x) === i);
        if (!(k >= 1 - 1e-6)) { $('#plMsg').textContent = `The shorter stages must start above the starting intensity, at ${+(pl.startP + pl.inc).toFixed(2)} ${pl.unit} or later.`; return; }
        if (Math.abs(k - Math.round(k)) > 1e-6) { $('#plMsg').textContent = `With these increments the stages go up in steps of ${pl.inc} ${pl.unit}, so the shorter stages must start at one of them, such as ${near.join(' or ')} ${pl.unit}.`; return; }
        if (pl.warmMin * 60 + k * (pl.stageMin * 60 + pl.restS) >= pl.endMin * 60) { $('#plMsg').textContent = 'At that intensity the shorter stages would start after the test ended. Check the intensity and the test end.'; return; } }
      set.plan = pl; set.blocks = null; set.stages = null; set.type = set.type === 'two' ? 'two' : 'incremental'; set.inc.t0 = set.inc.t1 = null;
      try { localStorage.setItem('labcpet:plan', JSON.stringify({ unit: pl.unit, warmMin: pl.warmMin, warmP: pl.warmP, startP: pl.startP, inc: pl.inc, stageMin: pl.stageMin, restS: pl.restS, shortMin: pl.shortMin })); } catch (e) { }
      later(() => { rebuild(); buildDetails(); buildTabs(); recompute(); });
    };
    $('#plOff').onclick = () => { set.plan = null; set.stages = null; set.inc.t0 = set.inc.t1 = null; later(() => { rebuild(); buildDetails(); buildTabs(); recompute(); }); };
  }
  /* ---------------- Stage table ----------------
     Every stage with its start, length, rest after it and intensity. Locked by default; Unlock lets the researcher correct the stages
     (from a file, from entered steps, or none at all). The edited list is S.set.stages, which replaces the intensity everywhere,
     so Reset to original and undo work like any other setting. */
  const sportUnit = () => (S.set.sport === 'run' ? 'km/h' : 'W');
  // The units on offer: only the one that matches running or cycling, when that was chosen on the start page.
  const unitOpts = () => (S.set.sport ? [sportUnit()] : ['W', 'km/h']).map(u => `<option value="${u}">${u === 'W' ? 'W (cycling)' : 'km/h (running)'}</option>`).join('');
  const stUnit = () => (S.set.stages && S.set.stages.unit) || (S.I && S.I.unit) || (S.set.sport ? sportUnit() : (S.set.plan && S.set.plan.unit) || 'W');
  function stageList() {
    if (S.set.stages) return S.set.stages.list.map(q => Object.assign({}, q));
    if (!S.I) return [];
    const minV = S.I.unit === 'W' ? 20 : 2, rests = (S.proto.inc && S.proto.inc.rests) || [], end = Math.max(S.gas.t.at(-1), 1);
    return C.plateaus(S.I).filter(q => q.p > minV && q.dur >= 10 && q.t0 < end && !rests.some(([a, b]) => q.t0 >= a - 1 && q.t1 <= b + 1)).map(q => ({ t0: +q.t0.toFixed(1), dur: +(Math.min(q.t1, end) - q.t0).toFixed(1), p: +q.p.toFixed(2) }));
  }
  // m:ss, or a number of minutes (3 → 3:00, 0.5 → 0:30)
  const parseT = s => { s = String(s).trim().replace(',', '.'); if (!s) return NaN; if (s.includes(':')) { const [m, x] = s.split(':'); return (parseFloat(m) || 0) * 60 + (parseFloat(x) || 0); } return parseFloat(s) * 60; };
  function setStages(list, msg) {
    list = list.filter(q => q.dur > 0 && F(q.p)).sort((a, b) => a.t0 - b.t0);
    S.set.stages = { unit: stUnit(), list }; S._stMsg = msg || '';
    later(() => { rebuild(); buildDetails(); buildTabs(); recompute(); });
  }
  /* The Stages block: a chart of the stages (with VO₂ behind them), the stage table, and the forms that fill it. */
  const stRests = rows => rows.slice(1).map((q, i) => [rows[i].t0 + rows[i].dur, q.t0, i]).filter(([a, b]) => b - a > 1);
  function buildStages() {
    const box = $('#sBox'); if (!box) return;
    const set = S.set, I = S.I, on = !!S._stUnlock, rows = stageList(), u = stUnit(), lab = u === 'W' ? 'Power' : 'Speed', dp = u === 'W' ? 0 : 1, rs = stRests(rows);
    const ov = rows.findIndex((q, i) => i && q.t0 < rows[i - 1].t0 + rows[i - 1].dur - 0.5);
    const from = set.stages ? 'edited by hand' : set.plan || set.blocks ? 'from the entered steps' : I ? 'from the file' : '';
    $('#sSum').textContent = rows.length ? `${rows.length} stage${rows.length > 1 ? 's' : ''} · ${(+rows[0].p).toFixed(dp)}–${(+rows.at(-1).p).toFixed(dp)} ${u}${rs.length ? ` · ${rs.length} rest${rs.length > 1 ? 's' : ''}` : ''} · ${from}${on ? ' · unlocked' : ''}` : 'none yet';
    const tin = (k, i, v) => `<input type="text" inputmode="decimal" data-st="${k}:${i}" value="${v}" aria-label="${k} of stage ${i + 1}">`;
    const body = rows.map((q, i) => { const nx = rows[i + 1], rest = nx ? nx.t0 - (q.t0 + q.dur) : NaN; return `<tr><td>${i + 1}</td>
      <td>${on ? tin('t0', i, mmss(q.t0)) : mmss(q.t0)}</td><td>${on ? tin('dur', i, mmss(q.dur)) : mmss(q.dur)}</td>
      <td>${nx ? (on ? tin('rest', i, mmss(Math.max(0, rest))) : rest > 1 ? mmss(rest) : '–') : '–'}</td>
      <td>${on ? `<input type="number" step="any" data-st="p:${i}" value="${+q.p.toFixed(2)}" aria-label="${lab} of stage ${i + 1}">` : (+q.p).toFixed(dp)}</td>
      <td>${on ? `<button class="rm" data-strm="${i}" title="Remove this stage" aria-label="Remove stage ${i + 1}">×</button>` : ''}</td></tr>`; }).join('');
    $('#sForm').innerHTML = `
      <div class="tools sttools">${on ? '<button id="stLock" aria-pressed="true">Lock the stages</button>' : '<button id="stLock" class="primary">Unlock to edit</button>'}<button id="stReset" ${set.stages ? '' : 'disabled'}>Reset to original</button>${on ? '<button id="stAdd">Add a stage</button>' : ''}<span id="stI"></span><span class="hint" id="stMsg">${esc(S._stMsg || '')}${ov > 0 ? ` Stage ${ov + 1} starts before stage ${ov} ends.` : ''}</span></div>
      <ul class="notes" data-info="stI"><li>Times are from the start of the recording, as minutes:seconds (or a number of minutes, such as 3 or 0.5).</li><li>In the table, changing a start, length or rest moves the stages after it by the same amount. On the chart, moving an edge changes only the stages on either side of it.</li><li>Edited stages replace the ${lab.toLowerCase()} from the file or the entered steps on every tab. <b>Reset to original</b> goes back, and Ctrl+Z (⌘Z) undoes the last change.</li><li>Rests between stages (up to 2 min, stopped or slower) keep the stages as one test. They are shaded grey${S.proto.type === 'incremental' ? ', and left out of the threshold charts and peak values unless you untick that under Test details' : ''}.</li></ul>
      <div class="stguide">${on ? `<b>Unlocked.</b> On the chart: <span class="k">↔</span> drag a red line to move a stage’s start or end · <span class="k">⇕</span> drag the top of a stage to change its ${lab.toLowerCase()} · <span class="k">+</span> drag across a stage to add a rest · click a stage or a grey rest to select it (then delete it, or use ← → for its length and ↑ ↓ for a stage’s ${lab.toLowerCase()}) · hold <span class="k">${MOD}</span>${IS_MAC ? ` (or <span class="k">${MOD2}</span>)` : ''} and scroll over a stage, a rest or a time in the table to change it in 5 s steps · pinch to zoom. Or type in the table.` : `Check the stages against your protocol. To correct them, click <b>Unlock to edit</b>.`}</div>
      <div class="stgrid"><div><div class="stzoom tools"><span>Zoom:</span><button data-sz="in" title="Zoom in" aria-label="Zoom in">+</button><button data-sz="out" title="Zoom out" aria-label="Zoom out">−</button><button data-sz="all">Show all stages</button><span class="hint">or drag the handles of the strip under the chart</span></div>
        <div class="stchartwrap" id="stcw"><div class="stchart" id="stc"></div><div class="stover" id="sto" hidden></div><div class="stpop" id="stpop" hidden></div><div class="stsel" id="stsel" hidden></div></div>
        <div class="sizebar" id="stsize" title="Drag up or down to change the chart's height" role="separator" aria-label="Drag to change the chart's height"><span></span></div></div>
        <div class="stside">${rows.length ? `<div class="tblwrap"><table class="stT"><thead><tr><th>Stage</th><th>Start</th><th>Length</th><th>Rest after</th><th>${lab} (${u})</th><th></th></tr></thead><tbody>${body}</tbody></table></div>` : `<p class="hint">${on ? 'Click <b>Add a stage</b>, or enter the steps below.' : 'No stages yet. Unlock to type them, or enter the steps below.'}</p>`}
        ${on && rows.length > 1 ? `<div class="stall"><b>Same for every stage</b><div class="tools"><label>Length <input type="text" id="stL" placeholder="${mmss(C.median(rows.slice(0, -1).map(q => q.dur)) || 180)}"></label><label>Rest after <input type="text" id="stR" placeholder="0:30"></label><button id="stAll">Apply</button></div><span class="hint">Fill one or both. The first start and the last stage’s length stay as they are.</span></div>` : ''}</div></div>
      ${planForm()}
      <details class="adv" id="blkD" ${set.blocks ? 'open' : ''}><summary>Enter blocks of stages (for example step tests within a trial)</summary>
        <div class="step" style="padding-top:8px">
          <p class="hint">One row per block of stages. Times are from the start of the COSMED recording. This replaces the detected intensity everywhere.</p>
          <div class="tools"><span>Unit</span><select id="bUnit">${unitOpts()}</select></div>
          <div class="tblwrap"><table class="blocks" id="bT"></table></div>
          <div class="tools"><button id="bAdd">Add block</button><button id="bApply" class="primary">Apply</button><button id="bClear" ${set.blocks ? '' : 'disabled'}>Back to detected stages</button></div>
        </div></details>
`;
    bindPlan();
    bindStageEditor(rows, on);
    // Blocks of stages typed by hand
    const rowsNow = set.blocks ? clone([...set.blocks]) : [{ start: 0, n: 5, dur: 4, first: I && I.unit === 'W' ? 100 : 8, inc: I && I.unit === 'W' ? 20 : 1 }];
    $('#bUnit').value = set.sport ? sportUnit() : (set.blocks && set.blocks.unit) || (I && I.unit) || 'km/h';
    const drawB = () => {
      $('#bT').innerHTML = '<tr><th>Start (min)</th><th>Stages</th><th>Stage length (min)</th><th>First stage</th><th>Increment</th><th></th></tr>' + rowsNow.map((b, i) => `<tr><td><input type="number" step="0.5" data-b="${i}" data-f="start" value="${b.start}"></td><td><input type="number" step="1" min="1" data-b="${i}" data-f="n" value="${b.n}"></td><td><input type="number" step="0.5" data-b="${i}" data-f="dur" value="${b.dur}"></td><td><input type="number" step="0.5" data-b="${i}" data-f="first" value="${b.first}"></td><td><input type="number" step="0.5" data-b="${i}" data-f="inc" value="${b.inc}"></td><td><button data-rm="${i}" aria-label="Remove block">Remove</button></td></tr>`).join('');
      $$('[data-b]').forEach(el => (el.onchange = () => { rowsNow[+el.dataset.b][el.dataset.f] = parseFloat(el.value); }));
      $$('[data-rm]').forEach(el => (el.onclick = () => { rowsNow.splice(+el.dataset.rm, 1); drawB(); }));
    };
    drawB();
    $('#bAdd').onclick = () => { const l = rowsNow.at(-1) || { start: 0, n: 5, dur: 4, first: 8, inc: 1 }; rowsNow.push({ start: l.start + l.n * l.dur + 60, n: l.n, dur: l.dur, first: l.first, inc: l.inc }); drawB(); };
    $('#bApply').onclick = () => { if (!rowsNow.length) return; const b = clone(rowsNow); b.unit = $('#bUnit').value; set.blocks = b; set.stages = null; set.excluded = []; fullS(); };
    $('#bClear').onclick = () => { set.blocks = null; set.stages = null; fullS(); };
    if (box.open && S.D) drawStageChart();
  }
  const fullS = () => { rebuild(); S.align = L.alignment(S.gas, S.I); buildDetails(); buildTabs(); recompute(); };
  function bindStageEditor(rows, on) {
    const set = S.set;
    $('#stLock').onclick = () => { S._stUnlock = !S._stUnlock; S._stMsg = ''; $('#sBox').open = true; buildStages(); if (S.view === 'protocol') render(); };
    $('#stReset').onclick = () => { S.set.stages = null; S._stMsg = 'Back to the original stages.'; later(fullS); };
    if ($('#stAdd')) $('#stAdd').onclick = () => {
      const r = stageList(), a = r.at(-1), b = r.at(-2), u = stUnit();
      r.push(a ? { t0: a.t0 + a.dur + (b ? Math.max(0, a.t0 - b.t0 - b.dur) : 0), dur: b ? b.dur : a.dur, p: +(a.p + (b ? a.p - b.p : 0)).toFixed(2) } : { t0: 60, dur: 180, p: u === 'W' ? 100 : 8 });
      setStages(r, `Stage ${r.length} added.`);
    };
    $$('[data-strm]').forEach(b => (b.onclick = () => { const r = stageList(); r.splice(+b.dataset.strm, 1); setStages(r, 'Stage removed.'); }));
    $$('[data-st]').forEach(el => (el.onchange = () => {
      const [k, s] = el.dataset.st.split(':'), i = +s, r = stageList(), q = r[i], v = k === 'p' ? parseFloat(el.value) : parseT(el.value);
      if (!F(v) || v < 0 || (k === 'dur' && v <= 0)) { $('#stMsg').textContent = 'Type a time as minutes:seconds, such as 3:00, or a number.'; return; }
      const shift = (from, d) => r.slice(from).forEach(x => (x.t0 = +(x.t0 + d).toFixed(1)));
      if (k === 'p') q.p = v; else if (k === 't0') shift(i, v - q.t0); else if (k === 'dur') { const d = v - q.dur; q.dur = v; shift(i + 1, d); } else if (k === 'rest' && r[i + 1]) shift(i + 1, q.t0 + q.dur + v - r[i + 1].t0);
      S._stFocus = el.dataset.st; setStages(r);
    }));
    $$('[data-st]').forEach(el => (el.onwheel = ev => {
      if (!modHeld(ev)) return; ev.preventDefault(); const W = el._w = el._w || { acc: 0 }, n = notchesOf(W, ev); if (!n) return;
      const [k] = el.dataset.st.split(':'), u = stUnit();
      if (k === 'p') { const stp = u === 'W' ? (ev.shiftKey ? 1 : 5) : (ev.shiftKey ? 0.1 : 0.5); el.value = Math.max(stp, stepN(parseFloat(el.value) || 0, -n, stp)); }
      else { const v = parseT(el.value); if (!F(v)) return; el.value = mmss(Math.max(k === 'dur' ? 5 : 0, stepN(v, -n, ev.shiftKey ? 1 : 5))); }
      clearTimeout(W.t); W.t = setTimeout(() => el.onchange(), 600); // applied when the scrolling pauses
    }));
    const tb = $('.stT');
    if (tb) tb.onkeydown = ev => { if (ev.key !== 'Enter') return; const el = ev.target.closest('[data-st]'); if (!el) return; ev.preventDefault(); const [k, s] = el.dataset.st.split(':'); S._stFocus = `${k}:${+s + 1}`; el.blur(); setTimeout(() => { const n2 = $(`[data-st="${S._stFocus}"]`); if (n2) { n2.focus(); n2.select(); } }, 40); };
    if (S._stFocus) { const f = $(`[data-st="${S._stFocus}"]`); S._stFocus = null; if (f) setTimeout(() => { f.focus(); f.select(); }, 0); }
    if ($('#stAll')) $('#stAll').onclick = () => {
      const L0 = parseT($('#stL').value), R0 = parseT($('#stR').value); if (!F(L0) && !F(R0)) { $('#stMsg').textContent = 'Type a length, a rest, or both.'; return; }
      const r = stageList(), rest0 = r.map((q, i) => (i ? Math.max(0, q.t0 - (r[i - 1].t0 + r[i - 1].dur)) : 0)); // each stage keeps its own rest unless a rest is typed
      r.forEach((q, i) => { if (i < r.length - 1 && F(L0) && L0 > 0) q.dur = L0; if (i) q.t0 = +(r[i - 1].t0 + r[i - 1].dur + (F(R0) ? R0 : rest0[i])).toFixed(1); });
      setStages(r, `Every stage set to${F(L0) ? ' ' + mmss(L0) : ''}${F(L0) && F(R0) ? ' with' : ''}${F(R0) ? ' a ' + mmss(R0) + ' rest after' : ''}.`);
    };
    void set; void rows; void on;
  }
  // The key held while scrolling to change a stage's or rest's length: ⌘ on a Mac, Ctrl elsewhere.
  // Ctrl + scroll is what a trackpad pinch sends, so it zooms; lengths use ⌘ or ⌥ on a Mac and Alt elsewhere.
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), MOD = IS_MAC ? '⌘' : 'Alt', MOD2 = IS_MAC ? '⌥' : 'Alt';
  const modHeld = ev => !ev.ctrlKey && (ev.altKey || (IS_MAC && ev.metaKey));
  // Steps of s seconds (or units) that land on round numbers: 179 → 180 → 185 going up, 179 → 175 → 170 going down.
  const toStep = (v, dir, s) => { const k = v / s, on = Math.abs(k - Math.round(k)) < 1e-6; return (dir > 0 ? (on ? Math.round(k) + 1 : Math.ceil(k)) : (on ? Math.round(k) - 1 : Math.floor(k))) * s; };
  const stepN = (v, n, s) => { let x = v; for (let k = 0; k < Math.abs(n); k++) x = toStep(x, Math.sign(n), s); return +x.toFixed(2); };
  // One change to a stage's length, a rest's length or a stage's intensity, n steps up (n > 0) or down; later stages move along.
  function stChange(r, what, i, n, fine) {
    const u = stUnit(), q = r[i];
    if (what === 'p') { const stp = u === 'W' ? (fine ? 1 : 5) : (fine ? 0.1 : 0.5); q.p = Math.max(stp, stepN(q.p, n, stp)); return `Stage ${i + 1}: ${(+q.p).toFixed(u === 'W' ? 0 : 1)} ${u}`; }
    const s = fine ? 1 : 5;
    if (what === 'rest') { const B = r[i + 1]; if (!B) return ''; const rest = B.t0 - (q.t0 + q.dur), nr = Math.max(0, stepN(rest, n, s)), d = nr - rest; r.slice(i + 1).forEach(x => (x.t0 = +(x.t0 + d).toFixed(1))); return `Rest after stage ${i + 1}: ${mmss(nr)}`; }
    const nd = Math.max(5, stepN(q.dur, n, s)), d = nd - q.dur; q.dur = nd; r.slice(i + 1).forEach(x => (x.t0 = +(x.t0 + d).toFixed(1))); return `Stage ${i + 1}: ${mmss(nd)}`;
  }
  // Scroll steps add up until they make one notch: a trackpad sends many small steps, a mouse wheel a few large ones.
  const notchesOf = (W, ev) => { W.acc += ev.deltaMode === 1 ? ev.deltaY * 20 : ev.deltaMode === 2 ? ev.deltaY * 400 : ev.deltaY; const n = Math.trunc(W.acc / 25); W.acc -= n * 25; return n; };
  const stDefaultX = rows => { const g = S.gas, tEnd = g.blank ? (rows.length ? rows.at(-1).t0 + rows.at(-1).dur + 120 : 1800) : g.t.at(-1); return [Math.max(0, (rows.length ? rows[0].t0 - 90 : 0) / 60), Math.min(tEnd, rows.length ? rows.at(-1).t0 + rows.at(-1).dur + 90 : tEnd) / 60]; };
  // The stage chart: power or speed as steps, VO₂ behind it, rests shaded. While unlocked, a transparent layer over the plot handles the editing.
  // tmp: stages being changed by scrolling, drawn before they are applied.
  function drawStageChart(tmp) {
    const gd = $('#stc'); if (!gd || !$('#sBox').open) return;
    const rows = tmp || stageList(), u = stUnit(), lab = u === 'W' ? 'Power' : 'Speed', on = !!S._stUnlock, g = S.gas, rs = stRests(rows), H = (S.set.view && S.set.view.stH) || 320;
    if (S._stSel !== undefined && S._stSel !== null && !rows[S._stSel]) S._stSel = null;
    if (S._stRest !== undefined && S._stRest !== null && !rs.some(x => x[2] === S._stRest)) S._stRest = null;
    const xs = [], ys = []; rows.forEach((q, i) => { const e = q.t0 + q.dur, pv = rows[i - 1]; if (!pv || q.t0 > pv.t0 + pv.dur + 0.5) { xs.push(q.t0 / 60); ys.push(0); } xs.push(q.t0 / 60, e / 60); ys.push(q.p, q.p); const nx = rows[i + 1]; if (!nx || nx.t0 > e + 0.5) { xs.push(e / 60); ys.push(0); } });
    const tr = [{ x: xs, y: ys, mode: 'lines', type: 'scatter', line: { color: css('--power'), width: 2 }, fill: 'tozeroy', fillcolor: css('--powerfill'), hoverinfo: 'skip', name: lab }];
    if (!g.blank && g.v.vo2) { if (!S._stVO2 || S._stVO2.g !== g) { const keep = g.t.map((x, i) => F(g.v.vo2[i]) && g.v.vo2[i] > 0), Gs = C.series(g, keep, 'bin', g.kind === 'avg' ? g.avgWidth : 10); S._stVO2 = { g, x: Gs.t.map(t => t / 60), y: Gs.v.vo2 }; } tr.push({ x: S._stVO2.x, y: S._stVO2.y, yaxis: 'y2', mode: 'lines', type: 'scatter', line: { color: css('--ma'), width: 1.2 }, opacity: 0.55, hoverinfo: 'skip', name: 'VO₂' }); }
    const top = Math.max(1, ...rows.map(q => q.p)) * 1.25, shapes = [], ann = [];
    rs.forEach(([a, b]) => shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: a / 60, x1: b / 60, y0: 0, y1: 1, fillcolor: css('--restfill'), line: { width: 0 }, layer: 'below' }));
    rows.forEach((q, i) => ann.push({ x: (q.t0 + q.dur / 2) / 60, y: q.p, yanchor: 'bottom', showarrow: false, text: (+q.p).toFixed(u === 'W' ? 0 : 1), font: { size: 10, color: css('--fg') } }));
    const sel = on && S._stSel !== null && S._stSel !== undefined ? rows[S._stSel] : null;
    if (sel) shapes.push({ type: 'rect', xref: 'x', yref: 'y', x0: sel.t0 / 60, x1: (sel.t0 + sel.dur) / 60, y0: 0, y1: sel.p, fillcolor: css('--accent-soft'), line: { color: css('--accent'), width: 2 } });
    const selR = on && S._stRest !== null && S._stRest !== undefined ? rs.find(x => x[2] === S._stRest) : null;
    if (selR) shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: selR[0] / 60, x1: selR[1] / 60, y0: 0, y1: 1, fillcolor: css('--accent-soft'), line: { color: css('--accent'), width: 2 } });
    // pinch zooms around what is selected, or else around the pointer
    gd._zoomAt = () => (sel ? (sel.t0 + sel.dur / 2) / 60 : selR ? (selR[0] + selR[1]) / 120 : null);
    const edges = [];
    if (on) {
      rows.forEach((q, i) => { const e = q.t0 + q.dur, nx = rows[i + 1], pv = rows[i - 1];
        if (!pv || Math.abs(pv.t0 + pv.dur - q.t0) > 1) edges.push({ x: q.t0, a: null, b: i });
        edges.push({ x: e, a: i, b: nx && Math.abs(nx.t0 - e) <= 1 ? i + 1 : null }); });
      edges.forEach(e => { e.k = shapes.length; shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: e.x / 60, x1: e.x / 60, y0: 0, y1: 1, line: { color: css('--accent'), width: 1.5 } }); });
    }
    const pv0 = shapes.length; shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0: 0, x1: 0, y0: 0, y1: 1, fillcolor: css('--restfill'), line: { color: css('--accent'), width: 1, dash: 'dot' }, visible: false }, { type: 'line', xref: 'x', yref: 'y', x0: 0, x1: 0, y0: 0, y1: 0, line: { color: css('--accent'), width: 2, dash: 'dot' }, visible: false });
    const xr = S._stX || stDefaultX(rows), hasV = tr.length > 1, end = Math.max(g.blank ? 0 : g.t.at(-1), rows.length ? rows.at(-1).t0 + rows.at(-1).dur + 120 : 0) / 60;
    gd.style.height = H + 'px';
    const L3 = lay({ height: H, margin: { l: 56, r: hasV ? 56 : 14, t: 34, b: 30 }, dragmode: on ? false : 'pan', showlegend: false, shapes, annotations: ann,
      xaxis: ax('Time (min)', { range: xr, rangeslider: { visible: true, thickness: 0.1, range: [0, end], bgcolor: css('--bg'), bordercolor: css('--line'), borderwidth: 1 }, title: { text: 'Time (min)', font: { size: 12, color: css('--fg') }, standoff: 2 } }), yaxis: ax(`${lab} (${u})`, { range: [0, top], fixedrange: true }) });
    if (hasV) L3.yaxis2 = ax('VO₂ (L/min)', { overlaying: 'y', side: 'right', fixedrange: true, showgrid: false, rangemode: 'tozero', title: { text: 'VO₂ (L/min)', font: { size: 11, color: css('--muted') } } }); // only when there is VO₂: an empty second axis stops Plotly
    const homeBtn = { name: 'Show all stages', icon: Plotly.Icons.home, click: () => { S._stX = null; Plotly.relayout(gd, { 'xaxis.range': stDefaultX(stageList()) }); } };
    try { Plotly.react(gd, tr, L3, Object.assign({}, FIGCFG, { scrollZoom: false, displayModeBar: true, modeBarButtons: [[homeBtn]] })); } catch (e) { console.error(e); return; } // a chart problem must never stop the rest of the page
    if (!gd._stOn) { gd._stOn = true; gd.on('plotly_relayout', e => { if (e['xaxis.range[0]'] !== undefined) S._stX = [e['xaxis.range[0]'], e['xaxis.range[1]']]; else if (Array.isArray(e['xaxis.range'])) S._stX = e['xaxis.range'].slice(); else if (e['xaxis.autorange']) S._stX = null; if (gd._place) gd._place(); }); }
    // zoom buttons
    const zoom = f => { const r = gd._fullLayout.xaxis.range, c = (r[0] + r[1]) / 2, h = (r[1] - r[0]) / 2 * f; S._stX = [Math.max(0, c - h), c + h]; Plotly.relayout(gd, { 'xaxis.range': S._stX.slice() }); };
    $$('[data-sz]').forEach(b => (b.onclick = () => { const k = b.dataset.sz; if (k === 'in') zoom(1 / 1.6); else if (k === 'out') zoom(1.6); else homeBtn.click(); }));
    // height: drag the bar under the chart
    const bar = $('#stsize');
    if (bar) bar.onpointerdown = ev => { ev.preventDefault(); bar.setPointerCapture(ev.pointerId); const y0 = ev.clientY, h0 = gd.getBoundingClientRect().height; let h = h0, raf = 0;
      const apply = () => { raf = 0; gd.style.height = h + 'px'; Plotly.relayout(gd, { height: h }).then(() => gd._place && gd._place()); };
      bar.onpointermove = e => { h = Math.round(Math.max(200, Math.min(900, h0 + e.clientY - y0))); if (!raf) raf = requestAnimationFrame(apply); };
      bar.onpointerup = bar.onpointercancel = () => { bar.onpointermove = bar.onpointerup = bar.onpointercancel = null; if (raf) cancelAnimationFrame(raf); apply(); S.set.view.stH = h; }; };
    const ov = $('#sto'), pop = $('#stpop'), selBox = $('#stsel'); ov.hidden = false; selBox.hidden = true;
    const xa = () => gd._fullLayout.xaxis, ya = () => gd._fullLayout.yaxis;
    const place = () => { const a = xa(), b = ya(); ov.style.left = a._offset + 'px'; ov.style.top = b._offset + 'px'; ov.style.width = a._length + 'px'; ov.style.height = b._length + 'px'; if (on) placeSel(); };
    gd._place = place;
    const step = u === 'W' ? 1 : 0.1, snapP = v => Math.max(step, Math.round(v / step) * step), dpU = u === 'W' ? 0 : 1;
    const secAt = px => xa().p2l(px) * 60, pxAt = sec => xa().l2p(sec / 60), pyAt = v => ya().l2p(v);
    const local = ev => { const r = ov.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    const tip = (txt, px, py) => { if (!txt) { pop.hidden = true; return; } pop.hidden = false; pop.textContent = txt; pop.style.left = (xa()._offset + px + 14) + 'px'; pop.style.top = (ya()._offset + py - 12 - pop.offsetHeight) + 'px'; };
    function hit(px, py) {
      let best = null, d = 8; edges.forEach(e => { const q = Math.abs(pxAt(e.x) - px); if (q < d) { d = q; best = e; } });
      // inside a narrow rest, its edges need a closer pointer so the rest itself can still be clicked
      const s = secAt(px), r = rs.find(([a, b]) => s > a && s < b);
      if (best && !(r && d > 2.5)) return { kind: 'edge', e: best };
      if (r) return { kind: 'rest', r };
      const i = rows.findIndex(q => s >= q.t0 && s <= q.t0 + q.dur); if (i < 0) return { kind: 'none' };
      return on && Math.abs(py - pyAt(rows[i].p)) < 8 ? { kind: 'top', i } : { kind: 'cut', i };
    }
    // What the pointer is over: its length first, then (when unlocked) what can be done there.
    const info = h => h.kind === 'rest' ? `Rest after stage ${h.r[2] + 1}: ${mmss(h.r[1] - h.r[0])}` : h.kind === 'cut' || h.kind === 'top' ? `Stage ${h.i + 1}: ${mmss(rows[h.i].dur)} at ${(+rows[h.i].p).toFixed(dpU)} ${u}` : h.kind === 'edge' ? `Edge at ${mmss(h.e.x)}` : '';
    const how = { edge: 'Drag to move it', top: `Drag up or down to change the ${lab.toLowerCase()}`, cut: `Click to select · drag across to add a rest · ${MOD} + scroll: length`, rest: `Click to select · ${MOD} + scroll: length`, none: '' };
    const curs = { edge: 'ew-resize', top: 'ns-resize', cut: 'crosshair', rest: 'pointer', none: 'default' };
    ov.onpointerleave = () => { if (!ov._drag) pop.hidden = true; };
    if (!on) { // locked: lengths on hover, and a reminder of how to start editing
      $$('.stT tbody tr.on').forEach(tr => tr.classList.remove('on')); place();
      ov.onpointermove = ev => { if (ev.buttons) return; const [px, py] = local(ev), h = hit(px, py); ov.style.cursor = 'default'; tip(info(h), px, py); };
      ov.onpointerdown = ev => { if (ev.button) return; const [px, py] = local(ev); tip('Click Unlock to edit to change the stages', px, py); };
      ov.onwheel = ev => { if (modHeld(ev)) { ev.preventDefault(); const [px, py] = local(ev); tip('Click Unlock to edit to change the stages', px, py); } };
      return;
    }
    // A selected stage or rest gets a small bar above it.
    function placeSel() {
      $$('.stT tbody tr').forEach((tr, k) => tr.classList.toggle('on', !!sel && k === S._stSel)); // the selected stage's row in the table too
      if ((!sel && !selR) || tmp) { selBox.hidden = true; return; }
      const a = xa(), b = ya(), x = a._offset + a.l2p(gd._zoomAt()), y = sel ? b._offset + b.l2p(sel.p) : b._offset + 16;
      if (x < a._offset || x > a._offset + a._length) { selBox.hidden = true; return; }
      selBox.hidden = false;
      selBox.innerHTML = sel ? `<span>Stage ${S._stSel + 1} · ${mmss(sel.dur)}</span><button id="stDel">Delete stage</button><button id="stUnsel" aria-label="Clear the selection" title="Clear the selection">×</button>`
        : `<span>Rest after stage ${S._stRest + 1} · ${mmss(selR[1] - selR[0])}</span><button id="stDel">Remove rest</button><button id="stUnsel" aria-label="Clear the selection" title="Clear the selection">×</button>`;
      selBox.style.left = x + 'px'; selBox.style.top = Math.max(2, y - 40) + 'px';
      $('#stDel').onclick = () => delSel(); $('#stUnsel').onclick = () => { S._stSel = S._stRest = null; drawStageChart(); };
    }
    function delSel() {
      const r = stageList(); S._stX = xa().range.slice();
      if (S._stSel !== null && S._stSel !== undefined) { const i = S._stSel; if (!r[i]) return; r.splice(i, 1); S._stSel = null; return setStages(r, `Stage ${i + 1} deleted. Drag an edge if the stages around it should close the gap.`); }
      if (S._stRest !== null && S._stRest !== undefined) { const i = S._stRest, A = r[i], B = r[i + 1]; if (!A || !B) return; S._stRest = null;
        // the stage before the rest takes up its time (or, if both sides are the same stage, they join)
        if (Math.abs(A.p - B.p) < step / 2) { A.dur = B.t0 + B.dur - A.t0; r.splice(i + 1, 1); } else A.dur = B.t0 - A.t0;
        return setStages(r, `Rest after stage ${i + 1} removed.`); }
    }
    place();
    if (!document._stKeys) { document._stKeys = true; document.addEventListener('keydown', e => {
      const isS = S._stSel !== null && S._stSel !== undefined, isR = S._stRest !== null && S._stRest !== undefined;
      if (!S._stUnlock || (!isS && !isR) || !['Delete', 'Backspace', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const el = document.activeElement; if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return; e.preventDefault();
      if (e.key === 'Escape') { S._stSel = S._stRest = null; drawStageChart(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { const d = $('#stDel'); if (d) d.click(); return; }
      if (isR && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
      // ← → length of the stage or rest (5 s, 1 s with Shift) · ↑ ↓ the stage's power or speed
      const r = (S._stTemp || stageList()).map(q => Object.assign({}, q)), i = isS ? S._stSel : S._stRest; if (!r[i]) return;
      const n = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1, txt = stChange(r, isR ? 'rest' : e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 'p' : 'dur', i, n, e.shiftKey);
      S._stTemp = r; drawStageChart(r); $('#stMsg').textContent = txt;
      clearTimeout(S._stKeyT); S._stKeyT = setTimeout(() => { const fin = S._stTemp; S._stTemp = null; if (fin) setStages(fin, txt + '.'); }, 600);
    }); }
    ov.onpointermove = ev => { if (ov._drag) return; const [px, py] = local(ev), h = hit(px, py); ov.style.cursor = curs[h.kind]; const a = info(h); tip(a ? a + (how[h.kind] ? '\n' + how[h.kind] : '') : '', px, py); };
    // ⌘ or ⌥ + scroll over a stage or a rest: first to a round 5 s, then 5 s a step (1 s with Shift). Later stages move along. Plain scrolling scrolls the page.
    ov.onwheel = ev => {
      if (!modHeld(ev)) return;
      ev.preventDefault(); // with the key held, the page itself must not scroll or zoom
      const [px, py] = local(ev), h = hit(px, py); if (h.kind !== 'cut' && h.kind !== 'top' && h.kind !== 'rest') { tip(`Hold ${MOD} and scroll over a stage or a grey rest`, px, py); return; }
      const W = S._stWheel = S._stWheel || { acc: 0 }, notches = notchesOf(W, ev); if (!notches) return;
      const r = (S._stTemp || stageList()).map(q => Object.assign({}, q)), txt = stChange(r, h.kind === 'rest' ? 'rest' : 'dur', h.kind === 'rest' ? h.r[2] : h.i, -notches, ev.shiftKey);
      S._stTemp = r; S._stX = xa().range.slice(); drawStageChart(r); tip(txt, px, py); $('#stMsg').textContent = txt;
      clearTimeout(W.t); W.t = setTimeout(() => { const fin = S._stTemp; S._stTemp = null; W.acc = 0; if (fin) setStages(fin, txt + '.'); }, 600);
    };
    ov.onpointerdown = ev => {
      if (ev.button) return; ev.preventDefault(); const [px0, py0] = local(ev), h = hit(px0, py0);
      if (h.kind === 'none') { if (sel || selR) { S._stSel = S._stRest = null; drawStageChart(); } return; }
      if (h.kind === 'rest') { S._stRest = S._stRest === h.r[2] ? null : h.r[2]; S._stSel = null; S._stX = xa().range.slice(); pop.hidden = true; return drawStageChart(); } // a click selects the rest
      const r = stageList(), s0 = secAt(px0); ov.setPointerCapture(ev.pointerId); ov._drag = true; let val = null, raf = 0;
      const live = up => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; Plotly.relayout(gd, up); }); };
      let lo = 0, hi = Infinity;
      if (h.kind === 'edge') { const e = h.e; lo = e.a !== null ? r[e.a].t0 + 5 : e.b > 0 ? r[e.b - 1].t0 + r[e.b - 1].dur : 0; hi = e.b !== null ? r[e.b].t0 + r[e.b].dur - 5 : r[e.a + 1] ? r[e.a + 1].t0 : Infinity; }
      ov.onpointermove = m => {
        const [px, py] = local(m);
        if (h.kind === 'edge') { val = Math.round(Math.max(lo, Math.min(hi, secAt(px)))); live({ [`shapes[${h.e.k}].x0`]: val / 60, [`shapes[${h.e.k}].x1`]: val / 60 }); tip(mmss(val), px, py); }
        else if (h.kind === 'top') { const q = r[h.i]; val = snapP(ya().p2l(py)); live({ [`shapes[${pv0 + 1}]`]: { type: 'line', xref: 'x', yref: 'y', x0: q.t0 / 60, x1: (q.t0 + q.dur) / 60, y0: val, y1: val, line: { color: css('--accent'), width: 2, dash: 'dot' }, visible: true } }); tip(`${(+val).toFixed(dpU)} ${u}`, px, py); }
        else if (h.kind === 'cut' && Math.abs(px - px0) >= 3) { const a = Math.round(Math.min(s0, secAt(px))), b = Math.round(Math.max(s0, secAt(px))); val = [a, b]; live({ [`shapes[${pv0}].x0`]: a / 60, [`shapes[${pv0}].x1`]: b / 60, [`shapes[${pv0}].visible`]: true }); tip(`Rest ${mmss(b - a)}`, px, py); }
      };
      ov.onpointerup = () => {
        ov._drag = false; ov.onpointermove = null; ov.onpointerup = null; if (raf) cancelAnimationFrame(raf); pop.hidden = true;
        S._stX = xa().range.slice();
        if (val === null) { if (h.kind === 'cut' || h.kind === 'top') { S._stSel = S._stSel === h.i ? null : h.i; S._stRest = null; } return drawStageChart(); } // a click selects (or clears) the stage
        if (h.kind === 'edge') { const e = h.e; if (Math.abs(val - e.x) < 0.5) return drawStageChart(); if (e.a !== null) r[e.a].dur = +(val - r[e.a].t0).toFixed(1); if (e.b !== null) { const end = r[e.b].t0 + r[e.b].dur; r[e.b].t0 = val; r[e.b].dur = +(end - val).toFixed(1); } return setStages(r, `Stage edge moved to ${mmss(val)}.`); }
        if (h.kind === 'top') { r[h.i].p = +val.toFixed(2); return setStages(r, `Stage ${h.i + 1} set to ${(+val).toFixed(dpU)} ${u}.`); }
        if (h.kind === 'cut') { const [a, b] = val; if (b - a < 3) return drawStageChart(); const out = []; r.forEach(q => { const e = q.t0 + q.dur; if (e <= a || q.t0 >= b) { out.push(q); return; } if (q.t0 < a - 0.5) out.push({ t0: q.t0, dur: a - q.t0, p: q.p }); if (e > b + 0.5) out.push({ t0: b, dur: e - b, p: q.p }); }); S._stSel = null; return setStages(out, `Rest added at ${mmss(a)}–${mmss(b)}.`); }
      };
    };
    window.addEventListener('resize', place, { once: true });
  }
  function protoSummary(stageTxt) {
    const pr = S.proto;
    if (!S.I) return S.gas.blank ? '<p class="hint">Lactate only, with no gas file. No stages have been entered yet.</p>' : '<p class="hint">Gas data only. No power or speed has been entered yet.</p>';
    if (pr.type === 'incremental') return `<p class="hint">${S.I.mode === 'cycling' ? 'Cycling' : 'Treadmill'} incremental test${pr.max ? ', then a separate VO₂max phase. Threshold stages' : '. Stages'}: ${esc(stageTxt)}${S.set.stages ? ' (edited by hand)' : S.set.blocks || S.set.plan ? ' (entered by hand)' : ''}.</p>${pr.inc && pr.inc.rests && pr.inc.rests.length ? `<label class="chk hint"><input type="checkbox" id="mRest" ${S.set.inc.dropRests === false ? '' : 'checked'}>Leave the ${pr.inc.rests.length} rest${pr.inc.rests.length > 1 ? 's' : ''} between stages out of the threshold charts and peak values</label>` : ''}`;
    const tests = (pr.allTests || []).map((T, i) => `<label class="chk"><input type="checkbox" data-ex="${Math.round(T.t0)}" ${S.set.excluded.includes(Math.round(T.t0)) ? '' : 'checked'}>${L.testName(pr, i)}: ${mmss(T.t0)}–${mmss(T.t1)}, ${T.steps.map(s => +s.p.toFixed(1)).join(', ')} ${S.I.unit}${T.complete ? '' : ' (partial)'}</label>`).join('<br>');
    setTimeout(() => $$('[data-ex]').forEach(el => (el.onchange = () => { const k = +el.dataset.ex, a = S.set.excluded; if (el.checked) a.splice(a.indexOf(k), 1); else a.push(k); rebuild(); buildTabs(); recompute(); })), 0);
    return `<p class="hint">${S.I.mode === 'cycling' ? 'Cycling' : 'Treadmill'} durability test. Steady work: ${F(pr.base) ? iVal(pr.base) : 'none found'}${pr.ttf && pr.maot ? `; work ends at ${mmss(pr.ttf)}; all-out test at ${mmss(pr.maot.t0)}` : ''}.${pr.pauses.length ? ' ' + pr.pauses.length + ' pause(s).' : ''} ${tests ? 'Tick the step tests to include:' : 'No step tests found.'}</p>${tests ? `<div class="hint">${tests}</div>` : ''}`;
  }
  function drawChecks() { const el = $('#chk'); if (!el || !S.checks) return; const ic = { ok: '✓', warn: '!', info: 'i' }; el.innerHTML = S.checks.map(c => `<li class="${c.level}"><span class="ic" aria-hidden="true">${ic[c.level]}</span><span>${esc(c.text)}</span></li>`).join(''); const w = S.checks.filter(c => c.level === 'warn').length, sm = $('#chkSum'); if (sm) sm.textContent = w ? `${w} to look at` : 'all passed'; }

  function buildProc() {
    const o = S.set.outl, av = S.set.avg, bxb = S.gas.kind === 'bxb', unit = bxb ? 'breaths' : 'samples', on = (id, fn) => { const el = $(id); if (el) el.onchange = e => later(() => fn(e)); };
    const modes = [['raw', bxb ? 'Breath by breath' : 'As in file'], ['bin', 'Time bins'], ['ma', 'Moving average'], ['roll', 'Rolling average']];
    $('#qForm').innerHTML = `
      <div class="step"><h4>Averaging <span>for the charts; VO₂peak and stage means use the recorded data in their own windows</span></h4>
        <div class="tools">${modes.map(([m, l]) => `<button data-am="${m}" aria-pressed="${av.mode === m}">${l}</button>`).join('')}
        ${av.mode === 'raw' ? '' : `<label class="chk"><input type="number" min="1" step="1" id="aPar" value="${avgParOf(S.set)}" style="width:4.5em"> ${av.mode === 'ma' ? unit : 's'}</label>`}</div></div>
      <div class="step"><h4>Outliers</h4>
        <div class="tools"><label class="chk"><input type="checkbox" id="oLocal" ${o.local ? 'checked' : ''}>Flag outliers</label>
        <select id="oNsd" ${o.local ? '' : 'disabled'}><option value="3">Strict (3 SD)</option><option value="4">Standard (4 SD)</option><option value="5">Lenient (5 SD)</option></select>
        <label class="chk"><input type="checkbox" id="oRem" ${o.remove ? 'checked' : ''} ${o.local ? '' : 'disabled'}>Remove flagged ${unit}</label>
        <label class="chk"><input type="checkbox" id="oShow" ${o.show && !o.remove && o.local ? 'checked' : ''} ${o.remove || !o.local ? 'disabled' : ''}>Show them on the Protocol chart</label><span id="outlInfo"></span></div>
        <p class="hint" data-info="outlInfo">${o.local ? `A ${bxb ? 'breath' : 'sample'} is flagged if VO₂, VCO₂ or VE is more than ${o.nsd} SD from the mean of the 5 ${unit} on each side${bxb ? `, breathing frequency is outside ${o.rfMin}–${o.rfMax} breaths/min, or tidal volume is under ${o.vtMin} L` : ''}. Flagged ${unit} stay in every calculation unless you remove them; removed ${unit} also leave the charts.` : 'Flagging is off, so every recorded ' + (bxb ? 'breath' : 'sample') + ' is used.'} ${unit[0].toUpperCase() + unit.slice(1)} with no VO₂ are always left out.</p></div>`;
    $('#oNsd').value = String(o.nsd);
    $$('[data-am]').forEach(b => (b.onclick = () => { av.mode = b.dataset.am; if (S.gas.kind === 'avg' && av.mode === 'bin' && av.bin < S.gas.avgWidth) av.bin = S.gas.avgWidth; buildProc(); recompute(); }));
    on('#aPar', e => { const v = Math.max(1, parseFloat(e.target.value) || 1); if (av.mode === 'bin') av.bin = Math.max(v, S.gas.kind === 'avg' ? S.gas.avgWidth : 1); else if (av.mode === 'ma') av.ma = Math.round(v); else av.roll = v; buildProc(); recompute(); });
    on('#oLocal', e => { o.local = e.target.checked; buildProc(); recompute(); }); on('#oNsd', e => { o.nsd = parseFloat(e.target.value); buildProc(); recompute(); });
    on('#oRem', e => { o.remove = e.target.checked; buildProc(); recompute(); }); on('#oShow', e => { o.show = e.target.checked; render(); });
  }
  function summaries() {
    const pr = S.proto, I = S.I, m = S.meta;
    $('#who').textContent = [m.studyId, m.name, m.date].filter(Boolean).join(' · ');
    const what = S.gas.blank && !I ? 'Lactate only, no stages entered yet' : !I ? 'Gas data only, no power entered' : (I.mode === 'cycling' ? 'Cycling' : 'Treadmill') + ' · ' + (pr.type === 'incremental' ? 'Incremental' + (pr.max ? ', threshold and VO₂max phases' : pr.inc && !pr.inc.ramp && pr.inc.stages.length ? ', ' + pr.inc.stages.length + ' stages' : '') : pr.tests.length + ' step test' + (pr.tests.length === 1 ? '' : 's'));
    const nw = (S.checks || []).filter(c => c.level === 'warn').length;
    $('#dSum').textContent = what + (F(m.mass) ? ' · ' + m.mass + ' kg' : '') + (nw ? ` · ${nw} check${nw > 1 ? 's' : ''} to review` : ' · checks passed');
    const fl = S.D.fl.flag, n = fl.length, f = fl.filter(x => x === 1 || x === 2).length;
    $('#qSum').textContent = `${avgLabel()} · ${f} of ${n} flagged, ${S.set.outl.remove ? 'removed' : 'kept'}`;
    if (S.gas.blank) $('#dSum').textContent = what + (F(m.mass) ? ' · ' + m.mass + ' kg' : '');
    drawChecks();
  }

