/* A small Word (.docx) writer: paragraphs, tables and PNG pictures, packed into a zip file in the browser.
   The styles, fonts and theme come from the clinic report template (LabDocxParts), so the reports look like it. */
(function (root) {
  'use strict';
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const FONT = '<w:rFonts w:ascii="Open Sans" w:hAnsi="Open Sans" w:cs="Open Sans"/>';

  /* ---------- text ---------- */
  // A run of text. o: { b, i, sz (points), color (hex), sub, sup }
  function run(text, o = {}) {
    const pr = FONT + (o.b ? '<w:b/><w:bCs/>' : '') + (o.i ? '<w:i/><w:iCs/>' : '') + (o.color ? `<w:color w:val="${o.color}"/>` : '') + (o.sz ? `<w:sz w:val="${o.sz * 2}"/><w:szCs w:val="${o.sz * 2}"/>` : '') + (o.sub ? '<w:vertAlign w:val="subscript"/>' : o.sup ? '<w:vertAlign w:val="superscript"/>' : '');
    return String(text).split('\n').map((t, k) => (k ? '<w:r><w:br/></w:r>' : '') + `<w:r><w:rPr>${pr}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`).join('');
  }
  // Text with chemical subscripts written as VO2, VCO2, VE/VO2 or with ₂ turned into proper subscripts.
  function rich(text, o = {}) {
    return String(text).split(/(₂|_\{[^}]*\})/).map(part => part === '₂' ? run('2', Object.assign({}, o, { sub: true })) : /^_\{/.test(part) ? run(part.slice(2, -1), Object.assign({}, o, { sub: true })) : part ? run(part, o) : '').join('');
  }
  // A paragraph. content: XML runs or plain text. o: { jc, border (heading lines), after (points), keep, runOpts }
  function para(content, o = {}) {
    const body = typeof content === 'string' && !content.startsWith('<w:') ? rich(content, o.run || {}) : content || '';
    const pr = (o.keep ? '<w:keepNext/>' : '') + (o.border ? '<w:pBdr><w:top w:val="single" w:sz="6" w:space="1" w:color="auto"/><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>' : '') + (o.after !== undefined || o.before !== undefined ? `<w:spacing${o.before !== undefined ? ` w:before="${o.before * 20}"` : ''}${o.after !== undefined ? ` w:after="${o.after * 20}"` : ''}/>` : '') + (o.jc ? `<w:jc w:val="${o.jc}"/>` : '');
    return `<w:p><w:pPr>${pr}<w:rPr>${FONT}</w:rPr></w:pPr>${body}</w:p>`;
  }
  const heading = text => para(rich(text, { b: true, sz: 16 }), { border: true, keep: true, before: 6 });
  const title = text => para(rich(text, { b: true, sz: 16 }), { jc: 'center' });

  /* ---------- tables ---------- */
  // rows: [{ cells: [{ text | xml, fill, color, b, jc, span }], header, fill, topLine, bottomLine }]; widths in twentieths of a point
  function table(rows, widths, o = {}) {
    const W = widths.reduce((a, b) => a + b, 0), none = o.box ? '' : '<w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders>';
    let xml = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${W}" w:type="dxa"/><w:jc w:val="${o.jc || 'center'}"/>${none}<w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    rows.forEach((r, ri) => {
      xml += `<w:tr><w:trPr>${r.header ? '<w:tblHeader/>' : ''}<w:cantSplit/><w:jc w:val="${o.jc || 'center'}"/></w:trPr>`;
      let col = 0;
      r.cells.forEach(c => {
        const span = c.span || 1, w = widths.slice(col, col + span).reduce((a, b) => a + b, 0); col += span;
        const fill = c.fill || r.fill, lines = (r.topLine ? '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>' : '') + (r.bottomLine || (o.lastLine && ri === rows.length - 1) ? '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>' : '');
        const color = c.color || (r.header ? 'FFFFFF' : undefined), body = c.xml || (c.lines || [c.text ?? '']).map((t, k) => para(rich(t, { color: k && c.subColor ? c.subColor : color, b: c.b || (k === 0 && c.firstBold), sz: k === 0 ? c.sz : c.sz2 || c.sz, i: c.i }), { jc: c.jc || o.cellJc || 'center', after: 0 })).join('');
        xml += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${lines ? `<w:tcBorders>${lines}</w:tcBorders>` : ''}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${body}</w:tc>`;
      });
      xml += '</w:tr>';
    });
    return xml + '</w:tbl>';
  }

  /* ---------- pictures ---------- */
  // A PNG picture, width in centimetres; the height keeps the picture's shape.
  function picture(doc, png, wPx, hPx, widthCm, o = {}) {
    const id = doc.images.length + 1, rid = 'rIdImg' + id, cx = Math.round(widthCm * 360000), cy = Math.round(cx * hPx / wPx);
    doc.images.push({ name: `image${id}.png`, rid, data: png });
    const pic = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${100 + id}" name="Figure ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${100 + id}" name="image${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${o.frame ? '<a:ln><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:ln>' : ''}</pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
    return para(`<w:r><w:rPr>${FONT}<w:noProof/></w:rPr>${pic}</w:r>`, { jc: o.jc || 'center', after: 2 });
  }

  /* ---------- the package ---------- */
  function doc() { return { body: [], images: [] }; }
  function pack(d, meta = {}) {
    const P = root.LabDocxParts, enc = new TextEncoder(), now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const sect = `<w:sectPr><w:pgSz w:w="${meta.a4 ? 11906 : 12240}" w:h="${meta.a4 ? 16838 : 15840}"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
    const files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/webSettings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/><Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(meta.title || '')}</dc:title><dc:creator>${esc(meta.creator || 'Lab CPET tool')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
      'docProps/app.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Lab CPET tool</Application></Properties>',
      'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/><Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>' + d.images.map(im => `<Relationship Id="${im.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.name}"/>`).join('') + '</Relationships>',
      'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${d.body.join('')}${sect}</w:body></w:document>`,
      'word/styles.xml': P['styles.xml'], 'word/settings.xml': P['settings.xml'], 'word/webSettings.xml': P['webSettings.xml'], 'word/fontTable.xml': P['fontTable.xml'], 'word/theme/theme1.xml': P['theme1.xml']
    };
    const entries = Object.entries(files).map(([n, s]) => [n, enc.encode(s)]).concat(d.images.map(im => ['word/media/' + im.name, im.data]));
    return new Blob([zip(entries)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* ---------- zip (stored, no compression) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(entries) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    entries.forEach(([name, data]) => {
      const nb = enc.encode(name), c = crc32(data), head = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0)];
      parts.push(new Uint8Array(head), nb, data);
      central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
      off += head.length + nb.length + data.length;
    });
    const cs = central.reduce((a, b) => a + b.length, 0);
    return new Blob([...parts, ...central, new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(cs), ...u32(off), ...u16(0)])]);
  }

  const API = { run, rich, para, heading, title, table, picture, doc, pack, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LabDocx = API;
})(this);
