/* ============================================================
   ELIJO TECNOLOGÍA — Aplicación del Catálogo y Cotizador 3D
   Integración con Google Sheets + Búsqueda + Visualización 3D + Cotizador + Proforma PDF
   ============================================================= */

'use strict';

// ─── WhatsApp (desde la configuración) ────────────────────────────────────
const WHATSAPP_NUMBER = (typeof SHEETS_CONFIG !== 'undefined')
  ? SHEETS_CONFIG.WHATSAPP_NUMBER
  : '51918394348';

// ─── Lista de productos reactivos ──────
let PRODUCTS = [];

// ─── Estado Global ───────────────────────────────────────────
let state = {
  search: '',
  category: 'all',
  brands: new Set(),
  priceMin: 0,
  priceMax: Infinity,
  sort: 'featured',
  loading: true,
  source: 'demo', // 'sheets' | 'demo'
  lastSync: null,
  only3D: false, // Filtro 🔥 Solo productos 3D
};

// ─── Estado de Cotización ────────────────────────────────────
let quotation = JSON.parse(localStorage.getItem('elijo_quotation') || '[]');

// ═════════════════════════════════════════════════════════════
// INTEGRACIÓN CON GOOGLE SHEETS Y PARSER DE DATOS
// ═════════════════════════════════════════════════════════════

/**
 * Analizar una fila CSV respetando los campos entre comillas que pueden contener comas.
 */
function parseCSVRow(row) {
  const resultado = [];
  let actual = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      resultado.push(actual.trim());
      actual = '';
    } else {
      actual += ch;
    }
  }
  resultado.push(actual.trim());
  return resultado;
}

/**
 * Analizar la cadena de especificaciones: "Clave1:Valor1|Clave2:Valor2" → { Clave1: 'Valor1', ... }
 */
function parseSpecs(specsStr) {
  if (!specsStr || specsStr.trim() === '') return {};
  const specs = {};
  specsStr.split('|').forEach(pair => {
    const colonIdx = pair.indexOf(':');
    if (colonIdx > -1) {
      const key = pair.slice(0, colonIdx).trim();
      const val = pair.slice(colonIdx + 1).trim();
      if (key) specs[key] = val;
    }
  });
  return specs;
}

/**
 * Analizar la cadena de etiquetas: "Tag1,Tag2,Tag3" → ['Tag1', 'Tag2', 'Tag3']
 */
function parseTags(tagsStr) {
  if (!tagsStr || tagsStr.trim() === '') return [];
  return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Convertir una fila CSV en objeto de producto con soporte de ID, imagen y modelo 3D.
 */
function rowToProduct(cells, index) {
  const [
    id, name, brand, category, price, oldPrice, badge,
    image, description, specs, tags, featured, has3D
  ] = cells;

  if (!name || !price) return null; // Omite filas vacías

  const rawId = id && String(id).trim() ? String(id).trim() : `prod-${101 + index}`;
  const parsedPrice = parseFloat(String(price).replace(/[^\d.]/g, ''));
  const parsedOldPrice = oldPrice && oldPrice.trim() !== ''
    ? parseFloat(String(oldPrice).replace(/[^\d.]/g, ''))
    : null;

  // Formato de imagen: image/[id].jpg según requerimiento y Google Sheets
  let imagePath = (image || '').trim();
  if (!imagePath) {
    imagePath = `image/${rawId}.jpg`;
  } else if (!imagePath.startsWith('http') && !imagePath.startsWith('image/') && !imagePath.startsWith('images/')) {
    imagePath = `image/${imagePath}`;
  }

  // Indicador 3D
  const is3D = has3D !== undefined && has3D !== null
    ? String(has3D).trim().toUpperCase() === 'TRUE'
    : (rawId.includes('3d') || (index % 3 === 0));

  return {
    id: rawId,
    name: name.trim(),
    brand: (brand || '').trim(),
    category: (category || '').trim().toLowerCase(),
    price: isNaN(parsedPrice) ? 0 : parsedPrice,
    oldPrice: parsedOldPrice && !isNaN(parsedOldPrice) ? parsedOldPrice : null,
    badge: badge && badge.trim() !== '' ? badge.trim().toLowerCase() : null,
    image: imagePath,
    has3D: is3D,
    description: (description || '').trim(),
    specs: parseSpecs(specs),
    tags: parseTags(tags),
    featured: String(featured).trim().toUpperCase() === 'TRUE',
  };
}

/**
 * Obtener productos desde Google Sheets CSV
 */
async function fetchFromGoogleSheets(csvUrl) {
  const url = csvUrl + (csvUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'text/csv,text/plain,*/*' },
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
  }

  const csvText = await response.text();
  const rows = csvText.split('\n').filter(r => r.trim() !== '');

  if (rows.length < 2) {
    throw new Error('La hoja de Google Sheets está vacía o no tiene datos de productos');
  }

  const productos = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = parseCSVRow(rows[i]);
    const producto = rowToProduct(cells, i - 1);
    if (producto) productos.push(producto);
  }

  if (productos.length === 0) {
    throw new Error('No se encontraron productos válidos en la hoja');
  }

  return productos;
}

/**
 * Cargar productos
 */
async function loadProducts() {
  showLoadingState();

  const config = typeof SHEETS_CONFIG !== 'undefined' ? SHEETS_CONFIG : {};
  const csvUrl = config.SHEETS_CSV_URL || '';

  if (csvUrl && csvUrl.startsWith('http')) {
    try {
      updateSyncBanner('syncing');
      const productos = await fetchFromGoogleSheets(csvUrl);
      PRODUCTS = productos;
      state.source = 'sheets';
      state.lastSync = new Date();
      updateSyncBanner('success', productos.length);
      console.log(`✅ Elijo Tech: ${productos.length} productos cargados desde Google Sheets`);
    } catch (err) {
      console.warn('⚠️ Elijo Tech: Error al cargar Google Sheets:', err.message);
      if (config.FALLBACK_TO_DEMO !== false) {
        PRODUCTS = (typeof PRODUCTOS_DEMO !== 'undefined') ? PRODUCTOS_DEMO : [];
        state.source = 'demo';
        updateSyncBanner('error', 0, err.message);
      } else {
        PRODUCTS = [];
        updateSyncBanner('error', 0, err.message);
      }
    }
  } else {
    PRODUCTS = (typeof PRODUCTOS_DEMO !== 'undefined') ? PRODUCTOS_DEMO : [];
    state.source = 'demo';
    updateSyncBanner('demo');
  }

  state.loading = false;
  renderCategoryPills();
  renderDropdownCategories();
  renderBrandFilters();
  renderProducts();
  renderOffers();
  updateQuotationUI();

  const refreshMins = config.AUTO_REFRESH_MINUTES || 0;
  if (refreshMins > 0 && csvUrl) {
    setInterval(() => refreshProducts(csvUrl), refreshMins * 60 * 1000);
  }
}

/**
 * Recarga silenciosa en segundo plano
 */
async function refreshProducts(csvUrl) {
  try {
    const productos = await fetchFromGoogleSheets(csvUrl);
    PRODUCTS = productos;
    state.source = 'sheets';
    state.lastSync = new Date();
    updateSyncBanner('success', productos.length);
    renderCategoryPills();
    renderDropdownCategories();
    renderBrandFilters();
    renderProducts();
    renderOffers();
  } catch (err) {
    console.warn('⚠️ Elijo Tech: Error al actualizar:', err.message);
  }
}

// ═════════════════════════════════════════════════════════════
// BANNER DE SINCRONIZACIÓN
// ═════════════════════════════════════════════════════════════
const SHOW_SYNC_STATUS = false;
function updateSyncBanner(status, count = 0, errorMsg = '') {
  if (!SHOW_SYNC_STATUS) return;
  const banner = document.getElementById('sheets-sync-banner');
  if (!banner) return;

  const messages = {
    syncing: 'Sincronizando con Google Sheets…',
    success: ` ✓ ${count} productos sincronizados desde Google Sheets`,
    error: `⚠ Error de sincronización — usando datos de ejemplo. (${errorMsg})`,
    demo: '📋 Modo demo · Elijo Tecnología',
  };

  banner.className = `sheets-sync-banner banner-${status}`;
  banner.innerHTML = `<span>${messages[status]}</span>`;
}

// ═════════════════════════════════════════════════════════════
// CARGANDO ESQUELETO
// ═════════════════════════════════════════════════════════════
function showLoadingState() {
  const grid = document.getElementById('products-grid');
  const countEl = document.getElementById('products-count');
  if (countEl) countEl.innerHTML = 'Cargando productos…';

  if (grid) {
    grid.innerHTML = Array.from({ length: 8 }, () => `
      <div class="product-card skeleton-card" aria-hidden="true">
        <div class="skeleton skeleton-img"></div>
        <div class="product-body">
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line medium"></div>
          <div class="skeleton skeleton-footer"></div>
        </div>
      </div>
    `).join('');
  }
}

// ─── Ayudas de formato ───────────────────────────────────────
function formatPrice(price) {
  return `S/ ${price.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function badgeHTML(badge, has3D = false) {
  let html = '';
  if (has3D) {
    html += `<span class="product-badge badge-3d">3D Disponible</span>`;
  }
  if (badge) {
    const labels = {
      new: 'Nuevo',
      hot: '🔥 Popular',
      sale: 'Oferta',
      stock: 'Disponible',
      agotado: 'Agotado',
      proximamente: 'Próximamente'
    };
    html += `<span class="product-badge badge-${badge}">${labels[badge] || badge}</span>`;
  }
  return html;
}

function whatsappLink(product) {
  const msg = encodeURIComponent(
    `¡Hola! Estoy interesado/a en el producto:\n*${product.name}*\nPrecio: ${formatPrice(product.price)}\n¿Podría darme más información?`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

// ═════════════════════════════════════════════════════════════
// MOTOR DE ENGAGEMENT: VISITAS + VALORACIONES (localStorage)
// Completamente client-side, sin tocar Google Sheets ni backend
// ═════════════════════════════════════════════════════════════

const VISITS_KEY  = 'elijo_product_visits';
const RATINGS_KEY = 'elijo_product_ratings';

/** Devuelve el mapa de visitas {productId: count} */
function getVisitsMap() {
  try { return JSON.parse(localStorage.getItem(VISITS_KEY) || '{}'); }
  catch { return {}; }
}

/** Registra una visita al producto y devuelve el nuevo total */
function registerVisit(productId) {
  const map = getVisitsMap();
  // Simula base inicial realista para efecto de prueba social
  if (!map[productId]) map[productId] = Math.floor(Math.random() * 120) + 18;
  else map[productId] += 1;
  localStorage.setItem(VISITS_KEY, JSON.stringify(map));
  return map[productId];
}

/** Obtiene el total de visitas de un producto */
function getVisits(productId) {
  const map = getVisitsMap();
  if (!map[productId]) {
    // Genera y persiste un valor inicial realista (efecto «prueba social»)
    map[productId] = Math.floor(Math.random() * 120) + 18;
    localStorage.setItem(VISITS_KEY, JSON.stringify(map));
  }
  return map[productId];
}

/** Devuelve el mapa de ratings {productId: {sum, count, userRating}} */
function getRatingsMap() {
  try { return JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}'); }
  catch { return {}; }
}

/** Obtiene datos de rating de un producto; genera seed realista si no existe */
function getProductRating(productId) {
  const map = getRatingsMap();
  if (!map[productId]) {
    // Seed inicial: entre 4.1 y 5.0 con número de votos entre 6 y 40
    const count = Math.floor(Math.random() * 34) + 6;
    const avg   = parseFloat((Math.random() * 0.9 + 4.1).toFixed(1));
    map[productId] = { sum: parseFloat((avg * count).toFixed(1)), count, userRating: 0 };
    localStorage.setItem(RATINGS_KEY, JSON.stringify(map));
  }
  return map[productId];
}

/** Guarda la valoración del usuario (1-5 estrellas) */
function saveUserRating(productId, stars) {
  const map = getRatingsMap();
  const r = map[productId] || getProductRating(productId);
  if (r.userRating > 0) {
    // Actualiza voto anterior
    r.sum = parseFloat((r.sum - r.userRating + stars).toFixed(1));
  } else {
    r.sum   = parseFloat((r.sum + stars).toFixed(1));
    r.count += 1;
  }
  r.userRating = stars;
  map[productId] = r;
  localStorage.setItem(RATINGS_KEY, JSON.stringify(map));
  return r;
}

/** Genera HTML de estrellas (modo sólo lectura) */
function starsReadonlyHTML(avg, count, productId) {
  const full  = Math.floor(avg);
  const half  = (avg - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const starsFull  = '★'.repeat(full);
  const starsHalf  = half  ? '<span class="star-half">★</span>' : '';
  const starsEmpty = '☆'.repeat(empty);
  return `
    <div class="product-rating" aria-label="Valoración: ${avg} de 5">
      <span class="stars-display">${starsFull}${starsHalf}${starsEmpty}</span>
      <span class="rating-score">${avg.toFixed(1)}</span>
      <span class="rating-count">(${count} valorac.)</span>
    </div>`;
}

/** Genera HTML de estrellas interactivas para el modal */
function starsInteractiveHTML(productId, currentRating) {
  const stars = [1,2,3,4,5].map(n => `
    <button class="star-btn ${n <= currentRating ? 'active' : ''}" 
      data-star="${n}" aria-label="${n} estrella${n>1?'s':''}" title="Puntuar ${n}">
      ${n <= currentRating ? '★' : '☆'}
    </button>`).join('');
  return `<div class="modal-rating-interactive" id="modal-stars-wrap" data-product="${productId}">${stars}</div>`;
}

// ═════════════════════════════════════════════════════════════
// MOTOR DE MARKETING PSICOLÓGICO (100% client-side)
// Evalúa nombre y categoría del producto → genera badgeTexto + beneficioLlave
// ═════════════════════════════════════════════════════════════

function getMarketingLayer(product) {
  const name = (product.name || '').toLowerCase();
  const cat  = (product.category || '').toLowerCase();
  const brand = (product.brand || '').toLowerCase();

  // ── Reglas de Badge psicológico ──────────────────────────────
  let badgeTexto = '';

  if (name.includes('gamer') || name.includes('gaming') || name.includes('rog') || name.includes('rtx')) {
    badgeTexto = '⚡ Alto Rendimiento';
  } else if (name.includes('pro') || brand.includes('apple') || name.includes('ultra')) {
    badgeTexto = '✓ Versión Pro';
  } else if (name.includes('ecotank') || name.includes('láser') || name.includes('laser')) {
    badgeTexto = '💰 Ahorro Total';
  } else if (name.includes('mesh') || name.includes('wifi 6') || name.includes('wi-fi 6')) {
    badgeTexto = '📶 Cobertura Total';
  } else if (name.includes('ssd') || name.includes('nvme') || name.includes('m.2')) {
    badgeTexto = '🚀 Ultra Velocidad';
  } else if (cat === 'celulares' || cat === 'tabletas') {
    badgeTexto = '⭐ Elección Top';
  } else if (cat === 'monitores') {
    badgeTexto = '🎨 Imagen Premium';
  } else if (cat === 'componentes') {
    badgeTexto = '🔧 Upgrade Ideal';
  } else if (cat === 'perifericos') {
    badgeTexto = '🖱️ Control Total';
  } else if (cat === 'software') {
    badgeTexto = '🔒 Licencia Oficial';
  } else if (cat === 'impresoras') {
    badgeTexto = '🖨️ Lista para Usar';
  } else if (cat === 'redes') {
    badgeTexto = '📡 Siempre Conectado';
  } else {
    badgeTexto = '✓ Recomendado';
  }

  // ── Micro-frase de beneficio clave ────────────────────────────
  let beneficioLlave = '';

  if (name.includes('gamer') || name.includes('rtx') || name.includes('rog')) {
    beneficioLlave = 'Juega sin límites ni lag';
  } else if (cat === 'laptops' && (name.includes('ultrabook') || name.includes('pavilion') || name.includes('hp'))) {
    beneficioLlave = 'Ligera, lista para llevar';
  } else if (cat === 'laptops') {
    beneficioLlave = 'Trabaja y estudia sin pausas';
  } else if (cat === 'celulares' && name.includes('ultra')) {
    beneficioLlave = 'Fotografía profesional en tu bolsillo';
  } else if (cat === 'celulares') {
    beneficioLlave = 'Conectado todo el día';
  } else if (cat === 'tabletas') {
    beneficioLlave = 'Crea y consume donde quieras';
  } else if (cat === 'componentes' && (name.includes('rtx') || name.includes('gpu') || name.includes('geforce'))) {
    beneficioLlave = 'Gráficos que te dejan sin aliento';
  } else if (cat === 'componentes') {
    beneficioLlave = 'Dale vida a tu PC';
  } else if (cat === 'impresoras' && name.includes('ecotank')) {
    beneficioLlave = 'Imprime miles de páginas a bajo costo';
  } else if (cat === 'impresoras') {
    beneficioLlave = 'Lista para imprimir hoy mismo';
  } else if (cat === 'monitores' && (name.includes('165hz') || name.includes('144hz'))) {
    beneficioLlave = 'Fluidez que se nota al instante';
  } else if (cat === 'monitores') {
    beneficioLlave = 'Más espacio visual para trabajar';
  } else if (cat === 'almacenamiento' && name.includes('ssd')) {
    beneficioLlave = 'Arranca en segundos, no minutos';
  } else if (cat === 'almacenamiento') {
    beneficioLlave = 'Lleva tus archivos a cualquier lugar';
  } else if (cat === 'redes') {
    beneficioLlave = 'Sin zonas muertas en tu hogar';
  } else if (cat === 'software') {
    beneficioLlave = 'Listo para usar sin configuraciones';
  } else if (cat === 'perifericos') {
    beneficioLlave = 'Siente la diferencia al primer toque';
  } else {
    beneficioLlave = 'Elige con confianza, elige mejor';
  }

  return { badgeTexto, beneficioLlave };
}

// ─── Ayudantes calculados ─────────────────────────────────────────
function getAllBrands() {
  return [...new Set(PRODUCTS.map(p => p.brand))].filter(Boolean).sort();
}

function getFilteredProducts() {
  let list = PRODUCTS.filter(p => {
    const matchSearch = !state.search ||
      p.name.toLowerCase().includes(state.search.toLowerCase()) ||
      p.brand.toLowerCase().includes(state.search.toLowerCase()) ||
      (p.tags || []).some(t => t.toLowerCase().includes(state.search.toLowerCase()));

    const matchCat = state.category === 'all' || p.category === state.category;
    const matchBrand = state.brands.size === 0 || state.brands.has(p.brand);
    const matchPrice = p.price >= state.priceMin && p.price <= state.priceMax;
    const match3D = !state.only3D || p.has3D === true;

    return matchSearch && matchCat && matchBrand && matchPrice && match3D;
  });

  switch (state.sort) {
    case 'variety': {
      const categoriesMap = new Map();
      list.forEach(p => {
        const cat = p.category || 'otros';
        if (!categoriesMap.has(cat)) categoriesMap.set(cat, []);
        categoriesMap.get(cat).push(p);
      });

      const interleaved = [];
      let added = true;
      while (added) {
        added = false;
        for (const [cat, prods] of categoriesMap.entries()) {
          if (prods.length > 0) {
            interleaved.push(prods.shift());
            added = true;
          }
        }
      }
      list = interleaved;
      break;
    }
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'name': list.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  // Empujar productos agotados al final
  list.sort((a, b) => {
    const aAgotado = a.badge === 'agotado' ? 1 : 0;
    const bAgotado = b.badge === 'agotado' ? 1 : 0;
    return aAgotado - bAgotado;
  });

  return list;
}

// ─── Renderizar cuadrícula de productos ──────────────────────────────────────
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const countEl = document.getElementById('products-count');
  const list = getFilteredProducts();

  if (countEl) {
    countEl.innerHTML = `<strong>${list.length}</strong> producto${list.length !== 1 ? 's' : ''} encontrado${list.length !== 1 ? 's' : ''}`;
  }

  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="no-results" style="grid-column:1/-1;text-align:center;padding:48px 20px;">
        <div class="no-results-icon" style="font-size:3rem;margin-bottom:12px;">🔍</div>
        <h3 style="font-size:1.2rem;font-weight:700;">No encontramos productos</h3>
        <p style="color:var(--text-muted);">Intente cambiar los filtros o la búsqueda</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map((p, i) => {
    const { badgeTexto, beneficioLlave } = getMarketingLayer(p);
    const visits  = getVisits(p.id);
    const rData   = getProductRating(p.id);
    const avgRating = rData.count > 0 ? rData.sum / rData.count : 0;
    const full  = Math.floor(avgRating);
    const half  = (avgRating - full) >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    const starsHTML = '★'.repeat(full) +
      (half ? '<span class="star-half">★</span>' : '') +
      '☆'.repeat(empty);

    return `
    <article
      class="product-card ${p.badge === 'agotado' ? 'product-card-out-of-stock' : ''}"
      role="button"
      tabindex="0"
      aria-label="Ver detalle de ${p.name}"
      data-id="${p.id}"
      style="animation-delay: ${Math.min(i * 30, 300)}ms"
    >
      <div class="product-badges-wrap">
        ${badgeHTML(p.badge, p.has3D)}
        <span class="mktg-badge">${badgeTexto}</span>
      </div>
      <div class="product-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy" width="400" height="400"
          onerror="this.src='image/1000.jpg'" />
        <!-- Contador de vistas (prueba social) -->
        <span class="views-counter">👁 ${visits} vistas</span>
        <div class="product-overlay">
          <button class="overlay-btn" tabindex="-1">Ver detalle</button>
        </div>
      </div>
      <div class="product-body">
        <p class="product-brand">${p.brand}</p>
        <h3 class="product-name">${p.name}</h3>
        <!-- Beneficio clave (marketing psicológico) -->
        <p class="product-benefit">💡 ${beneficioLlave}</p>
        <!-- Rating de estrellas -->
        <div class="product-rating">
          <span class="stars-display">${starsHTML}</span>
          <span class="rating-score">${avgRating.toFixed(1)}</span>
          <span class="rating-count">(${rData.count})</span>
        </div>
        <div class="product-specs">
          ${(p.tags || []).map(t => `<span class="spec-tag">${t}</span>`).join('')}
        </div>
        <div class="product-footer">
          <div class="product-price">
            <span class="price-current">${formatPrice(p.price)}</span>
            ${p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice)}</span>` : ''}
          </div>
          <button class="btn-add-quote" onclick="event.stopPropagation(); addToQuotation('${p.id}'); openQuotationDrawer();" aria-label="Añadir a Cotización" title="Añadir a Cotización">
            📋 +Cotizar
          </button>
        </div>
      </div>
    </article>`;
  }).join('');

  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(card.dataset.id); }
    });
  });
}

// ─── Renderizar Ofertas Especiales (Carrusel) ──────────────────────────────
let offersAutoScrollTimer = null;

function renderOffers() {
  const section = document.getElementById('offers-section');
  const grid = document.getElementById('offers-grid');
  if (!section || !grid) return;

  let offers = PRODUCTS.filter(p => (p.badge === 'sale' || (p.oldPrice && p.oldPrice > p.price)) && p.badge !== 'agotado');
  if (offers.length < 4) {
    const extra = PRODUCTS.filter(p => p.featured && p.badge !== 'agotado' && !offers.some(o => o.id === p.id));
    offers = [...offers, ...extra];
  }

  if (offers.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  grid.innerHTML = offers.map((p, i) => `
    <article
      class="product-card offer-card"
      role="button"
      tabindex="0"
      aria-label="Ver oferta de ${p.name}"
      data-id="${p.id}"
    >
      <div class="product-badges-wrap">
        ${badgeHTML(p.badge || 'sale', p.has3D)}
      </div>
      <div class="product-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy" width="400" height="400"
          onerror="this.src='image/1000.jpg'" />
        <div class="product-overlay">
          <button class="overlay-btn" tabindex="-1">Ver oferta</button>
        </div>
      </div>
      <div class="product-body">
        <p class="product-brand">${p.brand}</p>
        <h3 class="product-name">${p.name}</h3>
        <div class="product-specs">
          ${(p.tags || []).map(t => `<span class="spec-tag">${t}</span>`).join('')}
        </div>
        <div class="product-footer">
          <div class="product-price">
            <span class="price-current">${formatPrice(p.price)}</span>
            ${p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice)}</span>` : ''}
          </div>
          <button class="btn-add-quote" onclick="event.stopPropagation(); addToQuotation('${p.id}'); openQuotationDrawer();">
            📋 +Cotizar
          </button>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });

  initOffersCarousel(grid);
}

function initOffersCarousel(grid) {
  if (!grid) return;
  const prevBtn = document.getElementById('offers-prev-btn');
  const nextBtn = document.getElementById('offers-next-btn');

  const cardWidth = 300;

  const scrollNext = () => {
    const maxScroll = grid.scrollWidth - grid.clientWidth;
    if (grid.scrollLeft >= maxScroll - 15) {
      grid.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      grid.scrollBy({ left: cardWidth, behavior: 'smooth' });
    }
  };

  const scrollPrev = () => {
    if (grid.scrollLeft <= 15) {
      grid.scrollTo({ left: grid.scrollWidth - grid.clientWidth, behavior: 'smooth' });
    } else {
      grid.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    }
  };

  if (prevBtn) prevBtn.onclick = () => { scrollPrev(); restartTimer(); };
  if (nextBtn) nextBtn.onclick = () => { scrollNext(); restartTimer(); };

  const startTimer = () => {
    stopTimer();
    offersAutoScrollTimer = setInterval(scrollNext, 3500);
  };

  const stopTimer = () => {
    if (offersAutoScrollTimer) clearInterval(offersAutoScrollTimer);
  };

  const restartTimer = () => {
    stopTimer();
    startTimer();
  };

  grid.onmouseenter = stopTimer;
  grid.onmouseleave = startTimer;
  grid.ontouchstart = stopTimer;
  grid.ontouchend = () => setTimeout(startTimer, 2000);

  startTimer();
}

// ─── Renderizar Filtros de Marca ───────────────────────────────
function renderBrandFilters() {
  const container = document.getElementById('brand-filters');
  if (!container) return;

  const marcas = getAllBrands();
  const counts = {};
  PRODUCTS.forEach(p => { if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1; });

  container.innerHTML = marcas.map(b => `
    <label class="filter-option">
      <input type="checkbox" id="brand-${b.replace(/\s/g, '-')}" value="${b}"
        ${state.brands.has(b) ? 'checked' : ''} />
      <span class="filter-option-label">${b}</span>
      <span class="filter-option-count">${counts[b] || 0}</span>
    </label>
  `).join('');

  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.brands.add(cb.value);
      else state.brands.delete(cb.value);
      renderProducts();
    });
  });
}

// ─── Modal con Visualizador 3D <model-viewer>, Rating y Visitas ──────────────
function openModal(id) {
  const p = PRODUCTS.find(x => String(x.id) === String(id));
  if (!p) return;

  // Registrar visita al abrir el modal
  const totalVisits = registerVisit(p.id);

  // Obtener datos de marketing y rating
  const { badgeTexto, beneficioLlave } = getMarketingLayer(p);
  const rData     = getProductRating(p.id);
  const avgRating = rData.count > 0 ? parseFloat((rData.sum / rData.count).toFixed(1)) : 0;

  const specsHTML = Object.entries(p.specs || {}).map(([k, v]) => `
    <div class="modal-spec-row">
      <span class="modal-spec-key">${k}</span>
      <span class="modal-spec-val">${v}</span>
    </div>
  `).join('');

  const visualHTML = p.has3D ? `
    <div class="modal-3d-container">
      <span class="badge-3d-modal">🎮 3D Interactivo 360°</span>
      <model-viewer
        src="models/prod-${p.id}.glb"
        poster="${p.image}"
        alt="${p.name}"
        auto-rotate
        camera-controls
        shadow-intensity="1"
        ar
        class="modal-3d-viewer"
        id="modal-model-viewer"
      ></model-viewer>
      <img id="modal-img-fallback" src="${p.image}" alt="${p.name}" style="display:none; width:100%; height:320px; object-fit:contain;" onerror="this.src='image/1000.jpg'" />
    </div>
  ` : `
    <div class="modal-img-wrap">
      <img src="${p.image}" alt="${p.name}" onerror="this.src='image/1000.jpg'" />
    </div>
  `;

  // Construir HTML de estrellas interactivas
  const interactiveStars = [1,2,3,4,5].map(n => `
    <button class="star-btn ${n <= rData.userRating ? 'active' : ''}" 
      data-star="${n}" aria-label="${n} estrella${n>1?'s':''}" title="Puntuar con ${n}">
      ${n <= rData.userRating ? '★' : '☆'}
    </button>`).join('');

  document.getElementById('modal-content').innerHTML = `
    <header class="modal-header">
      <div>
        <span class="mktg-badge mktg-badge-modal">${badgeTexto}</span>
      </div>
      <button class="modal-close" id="modal-close-btn" aria-label="Cerrar">&times;</button>
    </header>
    <div class="modal-body">
      <!-- 1. Imagen / Visualizador 3D -->
      ${visualHTML}
      <div class="modal-info">
        <!-- 2. Nombre y Marca -->
        <p class="modal-brand">${p.brand}</p>
        <h2 class="modal-name">${p.name}</h2>
        ${(p.tags && p.tags.length) ? `<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">${p.tags.join(' · ')}</p>` : ''}

        <!-- 3. Precio -->
        <div class="modal-price-block">
          <span class="modal-price">${formatPrice(p.price)}</span>
          <span style="font-size:0.78rem;color:var(--text-muted);margin-left:6px;">(IGV Incluido)</span>
          ${p.oldPrice ? `<span class="modal-price-old">${formatPrice(p.oldPrice)}</span>` : ''}
        </div>

        <!-- 4. Información principal: Visitas, Rating y Beneficio clave -->
        <div class="modal-social-proof">
          <span class="modal-views">👁 <strong>${totalVisits}</strong> personas vieron este producto</span>
          <div class="modal-rating-block">
            <span class="modal-rating-label">Tu valoración:</span>
            <div class="modal-rating-interactive" id="modal-stars-wrap" data-product="${p.id}">
              ${interactiveStars}
            </div>
            <span class="modal-rating-avg" id="modal-rating-avg">
              ${avgRating.toFixed(1)} <small>(${rData.count} valorac.)</small>
            </span>
          </div>
        </div>

        <div class="modal-benefit-box">
          <span class="modal-benefit-icon">💡</span>
          <span class="modal-benefit-text">${beneficioLlave}</span>
        </div>

        <!-- 5. Especificaciones Técnicas -->
        ${specsHTML ? `<div style="margin-top:14px;">
          <p class="modal-specs-title">Especificaciones Técnicas</p>
          <div class="modal-specs-list">${specsHTML}</div>
        </div>` : ''}

        <!-- 6. Descripción -->
        ${p.description ? `<div style="margin-top:14px;">
          <p class="modal-specs-title">Descripción</p>
          <p class="modal-description">${p.description}</p>
        </div>` : ''}

        <!-- 7. Acciones: Añadir a Cotización / WhatsApp -->
        <div class="modal-actions" style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn-add-quote" id="modal-add-quote-btn" style="flex:1;padding:12px 18px;font-size:0.95rem;justify-content:center;">
            📋 Añadir a Cotización
          </button>
          <a href="${whatsappLink(p)}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-modal" id="modal-whatsapp-btn">
            Consultar WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';

  // ── Fallback modelo 3D ─────────────────────────────────
  const mv = document.getElementById('modal-model-viewer');
  if (mv) {
    mv.addEventListener('error', () => {
      mv.style.display = 'none';
      const fallback = document.getElementById('modal-img-fallback');
      if (fallback) fallback.style.display = 'block';
    });
  }

  // ── Rating interactivo con estrellas ──────────────────
  const starsWrap = document.getElementById('modal-stars-wrap');
  if (starsWrap) {
    const btns = starsWrap.querySelectorAll('.star-btn');
    btns.forEach(btn => {
      // Hover: iluminar hasta la estrella bajo el cursor
      btn.addEventListener('mouseenter', () => {
        const n = parseInt(btn.dataset.star, 10);
        btns.forEach(b => {
          const bn = parseInt(b.dataset.star, 10);
          b.textContent = bn <= n ? '★' : '☆';
          b.classList.toggle('hover', bn <= n);
        });
      });
      btn.addEventListener('mouseleave', () => {
        const currentR = getRatingsMap()[p.id]?.userRating || 0;
        btns.forEach(b => {
          const bn = parseInt(b.dataset.star, 10);
          b.textContent = bn <= currentR ? '★' : '☆';
          b.classList.remove('hover');
          b.classList.toggle('active', bn <= currentR);
        });
      });
      // Click: guardar rating
      btn.addEventListener('click', () => {
        const stars = parseInt(btn.dataset.star, 10);
        const updated = saveUserRating(p.id, stars);
        const newAvg  = parseFloat((updated.sum / updated.count).toFixed(1));
        btns.forEach(b => {
          const bn = parseInt(b.dataset.star, 10);
          b.textContent = bn <= stars ? '★' : '☆';
          b.classList.remove('hover');
          b.classList.toggle('active', bn <= stars);
        });
        const avgEl = document.getElementById('modal-rating-avg');
        if (avgEl) avgEl.innerHTML = `${newAvg.toFixed(1)} <small>(${updated.count} valorac.)</small>`;
        // Feedback visual al usuario
        starsWrap.classList.add('rated-flash');
        setTimeout(() => starsWrap.classList.remove('rated-flash'), 600);
        // Re-renderizar tarjetas para reflejar nuevo rating
        renderProducts();
      });
    });
  }

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-add-quote-btn').addEventListener('click', () => {
    addToQuotation(p.id);
    closeModal();
    openQuotationDrawer();
  });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ─── 10 Categorías Principales ───────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',            label: 'Todos',          icon: '🛍️' },
  { id: 'laptops',        label: 'Laptops',         icon: '💻' },
  { id: 'celulares',      label: 'Celulares',       icon: '📱' },
  { id: 'impresoras',     label: 'Impresoras',      icon: '🖨️' },
  { id: 'componentes',    label: 'Componentes',     icon: '⚙️' },
  { id: 'almacenamiento', label: 'Almacenamiento',  icon: '💾' },
  { id: 'monitores',      label: 'Monitores',       icon: '🖥️' },
  { id: 'tabletas',       label: 'Tabletas',        icon: '📟' },
  { id: 'redes',          label: 'Redes',           icon: '📡' },
  { id: 'software',       label: 'Software',        icon: '💿' },
  { id: 'perifericos',    label: 'Periféricos',     icon: '🖱️' },
];

function renderCategoryPills() {
  const container = document.getElementById('category-pills');
  if (!container) return;

  container.innerHTML = CATEGORIES.map(c => `
    <button class="cat-pill ${state.category === c.id ? 'active' : ''}"
      data-cat="${c.id}" aria-pressed="${state.category === c.id}">
      <span class="cat-icon">${c.icon}</span>
      ${c.label}
    </button>
  `).join('');

  container.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      state.category = pill.dataset.cat;
      renderCategoryPills();
      renderDropdownCategories();
      renderProducts();

      // Scroll automático al catálogo de productos
      const catalogSection = document.getElementById('catalogo') ||
                             document.getElementById('products-grid');
      if (catalogSection) {
        const offset = 80; // altura aprox del navbar fijo
        const top = catalogSection.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

function renderDropdownCategories() {
  const container = document.getElementById('logo-dropdown-categories');
  if (!container) return;

  container.innerHTML = CATEGORIES.map(c => `
    <button type="button" class="logo-dropdown-cat-item ${state.category === c.id ? 'active' : ''}" data-cat="${c.id}">
      <span class="dropdown-cat-icon">${c.icon}</span>
      <span class="dropdown-cat-label">${c.label}</span>
    </button>
  `).join('');

  container.querySelectorAll('.logo-dropdown-cat-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.category = btn.dataset.cat;
      renderCategoryPills();
      renderDropdownCategories();
      renderProducts();

      // Cerrar menú desplegable
      const logoDropdown = document.getElementById('logo-dropdown');
      const logoWrap = document.getElementById('nav-logo-wrap');
      const logoBtn = document.getElementById('nav-logo-btn');
      if (logoDropdown) logoDropdown.classList.remove('active');
      if (logoWrap) logoWrap.classList.remove('active');
      if (logoBtn) logoBtn.setAttribute('aria-expanded', 'false');

      scrollToCatalog();
    });
  });
}

// ═════════════════════════════════════════════════════════════
// MÓDULO DE COTIZACIÓN Y EXPORTACIÓN DE PROFORMA PDF
// ═════════════════════════════════════════════════════════════

function saveQuotation() {
  localStorage.setItem('elijo_quotation', JSON.stringify(quotation));
  updateQuotationUI();
}

function addToQuotation(productId) {
  const p = PRODUCTS.find(x => String(x.id) === String(productId));
  if (!p) return;

  const existing = quotation.find(item => String(item.id) === String(productId));
  if (existing) {
    existing.qty += 1;
  } else {
    quotation.push({
      id: p.id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      image: p.image,
      category: p.category,
      qty: 1
    });
  }
  saveQuotation();
}

function updateQuotationQty(productId, delta) {
  const item = quotation.find(x => String(x.id) === String(productId));
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    quotation = quotation.filter(x => String(x.id) !== String(productId));
  }
  saveQuotation();
}

function removeFromQuotation(productId) {
  quotation = quotation.filter(x => String(x.id) !== String(productId));
  saveQuotation();
}

function clearQuotation() {
  quotation = [];
  saveQuotation();
}

function getQuotationTotals() {
  const total = quotation.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const subtotal = total / 1.18; // Base Imponible (Op. Gravada)
  const igv = total - subtotal;   // IGV (18%)
  return { total, subtotal, igv };
}

function updateQuotationUI() {
  const count = quotation.reduce((acc, item) => acc + item.qty, 0);
  
  const badgeNav = document.getElementById('quote-badge-count');
  if (badgeNav) badgeNav.textContent = count;
  const badgeFab = document.getElementById('quote-fab-count');
  if (badgeFab) badgeFab.textContent = count;

  const bodyEl = document.getElementById('quote-drawer-body');
  if (!bodyEl) return;

  if (quotation.length === 0) {
    bodyEl.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
        <div style="font-size:3rem;margin-bottom:12px;">📋</div>
        <p style="font-weight:700;font-size:1rem;margin-bottom:4px;color:var(--text-primary);">Tu cotización está vacía</p>
        <p style="font-size:0.85rem;">Explora el catálogo y añade productos para generar tu Proforma PDF.</p>
      </div>`;
  } else {
    bodyEl.innerHTML = quotation.map(item => `
      <div class="quote-item-card">
        <img src="${item.image}" alt="${item.name}" class="quote-item-img" onerror="this.src='image/1000.jpg'" />
        <div class="quote-item-info">
          <div class="quote-item-title">${item.name}</div>
          <div class="quote-item-price">S/ ${item.price.toFixed(2)} c/u</div>
          <div class="quote-item-qty">
            <button class="qty-btn" onclick="updateQuotationQty('${item.id}', -1)">-</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="updateQuotationQty('${item.id}', 1)">+</button>
            <span style="margin-left:auto;font-weight:800;font-size:0.88rem;">S/ ${(item.price * item.qty).toFixed(2)}</span>
          </div>
        </div>
        <button class="quote-item-remove" onclick="removeFromQuotation('${item.id}')" title="Eliminar">&times;</button>
      </div>
    `).join('');
  }

  const { total, subtotal, igv } = getQuotationTotals();
  const subtotalEl = document.getElementById('quote-subtotal');
  const igvEl = document.getElementById('quote-igv');
  const totalEl = document.getElementById('quote-total');

  if (subtotalEl) subtotalEl.textContent = `S/ ${subtotal.toFixed(2)}`;
  if (igvEl) igvEl.textContent = `S/ ${igv.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;
}

function openQuotationDrawer() {
  document.getElementById('quote-drawer')?.classList.add('active');
  document.getElementById('quote-drawer-overlay')?.classList.add('active');
}

function closeQuotationDrawer() {
  document.getElementById('quote-drawer')?.classList.remove('active');
  document.getElementById('quote-drawer-overlay')?.classList.remove('active');
}

/**
 * Generación de Proforma PDF Empresarial A4 vía html2pdf.js
 * Soporta de 1 a N productos en múltiples páginas automáticas sin recortes ni hojas en blanco.
 */
function generateProformaPDF() {
  if (quotation.length === 0) {
    alert('Añade al menos un producto a la cotización antes de generar la Proforma PDF.');
    return;
  }

  const clientInput = document.getElementById('quote-client-name');
  const clientName = (clientInput && clientInput.value.trim()) ? clientInput.value.trim() : 'Cliente Solicitante';

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const seqNumber = String(Math.floor(Math.random() * 900) + 100);
  const codeDoc = `COT-${year}${month}${day}-V${seqNumber}`;
  
  const optionsDate = { day: '2-digit', month: 'long', year: 'numeric' };
  const fechaEmision = today.toLocaleDateString('es-PE', optionsDate);

  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 3);
  const fechaVencimiento = validUntil.toLocaleDateString('es-PE', optionsDate);

  const { total, subtotal, igv } = getQuotationTotals();

  const pdfContainer = document.getElementById('proforma-pdf-container');
  if (!pdfContainer) return;

  const tableRowsHTML = quotation.map(item => `
    <tr>
      <td style="text-align:center;font-weight:bold;">${item.qty}</td>
      <td><strong>${item.name}</strong>${item.brand ? `<br><small style="color:#64748b;">Marca: ${item.brand}</small>` : ''}</td>
      <td style="text-align:right;">S/ ${item.price.toFixed(2)}</td>
      <td style="text-align:right;font-weight:bold;">S/ ${(item.price * item.qty).toFixed(2)}</td>
    </tr>
  `).join('');

  pdfContainer.innerHTML = `
    <div class="proforma-pdf-page" id="proforma-pdf-content">
      <!-- Encabezado Corporativo -->
      <div class="pdf-header">
        <div class="pdf-company-info">
          <h1>Elijo Tecnología</h1>
          <p><strong>Razón Social:</strong> Linares Jotmar José</p>
          <p><strong>RUC:</strong> 15615011719</p>
          <p><strong>Teléfono / WhatsApp:</strong> +51 918 394 348</p>
          <p><strong>Email:</strong> elijotecnologia@gmail.com</p>
          <p><strong>Web:</strong> www.elijotecnologia.com</p>
        </div>
        <div class="pdf-doc-box">
          <h2>PROFORMA</h2>
          <p class="pdf-doc-code">N° ${codeDoc}</p>
          <p class="pdf-doc-ruc"><strong>R.U.C.:</strong> 15615011719</p>
        </div>
      </div>

      <!-- Cliente y Condiciones -->
      <div class="pdf-client-section">
        <div class="pdf-client-col">
          <p><strong>ATENCIÓN:</strong> ${clientName}</p>
          <p><strong>FECHA EMISIÓN:</strong> ${fechaEmision}</p>
          <p><strong>VALIDEZ HASTA:</strong> ${fechaVencimiento}</p>
        </div>
        <div class="pdf-client-col">
          <p><strong>MONEDA:</strong> Soles (S/)</p>
          <p><strong>CONDICIÓN DE PAGO:</strong> Contado / Transferencia</p>
          <p><strong>VALIDEZ DE OFERTA:</strong> 3 Días Hábiles</p>
        </div>
      </div>

      <!-- Tabla de Items -->
      <table class="pdf-table">
        <thead>
          <tr>
            <th style="width: 8%; text-align: center;">CANT.</th>
            <th style="width: 56%;">DESCRIPCIÓN DE COMPONENTES</th>
            <th style="width: 18%; text-align: right;">P. UNIT. (S/)</th>
            <th style="width: 18%; text-align: right;">IMPORTE (S/)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHTML}
        </tbody>
      </table>

      <!-- Resumen Tributario y Footer -->
      <div class="pdf-footer-section">
        <table class="pdf-totals-table">
          <tr>
            <td class="tot-lbl">Op. Gravada (Base Imponible):</td>
            <td class="tot-val">S/ ${subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="tot-lbl">IGV (18%):</td>
            <td class="tot-val">S/ ${igv.toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td class="tot-lbl-main">TOTAL NETO:</td>
            <td class="tot-val-main">S/ ${total.toFixed(2)}</td>
          </tr>
        </table>

        <div class="pdf-footer-note">
          <p class="note-main">📌 Proforma válida por 3 días hábiles. Precios incluyen IGV.</p>
          <p class="note-sub">Gracias por confiar en Elijo Tecnología. No venimos a venderte, venimos a ayudarte a elegir.</p>
        </div>
      </div>
    </div>
  `;

  pdfContainer.style.display = 'block';
  const element = document.getElementById('proforma-pdf-content');

  const opt = {
    margin:       [12, 12, 12, 12],
    filename:     `Proforma_ElijoTecnologia_${codeDoc}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { 
      scale: 2, 
      useCORS: true, 
      logging: false,
      scrollX: 0,
      scrollY: 0,
      letterRendering: true
    },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(element).save().then(() => {
      pdfContainer.style.display = 'none';
    }).catch(err => {
      console.error('Error al generar PDF:', err);
      pdfContainer.style.display = 'none';
    });
  } else {
    alert('La librería html2pdf.js está cargando. Reintente en un momento.');
    pdfContainer.style.display = 'none';
  }
}

function scrollToCatalog() {
  const catalogSection = document.getElementById('catalogo') || document.getElementById('products-grid');
  if (catalogSection) {
    const headerEl = document.querySelector('header');
    const headerHeight = headerEl ? headerEl.offsetHeight : 60;
    const offset = headerHeight + 12;
    const top = catalogSection.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

// ═════════════════════════════════════════════════════════════
// INICIALIZACIÓN Y EVENT LISTENERS
// ═════════════════════════════════════════════════════════════
function init() {
  // Buscador: ejecuta la búsqueda y el scroll únicamente al presionar Enter o pulsar la Lupa
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');

  const doSearch = (scroll = true) => {
    state.search = searchInput ? searchInput.value.trim() : '';
    renderProducts();
    if (scroll) {
      scrollToCatalog();
    }
  };

  if (searchInput) {
    // Si el usuario borra completamente la búsqueda, se actualiza la lista en silencio sin scroll
    searchInput.addEventListener('input', () => {
      if (searchInput.value.trim() === '' && state.search !== '') {
        state.search = '';
        renderProducts();
      }
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch(true);
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doSearch(true);
    });
  }

  // Ordenar
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      state.sort = e.target.value;
      renderProducts();
    });
  }

  // Filtro Toggle 3D
  const btnToggle3D = document.getElementById('btn-toggle-3d');
  const sidebarToggle3D = document.getElementById('sidebar-toggle-3d');

  const toggle3DFilter = (active) => {
    state.only3D = active;
    if (btnToggle3D) {
      btnToggle3D.classList.toggle('active', state.only3D);
      btnToggle3D.setAttribute('aria-pressed', state.only3D);
    }
    if (sidebarToggle3D) sidebarToggle3D.checked = state.only3D;
    renderProducts();
  };

  if (btnToggle3D) {
    btnToggle3D.addEventListener('click', () => toggle3DFilter(!state.only3D));
  }
  if (sidebarToggle3D) {
    sidebarToggle3D.addEventListener('change', e => toggle3DFilter(e.target.checked));
  }

  // Filtro de Precio
  const applyPrice = () => {
    const min = parseFloat(document.getElementById('price-min').value) || 0;
    const max = parseFloat(document.getElementById('price-max').value) || Infinity;
    state.priceMin = min;
    state.priceMax = max;
    renderProducts();
  };

  const priceMinInput = document.getElementById('price-min');
  const priceMaxInput = document.getElementById('price-max');
  if (priceMinInput) priceMinInput.addEventListener('change', applyPrice);
  if (priceMaxInput) priceMaxInput.addEventListener('change', applyPrice);

  // Limpiar Filtros
  const clearFiltersBtn = document.getElementById('btn-clear-filters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      state.search = '';
      state.category = 'all';
      state.brands = new Set();
      state.priceMin = 0;
      state.priceMax = Infinity;
      state.only3D = false;
      if (searchInput) searchInput.value = '';
      if (priceMinInput) priceMinInput.value = '';
      if (priceMaxInput) priceMaxInput.value = '';
      if (sortSelect) sortSelect.value = 'featured';
      if (btnToggle3D) btnToggle3D.classList.remove('active');
      if (sidebarToggle3D) sidebarToggle3D.checked = false;
      renderCategoryPills();
      renderBrandFilters();
      renderProducts();
    });
  }

  // Modal Overlay
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Drawer Lateral Filtros Móvil
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const filterFab = document.getElementById('filter-fab');

  if (filterFab && sidebar && sidebarOverlay) {
    filterFab.addEventListener('click', () => {
      sidebar.classList.add('drawer-open');
      sidebarOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  const closeSidebar = () => {
    if (sidebar) sidebar.classList.remove('drawer-open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);

  // Cotización Drawer Events
  document.getElementById('nav-quote-btn')?.addEventListener('click', openQuotationDrawer);
  document.getElementById('quote-fab')?.addEventListener('click', openQuotationDrawer);
  document.getElementById('quote-drawer-close')?.addEventListener('click', closeQuotationDrawer);
  document.getElementById('quote-drawer-overlay')?.addEventListener('click', closeQuotationDrawer);
  document.getElementById('btn-clear-quote')?.addEventListener('click', clearQuotation);
  document.getElementById('btn-download-pdf')?.addEventListener('click', generateProformaPDF);

  // Logo interactivo dropdown
  const logoWrap = document.getElementById('nav-logo-wrap');
  const logoBtn = document.getElementById('nav-logo-btn');
  const logoDropdown = document.getElementById('logo-dropdown');

  if (logoBtn && logoDropdown) {
    const toggleLogoDropdown = (show) => {
      const active = show !== undefined ? show : !logoDropdown.classList.contains('active');
      logoDropdown.classList.toggle('active', active);
      if (logoWrap) logoWrap.classList.toggle('active', active);
      logoBtn.setAttribute('aria-expanded', active);
    };

    logoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLogoDropdown();
    });

    document.addEventListener('click', (e) => {
      if (logoWrap && !logoWrap.contains(e.target)) {
        toggleLogoDropdown(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') toggleLogoDropdown(false);
    });

    document.getElementById('logo-menu-home')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLogoDropdown(false);
      state.search = '';
      state.category = 'all';
      state.brands = new Set();
      state.priceMin = 0;
      state.priceMax = Infinity;
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';
      renderCategoryPills();
      renderBrandFilters();
      renderProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('logo-menu-offers')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLogoDropdown(false);
      const offersSection = document.getElementById('offers-section');
      if (offersSection) {
        offersSection.style.display = 'block';
        offersSection.scrollIntoView({ behavior: 'smooth' });
      }
    });

    document.getElementById('logo-menu-quote')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLogoDropdown(false);
      openQuotationDrawer();
    });
  }

  // Manejadores de eventos para el Footer (Categorías, Marcas e Información)
  document.querySelectorAll('[data-footer-cat]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = link.dataset.footerCat;
      if (cat) {
        state.category = cat;
        renderCategoryPills();
        renderDropdownCategories();
        renderProducts();
        scrollToCatalog();
      }
    });
  });

  document.querySelectorAll('[data-footer-brand]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const brand = link.dataset.footerBrand;
      if (brand) {
        state.brands = new Set([brand]);
        renderBrandFilters();
        renderProducts();
        scrollToCatalog();
      }
    });
  });

  document.querySelectorAll('[data-footer-info]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const topic = link.dataset.footerInfo || 'Información';
      // Muestra un mensaje amigable en lugar de saltar agresivamente al top
      const notification = document.createElement('div');
      notification.className = 'info-toast';
      notification.innerHTML = `<span>ℹ️ <strong>${topic}</strong>: Sección en desarrollo. Próximamente incluirá información detallada.</span>`;
      document.body.appendChild(notification);
      setTimeout(() => notification.classList.add('active'), 10);
      setTimeout(() => {
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
      }, 3500);
    });
  });

  // Cargar productos
  loadProducts();
}

document.addEventListener('DOMContentLoaded', init);

// ─── Animación Círculos en Banner ──────────────────────────────
// ─── Animación Círculos + Marca de Agua Símbolo Elijo en Banner ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('particulas-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particulas = [];
  const cantidadParticulas = 25;
  const cantidadSimbolos = 12;

  function redimensionarCanvas() {
    if (!canvas.parentElement) return;
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
  }
  redimensionarCanvas();
  window.addEventListener('resize', redimensionarCanvas);

  class Particula {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.radio = Math.random() * 4 + 2;
      this.opacidad = Math.random() * 0.5 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.8;
      this.vy = (Math.random() - 0.5) * 0.8;
    }
    actualizar() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }
    dibujar() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${this.opacidad})`;
      ctx.fill();
    }
  }

  class ParticulaSimbolo {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.scale = Math.random() * 0.22 + 0.14;
      this.opacidad = Math.random() * 0.08 + 0.04;
      this.rotacion = (Math.random() - 0.5) * 0.5;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
    }
    actualizar() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < -30 || this.x > canvas.width + 30) this.vx *= -1;
      if (this.y < -30 || this.y > canvas.height + 30) this.vy *= -1;
    }
    dibujar() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotacion);
      ctx.scale(this.scale, this.scale);
      ctx.globalAlpha = this.opacidad;
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.translate(-44, -46);

      // Fila 1
      ctx.beginPath();
      ctx.arc(25, 25, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(40, 17, 48, 16, 8);
      else ctx.rect(40, 17, 48, 16);
      ctx.stroke();

      // Fila 2 (Círculo Relleno - Elección Elijo)
      ctx.beginPath();
      ctx.arc(25, 50, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(40, 42, 48, 16, 8);
      else ctx.rect(40, 42, 48, 16);
      ctx.stroke();

      // Fila 3
      ctx.beginPath();
      ctx.arc(25, 75, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(40, 67, 48, 16, 8);
      else ctx.rect(40, 67, 48, 16);
      ctx.stroke();

      ctx.restore();
    }
  }

  for (let i = 0; i < cantidadParticulas; i++) {
    particulas.push(new Particula());
  }
  for (let i = 0; i < cantidadSimbolos; i++) {
    particulas.push(new ParticulaSimbolo());
  }

  function animar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particulas.forEach(p => { p.actualizar(); p.dibujar(); });
    requestAnimationFrame(animar);
  }
  animar();
});

// ─── Buscador Hero Sincronizado ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const mainSearchInput = document.getElementById('search-input');
  const heroSearchInput = document.getElementById('hero-search-input');
  const heroSearchBtn = document.getElementById('hero-search-btn');

  if (mainSearchInput && heroSearchInput) {
    // Sincronizar texto en silencio sin disparar búsquedas impulsivas
    heroSearchInput.addEventListener('input', (e) => {
      mainSearchInput.value = e.target.value;
      if (e.target.value.trim() === '' && state.search !== '') {
        state.search = '';
        renderProducts();
      }
    });

    const runHeroSearch = () => {
      const query = heroSearchInput.value.trim();
      mainSearchInput.value = query;
      state.search = query;
      renderProducts();
      scrollToCatalog();
    };

    heroSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runHeroSearch();
      }
    });

    if (heroSearchBtn) {
      heroSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        runHeroSearch();
      });
    }

    mainSearchInput.addEventListener('input', (e) => {
      heroSearchInput.value = e.target.value;
    });
  }
});
