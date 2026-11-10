  // "What to look for": schematic reference charts drawn from the noise-free model behind the simulated example test
  // (src/example.js), with VT1 and VT2 marked. Based on the approach of Keir et al. (2022); not their figure.
  const LOOK = [['vco2', 'VCO₂ (L/min)'], ['ve', 'VE (L/min)'], ['eqo2', 'VE/VO₂'], ['eqco2', 'VE/VCO₂'], ['peto2', 'PETO₂ (mmHg)'], ['petco2', 'PETCO₂ (mmHg)'], ['rer', 'RER'], ['la', 'Lactate (mmol/L)']];
  function openLookFor() {
    let dlg = $('#lookDlg');
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'lookDlg'; dlg.setAttribute('aria-labelledby', 'lookH');
      dlg.innerHTML = `<div class="lookhead"><h2 id="lookH">What to look for at VT1 and VT2</h2><button id="lookX" aria-label="Close">Close</button></div>
        <p class="hint">Typical patterns from a simulated test. Based on Keir et al. (2022), <i>Sports Med</i>, <a href="https://doi.org/10.1007/s40279-021-01581-z" target="_blank" rel="noopener">doi:10.1007/s40279-021-01581-z</a>.</p>
        <div class="lookgrid">${LOOK.map(([k]) => `<div class="chart" id="look_${k}" style="height:200px"></div>`).join('')}</div>`;
      document.body.appendChild(dlg);
      dlg.addEventListener('click', e => { if (e.target === dlg || e.target.id === 'lookX') dlg.close(); });
    }
    dlg.showModal();
    const E = window.LabExample, C = E.curves(), at = P => C.find(q => q.P === P).vo2, v1 = at(E.truth.vt1), v2 = at(E.truth.vt2);
    const c1 = css('--vt1'), c2 = css('--vt2'), fg = css('--fg'), x = C.map(q => q.vo2);
    const pad = [x[0] - 0.07 * (x.at(-1) - x[0]), x.at(-1) + 0.03 * (x.at(-1) - x[0])], ax = (t, r) => ({ range: r, title: { text: t, font: { size: 11 } }, showline: true, linecolor: fg, linewidth: 1, ticks: 'outside', tickcolor: fg, showgrid: false, zeroline: false });
    LOOK.forEach(([k, yl]) => {
      const vl = (v, c) => ({ type: 'line', xref: 'x', yref: 'paper', x0: v, x1: v, y0: 0, y1: 1, line: { color: c, width: 1.5, dash: 'dot' } });
      Plotly.newPlot('look_' + k, [{ x, y: C.map(q => q[k]), mode: 'lines', type: 'scatter', line: { color: fg, width: 2 }, hoverinfo: 'skip' }],
        lay({ margin: { l: 56, r: 10, t: 20, b: 40 }, showlegend: false, dragmode: false, hovermode: false, xaxis: ax('VO₂ (L/min)', pad), yaxis: ax(yl),
          shapes: [vl(v1, c1), vl(v2, c2)],
          annotations: [['VT1', v1, c1], ['VT2', v2, c2]].map(([t, v, c]) => ({ x: v, y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom', text: t, showarrow: false, font: { color: c, size: 11 } })) }), { staticPlot: true, responsive: true });
    });
  }
  document.addEventListener('click', e => { if (e.target.closest('#lookFor')) openLookFor(); });
