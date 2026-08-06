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

  grid.innerHTML = list.map((p, i) => `
    <article
      class="product-card ${p.badge === 'agotado' ? 'product-card-out-of-stock' : ''}"
      role="button"
      tabindex="0"
      aria-label="Ver detalle de ${p.name}"
      data-id="${p.id}"
      style="animation-delay: ${Math.min(i * 30, 300)}ms"
    >
      ${badgeHTML(p.badge, p.has3D)}
      <div class="product-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy" width="400" height="400"
          onerror="this.src='image/1000.jpg'" />
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
          <button class="btn-add-quote" onclick="event.stopPropagation(); addToQuotation('${p.id}'); openQuotationDrawer();" aria-label="Añadir a Cotización" title="Añadir a Cotización">
            📋 +Cotizar
          </button>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(card.dataset.id); }
    });
  });
}

// ─── Renderizar Ofertas Especiales ──────────────────────────────────────────
function renderOffers() {
  const section = document.getElementById('offers-section');
  const grid = document.getElementById('offers-grid');
  if (!section || !grid) return;

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
      ${badgeHTML('sale', p.has3D)}
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

// ─── Modal con Visualizador 3D <model-viewer> ───────────────────────────────
function openModal(id) {
  const p = PRODUCTS.find(x => String(x.id) === String(id));
  if (!p) return;

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

  document.getElementById('modal-content').innerHTML = `
    <header class="modal-header">
      <div>
        <p class="modal-brand">${p.brand}</p>
        <p style="font-size:.8rem;color:var(--text-muted)">${(p.tags || []).join(' · ')}</p>
      </div>
      <button class="modal-close" id="modal-close-btn" aria-label="Cerrar">&times;</button>
    </header>
    <div class="modal-body">
      ${visualHTML}
      <div class="modal-info">
        <h2 class="modal-name">${p.name}</h2>
        <div class="modal-price-block">
          <span class="modal-price">${formatPrice(p.price)}</span>
          <span style="font-size:0.78rem;color:var(--text-muted);margin-left:6px;">(IGV Incluido)</span>
          ${p.oldPrice ? `<span class="modal-price-old">${formatPrice(p.oldPrice)}</span>` : ''}
        </div>
        <p class="modal-description">${p.description}</p>
        ${specsHTML ? `<div>
          <p class="modal-specs-title">Especificaciones Técnicas</p>
          <div class="modal-specs-list">${specsHTML}</div>
        </div>` : ''}
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

  // Manejo de fallback si el archivo GLB falla
  const mv = document.getElementById('modal-model-viewer');
  if (mv) {
    mv.addEventListener('error', () => {
      console.warn(`Modelo 3D models/prod-${p.id}.glb no disponible. Cargando imagen de fallback.`);
      mv.style.display = 'none';
      const fallback = document.getElementById('modal-img-fallback');
      if (fallback) fallback.style.display = 'block';
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
  { id: 'all', label: 'Todos', icon: '🛍️' },
  { id: 'laptops', label: 'Laptops', icon: '💻' },
  { id: 'pcs', label: 'PCs de Escritorio', icon: '🖥️' },
  { id: 'celulares', label: 'Celulares', icon: '📱' },
  { id: 'componentes', label: 'Componentes', icon: '⚙️' },
  { id: 'impresoras', label: 'Impresoras', icon: '🖨️' },
  { id: 'monitores', label: 'Monitores', icon: '🖥️' },
  { id: 'redes', label: 'Redes', icon: '📡' },
  { id: 'software', label: 'Software', icon: '💿' },
  { id: 'perifericos', label: 'Periféricos', icon: '🖱️' },
  { id: 'almacenamiento', label: 'Almacenamiento', icon: '💾' },
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

// ═════════════════════════════════════════════════════════════
// INICIALIZACIÓN Y EVENT LISTENERS
// ═════════════════════════════════════════════════════════════
function init() {
  // Buscador
  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  const doSearch = () => {
    state.search = searchInput ? searchInput.value.trim() : '';
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

  // WhatsApp Float Click
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

// ─── Animación Círculos en Banner ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('particulas-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particulas = [];
  const cantidadParticulas = 35;

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

  for (let i = 0; i < cantidadParticulas; i++) {
    particulas.push(new Particula());
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
    heroSearchInput.addEventListener('input', (e) => {
      mainSearchInput.value = e.target.value;
      mainSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    if (heroSearchBtn) {
      heroSearchBtn.addEventListener('click', () => {
        mainSearchInput.value = heroSearchInput.value;
        mainSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    mainSearchInput.addEventListener('input', (e) => {
      heroSearchInput.value = e.target.value;
    });
  }
});
