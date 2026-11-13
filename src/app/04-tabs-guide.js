  /* ---------------- Tabs ---------------- */
  // The data chosen on the start page for an incremental test: 'gas' hides the Lactate tab, 'lac' hides the gas thresholds tab (and, with no gas file, the Protocol tab).
  const dataMode = () => (S.proto && S.proto.type === 'incremental' && S.set.data) || 'both', noGas = () => !!(S.gas && S.gas.blank);
  function tabs() { const dm = dataMode(); return [...(noGas() ? [] : [['protocol', 'Protocol']]), ...(S.proto.type === 'incremental' ? (dm === 'lac' ? [] : [['incremental', S.proto.max ? 'Thresholds and VO₂max' : 'Thresholds and VO₂peak']]) : [['steps', 'Step tests'], ...(F(S.proto.base) ? [['prolonged', 'Prolonged exercise']] : [])]), ...(dm === 'gas' ? [] : [['lactate', 'Lactate']]), ['summary', 'Summary']]; }
  function buildTabs() {
    const T = tabs(); if (!T.some(t => t[0] === S.view)) S.view = T[0][0];
    $('#tabs').innerHTML = T.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === S.view}">${l}</button>`).join('') + `<button class="gtog" id="gTog" aria-pressed="${guideOn()}" title="Step-by-step guidance through the analysis">Guided steps</button>`;
    $$('[data-tab]').forEach(b => (b.onclick = () => { S.view = b.dataset.tab; $$('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b)); render(); }));
    $('#gTog').onclick = () => { setGuide(!guideOn()); $('#gTog').setAttribute('aria-pressed', guideOn()); renderGuide(); };
  }
  // Instructions and notes live in pop-ups behind an (i) button, so each tab stays uncluttered.
  // Mark any element with data-info="<id of the element that gets the button>"; it is moved into a pop-up after each render.
  function infoize() {
    document.querySelectorAll('[data-info]').forEach(el => {
      const tgt = document.getElementById(el.dataset.info); el.removeAttribute('data-info'); if (!tgt) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ib'; b.textContent = 'i'; b.title = 'More information'; b.setAttribute('aria-label', 'More information'); b.setAttribute('aria-expanded', 'false');
      el.classList.remove('hint'); el.removeAttribute('style'); b._pop = el.tagName === 'UL' ? el.outerHTML : `<p>${el.innerHTML}</p>`; tgt.appendChild(b); el.remove();
    });
  }
  function setupInfo() {
    const pop = document.createElement('div'); pop.id = 'ipop'; pop.setAttribute('role', 'dialog'); pop.hidden = true; document.body.appendChild(pop); let owner = null;
    const close = () => { pop.hidden = true; if (owner) owner.setAttribute('aria-expanded', 'false'); owner = null; };
    document.addEventListener('click', e => {
      const b = e.target.closest('.ib');
      if (b) { e.preventDefault(); if (owner === b) return close(); close(); owner = b; b.setAttribute('aria-expanded', 'true'); pop.innerHTML = b._pop; pop.hidden = false;
        const r = b.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight; pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left - 12)) + 'px'; pop.style.top = (r.bottom + 6 + h > window.innerHeight && r.top - h - 6 > 0 ? r.top - h - 6 : r.bottom + 6) + 'px'; return; }
      if (!pop.contains(e.target)) close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    window.addEventListener('scroll', close, true); window.addEventListener('resize', close);
    new MutationObserver(() => { if (document.querySelector('[data-info]')) infoize(); if (owner && !document.body.contains(owner)) close(); }).observe(document.body, { childList: true, subtree: true });
  }
  // A section that opens and closes when its title is clicked (an HTML <details> element). Which ones are open is remembered while the page is open.
  const openFolds = new Set();
  const fold = (id, title, sub, body) => `<details class="box fold" data-fold="${id}" ${openFolds.has(id) ? 'open' : ''}><summary>${title}<span>${sub}</span></summary><div class="foldbody">${body}</div></details>`;
  document.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.fold) (d.open ? openFolds.add(d.dataset.fold) : openFolds.delete(d.dataset.fold)); }, true);
  /* ---------------- Guided steps ----------------
     A bar under the tabs that walks through the analysis in order. Each step opens the right tab or section. On by default; switched off with the Guided steps button, remembered in this browser. */
  const guideOn = () => { try { return localStorage.getItem('labcpet.guided') !== 'off'; } catch (e) { return true; } };
  const setGuide = on => { try { localStorage.setItem('labcpet.guided', on ? 'on' : 'off'); } catch (e) { /* private window */ } };
  function guideSteps() {
    const pr = S.proto, inc = pr.type === 'incremental', openBox = id => () => { const b = $(id); if (b) { b.open = true; b.scrollIntoView({ block: 'start', behavior: 'smooth' }); } };
    const dm = dataMode(), first = noGas() ? 'lactate' : 'protocol';
    const st = noGas() ? [{ tab: 'lactate', title: 'Enter the test details and stages', text: 'Type the name and body mass under Test details. Then open Stages and enter the steps (or unlock the table and type each stage).', act: openBox('#sBox') }] : [
      { tab: 'protocol', title: 'Check the test details', text: 'Open Test details and check the name, body mass and test type. Open Stages and check the stages match your protocol; unlock it to correct them. Anything marked ! under Data checks needs a look.', act: openBox('#dBox') },
      { tab: 'protocol', title: 'Look over the whole test', text: 'Look for mask leaks, gaps or odd values on the Protocol chart. To drop a stretch of noisy or wrong data, click Leave out a period and drag across it. To clean or smooth the data, open Data processing.' }
    ];
    void first;
    if (inc && dm === 'lac') { /* no gas thresholds */ }
    else if (inc) st.push({ tab: 'incremental', title: 'Place the thresholds', text: 'Check the highlighted analysis window, then drag the VT1 and VT2 lines on the charts, or click Use next to a suggestion. Further down, the Oxynet models (two deep-learning models) give their own suggestions: click Use these lines on either chart to try them.' });
    else {
      st.push({ tab: 'steps', title: 'Place VT1 in each step test', text: 'Highlight the data to use in each test if needed, then drag the VT1 line on each test’s charts. Compare the tests stage by stage below.' });
      if (F(pr.base)) st.push({ tab: 'prolonged', title: 'Check the prolonged exercise', text: 'Read the summary and the values for each recording.' });
    }
    if (dm === 'lac') st.push({ tab: 'lactate', title: 'Enter the lactate values', text: 'Type or paste the lactate values and check LT1 and LT2.' });
    else if (dm !== 'gas') st.push({ tab: 'lactate', title: 'Lactate, if taken', text: 'Type or paste the lactate values and check LT1 and LT2. Skip this step if no lactate was taken.' });
    st.push({ tab: 'summary', title: 'Save, export and report', text: 'Check the thresholds table, then Save analysis, Export Excel, or generate a Word report under Reports.', act: () => { const d = document.querySelector('details[data-fold=rep]'); if (d) { d.open = true; openFolds.add('rep'); } } });
    return st;
  }
  function renderGuide() {
    const el = $('#guide'); if (!el) return;
    if (!guideOn() || !S.proto) { el.innerHTML = ''; el.hidden = true; return; }
    const st = guideSteps(); S.gStep = Math.max(0, Math.min(st.length - 1, S.gStep || 0));
    // follow the tab the person is on, if it is a different step's tab
    if (st[S.gStep].tab !== S.view) { const j = st.findIndex(x => x.tab === S.view); if (j >= 0) S.gStep = j; }
    const i = S.gStep, cur = st[i]; el.hidden = false;
    el.innerHTML = `<ol class="gsteps">${st.map((x, j) => `<li><button data-gs="${j}" aria-current="${j === i ? 'step' : 'false'}" class="${j < i ? 'done' : ''}"><b>${j + 1}</b> ${x.title}</button></li>`).join('')}</ol>
      <div class="gnow"><p><b>Step ${i + 1} of ${st.length}: ${cur.title}.</b> ${cur.text}</p><div class="tools"><button id="gBack" ${i ? '' : 'disabled'}>Back</button><button class="primary" id="gNext">${i === st.length - 1 ? 'Finish' : 'Next'}</button><button id="gOff">Hide guided steps</button></div></div>`;
    const go = j => { S.gStep = j; const s2 = st[j]; if (S.view !== s2.tab) { S.view = s2.tab; $$('[data-tab]').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === S.view)); render(); } else renderGuide(); if (s2.act) setTimeout(s2.act, 0); };
    $$('[data-gs]').forEach(b => (b.onclick = () => go(+b.dataset.gs)));
    $('#gBack').onclick = () => go(i - 1);
    $('#gNext').onclick = () => (i === st.length - 1 ? (setGuide(false), $('#gTog') && $('#gTog').setAttribute('aria-pressed', 'false'), renderGuide(), toast('Guided steps hidden. Turn them on again with Guided steps.')) : go(i + 1));
    $('#gOff').onclick = () => { setGuide(false); if ($('#gTog')) $('#gTog').setAttribute('aria-pressed', 'false'); renderGuide(); };
  }
  function render() {
    renderGuide();
    $$('#views .js-plotly-plot').forEach(el => Plotly.purge(el));
    ({ protocol: vProtocol, incremental: vIncremental, steps: vSteps, prolonged: vProlonged, lactate: vLactate, summary: vSummary })[S.view]();
  }

