/* Lab CPET tool — file parsing (COSMED, Lode, heart-rate files). Started from the GlyDurability parser.
   Works in the browser (global XLSX from SheetJS) and in Node (require('xlsx')). */
(function (root) {
  'use strict';
  const X = (typeof XLSX !== 'undefined') ? XLSX : (typeof require !== 'undefined' ? require('xlsx') : null);

  const num = v => {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).replace(/[<>,]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  };

  // Time cells: SheetJS gives a fraction of a day for time-formatted cells, or a string.
  function toSeconds(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v < 2 ? Math.round(v * 86400 * 1000) / 1000 : v;
    if (v instanceof Date) return v.getHours() * 3600 + v.getMinutes() * 60 + v.getSeconds();
    const m = String(v).trim().match(/^(\d+):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/);
    if (m) return m[3] !== undefined ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]);
    return NaN;
  }

  function rows(ws) { return X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }); }

  function readWorkbook(buf) { return X.read(buf, { type: buf instanceof ArrayBuffer ? 'array' : 'buffer', cellDates: false }); }

  // Identify what a workbook is.
  function identify(wb) {
    if (wb.SheetNames.some(n => /^Bicycle/i.test(n))) return 'lode';
    if (wb.Sheets.Data) {
      const r0 = (rows(wb.Sheets.Data)[0] || []).map(x => String(x));
      if (r0.includes('t') && r0.includes('VO2')) return 'cosmed';
    }
    return 'unknown';
  }

  // Label/value pairs in the Cosmed header block (columns 0-7, first 30 rows).
  function headerMeta(R) {
    const out = {};
    for (let i = 0; i < Math.min(30, R.length); i++) {
      const r = R[i] || [];
      for (let j = 0; j < 7; j++) {
        const k = r[j];
        if (typeof k === 'string' && r[j + 1] !== null && r[j + 1] !== undefined && r[j + 1] !== '') out[k.trim()] = r[j + 1];
      }
    }
    return out;
  }

  const COSMED_VARS = { rf: 'Rf', vt: 'VT', ve: 'VE', vo2: 'VO2', vco2: 'VCO2', rer: 'RQ', eqo2: 'VE/VO2', eqco2: 'VE/VCO2', peto2: 'PetO2', petco2: 'PetCO2', hr: 'HR' };

  function parseCosmed(wb) {
    const R = rows(wb.Sheets.Data);
    const h = (R[0] || []).map(x => (x === null ? '' : String(x)));
    const i0 = h.indexOf('t');
    if (i0 < 0) throw new Error('Cosmed file: no "t" column found in the Data sheet.');
    const col = {};
    for (const [k, name] of Object.entries(COSMED_VARS)) { const j = h.indexOf(name, i0); if (j >= 0) col[k] = j; }
    const t = [], v = {}, markers = []; Object.keys(col).forEach(k => (v[k] = []));
    // Ergometer channels recorded by the COSMED, kept apart from the gas variables because they are not averaged.
    const auxCol = { speed: h.indexOf('Speed', i0), grade: Math.max(h.indexOf('Grade', i0), h.indexOf('Elevation', i0)), power: h.findIndex((x, j) => j >= i0 && /^(power|load|watt|watts)$/i.test(x.trim())) };
    const iPhase = h.indexOf('Phase', i0), aux = { speed: [], grade: [], power: [], phase: [] };
    const sUnit = auxCol.speed >= 0 ? String((R[1] || [])[auxCol.speed] || '') : '', sFactor = /mph/i.test(sUnit) ? 1.60934 : 1; // always km/h inside the tool
    aux.speedUnit = sUnit;
    const im = h.findIndex((x, j) => j >= i0 && /^marker$/i.test(x.trim()));
    for (let i = 1; i < R.length; i++) {
      const r = R[i]; if (!r) continue;
      const ts = toSeconds(r[i0]); if (!Number.isFinite(ts)) continue;
      t.push(ts);
      aux.speed.push(auxCol.speed >= 0 ? num(r[auxCol.speed]) * sFactor : NaN); aux.grade.push(auxCol.grade >= 0 ? num(r[auxCol.grade]) : NaN); aux.power.push(auxCol.power >= 0 ? num(r[auxCol.power]) : NaN); aux.phase.push(iPhase >= 0 ? String(r[iPhase] || '') : '');
      if (im >= 0 && r[im] !== null && String(r[im]).trim() !== '') markers.push({ t: ts, text: String(r[im]).trim() });
      for (const k in col) {
        let x = num(r[col[k]]);
        if ((k === 'vo2' || k === 'vco2') && Number.isFinite(x)) x = x / 1000; // mL/min -> L/min
        v[k].push(x);
      }
    }
    const dts = []; for (let i = 1; i < t.length; i++) dts.push(t[i] - t[i - 1]);
    dts.sort((a, b) => a - b);
    const medDt = dts.length ? dts[Math.floor(dts.length / 2)] : NaN;
    const meta = headerMeta(R);
    const saved = savedThresholds(wb);
    return {
      kind: medDt >= 8 ? 'avg' : 'bxb', avgWidth: medDt >= 8 ? Math.round(medDt) : null,
      t, v, has: Object.keys(col), markers, aux,
      meta: {
        firstName: meta['First Name'] || '', lastName: meta['Last Name'] || '', sex: meta['Gender'] || '',
        mass: num(meta['Weight (kg)']), height: num(meta['Height (cm)']), age: num(meta['Age']),
        testDate: meta['Test date'] || '', testTime: meta['Test Time'] || '', ergometer: meta['Ergometer'] || '', protocol: meta['Protocol'] || '', hrMax: num(meta['HR Max']), id: meta['ID1'] || '', saved
      }
    };
  }

  // VT1 and VT2 VO2 (L/min) if someone marked them in the COSMED software (Results sheet).
  function savedThresholds(wb) {
    if (!wb.Sheets.Results) return {};
    const R = rows(wb.Sheets.Results), head = R.find(r => r && r.some(x => /^VT1/.test(String(x)))), vo2 = R.find(r => r && r[0] === 'VO2'), out = {};
    if (!head || !vo2) return out;
    head.forEach((x, j) => { const n = num(vo2[j]); if (Number.isFinite(n)) { if (/^VT1/.test(String(x))) out.vt1 = n / 1000; if (/^VT2/.test(String(x))) out.vt2 = n / 1000; } });
    return out;
  }

  function parseLode(wb) {
    const name = wb.SheetNames.find(n => /^Bicycle/i.test(n));
    const R = rows(wb.Sheets[name]);
    const h = (R[0] || []).map(x => String(x));
    const it = h.indexOf('Time'), il = h.indexOf('Load'), ir = h.indexOf('RPM');
    if (it < 0 || il < 0) throw new Error('Lode file: "Time" and "Load" columns not found in ' + name + '.');
    const t = [], p = [], rpm = [];
    for (let i = 1; i < R.length; i++) {
      const r = R[i]; if (!r) continue;
      const ts = num(r[it]), pw = num(r[il]); if (!Number.isFinite(ts) || !Number.isFinite(pw)) continue;
      t.push(ts); p.push(pw); rpm.push(ir >= 0 ? num(r[ir]) : NaN);
    }
    const meta = {};
    if (wb.Sheets.Participant) {
      const P = rows(wb.Sheets.Participant); const ph = (P[0] || []).map(String), pr = P[1] || [];
      const g = k => { const j = ph.indexOf(k); return j >= 0 ? pr[j] : null; };
      meta.firstName = g('First Name') || ''; meta.lastName = g('Last Name') || '';
      meta.sex = g('Gender') || ''; meta.mass = num(g('Weight'));
    }
    if (wb.Sheets.Devices) {
      const D = rows(wb.Sheets.Devices); const dh = (D[0] || []).map(String), dr = D[1] || [];
      const j = dh.indexOf('Date'); if (j >= 0) meta.date = dr[j];
      const k = dh.indexOf('Duration'); if (k >= 0) meta.duration = num(dr[k]);
    }
    return { t, p, rpm, sheet: name, meta };
  }

  // Heart-rate files: TCX, GPX, or CSV (Polar Flow export or a generic time/HR table).
  function parseHR(text, filename) {
    const name = (filename || '').toLowerCase();
    const out = { t: [], hr: [], abs: false, start: null, source: filename };
    if (/<TrainingCenterDatabase|\.tcx$/i.test(text) || name.endsWith('.tcx')) {
      const re = /<Trackpoint>[\s\S]*?<Time>([^<]+)<\/Time>[\s\S]*?<HeartRateBpm>[\s\S]*?<Value>(\d+)<\/Value>[\s\S]*?<\/Trackpoint>/g;
      let m; while ((m = re.exec(text))) { out.t.push(Date.parse(m[1]) / 1000); out.hr.push(+m[2]); }
      out.abs = true;
    } else if (/<gpx|\.gpx$/i.test(text) || name.endsWith('.gpx')) {
      const re = /<trkpt[\s\S]*?<time>([^<]+)<\/time>[\s\S]*?<(?:\w+:)?hr>(\d+)<\/(?:\w+:)?hr>[\s\S]*?<\/trkpt>/g;
      let m; while ((m = re.exec(text))) { out.t.push(Date.parse(m[1]) / 1000); out.hr.push(+m[2]); }
      out.abs = true;
    } else {
      const lines = text.split(/\r?\n/).map(l => l.split(/[,;\t]/).map(s => s.trim()));
      let hi = -1, ti = -1, hri = -1;
      for (let i = 0; i < Math.min(lines.length, 60); i++) {
        const L = lines[i].map(s => s.toLowerCase());
        const a = L.findIndex(s => /^time/.test(s) || s === 'timestamp' || s === 'elapsed');
        const b = L.findIndex(s => /^hr\b|heart ?rate|^hr \(bpm\)/.test(s));
        if (a >= 0 && b >= 0) { hi = i; ti = a; hri = b; break; }
      }
      if (hi < 0) throw new Error('Heart-rate CSV: could not find "Time" and "HR" columns.');
      // Polar Flow: start date/time in the summary rows above the sample header.
      for (let i = 0; i < hi - 1; i++) {
        const L = lines[i].map(s => s.toLowerCase()), di = L.indexOf('date'), si = L.indexOf('start time');
        if (di >= 0 && si >= 0 && lines[i + 1]) {
          const d = lines[i + 1][di], s = lines[i + 1][si];
          const dm = d && d.match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
          if (dm) out.start = new Date(+dm[3], +dm[2] - 1, +dm[1], ...s.split(':').map(Number)).getTime() / 1000;
        }
      }
      for (let i = hi + 1; i < lines.length; i++) {
        const r = lines[i]; if (!r || r.length <= Math.max(ti, hri)) continue;
        const hrv = num(r[hri]); if (!Number.isFinite(hrv) || hrv <= 0) continue;
        let tv = toSeconds(r[ti]);
        if (!Number.isFinite(tv)) { const d = Date.parse(r[ti]); if (Number.isFinite(d)) { tv = d / 1000; out.abs = true; } }
        if (!Number.isFinite(tv)) continue;
        out.t.push(tv); out.hr.push(hrv);
      }
      if (!out.abs && out.start !== null) { out.t = out.t.map(x => x + out.start); out.abs = true; }
    }
    if (!out.t.length) throw new Error('No heart-rate samples found in ' + filename + '.');
    if (out.abs) { out.start = out.t[0]; out.t = out.t.map(x => x - out.start); }
    return out;
  }

  // Cosmed header date/time -> epoch seconds (local time), for aligning absolute HR files.
  function cosmedStartEpoch(meta) {
    const d = String(meta.testDate || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const tm = String(meta.testTime || '').match(/(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/i);
    if (!d || !tm) return null;
    let H = +tm[1]; if (tm[4]) { if (/PM/i.test(tm[4]) && H < 12) H += 12; if (/AM/i.test(tm[4]) && H === 12) H = 0; }
    return new Date(+d[3], +d[2] - 1, +d[1], H, +tm[2], +tm[3]).getTime() / 1000;
  }

  const API = { readWorkbook, identify, parseCosmed, parseLode, parseHR, cosmedStartEpoch, toSeconds };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.GDParse = API;
})(this);
