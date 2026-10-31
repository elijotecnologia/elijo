// scripts/validate-catalog.mjs
// Validacion local del CSV de Google Sheets de Elijo Tecnologia.
// Uso: node scripts/validate-catalog.mjs [ruta.csv]
// Si no se pasa ruta, intenta leer SHEETS_CSV_URL desde sheets-config.js y descargarlo.
// No modifica la hoja ni ningun archivo del proyecto.

import { readFileSync } from 'node:fs';

async function loadCSV(arg) {
  if (arg) {
    return readFileSync(arg, 'utf8');
  }
  // Leer URL desde sheets-config.js
  let url = '';
  try {
    const cfg = readFileSync('sheets-config.js', 'utf8');
    const m = cfg.match(/SHEETS_CSV_URL\s*:\s*['"]([^'"]+)['"]/);
    if (m) url = m[1];
  } catch (_) {}
  if (!url) {
    console.error('No se encontro SHEETS_CSV_URL en sheets-config.js y no se paso ruta de archivo.');
    process.exit(1);
  }
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  for (const line of lines) {
    const cells = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  const cleaned = String(v).replace(/[^\d.]/g, '');
  if (cleaned === '' || cleaned === '.') return NaN;
  // Si hay mas de un punto, quedarse con el ultimo como decimal
  const parts = cleaned.split('.');
  const num = parts.length > 1
    ? parts.slice(0, -1).join('') + '.' + parts[parts.length - 1]
    : cleaned;
  return parseFloat(num);
}

function main() {
  const arg = process.argv[2];
  loadCSV(arg).then(text => {
    const rows = parseCSV(text);
    const header = rows[0];
    const data = rows.slice(1);

    const EXPECTED = ['ID', 'name', 'brand', 'category', 'price', 'oldPrice', 'badge', 'Columna 8 (image)', 'description', 'specs', 'tags', 'featured'];
    console.log('=== VALIDACION DE CATALOGO ELIJO ===');
    console.log('Archivo/origen:', arg || '(descargado desde sheets-config.js)');
    console.log('Encabezado real :', header.join(' | '));
    console.log('Columnas esperadas (contrato):', EXPECTED.join(' | '));
    console.log('Filas de datos :', data.length);
    console.log('');

    // 1. Numero de columnas
    const badCols = data.map((r, i) => ({ i: i + 2, n: r.length })).filter(x => x.n !== header.length);
    console.log('--- 1. Estructura de columnas ---');
    console.log('Filas con cantidad de columnas distinta a', header.length, ':', badCols.length);
    if (badCols.length) console.log('  Ejemplos:', badCols.slice(0, 5));

    // 2. Campos vacios
    const emptyName = data.filter(r => !r[1] || !r[1].trim()).length;
    const emptyPrice = data.filter(r => !r[4] || !r[4].trim()).length;
    const emptyBrand = data.filter(r => !r[2] || !r[2].trim()).length;
    const emptyCat = data.filter(r => !r[3] || !r[3].trim()).length;
    const emptyImg = data.filter(r => !r[7] || !r[7].trim()).length;
    console.log('\n--- 2. Campos vacios ---');
    console.log('name vacio  :', emptyName);
    console.log('price vacio :', emptyPrice);
    console.log('brand vacio :', emptyBrand);
    console.log('category vacio:', emptyCat);
    console.log('image (col8) vacio:', emptyImg);

    // 3. Badges
    const badgeCount = {};
    for (const r of data) { const b = (r[6] || '').trim(); badgeCount[b] = (badgeCount[b] || 0) + 1; }
    console.log('\n--- 3. Badges ---');
    console.log(JSON.stringify(badgeCount, null, 2));

    // 4. Categorias
    const catCount = {};
    for (const r of data) { const c = (r[3] || '').trim().toLowerCase(); catCount[c] = (catCount[c] || 0) + 1; }
    console.log('\n--- 4. Categorias ---');
    console.log(JSON.stringify(catCount, null, 2));

    // 5. Marcas
    const brandCount = {};
    for (const r of data) { const b = (r[2] || '').trim(); brandCount[b] = (brandCount[b] || 0) + 1; }
    console.log('\n--- 5. Marcas (total:', Object.keys(brandCount).length, ') ---');

    // 6. Nombres truncados y duplicados
    const names = data.map(r => (r[1] || '').trim());
    const truncated = names.filter(n => n.endsWith('...')).length;
    const dupMap = {};
    for (const n of names) dupMap[n] = (dupMap[n] || 0) + 1;
    const dups = Object.entries(dupMap).filter(([, c]) => c > 1);
    console.log('\n--- 6. Nombres ---');
    console.log('Nombres que terminan en "..." :', truncated, 'de', names.length);
    console.log('Nombres duplicados (grupos):', dups.length);
    for (const [n, c] of dups.slice(0, 10)) console.log('   ', c, 'x', n.slice(0, 80));

    // 7. IDs
    const ids = data.map(r => (r[0] || '').trim());
    const idDup = Object.entries(ids.reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {})).filter(([, c]) => c > 1);
    console.log('\n--- 7. IDs ---');
    console.log('IDs duplicados:', idDup.length);

    // 8. featured
    const featCount = {};
    for (const r of data) { const f = (r[11] || '').trim().toUpperCase(); featCount[f] = (featCount[f] || 0) + 1; }
    console.log('\n--- 8. featured ---');
    console.log(JSON.stringify(featCount));

    // 9. has3D (columna 13 no existe)
    console.log('\n--- 9. has3D ---');
    console.log('Filas con columna 13 (has3D):', data.filter(r => r.length >= 13).length);
    console.log('=> has3D no existe en la hoja; el codigo NO debe auto-asignarlo.');

    // 10. Precios y descuentos
    let okDisc = 0, noDisc = 0, parseErr = 0;
    const buckets = { '<10%': 0, '10-15%': 0, '>=15%': 0 };
    let minD = 1, maxD = 0;
    for (const r of data) {
      const p = toNumber(r[4]); const o = toNumber(r[5]);
      if (isNaN(p) || isNaN(o)) { parseErr++; continue; }
      if (o <= 0) { parseErr++; continue; }
      const d = (o - p) / o;
      if (d > 0) {
        okDisc++;
        if (d >= 0.15) buckets['>=15%']++;
        else if (d >= 0.10) buckets['10-15%']++;
        else buckets['<10%']++;
        minD = Math.min(minD, d); maxD = Math.max(maxD, d);
      } else {
        noDisc++;
      }
    }
    console.log('\n--- 10. Precios y descuentos ---');
    console.log('Productos con oldPrice > price:', okDisc);
    console.log('Sin descuento (oldPrice<=price):', noDisc);
    console.log('Error de parseo:', parseErr);
    console.log('Buckets:', JSON.stringify(buckets));
    console.log('Descuento min/max:', (minD * 100).toFixed(2) + '%', '/', (maxD * 100).toFixed(2) + '%');

    // 11. Formatos de precio
    const priceFormats = new Set();
    for (const r of data) {
      if (!/^\d+(\.\d+)?$/.test(r[4].trim())) priceFormats.add(r[4].trim().slice(0, 12));
      if (!/^\d+(\.\d+)?$/.test(r[5].trim())) priceFormats.add('OLD:' + r[5].trim().slice(0, 12));
    }
    console.log('\n--- 11. Formatos de precio no numericos puros ---');
    console.log('Muestras:', [...priceFormats].slice(0, 12));

    console.log('\n=== FIN DE VALIDACION ===');
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

main();
