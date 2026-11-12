  /* ---------------- Undo, redo and unsaved work ----------------
     After each click, drag, typed change or key press, the settings and threshold lines are compared with the last saved step.
     If they changed, a new step is kept (up to 100). Ctrl+Z (⌘Z on a Mac) goes back a step; Ctrl+Shift+Z or Ctrl+Y goes forward. */
  const H = { steps: [], at: -1, saved: null, timer: 0 };
  const snapOf = () => { const b = S.set.blocks; return { set: structuredClone(Object.assign({}, S.set, { blocks: b ? { list: [...b], unit: b.unit } : null })), picks: structuredClone(S.picks) }; };
  const keyOf = sn => JSON.stringify(sn);
  function checkpoint() {
    if (!S.gas || !S.D) return; const sn = snapOf(), k = keyOf(sn);
    if (H.at >= 0 && H.steps[H.at].k === k) return;
    H.steps = H.steps.slice(0, H.at + 1); H.steps.push({ sn, k }); if (H.steps.length > 100) H.steps.shift(); H.at = H.steps.length - 1;
    if (H.saved === null) H.saved = k;
  }
  const soon = () => { clearTimeout(H.timer); H.timer = setTimeout(checkpoint, 400); };
  ['pointerup', 'change', 'click', 'keyup'].forEach(ev => document.addEventListener(ev, soon, true));
  function restoreStep(i) {
    if (i < 0 || i >= H.steps.length) return false; H.at = i;
    const set = structuredClone(H.steps[i].sn.set); if (set.blocks) { const l = set.blocks.list; l.unit = set.blocks.unit; set.blocks = l; }
    S.set = set; S.picks = structuredClone(H.steps[i].sn.picks); S._pvX = null;
    rebuild(); buildDetails(); buildProc(); buildTabs(); recompute(); return true;
  }
  const toast = msg => { let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1600); };
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || !S.gas || $('#app').hidden) return;
    const k = e.key.toLowerCase(), el = document.activeElement; if (k !== 'z' && k !== 'y') return;
    if (el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(el.type)))) return; // typing boxes keep their own undo
    e.preventDefault(); clearTimeout(H.timer); checkpoint();
    const redo = k === 'y' || e.shiftKey;
    if (restoreStep(H.at + (redo ? 1 : -1))) toast(redo ? 'Redone' : 'Undone'); else toast(redo ? 'Nothing to redo' : 'Nothing to undo');
  });
  window.addEventListener('beforeunload', e => { if (!S.gas) return; clearTimeout(H.timer); checkpoint(); if (H.at >= 0 && H.steps[H.at].k !== H.saved) { e.preventDefault(); e.returnValue = ''; } });
  /* ---------------- Lab presets ----------------
     A preset holds a protocol's settings (never data or thresholds). Kept in this browser's storage; exported and imported as a JSON file. */
  const presetList = () => { try { return JSON.parse(localStorage.getItem('labcpet.presets') || '[]'); } catch (e) { return []; } };
  const presetSave = list => { try { localStorage.setItem('labcpet.presets', JSON.stringify(list)); return true; } catch (e) { return false; } };
  function presetFromCurrent(name) {
    const s = S.set, pick = (o, ks) => Object.fromEntries(ks.filter(k => o && o[k] !== undefined).map(k => [k, structuredClone(o[k])])), rep = S.meta.rep || {};
    return { name, made: new Date().toISOString().slice(0, 10), version: VERSION, set: { type: s.type, plan: s.plan ? structuredClone(s.plan) : null, oxyWin: s.oxyWin, avg: structuredClone(s.avg), outl: pick(s.outl, ['local', 'nsd', 'remove', 'show']), inc: pick(s.inc, ['stageWin', 'peakWin', 'skip', 'x']), st: pick(s.st, ['meas', 'win', 'regWin', 'vt2', 'cmp']), per: structuredClone(s.per), lac: s.lac ? pick(s.lac, ['fit', 'baseline', 'restrain', 'lt1', 'lt2', 'show']) : undefined }, report: pick(rep, ['title', 'protocol', 'src']) };
  }
  // Put a preset into S.set and S.meta. Entered steps are used only when the files have no power or speed.
  function applyPresetTo(pre) {
    const p = pre.set || {}, s = S.set, noI = !L.availableIntensity(S.gas, S.lode).length;
    if (p.type !== undefined) s.type = p.type; if (p.plan && noI) s.plan = structuredClone(p.plan); if (p.oxyWin) s.oxyWin = p.oxyWin;
    ['avg', 'outl', 'inc', 'st', 'per'].forEach(k => { if (p[k]) s[k] = Object.assign({}, s[k], structuredClone(p[k])); });
    if (p.lac) s.lac = Object.assign({}, s.lac || {}, structuredClone(p.lac), { series: (s.lac && s.lac.series) || {} });
    if (pre.report) S.meta.rep = Object.assign({}, S.meta.rep || {}, pre.report);
    return { planUsed: !!(p.plan && noI), planSkipped: !!(p.plan && !noI) };
  }
  function bindPresets() {
    const msg = t => ($('#pMsg').textContent = t), sel = $('#pSel');
    try { const last = localStorage.getItem('labcpet.lastPreset'); if (last && presetList().some(x => x.name === last)) sel.value = last; } catch (e) { /* private window */ }
    $('#pSave').onclick = () => {
      const name = $('#pName').value.trim(); if (!name) return msg('Give the preset a name first.');
      const list = presetList().filter(x => x.name !== name); list.push(presetFromCurrent(name)); list.sort((a, b) => a.name.localeCompare(b.name));
      if (!presetSave(list)) return msg('This browser would not save it (private window?). Use Export instead.');
      buildDetails(); $('#pMsg').textContent = `Saved “${name}”.`;
    };
    $('#pApply').onclick = () => {
      const pre = presetList().find(x => x.name === sel.value); if (!pre) return;
      const r = applyPresetTo(pre); try { localStorage.setItem('labcpet.lastPreset', pre.name); } catch (e) { /* private window */ }
      rebuild(); S.align = L.alignment(S.gas, S.I); buildDetails(); buildProc(); buildTabs(); recompute();
      $('#pMsg').textContent = `Applied “${pre.name}”.` + (r.planSkipped ? ' Its entered steps were not used, because this file has its own power or speed.' : '');
    };
    $('#pDel').onclick = () => { const n = sel.value; if (!n) return; presetSave(presetList().filter(x => x.name !== n)); buildDetails(); $('#pMsg').textContent = `Deleted “${n}”.`; };
    $('#pExp').onclick = () => download(new Blob([JSON.stringify({ app: 'lab-cpet-tool', kind: 'presets', version: VERSION, presets: presetList() }, null, 1)], { type: 'application/json' }), 'lab-cpet-presets.json');
    $('#pImp').onclick = () => {
      const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.json,application/json';
      fi.onchange = async () => {
        try {
          const o = JSON.parse(await fi.files[0].text()); if (o.app !== 'lab-cpet-tool' || o.kind !== 'presets' || !Array.isArray(o.presets)) throw new Error('This is not a Lab CPET tool presets file.');
          const names = new Set(o.presets.map(x => x.name)), list = presetList().filter(x => !names.has(x.name)).concat(o.presets).sort((a, b) => a.name.localeCompare(b.name));
          presetSave(list); buildDetails(); fillStartPresets(); $('#pMsg').textContent = `Imported ${o.presets.length} preset${o.presets.length === 1 ? '' : 's'}.`;
        } catch (e) { $('#pMsg').textContent = e.message; }
      };
      fi.click();
    };
  }
  function fillStartPresets() {
    const sel = $('#sPreset'); if (!sel) return; const list = presetList(); let last = ''; try { last = localStorage.getItem('labcpet.lastPreset') || ''; } catch (e) { /* private window */ }
    sel.innerHTML = '<option value="">None</option>' + list.map(x => `<option ${x.name === last ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    sel.closest('.tools').hidden = !list.length;
  }
  fillStartPresets();
  setupInfo();
  window.LabApp = { S, recompute, results, methodsText, H, _lac: { series: lacSeries, analyse: lacAnalyse, rows: lacRows }, _rep: { clientReport, researchReport } };
})();
