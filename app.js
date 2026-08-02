/* ============================================================
   ELIJO TECNOLOGÍA — Aplicación del Catálogo
   Integración con Google Sheets + Búsqueda + Filtro + Ventana modal + WhatsApp
   ============================================================= */

'use strict';

// ─── WhatsApp (desde la configuración) ────────────────────────────────────
const WHATSAPP_NUMBER = (typeof SHEETS_CONFIG !== 'undefined')
  ? SHEETS_CONFIG.WHATSAPP_NUMBER
  : '51918394348';

// (PRODUCTOS_DEMO se ha movido a demo-products.js)

// ─── Lista de productos reactivos (rellenada desde Hojas de cálculo o demostración) ──────
let PRODUCTS = [];

// ─── Estado ──────────────────────────────────────────────────
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
};

// ═════════════════════════════════════════════════════════════
// INTEGRACIÓN CON GOOGLE SHEETS
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
 * Convertir una matriz de filas CSV en un objeto de producto.
 */
function rowToProduct(cells, index) {
  const [
    id, name, brand, category, price, oldPrice, badge,
    image, description, specs, tags, featured
  ] = cells;

  if (!name || !price) return null; // omite las filas vacías

  const parsedPrice = parseFloat(String(price).replace(/[^\d.]/g, ''));
  const parsedOldPrice = oldPrice && oldPrice.trim() !== ''
    ? parseFloat(String(oldPrice).replace(/[^\d.]/g, ''))
    : null;

  return {
    id: id ? parseInt(id) : (index + 1),
    name: name.trim(),
    brand: (brand || '').trim(),
    category: (category || '').trim().toLowerCase(),
    price: isNaN(parsedPrice) ? 0 : parsedPrice,
    oldPrice: parsedOldPrice && !isNaN(parsedOldPrice) ? parsedOldPrice : null,
    badge: badge && badge.trim() !== '' ? badge.trim().toLowerCase() : null,
    image: (image || '').trim() || 'images/laptop.jpg',
    description: (description || '').trim(),
    specs: parseSpecs(specs),
    tags: parseTags(tags),
    featured: String(featured).trim().toUpperCase() === 'TRUE',
  };
}

/**
 * Obtener y analizar archivos CSV de Google Sheets
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
 * Cargar productos: pruebe primero con Hojas de cálculo; si no funciona, utilice la versión de demostración.
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
        PRODUCTS = PRODUCTOS_DEMO;
        state.source = 'demo';
        updateSyncBanner('error', 0, err.message);
      } else {
        PRODUCTS = [];
        updateSyncBanner('error', 0, err.message);
      }
    }
  } else {
    PRODUCTS = PRODUCTOS_DEMO;
    state.source = 'demo';
    updateSyncBanner('demo');
  }

  const refreshMins = config.AUTO_REFRESH_MINUTES || 0;
  if (refreshMins > 0 && csvUrl) {
    setInterval(() => refreshProducts(csvUrl), refreshMins * 60 * 1000);
  }
}

/**
 * Actualización silenciosa en segundo plano
 */
async function refreshProducts(csvUrl) {
  try {
    const productos = await fetchFromGoogleSheets(csvUrl);
    PRODUCTS = productos;
    state.source = 'sheets';
    state.lastSync = new Date();
    updateSyncBanner('success', productos.length);
    renderCategoryPills();
    renderBrandFilters();
    renderProducts();
    renderOffers();
    console.log(`🔄 Elijo Tech: Catálogo actualizado (${productos.length} productos)`);
  } catch (err) {
    console.warn('⚠️ Elijo Tech: Error al actualizar:', err.message);
  }
}

// ═════════════════════════════════════════════════════════════
// BANNER DE SINCRONIZACIÓN
// ═════════════════════════════════════════════════════════════
function updateSyncBanner(status, count = 0, errorMsg = '') {
  const banner = document.getElementById('sheets-sync-banner');
  if (!banner) return;

  const icons = {
    syncing: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
    success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    demo: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const messages = {
    syncing: 'Sincronizando con Google Sheets…',
    success: ` ✓ ${count} productos sincronizados desde Google Sheets · Última actualización: ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`,
    error: `⚠ Error de sincronización — usando datos de ejemplo. (${errorMsg})`,
    demo: '📋 Modo demo · Configura Google Sheets en <strong>sheets-config.js</strong> para cargar tus productos reales',
  };

  const colors = {
    syncing: 'banner-syncing',
    success: 'banner-success',
    error: 'banner-error',
    demo: 'banner-demo',
  };

  banner.className = `sheets-sync-banner ${colors[status]}`;
  banner.innerHTML = `
    <span class="banner-icon ${status === 'syncing' ? 'spinning' : ''}">${icons[status]}</span>
    <span>${messages[status]}</span>
    ${status !== 'syncing' && status !== 'demo' ? `<button class="banner-refresh-btn" id="banner-refresh-btn" title="Actualizar ahora">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
    </button>` : ''}
  `;

  const refreshBtn = document.getElementById('banner-refresh-btn');
  if (refreshBtn) {
    const csvUrl = (typeof SHEETS_CONFIG !== 'undefined') ? SHEETS_CONFIG.SHEETS_CSV_URL : '';
    if (csvUrl) {
      refreshBtn.addEventListener('click', () => refreshProducts(csvUrl));
    }
  }
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
  return `S/ ${price.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`;
}

function badgeHTML(badge) {
  if (!badge) return '';
  const labels = {
    new: 'Nuevo',
    hot: '🔥 Popular',
    sale: 'Oferta',
    stock: 'Disponible',
    agotado: 'Agotado',
    proximamente: 'Próximamente'
  };
  return `<span class="product-badge badge-${badge}">${labels[badge] || badge}</span>`;
}

function whatsappLink(product) {
  const msg = encodeURIComponent(
    `¡Hola! Estoy interesado/a en el producto:\n*${product.name}*\nPrecio: ${formatPrice(product.price)}\n¿Podría darme más información?`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

// ─── Ayudantes calculados ─────────────────────────────────────────
function getAllBrands() {
  return [...new Set(PRODUCTS.map(p => p.brand))].sort();
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

    return matchSearch && matchCat && matchBrand && matchPrice;
  });

  switch (state.sort) {
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'name': list.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  // Empujar los productos agotados automáticamente al final de la lista
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
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <h3>No encontramos productos</h3>
        <p>Intente cambiar los filtros o la búsqueda</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map((p, i) => `
    <article
      class="product-card ${p.badge === 'agotado' ? 'product-card-out-of-stock' : ''}"
      role="button"
      tabindex="0"
      aria-label="Ver detalle de ${p.name}"
      data-id="${p.id}"
      style="animation-delay: ${Math.min(i * 40, 400)}ms"
    >
      ${badgeHTML(p.badge)}
      <div class="product-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy" width="400" height="400"
          onerror="this.src='images/laptop.jpg'" />
        <div class="product-overlay">
          <button class="overlay-btn" tabindex="-1">Ver detalle</button>
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
          <a href="${whatsappLink(p)}" target="_blank" rel="noopener noreferrer"
            class="btn-whatsapp-card ${p.badge === 'agotado' ? 'btn-whatsapp-out-of-stock' : ''}" aria-label="Consultar por WhatsApp"
            onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            ${p.badge === 'agotado' ? 'Consultar Stock' : 'Consultar'}
          </a>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openModal(+card.dataset.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(+card.dataset.id); }
    });
  });
}

// ─── Renderizar Ofertas Especiales ──────────────────────────────────────────
function renderOffers() {
  const section = document.getElementById('offers-section');
  const grid = document.getElementById('offers-grid');
  if (!section || !grid) return;

  // Filtrar productos con badge 'sale' y que no estén agotados
  const offers = PRODUCTS.filter(p => p.badge === 'sale' && p.badge !== 'agotado').slice(0, 4);

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
      style="animation-delay: ${Math.min(i * 60, 400)}ms"
    >
      <span class="product-badge badge-sale">Oferta Especial</span>
      <div class="product-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy" width="400" height="400"
          onerror="this.src='images/laptop.jpg'" />
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
          <a href="${whatsappLink(p)}" target="_blank" rel="noopener noreferrer"
            class="btn-whatsapp-card" aria-label="Consultar por WhatsApp"
            onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Consultar Oferta
          </a>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openModal(+card.dataset.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(+card.dataset.id); }
    });
  });
}

// ─── Opciones de filtro de marca de renderizado ───────────────────────────────
function renderBrandFilters() {
  const container = document.getElementById('brand-filters');
  if (!container) return;

  const marcas = getAllBrands();
  const counts = {};
  PRODUCTS.forEach(p => { counts[p.brand] = (counts[p.brand] || 0) + 1; });

  container.innerHTML = marcas.map(b => `
    <label class="filter-option">
      <input type="checkbox" id="brand-${b.replace(/\s/g, '-')}" value="${b}"
        ${state.brands.has(b) ? 'checked' : ''} />
      <span class="filter-option-label">${b}</span>
      <span class="filter-option-count">${counts[b]}</span>
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

// ─── Modal ───────────────────────────────────────────────────
function openModal(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;

  const specsHTML = Object.entries(p.specs || {}).map(([k, v]) => `
    <div class="modal-spec-row">
      <span class="modal-spec-key">${k}</span>
      <span class="modal-spec-val">${v}</span>
    </div>
  `).join('');

  document.getElementById('modal-content').innerHTML = `
    <header class="modal-header">
      <div>
        <p class="modal-brand">${p.brand}</p>
        <p style="font-size:.8rem;color:var(--text-muted)">${(p.tags || []).join(' · ')}</p>
      </div>
      <button class="modal-close" id="modal-close-btn" aria-label="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </header>
    <div class="modal-body">
      <div class="modal-img-wrap">
        <img src="${p.image}" alt="${p.name}" onerror="this.src='images/laptop.jpg'" />
      </div>
      <div class="modal-info">
        <h2 class="modal-name">${p.name}</h2>
        <div class="modal-price-block">
          <span class="modal-price">${formatPrice(p.price)}</span>
          ${p.oldPrice ? `<span class="modal-price-old">${formatPrice(p.oldPrice)}</span>` : ''}
        </div>
        <p class="modal-description">${p.description}</p>
        ${specsHTML ? `<div>
          <p class="modal-specs-title">Especificaciones</p>
          <div class="modal-specs-list">${specsHTML}</div>
        </div>` : ''}
        <div class="modal-actions">
          <a href="${whatsappLink(p)}" target="_blank" rel="noopener noreferrer"
            class="btn-whatsapp-modal" id="modal-whatsapp-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Consultar por WhatsApp
          </a>
          <button class="btn-share-modal" id="modal-share-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Compartir producto
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-share-btn').addEventListener('click', () => {
    if (navigator.share) {
      navigator.share({ title: p.name, text: `${p.name} — ${formatPrice(p.price)}`, url: window.location.href });
    } else {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        const btn = document.getElementById('modal-share-btn');
        if (btn) btn.textContent = ' ✓ Enlace copiado';
      });
    }
  });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ─── Categoría pastillas ───────────────────────────────────────────
const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: '🛍️' },
  { id: 'laptops', label: 'Portátiles', icon: '💻' },
  { id: 'pcs', label: 'PCs', icon: '🖥️' },
  { id: 'celulares', label: 'Celulares', icon: '📱' },
  { id: 'tabletas', label: 'Tabletas', icon: '📟' },
  { id: 'periféricos', label: 'Periféricos', icon: '🖱️' },
  { id: 'impresoras', label: 'Impresoras', icon: '🖨️' },
  { id: 'componentes', label: 'Componentes', icon: '⚙️' },
  { id: 'accesorios', label: 'Accesorios', icon: '🎧' },
  { id: 'redes', label: 'Redes', icon: '📡' },
  { id: 'software', label: 'Software', icon: '💿' },
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
      renderProducts();
    });
  });
}

// ─── Inicializar ──────────────────────────────────────────────
function init() {
  // Buscar
  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  const doSearch = () => {
    state.search = searchInput.value.trim();
    renderProducts();
  };
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, 250);
    });
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  }
  
  const searchBtn = document.getElementById('search-btn');
  if (searchBtn) searchBtn.addEventListener('click', doSearch);

  // Ordenar
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      state.sort = e.target.value;
      renderProducts();
    });
  }

  // Filtro de precio
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

  // Borrar filtros
  const clearFiltersBtn = document.getElementById('btn-clear-filters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      state.search = '';
      state.category = 'all';
      state.brands = new Set();
      state.priceMin = 0;
      state.priceMax = Infinity;
      if (searchInput) searchInput.value = '';
      if (priceMinInput) priceMinInput.value = '';
      if (priceMaxInput) priceMaxInput.value = '';
      if (sortSelect) sortSelect.value = 'featured';
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

  // Cajón lateral para dispositivos móviles
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

  // Clic flotante de WhatsApp
  const whatsappFloat = document.getElementById('whatsapp-float');
  if (whatsappFloat) {
    whatsappFloat.addEventListener('click', () => {
      const msg = encodeURIComponent('¡Hola! Quisiera saber más sobre sus productos de tecnología. ¿Me pueden ayudar?');
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank', 'noopener,noreferrer');
    });
  }

  // Cargar productos
  loadProducts();
}

document.addEventListener('DOMContentLoaded', init);
// --- ANIMACIÓN DE CÍRCULOS FLOTANTES ("PECES" EN EL BANNER) ---
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('particulas-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particulas = [];
  const cantidadParticulas = 35; // Puedes aumentar o reducir la cantidad de círculos

  function redimensionarCanvas() {
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
  }
  redimensionarCanvas();
  window.addEventListener('resize', redimensionarCanvas);

  class Particula {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.radio = Math.random() * 4 + 2; // Tamaños variados como en tu logo
      this.opacidad = Math.random() * 0.5 + 0.3; // Semitransparentes
      this.vx = (Math.random() - 0.5) * 0.8; // Movimiento suave horizontal
      this.vy = (Math.random() - 0.5) * 0.8; // Movimiento suave vertical
    }

    actualizar() {
      this.x += this.vx;
      this.y += this.vy;

      // Rebotar en los bordes del recuadro
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

  for (let i = 0; i < cantidadParticulas; i++) {
    particulas.push(new Particula());
  }

  function animar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particulas.forEach(p => {
      p.actualizar();
      p.dibujar();
    });
    requestAnimationFrame(animar);
  }

  animar();
});
// ════════════════════════════════════════════════════════════
// SINCRONIZACIÓN Y FUNCIONALIDAD DEL BUSCADOR DEL BANNER (HERO)
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const mainSearchInput = document.getElementById('search-input');
  const heroSearchInput = document.getElementById('hero-search-input');
  const heroSearchBtn = document.getElementById('hero-search-btn');

  if (mainSearchInput && heroSearchInput) {
    // 1. Al escribir en el buscador del banner, sincroniza y ejecuta la búsqueda original
    heroSearchInput.addEventListener('input', (e) => {
      mainSearchInput.value = e.target.value;
      mainSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 2. Al hacer clic en el botón "Buscar" del banner
    if (heroSearchBtn) {
      heroSearchBtn.addEventListener('click', () => {
        mainSearchInput.value = heroSearchInput.value;
        mainSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
        // Desplaza suavemente al catálogo para ver los resultados
        document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // 3. Al escribir arriba en la navbar, actualiza también el buscador del banner
    mainSearchInput.addEventListener('input', (e) => {
      heroSearchInput.value = e.target.value;
    });
  }
});
