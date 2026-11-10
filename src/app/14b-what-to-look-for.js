  // "What to look for": original reference charts drawn from the simulated example test (src/example.js), with VT1 and VT2
  // marked where the model puts them, and the usual signs for each. Approach as described by Keir et al. (2022); not their figure.
  const LOOK = [
    ['vco2', 'VCO<sub>2</sub> against VO<sub>2</sub> (V-slope)', 'VCO₂ (L/min)', '<b class="vt1c">VT1</b>: the slope gets steeper, as buffering of lactic acid adds extra CO₂.'],
    ['ve', 'Ventilation (VE)', 'VE (L/min)', '<b class="vt1c">VT1</b>: VE starts to rise faster. <b class="vt2c">VT2</b>: a second, steeper rise.'],
    ['eqo2', 'VE/VO<sub>2</sub>', 'VE/VO₂', '<b class="vt1c">VT1</b>: the lowest point before a steady rise, while VE/VCO₂ stays flat.'],
    ['eqco2', 'VE/VCO<sub>2</sub>', 'VE/VCO₂', 'Flat (or falling) through VT1. <b class="vt2c">VT2</b>: starts to rise.'],
    ['peto2', 'End-tidal O<sub>2</sub> (P<sub>ET</sub>O<sub>2</sub>)', 'PETO₂ (mmHg)', '<b class="vt1c">VT1</b>: starts to rise, while PETCO₂ does not fall.'],
    ['petco2', 'End-tidal CO<sub>2</sub> (P<sub>ET</sub>CO<sub>2</sub>)', 'PETCO₂ (mmHg)', 'Flat or rising between VT1 and VT2. <b class="vt2c">VT2</b>: starts to fall.'],
    ['rer', 'Respiratory exchange ratio (RER)', 'RER', '<b class="vt1c">VT1</b>: rises faster. Helps confirm VT1; not used on its own.'],
    ['la', 'Blood lactate', 'Lactate (mmol/L)', 'The first rise above baseline is near <b class="vt1c">VT1</b>; the rapid rise is near <b class="vt2c">VT2</b>.'],
  ];
  function lookData() {
    if (S._look) return S._look;
    const E = window.LabExample, T = E.truth, R = E.rows().filter(b => b.t >= T.rest && b.t < T.end), bins = [];
    const med = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    for (let a = T.rest; a < T.end; a += 15) { const g = R.filter(b => b.t >= a && b.t < a + 15); if (g.length < 3) continue;
      const o = {}; ['vo2', 'vco2', 've', 'eqo2', 'eqco2', 'peto2', 'petco2', 'rer'].forEach(k => (o[k] = med(g.map(b => b[k])))); bins.push(o); }
    const vo2At = P => 0.8 + 0.0105 * P; // the model's steady-state VO₂ (L/min) at a power below VT2
    const la = []; for (let P = T.p0; P < T.p0 + 8 * T.inc + 1; P += T.inc) { const st = R.filter(b => b.P === P && b.t >= T.rest + ((P - T.p0) / T.inc) * T.stage + T.stage - 30); if (st.length) la.push({ vo2: med(st.map(b => b.vo2)), la: E.lactate(P) }); }
    return (S._look = { bins, la, vt1: vo2At(T.vt1), vt2: vo2At(T.vt2) + 0.01 });
  }
  function openLookFor() {
    let dlg = $('#lookDlg');
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'lookDlg'; dlg.setAttribute('aria-labelledby', 'lookH');
      dlg.innerHTML = `<div class="lookhead"><h2 id="lookH">What to look for at VT1 and VT2</h2><button id="lookX" aria-label="Close">Close</button></div>
        <p class="hint">Typical patterns, plotted against VO<sub>2</sub> from a <b>simulated</b> incremental cycling test (the example test, not a real person), with <b class="vt1c">VT1</b> and <b class="vt2c">VT2</b> where the model puts them. Real data are noisier and not every sign is clear in every test: look for the signs that agree across several charts, rather than relying on one.</p>
        <div class="lookgrid">${LOOK.map(([k, h, , cue]) => `<div class="panel"><h3>${h}</h3><div class="chart" id="look_${k}" style="height:190px"></div><p class="lookcue">${cue}</p></div>`).join('')}</div>
        <p class="hint">VT1 is also called the gas exchange threshold or estimated lactate threshold; VT2 is also called the respiratory compensation point. Approach as described in Keir DA, Iannetta D, Mattioni Maturana F, Kowalchuk JM, Murias JM. Identification of non-invasive exercise thresholds: methods, strategies, and an online app. <i>Sports Medicine</i> (2022), <a href="https://doi.org/10.1007/s40279-021-01581-z" target="_blank" rel="noopener">doi:10.1007/s40279-021-01581-z</a>. These charts are drawn for this tool and are not taken from that paper.</p>`;
      document.body.appendChild(dlg);
      dlg.addEventListener('click', e => { if (e.target === dlg || e.target.id === 'lookX') dlg.close(); });
    }
    dlg.showModal();
    const L = lookData(), c1 = css('--vt1'), c2 = css('--vt2'), x = L.bins.map(b => b.vo2);
    LOOK.forEach(([k, , yl]) => {
      const tr = k === 'la' ? [{ x: L.la.map(q => q.vo2), y: L.la.map(q => q.la), mode: 'lines+markers', type: 'scatter', line: { color: css('--fg'), width: 1.5 }, marker: { size: 6 }, hoverinfo: 'skip' }]
        : [{ x, y: L.bins.map(b => b[k]), mode: 'markers', type: 'scatter', marker: { size: 5, color: css('--fg'), opacity: 0.7 }, hoverinfo: 'skip' }];
      const vl = (v, c, t) => ({ type: 'line', xref: 'x', yref: 'paper', x0: v, x1: v, y0: 0, y1: 1, line: { color: c, width: 2, dash: 'dot' } });
      Plotly.newPlot('look_' + k, tr, lay({ margin: { l: 52, r: 10, t: 18, b: 38 }, showlegend: false, dragmode: false, hovermode: false,
        xaxis: { title: { text: 'VO₂ (L/min)', font: { size: 11 } }, gridcolor: css('--grid'), zeroline: false },
        yaxis: { title: { text: yl, font: { size: 11 } }, gridcolor: css('--grid'), zeroline: false },
        shapes: [vl(L.vt1, c1), vl(L.vt2, c2)],
        annotations: [['VT1', L.vt1, c1], ['VT2', L.vt2, c2]].map(([t, v, c]) => ({ x: v, y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom', text: t, showarrow: false, font: { color: c, size: 11 } })) }), { staticPlot: true, responsive: true });
    });
  }
  document.addEventListener('click', e => { if (e.target.closest('#lookFor')) openLookFor(); });
