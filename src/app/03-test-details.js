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
      ${planForm()}
      <details class="adv" ${set.blocks ? 'open' : ''}><summary>Any other protocol, such as step tests within a trial: enter blocks of stages by hand</summary>
        <div class="step" style="padding-top:8px">
          <p class="hint">One row per block of stages. Times are from the start of the COSMED recording. This replaces the detected intensity everywhere.</p>
          <div class="tools"><span>Unit</span><select id="bUnit"><option value="km/h">km/h</option><option value="W">W</option></select></div>
          <div class="tblwrap"><table class="blocks" id="bT"></table></div>
          <div class="tools"><button id="bAdd">Add block</button><button id="bApply" class="primary">Apply</button><button id="bClear" ${set.blocks ? '' : 'disabled'}>Back to detected stages</button></div>
        </div></details>
      <details class="sub" data-fold="dchk" ${openFolds.has('dchk') ? 'open' : ''}><summary>Data checks <span class="hint" id="chkSum"></span></summary><ul class="checks" id="chk"></ul></details>
      <details class="sub" data-fold="dpre" ${openFolds.has('dpre') ? 'open' : ''}><summary>Lab presets <span class="hint">${presetList().length ? presetList().length + ' saved' : 'none saved yet'}</span><span id="preInfo"></span></summary><div>
        <p class="hint" data-info="preInfo">A preset keeps the settings of a protocol so the next test starts with them: test type, entered steps (used only when a file has no power or speed), averaging and outliers, the analysis windows, the step-test options, the lactate settings and the report heading and protocol text. Thresholds, lactate values and participant details are never saved in a preset. Presets are kept in this browser; use Export and Import to share them with the lab.</p>
        <div class="tools"><select id="pSel">${presetList().map(x => `<option>${esc(x.name)}</option>`).join('') || '<option value="">No presets yet</option>'}</select><button id="pApply" ${presetList().length ? '' : 'disabled'}>Apply</button><button id="pDel" ${presetList().length ? '' : 'disabled'}>Delete</button>
          <span class="sep"></span><input id="pName" placeholder="Name, e.g. Clinic run" style="width:14em"><button id="pSave">Save these settings as a preset</button>
          <span class="sep"></span><button id="pExp" ${presetList().length ? '' : 'disabled'}>Export presets</button><button id="pImp">Import presets</button><span class="hint" id="pMsg"></span></div></div></details>`;
    bindPresets();
    bindPlan();
    // A clear prompt when the file has no power or speed: the steps must be entered (or the Lode file added) for stage and power results.
    const ns = $('#needSteps'); ns.innerHTML = !S.I && pr.type === 'incremental' && !set.blocks ? (S.gas.blank ? `<div class="needsteps"><p><b>Lactate only, with no gas file.</b> Enter the test's stages first; the Lactate tab then has a row for each stage.</p><button class="primary" id="nsGo">Enter the stages</button></div>` : `<div class="needsteps"><p><b>No power or speed in this file.</b> Enter the incremental test steps to get stages and power results, or add the Lode file.</p><button class="primary" id="nsGo">Enter the incremental test steps</button><button id="nsLode">Add the Lode file</button></div>`) : '';
    $('#qBox').hidden = !!S.gas.blank;
    if ($('#nsLode')) $('#nsLode').onclick = () => { S.addLode = true; fileIn.accept = '.xlsx,.xls'; fileIn.click(); };
    if ($('#nsGo')) $('#nsGo').onclick = () => { $('#dBox').open = true; const pd = $('#planD'); if (pd) { pd.open = true; pd.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { const f = pd.querySelector('input'); if (f) f.focus(); }, 400); } };
    $('#mSex').value = m.sex || ''; if (av.length) $('#mSrc').value = set.source; $('#mType').value = pr.max ? 'two' : pr.type;
    const on = (id, fn) => { const el = $(id); if (el) el.onchange = e => later(() => fn(e)); };
    on('#mName', e => { m.name = e.target.value; summaries(); });
    on('#mId', e => { m.studyId = e.target.value; summaries(); });
    on('#mDate', e => { m.date = e.target.value; summaries(); });
    on('#mSex', e => { m.sex = e.target.value; });
    on('#mMass', e => { m.mass = parseFloat(e.target.value); recompute(); });
    on('#mAge', e => { m.age = parseFloat(e.target.value); recompute(); });
    const full = () => { rebuild(); S.align = L.alignment(S.gas, S.I); buildDetails(); buildTabs(); recompute(); };
    on('#mSrc', e => { set.source = e.target.value; set.blocks = null; full(); });
    on('#mType', e => { set.type = e.target.value; S.view = 'protocol'; full(); });
    on('#mOff', e => { set.offset = parseFloat(e.target.value) || 0; full(); });
    on('#mHR', e => { set.hrOffset = parseFloat(e.target.value) || 0; recompute(); });
    // Manual blocks
    const rowsNow = set.blocks ? clone([...set.blocks]) : [{ start: 0, n: 5, dur: 4, first: I && I.unit === 'W' ? 100 : 8, inc: I && I.unit === 'W' ? 20 : 1 }];
    $('#bUnit').value = (set.blocks && set.blocks.unit) || (I && I.unit) || 'km/h';
    const drawB = () => {
      $('#bT').innerHTML = '<tr><th>Start (min)</th><th>Stages</th><th>Stage length (min)</th><th>First stage</th><th>Increment</th><th></th></tr>' + rowsNow.map((b, i) => `<tr><td><input type="number" step="0.5" data-b="${i}" data-f="start" value="${b.start}"></td><td><input type="number" step="1" min="1" data-b="${i}" data-f="n" value="${b.n}"></td><td><input type="number" step="0.5" data-b="${i}" data-f="dur" value="${b.dur}"></td><td><input type="number" step="0.5" data-b="${i}" data-f="first" value="${b.first}"></td><td><input type="number" step="0.5" data-b="${i}" data-f="inc" value="${b.inc}"></td><td><button data-rm="${i}" aria-label="Remove block">Remove</button></td></tr>`).join('');
      $$('[data-b]').forEach(el => (el.onchange = () => { rowsNow[+el.dataset.b][el.dataset.f] = parseFloat(el.value); }));
      $$('[data-rm]').forEach(el => (el.onclick = () => { rowsNow.splice(+el.dataset.rm, 1); drawB(); }));
    };
    drawB();
    $('#bAdd').onclick = () => { const l = rowsNow.at(-1) || { start: 0, n: 5, dur: 4, first: 8, inc: 1 }; rowsNow.push({ start: l.start + l.n * l.dur + 60, n: l.n, dur: l.dur, first: l.first, inc: l.inc }); drawB(); };
    $('#bApply').onclick = () => { if (!rowsNow.length) return; const b = clone(rowsNow); b.unit = $('#bUnit').value; set.blocks = b; set.excluded = []; full(); };
    $('#bClear').onclick = () => { set.blocks = null; full(); };
    drawChecks();
  }
  function groupStages(st) { // "warm-up 5:00 at 50 W; 7 × 3:00 from 9 to 15 km/h; 5 × 1:00 from 16 to 20 km/h"
    const out = [], rest = st.filter(q => !q.warm); st.filter(q => q.warm).forEach(q => out.push(`warm-up ${mmss(q.dur)} at ${+q.p.toFixed(1)} ${S.I.unit}`));
    let a = 0;
    for (let i = 1; i <= rest.length; i++) if (i === rest.length || Math.abs(rest[i].dur - rest[a].dur) > 20) { out.push(i - a === 1 ? `${mmss(rest[a].dur)} at ${+rest[a].p.toFixed(1)} ${S.I.unit}` : `${i - a} × ${mmss(Math.round(rest[a].dur / 5) * 5)} from ${+rest[a].p.toFixed(1)} to ${+rest[i - 1].p.toFixed(1)} ${S.I.unit}`); a = i; }
    return out.join('; ');
  }
  // The usual incremental test: warm-up, longer stages, then shorter stages to failure.
  function planDefaults() { let last = {}; try { last = JSON.parse(localStorage.getItem('labcpet:plan') || '{}'); } catch (e) { } const u = S.set.sport ? (S.set.sport === 'run' ? 'km/h' : 'W') : last.unit || 'W'; return { unit: u, warmMin: last.warmMin, warmP: last.warmP, startP: last.startP, inc: last.inc, stageMin: last.stageMin || 3, switchP: NaN, shortMin: last.shortMin || 1, endMin: S.gas.blank ? NaN : +(L.exerciseEnd(S.gas) / 60).toFixed(2) }; }
  function planForm() {
    const set = S.set, q = set.plan || planDefaults(), need = !S.I, show = need && !set.plan, val = v => (F(v) ? v : ''), uu = q.unit === 'W' ? 'W' : 'km/h', fld = (id, lab, v, extra) => `<label class="f"><span>${lab}</span><input type="number" step="any" id="${id}" value="${val(v)}" ${extra || ''}></label>`;
    return `<details class="adv" id="planD" ${show ? 'open' : ''}><summary>${set.plan ? `Change the entered steps <span class="hint">(applied: ${+set.plan.startP} ${set.plan.unit === 'W' ? 'W' : 'km/h'}, +${+set.plan.inc} every ${+set.plan.stageMin} min)</span>` : S.lode || S.I && !S.I.plan ? 'Replace the detected stages with entered ones' : 'Enter the incremental test steps'}</summary><div class="plan ${need ? 'need' : ''}" style="margin-top:8px">
      <h4>Incremental test steps</h4>
      ${S.gas.blank ? '<p class="hint">Enter the stages as they were run. Times are from the start of the first stage (or of the warm-up, if you enter one). <b>Test ended at</b> is the time the last stage stopped, so an unfinished last stage is counted correctly.</p>' : need ? '<p class="hint">This COSMED file has no power recording. Enter the steps here, or <button id="bAddLode">add the Lode file</button>. Times are from the start of the COSMED recording.</p>' : ''}
      <div class="form">
        <label class="f"><span>Unit</span><select id="plU"><option value="W">W (cycling)</option><option value="km/h">km/h (treadmill)</option></select></label>
        ${fld('plWm', 'Warm-up length (min, optional)', q.warmMin)}${fld('plWp', `Warm-up intensity (${uu}, optional)`, q.warmP)}
        ${fld('plS', `Starting intensity (${uu})`, q.startP)}${fld('plI', `Increment (${uu})`, q.inc)}${fld('plD', 'Stage length (min)', q.stageMin)}
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
      const sh = hasSh.value === '1', pl = { unit: u.value, warmMin: g('#plWm') || 0, warmP: g('#plWp'), startP: g('#plS'), inc: g('#plI'), stageMin: g('#plD'), switchP: sh ? g('#plSw') : NaN, shortMin: g('#plSd') || 1, endMin: g('#plE') };
      if (sh && !F(pl.switchP)) { $('#plMsg').textContent = `Enter the ${pl.unit === 'W' ? 'power' : 'speed'} the shorter stages started at, or choose No under Shorter stages at the end.`; return; }
      if (!F(pl.startP) || !F(pl.inc) || !(pl.stageMin > 0) || !(pl.endMin > pl.warmMin)) { $('#plMsg').textContent = 'Enter the starting intensity, increment, stage length and test end.'; return; }
      if (F(pl.switchP)) { const k = (pl.switchP - pl.startP) / pl.inc, near = [Math.floor(k), Math.ceil(k)].map(j => +(pl.startP + Math.max(1, j) * pl.inc).toFixed(2)).filter((x, i, a) => a.indexOf(x) === i);
        if (!(k >= 1 - 1e-6)) { $('#plMsg').textContent = `The shorter stages must start above the starting intensity, at ${+(pl.startP + pl.inc).toFixed(2)} ${pl.unit} or later.`; return; }
        if (Math.abs(k - Math.round(k)) > 1e-6) { $('#plMsg').textContent = `With these increments the stages go up in steps of ${pl.inc} ${pl.unit}, so the shorter stages must start at one of them, such as ${near.join(' or ')} ${pl.unit}.`; return; }
        if (pl.warmMin * 60 + k * pl.stageMin * 60 >= pl.endMin * 60) { $('#plMsg').textContent = 'At that intensity the shorter stages would start after the test ended. Check the intensity and the test end.'; return; } }
      set.plan = pl; set.blocks = null; set.type = 'incremental'; set.inc.t0 = set.inc.t1 = null;
      try { localStorage.setItem('labcpet:plan', JSON.stringify({ unit: pl.unit, warmMin: pl.warmMin, warmP: pl.warmP, startP: pl.startP, inc: pl.inc, stageMin: pl.stageMin, shortMin: pl.shortMin })); } catch (e) { }
      later(() => { rebuild(); buildDetails(); buildTabs(); recompute(); });
    };
    $('#plOff').onclick = () => { set.plan = null; set.inc.t0 = set.inc.t1 = null; later(() => { rebuild(); buildDetails(); buildTabs(); recompute(); }); };
  }
  function protoSummary(stageTxt) {
    const pr = S.proto;
    if (!S.I) return S.gas.blank ? '<p class="hint">Lactate only, with no gas file. No stages have been entered yet.</p>' : '<p class="hint">Gas data only. No power or speed has been entered yet.</p>';
    if (pr.type === 'incremental') return `<p class="hint">${S.I.mode === 'cycling' ? 'Cycling' : 'Treadmill'} incremental test${pr.max ? ', then a separate VO₂max phase. Threshold stages' : '. Stages'}: ${esc(stageTxt)}${S.set.blocks || S.set.plan ? ' (entered by hand)' : ''}.</p>`;
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

